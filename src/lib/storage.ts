import { getSupabaseAdmin } from '@/lib/supabaseServer';

function getReportsBucket(): string {
  const bucket = process.env.STORAGE_BUCKET_REPORTS;
  if (!bucket) {
    throw new Error('Missing STORAGE_BUCKET_REPORTS');
  }
  return bucket;
}

function getIssueReportsBucket(): string {
  return process.env.STORAGE_BUCKET_ISSUE_REPORTS_PRIVATE?.trim() || 'issue-reports-private';
}

async function ensurePrivateIssueReportsBucket(): Promise<string> {
  const supabase = getSupabaseAdmin();
  const bucket = getIssueReportsBucket();
  const { data, error } = await supabase.storage.getBucket(bucket);
  if (data && !data.public) return bucket;
  if (data?.public) {
    throw new Error(`Issue screenshot bucket ${bucket} must be private`);
  }
  if (error && !/not found/i.test(error.message)) {
    throw new Error(`Failed to inspect issue screenshot bucket: ${error.message}`);
  }
  const { error: createError } = await supabase.storage.createBucket(bucket, {
    public: false,
    fileSizeLimit: 5 * 1024 * 1024,
    allowedMimeTypes: ['image/png', 'image/jpeg', 'image/webp'],
  });
  if (createError && !/already exists/i.test(createError.message)) {
    throw new Error(`Failed to create private issue screenshot bucket: ${createError.message}`);
  }
  return bucket;
}

export async function uploadReportPdf(storagePath: string, fileBuffer: Buffer): Promise<string> {
  const supabase = getSupabaseAdmin();
  const bucket = getReportsBucket();

  const { error } = await supabase.storage.from(bucket).upload(storagePath, fileBuffer, {
    cacheControl: '3600',
    contentType: 'application/pdf',
    upsert: true,
  });

  if (error) {
    throw new Error(`Failed to upload report PDF: ${error.message}`);
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(storagePath);
  if (!data?.publicUrl) {
    throw new Error('Failed to resolve public URL for report PDF');
  }

  return data.publicUrl;
}

export async function uploadIssueScreenshot(
  storagePath: string,
  fileBuffer: Buffer,
  contentType: string,
): Promise<void> {
  const supabase = getSupabaseAdmin();
  const bucket = await ensurePrivateIssueReportsBucket();

  const { error } = await supabase.storage.from(bucket).upload(storagePath, fileBuffer, {
    cacheControl: '3600',
    contentType,
    upsert: false,
  });

  if (error) {
    throw new Error(`Failed to upload issue screenshot: ${error.message}`);
  }

}

export async function createIssueScreenshotViewUrl(storagePath: string): Promise<string | null> {
  if (!storagePath) return null;
  const supabase = getSupabaseAdmin();
  const bucket = await ensurePrivateIssueReportsBucket();
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(storagePath, 60 * 60);
  if (error) {
    console.warn('[IssueReport] Failed to create screenshot signed URL', error.message);
    return null;
  }
  return data?.signedUrl || null;
}

function getLessonExamplesBucket(): string {
  const bucket = process.env.STORAGE_BUCKET_LESSON_EXAMPLES;
  if (!bucket) {
    throw new Error('Missing STORAGE_BUCKET_LESSON_EXAMPLES');
  }
  return bucket;
}

export async function uploadLessonExample(storagePath: string, fileBuffer: Buffer, contentType: string): Promise<string> {
  const supabase = getSupabaseAdmin();
  const bucket = getLessonExamplesBucket();

  const { error } = await supabase.storage.from(bucket).upload(storagePath, fileBuffer, {
    cacheControl: '3600',
    contentType,
    upsert: true,
  });

  if (error) {
    throw new Error(`Failed to upload lesson example: ${error.message}`);
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(storagePath);
  if (!data?.publicUrl) {
    throw new Error('Failed to resolve public URL for lesson example');
  }

  return data.publicUrl;
}

export async function deleteLessonExample(storagePath: string): Promise<void> {
  if (!storagePath) {
    return;
  }
  const supabase = getSupabaseAdmin();
  const bucket = getLessonExamplesBucket();
  const { error } = await supabase.storage.from(bucket).remove([storagePath]);
  if (error) {
    throw new Error(`Failed to delete lesson example: ${error.message}`);
  }
}

export async function uploadPortfolioScreenshot(
  storagePath: string,
  fileBuffer: Buffer,
  contentType: string,
): Promise<string> {
  const supabase = getSupabaseAdmin();
  const bucket = getReportsBucket();
  const { error } = await supabase.storage.from(bucket).upload(storagePath, fileBuffer, {
    cacheControl: '3600',
    contentType,
    upsert: false,
  });

  if (error) {
    throw new Error(`Failed to upload portfolio screenshot: ${error.message}`);
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(storagePath);
  if (!data?.publicUrl) {
    throw new Error('Failed to resolve portfolio screenshot URL');
  }
  return data.publicUrl;
}

export async function deletePortfolioScreenshots(storagePaths: string[]): Promise<void> {
  if (storagePaths.length === 0) return;
  const supabase = getSupabaseAdmin();
  const bucket = getReportsBucket();
  const { error } = await supabase.storage.from(bucket).remove(storagePaths);
  if (error) {
    throw new Error(`Failed to delete portfolio screenshots: ${error.message}`);
  }
}
