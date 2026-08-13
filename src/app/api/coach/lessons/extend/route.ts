import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getSessionOrThrow } from '@/lib/auth';
import { classesDao, sessionsDao } from '@/lib/dao';
import { assertRole } from '@/lib/roles';
import { computeLessonSchedule, formatLessonTitle } from '@/lib/services/lessonScheduler';
import { extendClassLesson } from '@/lib/services/lessonExtension';

const schema = z.object({
  sessionId: z.string().uuid(),
  reason: z.string().trim().min(10).max(500),
});

function errorStatus(message: string): number {
  if (/sudah pernah|part terakhir|pertemuan setelahnya|hanya tersedia/i.test(message)) return 409;
  if (/tidak ditemukan|belum ada pertemuan/i.test(message)) return 404;
  return 500;
}

export async function POST(request: Request) {
  try {
    const auth = await getSessionOrThrow();
    await assertRole(auth, 'COACH');

    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Isi alasan perpanjangan minimal 10 karakter.' }, { status: 400 });
    }

    const sessionRecord = await sessionsDao.getSessionById(parsed.data.sessionId);
    if (!sessionRecord) {
      return NextResponse.json({ error: 'Sesi tidak ditemukan.' }, { status: 404 });
    }

    const classRecord = await classesDao.getClassById(sessionRecord.class_id);
    if (
      !classRecord
      || (classRecord.coach_id !== auth.user.id && sessionRecord.substitute_coach_id !== auth.user.id)
    ) {
      return NextResponse.json({ error: 'Sesi tidak ditemukan untuk coach ini.' }, { status: 404 });
    }
    if (classRecord.type !== 'WEEKLY' || !classRecord.level_id) {
      return NextResponse.json({ error: 'Perpanjangan lesson hanya tersedia untuk kelas weekly.' }, { status: 409 });
    }

    const classSessions = await sessionsDao.listSessionsByClass(classRecord.id);
    const schedule = await computeLessonSchedule(classRecord.id, classRecord.level_id);
    const slot = schedule.get(sessionRecord.id);
    if (!slot?.classLessonId || slot.partNumber !== slot.totalParts) {
      return NextResponse.json({ error: 'Lesson hanya dapat diperpanjang dari part terakhir.' }, { status: 409 });
    }

    const hasLaterCompletedSession = classSessions.some((item) => (
      item.status === 'COMPLETED'
      && new Date(item.date_time).getTime() > new Date(sessionRecord.date_time).getTime()
    ));
    if (hasLaterCompletedSession) {
      return NextResponse.json(
        { error: 'Lesson lama tidak dapat diperpanjang karena pertemuan setelahnya sudah selesai.' },
        { status: 409 },
      );
    }

    const result = await extendClassLesson({
      classId: classRecord.id,
      sessionId: sessionRecord.id,
      classLessonId: slot.classLessonId,
      actorId: auth.user.id,
      actorRole: 'COACH',
      actorName: auth.user.fullName,
      className: classRecord.name,
      lessonTitle: formatLessonTitle(slot),
      reason: parsed.data.reason,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Gagal memperpanjang lesson.';
    console.error('[LessonExtension] Coach extension failed', error);
    return NextResponse.json({ error: message }, { status: errorStatus(message) });
  }
}
