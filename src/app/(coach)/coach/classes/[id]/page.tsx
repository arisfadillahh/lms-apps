import type { CSSProperties } from 'react';
import Link from 'next/link';
import { format, isSameDay } from 'date-fns';

import { getSessionOrThrow } from '@/lib/auth';
import { attendanceDao, classesDao, materialsDao, sessionsDao, usersDao } from '@/lib/dao';
import { computeLessonSchedule, formatLessonTitle, getLessonSlotsForLevel } from '@/lib/services/lessonScheduler';
import UploadMaterialForm from './UploadMaterialForm';
import LessonPlanSection from './LessonPlanSection';
import LessonScheduleTable from '@/components/coach/LessonScheduleTable';
import CalendarModal from '@/components/coach/CalendarModal';

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ month?: string }>;
};

export default async function CoachClassPage({ params, searchParams }: PageProps) {
  const session = await getSessionOrThrow();
  const resolvedParams = await params;
  const resolvedSearch = await searchParams;
  const rawId = resolvedParams.id ?? '';
  const classIdParam = decodeURIComponent(rawId).trim();

  if (!classIdParam || classIdParam === 'undefined' || classIdParam === 'null') {
    return renderInvalidClassMessage(classIdParam);
  }

  if (!isValidUuid(classIdParam)) {
    return renderInvalidClassMessage(classIdParam);
  }

  // Ensure future sessions exist (Rolling 12 sessions)
  await sessionsDao.ensureFutureSessions(classIdParam);

  const [classRecord, sessions, enrollments, materials] = await Promise.all([
    classesDao.getClassById(classIdParam),
    sessionsDao.listSessionsByClass(classIdParam),
    classesDao.listEnrollmentsByClass(classIdParam),
    materialsDao.listMaterialsByClass(classIdParam),
  ]);

  // Use computed lesson schedule instead of class_lessons
  const lessonScheduleMap = await computeLessonSchedule(classIdParam, classRecord?.level_id ?? null);

  // Get all lesson slots for display purposes
  const allLessonSlots = classRecord?.level_id
    ? await getLessonSlotsForLevel(classRecord.level_id)
    : [];

  if (!classRecord || classRecord.coach_id !== session.user.id) {
    return (
      <div>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 600 }}>Class not found</h1>
        <p style={{ color: '#64748b' }}>You are not assigned to this class.</p>
      </div>
    );
  }

  const coderIds = enrollments.map((enrollment) => enrollment.coder_id);
  const coders = await usersDao.getUsersByIds(coderIds);
  const coderNameMap = new Map(coders.map((coder) => [coder.id, coder.full_name]));

  const now = new Date();
  const sortedSessions = [...sessions].sort(
    (a, b) => new Date(a.date_time).getTime() - new Date(b.date_time).getTime(),
  );
  const upcomingSessions = sortedSessions.filter((sessionItem) => new Date(sessionItem.date_time) >= now);
  const nextSession = upcomingSessions[0] ?? null;
  const sessionToday = sortedSessions.find((sessionItem) => isSameDay(new Date(sessionItem.date_time), now));

  // Build lessons array for LessonScheduleTable using computed schedule
  const computedLessonsForTable = sortedSessions.map((sessionItem) => {
    const slot = lessonScheduleMap.get(sessionItem.id);
    if (!slot) return null;
    return {
      id: slot.lessonTemplate.id,
      title: formatLessonTitle(slot),
      session_id: sessionItem.id,
      slide_url: slot.lessonTemplate.slide_url,
      coach_example_url: slot.lessonTemplate.example_url,
      block_title: slot.block.name,
    };
  }).filter((l): l is NonNullable<typeof l> => l !== null);

  // Helper to generate unique ID for lesson slots (handles multi-part lessons)
  const getSlotId = (slot: { lessonTemplate: { id: string }, partNumber: number }) =>
    `${slot.lessonTemplate.id}-${slot.partNumber}`;

  // For legacy LessonPlanSection - only show lessons that have scheduled sessions
  const blockLessons = computedLessonsForTable.length > 0 ? [{
    block: {
      id: 'scheduled',
      block_name: 'Jadwal Lesson',
      status: 'CURRENT' as const,
      start_date: classRecord?.start_date ?? null,
      end_date: classRecord?.end_date ?? null,
    },
    lessons: computedLessonsForTable.map((lesson, index) => ({
      lesson: {
        id: lesson.id,
        title: lesson.title,
        order_index: index,
        session_id: lesson.session_id,
        slide_url: lesson.slide_url,
        coach_example_url: lesson.coach_example_url,
      },
      template: null,
    })),
  }] : [];

  // Current/Next lesson logic
  const currentLesson = sessionToday ? lessonScheduleMap.get(sessionToday.id) : null;
  const nextLesson = nextSession ? lessonScheduleMap.get(nextSession.id) : null;

  const currentLessonId = currentLesson ? getSlotId(currentLesson) : null;
  const nextLessonId = nextLesson ? getSlotId(nextLesson) : (allLessonSlots[0] ? getSlotId(allLessonSlots[0]) : null);


  /* Attendance Records Logic */
  const attendanceRecords = sortedSessions.length
    ? await attendanceDao.listAttendanceForSessions(sortedSessions.map((sessionItem) => sessionItem.id))
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

  const attendanceSummaryRows = enrollments.map((enrollment) => {
    const statuses = sortedSessions.map((sessionItem) => {
      return attendanceBySession.get(sessionItem.id)?.get(enrollment.coder_id) ?? null;
    });
    return {
      fullName: coderNameMap.get(enrollment.coder_id) ?? 'Coder',
      statuses,
    };
  });


  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '2rem',
        maxWidth: '1200px',
        width: '100%',
        margin: '0 auto',
        padding: '0 1.25rem 2.5rem',
      }}
    >
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 600 }}>{classRecord.name}</h1>
          <p style={{ color: '#64748b' }}>
            {classRecord.type} • {classRecord.schedule_day} @ {classRecord.schedule_time}
          </p>
        </div>
      </header>

      {/* ... (Skipping Section 1 & 2 for brevity in replacement if possible, but safer to replace whole block if overlaps) */}
      {/* Re-writing the render part to ensure context matches */}

      <section style={cardStyle}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 600 }}>Upcoming Session</h2>
            <CalendarModal sessions={sortedSessions}>
              <button style={{
                color: '#2563eb',
                fontWeight: 600,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
                fontSize: 'inherit'
              }}>
                📅 Buka kalender
              </button>
            </CalendarModal>
          </div>
          {sessionToday ? (
            <p style={{ color: '#2563eb', fontWeight: 600 }}>
              Ada sesi hari ini pada {new Date(sessionToday.date_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
          ) : null}
          {nextSession ? (
            nextSession.status === 'CANCELLED' ? (
              <div
                style={{
                  border: '1px solid #e2e8f0',
                  borderRadius: 'var(--radius-lg)',
                  padding: '1rem 1.25rem',
                  background: '#f1f5f9',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '1rem',
                  opacity: 0.6,
                  cursor: 'not-allowed',
                }}
              >
                <div>
                  <p style={{ fontSize: '0.9rem', color: '#64748b' }}>Sesi berikutnya</p>
                  <strong style={{ fontSize: '1.05rem', color: '#0f172a' }}>
                    {new Date(nextSession.date_time).toLocaleString()}
                  </strong>
                  <p style={{ fontSize: '0.85rem', color: '#475569', marginTop: '0.35rem' }}>
                    Status: <StatusBadge status={nextSession.status} />
                  </p>
                </div>
                <span style={{ color: '#94a3b8', fontWeight: 600 }}>Sesi Dibatalkan</span>
              </div>
            ) : (
              <Link
                href={`/coach/sessions/${nextSession.id}/attendance`}
                scroll={false}
                style={{
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '1rem 1.25rem',
                  background: 'rgba(37, 99, 235, 0.05)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '1rem',
                  textDecoration: 'none',
                }}
              >
                <div>
                  <p style={{ fontSize: '0.9rem', color: '#64748b' }}>Sesi berikutnya</p>
                  <strong style={{ fontSize: '1.05rem', color: '#0f172a' }}>
                    {new Date(nextSession.date_time).toLocaleString()}
                  </strong>
                  <p style={{ fontSize: '0.85rem', color: '#475569', marginTop: '0.35rem' }}>
                    Status: <StatusBadge status={nextSession.status} />
                  </p>
                </div>
                <span style={{ color: '#2563eb', fontWeight: 600 }}>Open Administration →</span>
              </Link>
            )
          ) : (
            <p style={{ color: '#64748b' }}>Belum ada sesi mendatang.</p>
          )}
        </div>
      </section>

      {/* New Table View */}
      <LessonScheduleTable sessions={sortedSessions} lessons={computedLessonsForTable} />

      <section style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
          <div>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 600 }}>Materi Kurikulum</h2>
            <p style={{ color: '#64748b', fontSize: '0.9rem' }}>Slide deck pembelajaran dan contoh game.</p>
          </div>
        </div>
        <LessonPlanSection
          blockLessons={blockLessons as any}
          currentLessonId={currentLessonId}
          nextLessonId={nextLessonId}
        />
      </section>

      {/* RECAP ATTENDANCE below */}
      {sortedSessions.length > 0 ? (
        <section style={cardStyle}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: '1rem' }}>Rekap Kehadiran</h2>
          <div style={recapWrapperStyle}>
            <table style={recapTableStyle}>
              <thead>
                <tr>
                  <th style={recapNameHeaderStyle}>Nama</th>
                  {sortedSessions.map((sessionItem) => (
                    <th key={sessionItem.id} style={recapDateHeaderStyle}>
                      <div>{format(new Date(sessionItem.date_time), 'dd MMM')}</div>
                      <small style={{ color: 'var(--color-text-muted)' }}>
                        {format(new Date(sessionItem.date_time), 'EEE')}
                      </small>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {attendanceSummaryRows.map((row) => (
                  <tr key={row.fullName}>
                    <td style={recapNameCellStyle}>{row.fullName}</td>
                    {row.statuses.map((status, index) => {
                      if (!status) {
                        return (
                          <td key={`${row.fullName}-${index}`} style={recapCellStyle}>
                            —
                          </td>
                        );
                      }
                      if (status.status === 'PRESENT' || status.status === 'LATE') {
                        return (
                          <td key={`${row.fullName}-${index}`} style={{ ...recapCellStyle, color: 'var(--color-success)' }}>
                            ✓
                          </td>
                        );
                      }
                      if (status.status === 'EXCUSED') {
                        return (
                          <td key={`${row.fullName}-${index}`} style={{ ...recapCellStyle, color: 'var(--color-accent)' }}>
                            E{status.reason ? ` (${status.reason})` : ''}
                          </td>
                        );
                      }
                      return (
                        <td key={`${row.fullName}-${index}`} style={{ ...recapCellStyle, color: 'var(--color-danger)' }}>
                          ×{status.reason ? ` (${status.reason})` : ''}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <section style={cardStyle}>
        <h2 style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: '1rem' }}>Enrolled Coders</h2>
        <ul style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
          {enrollments.length === 0 ? (
            <li style={{ color: '#6b7280' }}>No coders enrolled.</li>
          ) : (
            enrollments.map((enrollment) => (
              <li key={enrollment.id} style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '0.75rem' }}>
                {coderNameMap.get(enrollment.coder_id) ?? 'Coder'}
              </li>
            ))
          )}
        </ul>
      </section>

      <section style={cardStyle}>
        <h2 style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: '1rem' }}>Materials</h2>
        <UploadMaterialForm classId={classIdParam} sessions={sessions} />
        <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {materials.length === 0 ? (
            <p style={{ color: '#6b7280' }}>No materials uploaded yet.</p>
          ) : (
            materials.map((material) => (
              <div
                key={material.id}
                style={{ border: '1px solid #e2e8f0', borderRadius: '0.75rem', padding: '1rem', background: '#f8fafc' }}
              >
                <strong style={{ fontSize: '1rem', color: '#0f172a' }}>{material.title}</strong>
                {material.description ? <p style={{ color: '#475569', marginTop: '0.25rem' }}>{material.description}</p> : null}
                {material.file_url ? (
                  <a
                    href={material.file_url}
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: '#2563eb', fontSize: '0.9rem' }}
                  >
                    Open file
                  </a>
                ) : null}
                {material.coach_note ? (
                  <p style={{ fontSize: '0.85rem', color: '#6b7280', marginTop: '0.25rem' }}>Coach note: {material.coach_note}</p>
                ) : null}
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

function renderInvalidClassMessage(value = '') {
  console.warn('[CoachClassPage] Invalid class id parameter:', value);
  return (
    <div style={{ padding: '2rem', background: '#ffffff', borderRadius: '0.75rem', border: '1px solid #e5e7eb' }}>
      <h1 style={{ fontSize: '1.4rem', fontWeight: 600, marginBottom: '0.5rem' }}>Kelas tidak ditemukan</h1>
      <p style={{ color: '#64748b' }}>
        Parameter ID kelas tidak valid{value ? `: "${value}"` : ''}. Silakan kembali ke dashboard coach dan pilih kelas ulang.
      </p>
    </div>
  );
}

function isValidUuid(value: string): boolean {
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(value);
}

function formatDate(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleDateString();
}

const cardStyle: CSSProperties = {
  background: 'var(--color-bg-surface)',
  width: '100%',
  borderRadius: 'var(--radius-lg)',
  border: '1px solid var(--color-border)',
  padding: '1.25rem 1.5rem',
  overflowX: 'auto',
  boxShadow: 'var(--shadow-medium)',
};

const calendarLegendStyle: CSSProperties = {
  display: 'flex',
  gap: '1.5rem',
  fontSize: '0.85rem',
  color: 'var(--color-text-muted)',
  marginBottom: '1rem',
  flexWrap: 'wrap',
  alignItems: 'center',
};

const calendarGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(7, minmax(120px, 1fr))',
  gap: '0.75rem',
  minWidth: '840px',
};

const calendarScrollContainerStyle: CSSProperties = {
  overflowX: 'auto',
  paddingBottom: '0.5rem',
};

const calendarDayHeaderStyle: CSSProperties = {
  textAlign: 'center',
  fontSize: '0.85rem',
  fontWeight: 600,
  color: 'var(--color-text-secondary)',
};

const calendarCellStyle: CSSProperties = {
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-lg)',
  padding: '0.75rem',
  minHeight: '150px',
  background: 'var(--color-bg-surface)',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.5rem',
  transition: 'background 0.2s ease',
};

const calendarSessionCardStyle: CSSProperties = {
  border: '1px solid rgba(37, 99, 235, 0.2)',
  borderRadius: 'var(--radius-md)',
  padding: '0.55rem 0.65rem',
  background: 'rgba(37, 99, 235, 0.05)',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.35rem',
  textDecoration: 'none',
};

const calendarNavButtonStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '0.45rem 0.8rem',
  borderRadius: '0.5rem',
  border: '1px solid var(--color-border)',
  background: 'var(--color-bg-surface)',
  color: 'var(--color-text-primary)',
  fontWeight: 600,
  cursor: 'pointer',
  textDecoration: 'none',
};

const calendarNavButtonDisabledStyle: CSSProperties = {
  ...calendarNavButtonStyle,
  background: 'rgba(15, 23, 42, 0.05)',
  color: 'var(--color-text-muted)',
  cursor: 'not-allowed',
};

const WEEKDAY_LABELS = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];

const recapWrapperStyle: CSSProperties = {
  overflowX: 'auto',
};

const recapTableStyle: CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  minWidth: '680px',
};

const recapNameHeaderStyle: CSSProperties = {
  position: 'sticky',
  left: 0,
  zIndex: 2,
  background: 'var(--color-bg-surface)',
  borderBottom: '1px solid #e2e8f0',
  padding: '0.7rem 0.9rem',
  textAlign: 'left',
  fontWeight: 600,
  color: 'var(--color-text-secondary)',
};

const recapDateHeaderStyle: CSSProperties = {
  borderBottom: '1px solid #e2e8f0',
  padding: '0.7rem 0.9rem',
  textAlign: 'center',
  fontWeight: 600,
  color: 'var(--color-text-secondary)',
  background: 'rgba(15, 23, 42, 0.04)',
  minWidth: '110px',
};

const recapNameCellStyle: CSSProperties = {
  position: 'sticky',
  left: 0,
  zIndex: 1,
  background: 'var(--color-bg-surface)',
  borderBottom: '1px solid #e2e8f0',
  padding: '0.7rem 0.9rem',
  fontWeight: 600,
  color: 'var(--color-text-primary)',
};

const recapCellStyle: CSSProperties = {
  borderBottom: '1px solid #e2e8f0',
  padding: '0.7rem 0.9rem',
  textAlign: 'center',
  color: 'var(--color-text-secondary)',
  fontSize: '0.9rem',
  whiteSpace: 'nowrap',
};

const lessonBlockStyle: CSSProperties = {
  border: '1px solid #e2e8f0',
  borderRadius: '0.85rem',
  padding: '1rem 1.1rem',
  background: '#ffffff',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.75rem',
};

const lessonBlockStatusBadge = (status: string): CSSProperties => ({
  padding: '0.25rem 0.65rem',
  borderRadius: '999px',
  fontSize: '0.75rem',
  fontWeight: 600,
  color:
    status === 'COMPLETED' ? '#16a34a' : status === 'CURRENT' ? '#2563eb' : '#ea580c',
  background:
    status === 'COMPLETED'
      ? '#ecfdf3'
      : status === 'CURRENT'
        ? 'rgba(37, 99, 235, 0.12)'
        : 'rgba(234, 88, 12, 0.12)',
});

type StatusBadgeProps = {
  status: 'SCHEDULED' | 'COMPLETED' | 'CANCELLED';
};

function StatusBadge({ status }: StatusBadgeProps) {
  const colors = {
    SCHEDULED: 'var(--color-accent)',
    COMPLETED: 'var(--color-success)',
    CANCELLED: 'var(--color-danger)',
  } as const;

  const color = colors[status];

  return (
    <span
      style={{
        display: 'inline-block',
        width: '0.65rem',
        height: '0.65rem',
        borderRadius: '999px',
        background: color,
      }}
    />
  );
}

type LegendSwatchProps = {
  color: string;
  label: string;
};

function LegendSwatch({ color, label }: LegendSwatchProps) {
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
      <span
        style={{
          display: 'inline-block',
          width: '0.7rem',
          height: '0.7rem',
          borderRadius: '999px',
          background: color,
        }}
      />
      <span>{label}</span>
    </span>
  );
}
