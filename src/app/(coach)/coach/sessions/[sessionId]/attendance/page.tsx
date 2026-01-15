import { getSessionOrThrow } from '@/lib/auth';
import { attendanceDao, classesDao, materialsDao, sessionsDao, usersDao } from '@/lib/dao';
import { computeLessonSchedule, formatLessonTitle } from '@/lib/services/lessonScheduler';
import UploadMaterialForm from '@/app/(coach)/coach/classes/[id]/UploadMaterialForm';

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

  const [enrollments, classSessions, lessonScheduleMap, materials] = await Promise.all([
    classesDao.listEnrollmentsByClass(classRecord.id),
    sessionsDao.listSessionsByClass(classRecord.id),
    computeLessonSchedule(classRecord.id, classRecord.level_id),
    materialsDao.listMaterialsByClass(classRecord.id),
  ]);

  const attendanceRecords = classSessions.length
    ? await attendanceDao.listAttendanceForSessions(classSessions.map((item) => item.id))
    : [];

  const attendanceBySession = new Map<string, Map<string, { status: string; reason: string | null }>>();
  attendanceRecords.forEach((record) => {
    if (!attendanceBySession.has(record.session_id)) {
      attendanceBySession.set(record.session_id, new Map());
    }
    attendanceBySession
      .get(record.session_id)!
      .set(record.coder_id, { status: record.status, reason: record.reason ?? null });
  });

  const coders = await usersDao.getUsersByIds(enrollments.map((enrollment) => enrollment.coder_id));
  const coderMap = new Map(coders.map((coder) => [coder.id, coder.full_name]));

  const currentSessionMap =
    attendanceBySession.get(sessionRecord.id) ?? new Map<string, { status: string; reason: string | null }>();

  const attendees = enrollments.map((enrollment) => ({
    coderId: enrollment.coder_id,
    fullName: coderMap.get(enrollment.coder_id) ?? 'Coder',
    attendance: currentSessionMap.get(enrollment.coder_id)
      ? {
        coder_id: enrollment.coder_id,
        status: currentSessionMap.get(enrollment.coder_id)!.status as any,
        reason: currentSessionMap.get(enrollment.coder_id)!.reason,
      }
      : null,
  }));

  const currentLessonSlot = lessonScheduleMap.get(sessionRecord.id);
  const slideUrl = currentLessonSlot?.lessonTemplate.slide_url ?? null;
  const slideTitle = currentLessonSlot ? formatLessonTitle(currentLessonSlot) : null;
  const lessonSummary = currentLessonSlot?.lessonTemplate.summary ?? 'No summary available for this lesson.';

  const sessionMaterials = materials.filter((m) => m.session_id === sessionId);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* 1. Header with Lesson Title */}
      <header style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '1.5rem' }}>
        <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '0.25rem' }}>
          {classRecord.name} • {new Date(sessionRecord.date_time).toLocaleString('id-ID', { dateStyle: 'full', timeStyle: 'short' })}
        </p>
        <h1 style={{ fontSize: '1.8rem', fontWeight: 700, color: '#1e293b' }}>
          {slideTitle ?? 'Session Administration'}
        </h1>
        {currentLessonSlot && (
          <p style={{ marginTop: '0.5rem', color: '#475569', maxWidth: '800px' }}>
            {lessonSummary}
          </p>
        )}
      </header>

      {/* 2. Actions (Start Class, etc) */}
      <section>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '1rem', color: '#334155' }}>Actions</h2>
        <SessionActions
          sessionId={sessionRecord.id}
          zoomLink={sessionRecord.zoom_link_snapshot}
          canComplete={sessionRecord.status === 'SCHEDULED'}
          slideUrl={slideUrl}
          slideTitle={slideTitle ?? undefined}
        />
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', alignItems: 'start' }}>
        {/* 3. Attendance */}
        <section style={{ background: '#fff', borderRadius: '1rem', border: '1px solid #e2e8f0', padding: '1.5rem' }}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: '1.25rem' }}>Absensi Coder</h2>
          <AttendanceList sessionId={sessionRecord.id} attendees={attendees} />
        </section>

        {/* 4. Documentation / Materials */}
        <section style={{ background: '#fff', borderRadius: '1rem', border: '1px solid #e2e8f0', padding: '1.5rem' }}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: '0.5rem' }}>Dokumentasi & Laporan</h2>
          <p style={{ fontSize: '0.9rem', color: '#64748b', marginBottom: '1.25rem' }}>
            Upload foto kelas atau laporan sesi ini.
          </p>

          <UploadMaterialForm
            classId={classRecord.id}
            sessions={classSessions}
            defaultSessionId={sessionId}
          />

          <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {sessionMaterials.length === 0 ? (
              <p style={{ fontSize: '0.9rem', color: '#94a3b8', fontStyle: 'italic' }}>Belum ada dokumentasi untuk sesi ini.</p>
            ) : (
              sessionMaterials.map(m => (
                <div key={m.id} style={{ padding: '0.75rem', borderRadius: '0.5rem', background: '#f8fafc', border: '1px solid #f1f5f9' }}>
                  <div style={{ fontWeight: 500, fontSize: '0.95rem' }}>{m.title}</div>
                  {m.description && <div style={{ fontSize: '0.85rem', color: '#64748b' }}>{m.description}</div>}
                  {m.file_url && (
                    <a href={m.file_url} target="_blank" rel="noreferrer" style={{ fontSize: '0.85rem', color: '#1e3a5f', display: 'block', marginTop: '0.25rem' }}>
                      View File
                    </a>
                  )}
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
