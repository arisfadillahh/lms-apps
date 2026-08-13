import 'server-only';

import { ensureFutureSessions } from '@/lib/dao/sessionsDao';
import { createAdminNotifications } from '@/lib/dao/notificationsDao';
import { getSupabaseAdmin } from '@/lib/supabaseServer';

type ExtendClassLessonResult = {
  addedClassLessonId: string;
  newPartNumber: number;
  targetSessionId: string;
  targetSessionAt: string;
};

export type ExtendClassLessonInput = {
  classId: string;
  sessionId: string;
  classLessonId: string;
  actorId: string;
  actorRole: 'COACH' | 'ADMIN';
  actorName: string;
  className: string;
  lessonTitle: string;
  reason: string;
};

function parseRpcResult(value: unknown): ExtendClassLessonResult {
  if (!value || typeof value !== 'object') {
    throw new Error('Hasil perpanjangan lesson tidak valid.');
  }

  const result = value as Partial<ExtendClassLessonResult>;
  if (
    typeof result.addedClassLessonId !== 'string'
    || typeof result.newPartNumber !== 'number'
    || typeof result.targetSessionId !== 'string'
    || typeof result.targetSessionAt !== 'string'
  ) {
    throw new Error('Hasil perpanjangan lesson tidak lengkap.');
  }

  return result as ExtendClassLessonResult;
}

async function notifyAdmins(input: ExtendClassLessonInput, result: ExtendClassLessonResult): Promise<void> {
  const targetDate = new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(result.targetSessionAt));
  const title = 'Lesson kelas diperpanjang';
  const message = `${input.actorName} menambah ${input.lessonTitle} menjadi Part ${result.newPartNumber} di ${input.className}. Sesi tambahan dijadwalkan ${targetDate} WIB. Alasan: ${input.reason}`;

  await createAdminNotifications({
    type: 'LESSON_EXTENSION',
    title,
    message,
    pushBody: `${input.className}: ${input.lessonTitle} ditambah menjadi Part ${result.newPartNumber}.`,
    pushUrl: `/admin/classes/${input.classId}`,
    pushTag: `lesson-extension-${result.addedClassLessonId}`,
  });
}

export async function extendClassLesson(input: ExtendClassLessonInput): Promise<ExtendClassLessonResult> {
  await ensureFutureSessions(input.classId, 16);

  const supabase = getSupabaseAdmin();
  const rpcClient = supabase as unknown as {
    rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string; code?: string } | null }>;
  };
  const { data, error } = await rpcClient.rpc('extend_class_lesson', {
    p_class_id: input.classId,
    p_source_session_id: input.sessionId,
    p_source_class_lesson_id: input.classLessonId,
    p_extended_by: input.actorId,
    p_extended_by_role: input.actorRole,
    p_reason: input.reason,
  });

  if (error) {
    throw new Error(error.message);
  }

  const result = parseRpcResult(data);
  try {
    await notifyAdmins(input, result);
  } catch (notificationError) {
    console.error('[LessonExtension] Extension succeeded but admin notification failed', notificationError);
  }

  return result;
}
