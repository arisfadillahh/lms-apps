import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const APPLY = process.argv.includes('--apply');
const rollbackArgument = process.argv.find((argument) => argument.startsWith('--rollback='));
const ROLLBACK_MANIFEST = rollbackArgument?.slice('--rollback='.length) || null;
const SOURCE_BUCKET = process.env.STORAGE_BUCKET_REPORTS?.trim();
const TARGET_BUCKET = process.env.STORAGE_BUCKET_ISSUE_REPORTS_PRIVATE?.trim() || 'issue-reports-private';
const BACKUP_ROOT = process.env.SECURITY_BACKUP_DIR?.trim() || '/root/lms/shared/security-backups';

function requiredEnvironment(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function getClient() {
  return createClient(
    requiredEnvironment('NEXT_PUBLIC_SUPABASE_URL'),
    requiredEnvironment('SUPABASE_SERVICE_ROLE_KEY'),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

async function ensurePrivateBucket(supabase) {
  const { data, error } = await supabase.storage.getBucket(TARGET_BUCKET);
  if (data?.public) throw new Error(`Target bucket ${TARGET_BUCKET} is public`);
  if (data) return;
  if (error && !/not found/i.test(error.message)) throw error;

  const { error: createError } = await supabase.storage.createBucket(TARGET_BUCKET, {
    public: false,
    fileSizeLimit: 5 * 1024 * 1024,
    allowedMimeTypes: ['image/png', 'image/jpeg', 'image/webp'],
  });
  if (createError && !/already exists/i.test(createError.message)) throw createError;
}

async function listLegacyRows(supabase) {
  const { data, error } = await supabase
    .from('issue_reports')
    .select('id,screenshot_storage_path,screenshot_url')
    .not('screenshot_storage_path', 'is', null);
  if (error) throw error;
  return (data || []).filter((row) => row.screenshot_storage_path);
}

async function downloadObject(supabase, bucket, storagePath) {
  const { data, error } = await supabase.storage.from(bucket).download(storagePath);
  if (error || !data) throw new Error(`Unable to download object from ${bucket}: ${error?.message || 'empty file'}`);
  return { buffer: Buffer.from(await data.arrayBuffer()), contentType: data.type || 'application/octet-stream' };
}

async function writeBackup(rows, objects) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDirectory = path.join(BACKUP_ROOT, `issue-screenshots-${stamp}`);
  await fs.mkdir(backupDirectory, { recursive: true, mode: 0o700 });
  await fs.chmod(backupDirectory, 0o700);

  const entries = [];
  for (const row of rows) {
    const object = objects.get(row.id);
    const backupFile = `${row.id}.bin`;
    await fs.writeFile(path.join(backupDirectory, backupFile), object.buffer, { mode: 0o600 });
    entries.push({
      id: row.id,
      storagePath: row.screenshot_storage_path,
      screenshotUrl: row.screenshot_url,
      backupFile,
      contentType: object.contentType,
      size: object.buffer.length,
    });
  }

  const manifest = {
    version: 1,
    createdAt: new Date().toISOString(),
    sourceBucket: SOURCE_BUCKET,
    targetBucket: TARGET_BUCKET,
    entries,
  };
  const manifestPath = path.join(backupDirectory, 'manifest.json');
  await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 });
  return { manifest, manifestPath, backupDirectory };
}

async function restoreFromManifest(supabase, manifestPath) {
  const absoluteManifest = path.resolve(manifestPath);
  const backupDirectory = path.dirname(absoluteManifest);
  const manifest = JSON.parse(await fs.readFile(absoluteManifest, 'utf8'));
  if (manifest.version !== 1 || !Array.isArray(manifest.entries)) throw new Error('Unsupported backup manifest');

  for (const entry of manifest.entries) {
    const buffer = await fs.readFile(path.join(backupDirectory, entry.backupFile));
    const { error: uploadError } = await supabase.storage
      .from(manifest.sourceBucket)
      .upload(entry.storagePath, buffer, { contentType: entry.contentType, upsert: true });
    if (uploadError) throw uploadError;

    const { error: updateError } = await supabase
      .from('issue_reports')
      .update({ screenshot_storage_path: entry.storagePath, screenshot_url: entry.screenshotUrl })
      .eq('id', entry.id);
    if (updateError) throw updateError;
  }

  const privatePaths = manifest.entries.map((entry) => entry.storagePath);
  if (privatePaths.length > 0) {
    const { error } = await supabase.storage.from(manifest.targetBucket).remove(privatePaths);
    if (error) throw error;
  }
  console.log(JSON.stringify({ mode: 'rollback', restored: manifest.entries.length, manifest: absoluteManifest }));
}

async function migrate(supabase) {
  if (!SOURCE_BUCKET) throw new Error('Missing STORAGE_BUCKET_REPORTS');
  const rows = await listLegacyRows(supabase);
  if (!APPLY) {
    console.log(JSON.stringify({ mode: 'dry-run', candidates: rows.length, sourceBucket: SOURCE_BUCKET, targetBucket: TARGET_BUCKET }));
    return;
  }
  if (rows.length === 0) {
    console.log(JSON.stringify({ mode: 'apply', migrated: 0 }));
    return;
  }

  await ensurePrivateBucket(supabase);
  const objects = new Map();
  for (const row of rows) objects.set(row.id, await downloadObject(supabase, SOURCE_BUCKET, row.screenshot_storage_path));
  const backup = await writeBackup(rows, objects);

  try {
    for (const row of rows) {
      const object = objects.get(row.id);
      const { error: uploadError } = await supabase.storage
        .from(TARGET_BUCKET)
        .upload(row.screenshot_storage_path, object.buffer, {
          contentType: object.contentType,
          cacheControl: '3600',
          upsert: true,
        });
      if (uploadError) throw uploadError;
      const verification = await downloadObject(supabase, TARGET_BUCKET, row.screenshot_storage_path);
      if (verification.buffer.length !== object.buffer.length) throw new Error('Private object verification failed');
    }

    for (const row of rows) {
      const { error } = await supabase.from('issue_reports').update({ screenshot_url: null }).eq('id', row.id);
      if (error) throw error;
    }

    const { error: removeError } = await supabase.storage
      .from(SOURCE_BUCKET)
      .remove(rows.map((row) => row.screenshot_storage_path));
    if (removeError) throw removeError;
  } catch (error) {
    await restoreFromManifest(supabase, backup.manifestPath);
    throw error;
  }

  console.log(JSON.stringify({ mode: 'apply', migrated: rows.length, manifest: backup.manifestPath }));
}

async function main() {
  if (APPLY && ROLLBACK_MANIFEST) throw new Error('Choose either --apply or --rollback=<manifest>');
  const supabase = getClient();
  if (ROLLBACK_MANIFEST) await restoreFromManifest(supabase, ROLLBACK_MANIFEST);
  else await migrate(supabase);
}

main().catch((error) => {
  const message = error instanceof Error
    ? error.message
    : typeof error === 'object' && error && 'message' in error
      ? String(error.message)
      : JSON.stringify(error);
  console.error(message);
  process.exit(1);
});
