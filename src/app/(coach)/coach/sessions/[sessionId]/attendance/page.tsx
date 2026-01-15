import Link from 'next/link';
import { Calendar, Monitor, BookOpen } from 'lucide-react';
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
    return renderError('Session ID tidak valid', 'Parameter URL salah.');
  }

  const sessionRecord = await sessionsDao.getSessionById(sessionId);

  if (!sessionRecord) {
    return renderError('Sesi tidak ditemukan', 'Sesi ini mungkin sudah dihapus.');
  }

  const classRecord = await classesDao.getClassById(sessionRecord.class_id);
  if (!classRecord) {
    return renderError('Kelas tidak ditemukan', 'Data kelas hilang.');
  }

  if (classRecord.coach_id !== session.user.id && sessionRecord.substitute_coach_id !== session.user.id) {
    return renderError('Akses Ditolak', 'Anda bukan coach untuk sesi ini.');
  }

  const [enrollments, classSessions, lessonScheduleMap, materials] = await Promise.all([
    classesDao.listEnrollmentsByClass(classRecord.id, { includeInactive: true }),
    sessionsDao.listSessionsByClass(classRecord.id),
    computeLessonSchedule(
      classRecord.id,
      classRecord.level_id ?? null,
      (classRecord as any).ekskul_lesson_plan_id
    ),
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

  // Filter active coders only unless they have attendance record
  const attendees = enrollments
    .filter(e => e.status === 'ACTIVE' || currentSessionMap.has(e.coder_id))
    .map((enrollment) => ({
      coderId: enrollment.coder_id,
      fullName: coderMap.get(enrollment.coder_id) ?? 'Unknown Coder',
      attendance: currentSessionMap.get(enrollment.coder_id)
        ? {
          status: currentSessionMap.get(enrollment.coder_id)!.status as any,
          reason: currentSessionMap.get(enrollment.coder_id)!.reason,
        }
        : null,
    }));

  const currentLessonSlot = lessonScheduleMap.get(sessionRecord.id);
  const slideUrl = currentLessonSlot?.lessonTemplate.slide_url ?? null;
  const slideTitle = currentLessonSlot ? formatLessonTitle(currentLessonSlot) : null;
  const lessonSummary = currentLessonSlot?.lessonTemplate.summary ?? 'Tidak ada ringkasan materi.';

  const sessionMaterials = materials.filter((m) => m.session_id === sessionId);

  return (
    <div style={pageContainerStyle}>
      {/* 1. Header with Lesson Title */}
      <div style={{ marginBottom: '1rem' }}>
        <Link
          href={`/coach/classes/${classRecord.id}`}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: '#64748b', fontSize: '0.9rem', fontWeight: 600, textDecoration: 'none', marginBottom: '0.75rem' }}
        >
          ← Kembali ke Detail Kelas
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
          <span style={{ padding: '0.25rem 0.6rem', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 700, background: '#eff6ff', color: '#3b82f6', border: '1px solid #dbeafe' }}>SESSION</span>
          <span style={{ color: '#64748b', fontSize: '0.9rem', fontWeight: 500 }}>
            {new Date(sessionRecord.date_time).toLocaleString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
        <h1 style={{ fontSize: '2rem', fontWeight: 800, color: '#1e293b', margin: 0, letterSpacing: '-0.02em', lineHeight: 1.2 }}>
          {slideTitle ?? 'Administrasi Sesi'}
        </h1>
        {currentLessonSlot && (
          <p style={{ marginTop: '0.75rem', color: '#475569', fontSize: '1rem', lineHeight: 1.6, maxWidth: '800px' }}>
            <BookOpen size={16} style={{ display: 'inline', marginRight: '0.4rem', verticalAlign: 'text-bottom' }} />
            {lessonSummary}
          </p>
        )}
      </div>

      {/* 2. Actions (Start Class, etc) */}
      <section>
        <SessionActions
          sessionId={sessionRecord.id}
          zoomLink={sessionRecord.zoom_link_snapshot}
          canComplete={sessionRecord.status === 'SCHEDULED'}
          slideUrl={slideUrl}
          slideTitle={slideTitle ?? undefined}
        />
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '2rem', alignItems: 'start' }}>
        {/* 3. Attendance */}
        <section style={cardStyle}>
          <h2 style={sectionTitleStyle}>Absensi Coder</h2>
          <p style={{ fontSize: '0.9rem', color: '#64748b', marginTop: '0.25rem', marginBottom: '1.25rem' }}>
            Catat kehadiran siswa untuk sesi ini.
          </p>
          <AttendanceList sessionId={sessionRecord.id} attendees={attendees} />
        </section>

        {/* 4. Documentation / Materials */}
        <section style={cardStyle}>
          <h2 style={sectionTitleStyle}>Dokumentasi & Laporan</h2>
          <p style={{ fontSize: '0.9rem', color: '#64748b', marginBottom: '1.25rem', marginTop: '0.25rem' }}>
            Upload foto kelas atau laporan sesi untuk orang tua.
          </p>

          <div style={{ padding: '1.25rem', background: '#f8fafc', borderRadius: '12px', border: '1px dashed #cbd5e1', marginBottom: '1.5rem' }}>
            <UploadMaterialForm
              classId={classRecord.id}
              sessions={classSessions}
              defaultSessionId={sessionId}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#334155' }}>File Sesi Ini</h3>
            {sessionMaterials.length === 0 ? (
              <p style={{ fontSize: '0.9rem', color: '#94a3b8', fontStyle: 'italic' }}>Belum ada dokumentasi diupload.</p>
            ) : (
              sessionMaterials.map(m => (
                <div key={m.id} style={{ padding: '1rem', borderRadius: '12px', background: '#fff', border: '1px solid #e2e8f0', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                  <div style={{ fontWeight: 600, fontSize: '0.95rem', color: '#1e293b' }}>{m.title}</div>
                  {m.description && <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '0.2rem' }}>{m.description}</div>}
                  {m.file_url && (
                    <a href={m.file_url} target="_blank" rel="noreferrer" style={fileLinkStyle}>
                      📄 Buka File
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

function renderError(title: string, message: string) {
  return (
    <div style={{ padding: '4rem 2rem', textAlign: 'center', maxWidth: '600px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1e293b' }}>{title}</h1>
      <p style={{ color: '#64748b', marginTop: '0.5rem' }}>{message}</p>
      <Link href="/coach/dashboard" style={{ marginTop: '1.5rem', display: 'inline-block', color: '#3b82f6', fontWeight: 600 }}>← Kembali ke Dashboard</Link>
    </div>
  );
}

// Styles
const pageContainerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '2rem',
  maxWidth: '1200px',
  width: '100%',
  margin: '0 auto',
  padding: '0 1.5rem 3rem',
};

const cardStyle: React.CSSProperties = {
  background: '#ffffff',
  borderRadius: '16px',
  border: '1px solid #e2e8f0',
  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
  padding: '1.5rem',
  width: '100%',
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: '1.2rem',
  fontWeight: 700,
  color: '#1e293b',
  margin: 0
};

const fileLinkStyle: React.CSSProperties = {
  fontSize: '0.85rem',
  color: '#3b82f6',
  fontWeight: 600,
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.3rem',
  marginTop: '0.5rem',
  textDecoration: 'none'
};
