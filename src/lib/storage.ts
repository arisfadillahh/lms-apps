import { getSupabaseAdmin } from '@/lib/supabaseServer';

function getReportsBucket(): string {
  const bucket = process.env.STORAGE_BUCKET_REPORTS;
  if (!bucket) {
    throw new Error('Missing STORAGE_BUCKET_REPORTS');
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
