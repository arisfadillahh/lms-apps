import { getSessionOrThrow } from '@/lib/auth';
import { attendanceDao, classesDao, classLessonsDao, sessionsDao, usersDao } from '@/lib/dao';

import AttendanceList from './AttendanceList';
import SessionActions from './SessionActions';

type PageProps = {
  params: Promise<{ sessionId: string }>;
};

function isValidUuid(value: string): boolean {
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(value);
}

export default async function SessionAttendancePage({ params }: PageProps) {
  const session = await getSessionOrThrow();
  const resolvedParams = await params;
  const rawSessionId = resolvedParams.sessionId ?? '';
  const sessionId = decodeURIComponent(rawSessionId).trim();

  if (!sessionId || !isValidUuid(sessionId)) {
    return (
      <div>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 600 }}>Invalid session</h1>
        <p style={{ color: '#64748b' }}>Parameter session tidak valid.</p>
      </div>
    );
  }

  const sessionRecord = await sessionsDao.getSessionById(sessionId);

  if (!sessionRecord) {
    return (
      <div>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 600 }}>Session not found</h1>
      </div>
    );
  }

  const classRecord = await classesDao.getClassById(sessionRecord.class_id);
  if (!classRecord) {
    return (
      <div>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 600 }}>Class not found</h1>
      </div>
    );
  }

  if (classRecord.coach_id !== session.user.id && sessionRecord.substitute_coach_id !== session.user.id) {
    return (
      <div>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 600 }}>Unauthorized</h1>
        <p style={{ color: '#64748b' }}>You are not assigned to this session.</p>
      </div>
    );
  }

  const [enrollments, classSessions, classLesson] = await Promise.all([
    classesDao.listEnrollmentsByClass(classRecord.id),
    sessionsDao.listSessionsByClass(classRecord.id),
    classLessonsDao.getClassLessonBySession(sessionRecord.id),
  ]);

  const attendanceRecords = classSessions.length
    ? await attendanceDao.listAttendanceForSessions(classSessions.map((item) => item.id))
    : [];

  const attendanceBySession = new Map<string, Map<string, string>>();
  attendanceRecords.forEach((record) => {
    if (!attendanceBySession.has(record.session_id)) {
      attendanceBySession.set(record.session_id, new Map());
    }
    attendanceBySession.get(record.session_id)!.set(record.coder_id, record.status);
  });

  const coders = await usersDao.getUsersByIds(enrollments.map((enrollment) => enrollment.coder_id));
  const coderMap = new Map(coders.map((coder) => [coder.id, coder.full_name]));

  const currentSessionMap = attendanceBySession.get(sessionRecord.id) ?? new Map<string, string>();

  const attendees = enrollments.map((enrollment) => ({
    coderId: enrollment.coder_id,
    fullName: coderMap.get(enrollment.coder_id) ?? 'Coder',
    attendance: currentSessionMap.get(enrollment.coder_id)
      ? {
          coder_id: enrollment.coder_id,
          status: currentSessionMap.get(enrollment.coder_id) as 'PRESENT' | 'LATE' | 'EXCUSED' | 'ABSENT',
        }
      : null,
  }));

  const slideUrl = classLesson?.slide_url ?? classLesson?.coach_example_url ?? null;
  const slideTitle = classLesson?.title ?? null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      <header>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 600 }}>Administrasi Sesi</h1>
        <p style={{ color: '#64748b' }}>
          {classRecord.name} • {new Date(sessionRecord.date_time).toLocaleString()}
        </p>
      </header>

      <SessionActions
        sessionId={sessionRecord.id}
        zoomLink={sessionRecord.zoom_link_snapshot}
        canComplete={sessionRecord.status === 'SCHEDULED'}
        slideUrl={slideUrl}
        slideTitle={slideTitle ?? undefined}
      />

      <section>
        <h2 style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: '0.75rem' }}>Absensi coder</h2>
        <AttendanceList sessionId={sessionRecord.id} attendees={attendees} />
      </section>
    </div>
  );
}
