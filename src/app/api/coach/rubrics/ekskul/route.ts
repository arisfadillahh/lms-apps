import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getSessionOrThrow } from '@/lib/auth';
import { attendanceDao, classesDao, rubricsDao, sessionsDao, usersDao } from '@/lib/dao';
import { generateRubricPdf } from '@/lib/pdf/generateRubricPdf';
import { assertRole } from '@/lib/roles';
import { generateNarrative } from '@/lib/rubrics/narrative';
import { computeLessonSchedule } from '@/lib/services/lessonScheduler';

type CompetencyMap = Record<
  string,
  {
    label: string;
    descriptions?: Record<'A' | 'B' | 'C', string>;
  }
>;

const ekskulSchema = z.object({
  classId: z.string().uuid(),
  semesterTag: z.string().min(1),
  coderId: z.string().uuid(),
  grades: z.record(z.string(), z.enum(['A', 'B', 'C'])),
  positiveCharacters: z
    .array(z.string())
    .length(3, 'Positive characters must contain exactly 3 selections'),
});

export async function POST(request: Request) {
  const session = await getSessionOrThrow();
  const coachSession = await assertRole(session, 'COACH');

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = ekskulSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  const { classId, semesterTag, coderId, grades, positiveCharacters } = parsed.data;
  const classRecord = await classesDao.getClassById(classId);
  if (!classRecord) {
    return NextResponse.json({ error: 'Class not found' }, { status: 404 });
  }

  if (classRecord.coach_id !== coachSession.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (classRecord.type !== 'EKSKUL') {
    return NextResponse.json({ error: 'Ekskul rubric only for EKSKUL classes' }, { status: 400 });
  }

  const activeEnrollments = (await classesDao.listEnrollmentsByClass(classId)).filter(
    (enrollment) => enrollment.status === 'ACTIVE',
  );
  if (!activeEnrollments.some((enrollment) => enrollment.coder_id === coderId)) {
    return NextResponse.json({ error: 'Coder tidak terdaftar aktif di kelas ini' }, { status: 403 });
  }

  const [classSessions, lessonSchedule] = await Promise.all([
    sessionsDao.listSessionsByClass(classId),
    computeLessonSchedule(
      classId,
      classRecord.level_id ?? null,
      (classRecord as { ekskul_lesson_plan_id?: string | null }).ekskul_lesson_plan_id,
    ),
  ]);
  const requiredLessonSessions = classSessions
    .filter((item) => item.status !== 'CANCELLED' && lessonSchedule.has(item.id))
    .sort((a, b) => new Date(a.date_time).getTime() - new Date(b.date_time).getTime());

  if (requiredLessonSessions.length === 0) {
    return NextResponse.json({ error: 'Lesson ekskul belum terjadwal' }, { status: 409 });
  }

  const incompleteSessions = requiredLessonSessions.filter((item) => item.status !== 'COMPLETED');
  if (incompleteSessions.length > 0) {
    return NextResponse.json(
      { error: `Selesaikan ${incompleteSessions.length} lesson ekskul dulu sebelum membuat rapor.` },
      { status: 409 },
    );
  }

  const attendanceRecords = await attendanceDao.listAttendanceForSessions(requiredLessonSessions.map((item) => item.id));
  const attendedSessionIds = new Set(
    attendanceRecords.filter((record) => record.coder_id === coderId).map((record) => record.session_id),
  );
  const missingAttendanceCount = requiredLessonSessions.filter((item) => !attendedSessionIds.has(item.id)).length;
  if (missingAttendanceCount > 0) {
    return NextResponse.json(
      { error: `Lengkapi presensi ${missingAttendanceCount} lesson ekskul untuk coder ini sebelum memberi nilai.` },
      { status: 409 },
    );
  }

  const template = await rubricsDao.findRubricTemplate('EKSKUL', classRecord.level_id ?? null);
  if (!template) {
    return NextResponse.json({ error: 'Rubric template not configured for this class' }, { status: 400 });
  }

  const allowedCharacters = new Set((template.positive_characters as string[]) ?? []);
  const filteredCharacters = positiveCharacters.filter((character) => allowedCharacters.has(character));

  const coder = await usersDao.getUserById(coderId);
  if (!coder) {
    return NextResponse.json({ error: 'Coder not found' }, { status: 404 });
  }

  const competencies = (template.competencies as unknown as CompetencyMap) ?? {};
  const gradePayload: Record<string, string> = Object.fromEntries(
    Object.entries(grades).map(([key, value]) => [key, value]),
  );

  const narrative = generateNarrative({
    coderName: coder.full_name,
    className: classRecord.name,
    competencies,
    grades: gradePayload,
    positiveCharacters: filteredCharacters,
  });

  const submission = await rubricsDao.submitRubric({
    classId,
    coderId,
    rubricTemplateId: template.id,
    grades: gradePayload,
    positiveCharacters: filteredCharacters,
    narrative,
    submittedBy: coachSession.user.id,
    status: 'FINAL',
    semesterTag,
  });

  try {
    const generated = await generateRubricPdf(submission.id);
    return NextResponse.json({ submission, report: generated.report, pdfUrl: generated.pdfUrl });
  } catch (error) {
    console.error('Failed to generate ekskul report PDF', error);
    return NextResponse.json(
      {
        error: 'Nilai tersimpan, tapi PDF rapor gagal dibuat. Coba generate ulang dari admin.',
        submission,
      },
      { status: 500 },
    );
  }
}
