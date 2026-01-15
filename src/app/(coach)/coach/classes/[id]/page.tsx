import type { CSSProperties } from 'react';
import Link from 'next/link';
import { format, isSameDay } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { Info, Calendar, Monitor, BookOpen, Users } from 'lucide-react';

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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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

  // Use computed lesson schedule instead of class_lessons (now supports Ekskul)
  const lessonScheduleMap = await computeLessonSchedule(
    classIdParam,
    classRecord?.level_id ?? null,
    (classRecord as any).ekskul_lesson_plan_id
  );

  // Get all lesson slots for display purposes
  const allLessonSlots = classRecord?.level_id
    ? await getLessonSlotsForLevel(classRecord.level_id)
    : [];

  if (!classRecord || classRecord.coach_id !== session.user.id) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center' }}>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 600, color: '#1e293b' }}>Kelas tidak ditemukan</h1>
        <p style={{ color: '#64748b' }}>Anda tidak memiliki akses ke kelas ini.</p>
        <Link href="/coach/dashboard" style={{ marginTop: '1rem', display: 'inline-block', color: '#3b82f6', fontWeight: 600 }}>← Kembali ke Dashboard</Link>
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
      id: sessionItem.id, // Use session ID for unique key
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
    <div style={pageContainerStyle}>
      {/* Header */}
      <div style={{ marginBottom: '1rem' }}>
        <Link href="/coach/dashboard" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', color: '#64748b', fontSize: '0.9rem', fontWeight: 500, textDecoration: 'none', marginBottom: '1rem' }}>
          ← Kembali ke Dashboard
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <h1 style={{ fontSize: '2rem', fontWeight: 800, color: '#1e293b', margin: 0, letterSpacing: '-0.02em' }}>{classRecord.name}</h1>
          <span style={{
            padding: '0.3rem 0.6rem',
            borderRadius: '8px',
            background: classRecord.type === 'EKSKUL' ? '#fdf4ff' : '#eff6ff',
            color: classRecord.type === 'EKSKUL' ? '#c026d3' : '#3b82f6',
            border: classRecord.type === 'EKSKUL' ? '1px solid #fae8ff' : '1px solid #dbeafe',
            fontSize: '0.8rem',
            fontWeight: 700
          }}>
            {classRecord.type}
          </span>
        </div>
        <p style={{ color: '#64748b', marginTop: '0.5rem', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Calendar size={18} /> {classRecord.schedule_day}, {classRecord.schedule_time} WIB
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>

        {/* Left Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>

          {/* Upcoming Session */}
          <section style={cardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Monitor size={20} color="#3b82f6" />
                <h2 style={sectionTitleStyle}>Sesi Berikutnya</h2>
              </div>
            </div>

            {nextSession ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={nextSessionCardStyle}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
                      {format(new Date(nextSession.date_time), 'EEEE, d MMMM yyyy', { locale: idLocale })}
                    </span>
                    <span style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1e293b' }}>
                      {format(new Date(nextSession.date_time), 'HH:mm')} WIB
                    </span>
                    <div style={{ marginTop: '0.5rem' }}>
                      <StatusBadge status={nextSession.status} />
                    </div>
                  </div>

                  <Link
                    href={`/coach/sessions/${nextSession.id}/attendance`}
                    style={openSessionButtonStyle}
                  >
                    Buka Sesi →
                  </Link>
                </div>
                {sessionToday && (
                  <div style={{ padding: '0.75rem', background: '#ecfdf3', border: '1px solid #bbf7d0', borderRadius: '10px', color: '#15803d', fontSize: '0.9rem', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Info size={16} /> Ada sesi hari ini! Jangan lupa absen.
                  </div>
                )}
              </div>
            ) : (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b', background: '#f8fafc', borderRadius: '12px' }}>
                Belum ada jadwal sesi mendatang.
              </div>
            )}
          </section>

          {/* Lessons */}
          <section style={cardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <BookOpen size={20} color="#8b5cf6" />
                <h2 style={sectionTitleStyle}>Materi & Kurikulum</h2>
              </div>
            </div>
            <LessonPlanSection
              blockLessons={blockLessons as any}
              currentLessonId={currentLessonId}
              nextLessonId={nextLessonId}
            />
          </section>

        </div>

        {/* Right Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>

          {/* Enrolled Coders */}
          <section style={cardStyle}>
            <div style={sectionHeaderStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Users size={20} color="#10b981" />
                <h2 style={sectionTitleStyle}>Daftar Coder ({enrollments.length})</h2>
              </div>
            </div>
            <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
              {enrollments.length === 0 ? (
                <p style={{ color: '#94a3b8', fontStyle: 'italic', padding: '1rem', textAlign: 'center' }}>Belum ada coder terdaftar.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {enrollments.map((enrollment, index) => (
                    <div key={enrollment.id} style={{
                      padding: '0.75rem 1rem',
                      background: '#f8fafc',
                      borderRadius: '10px',
                      border: '1px solid #f1f5f9',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem'
                    }}>
                      <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '0.75rem', fontWeight: 600 }}>
                        {index + 1}
                      </div>
                      <span style={{ fontWeight: 600, color: '#334155' }}>{coderNameMap.get(enrollment.coder_id) ?? 'Unknown'}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* Materials */}
          <section style={cardStyle}>
            <div style={sectionHeaderStyle}>
              <h2 style={sectionTitleStyle}>File Materi Tambahan</h2>
            </div>
            <div style={{ marginBottom: '1rem', padding: '1rem', background: '#f8fafc', borderRadius: '12px', border: '1px dashed #cbd5e1' }}>
              <UploadMaterialForm classId={classIdParam} sessions={sessions} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {materials.map((material) => (
                <div key={material.id} style={{ border: '1px solid #e2e8f0', borderRadius: '10px', padding: '1rem', background: '#fff' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <strong style={{ fontSize: '0.95rem', color: '#1e293b' }}>{material.title}</strong>
                    {material.file_url && (
                      <a href={material.file_url} target="_blank" rel="noreferrer" style={{ fontSize: '0.8rem', color: '#3b82f6', fontWeight: 600, textDecoration: 'none' }}>Download ↓</a>
                    )}
                  </div>
                  {material.description && <p style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '0.25rem' }}>{material.description}</p>}
                </div>
              ))}
              {materials.length === 0 && (
                <p style={{ fontSize: '0.85rem', color: '#94a3b8', textAlign: 'center' }}>Tidak ada materi tambahan.</p>
              )}
            </div>
          </section>

        </div>
      </div>

      {/* Full Width Sections */}

      {/* Schedule Table */}
      <section style={cardStyle}>
        <div style={sectionHeaderStyle}>
          <h2 style={sectionTitleStyle}>Jadwal Lengkap</h2>
          <CalendarModal sessions={sortedSessions}>
            <button style={{ color: '#3b82f6', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.9rem' }}>
              📅 Lihat Kalender
            </button>
          </CalendarModal>
        </div>
        <LessonScheduleTable
          sessions={sortedSessions}
          lessons={computedLessonsForTable}
          classType={classRecord.type}
        />
      </section>

      {/* Attendance Recap */}
      {sortedSessions.length > 0 && (
        <section style={cardStyle}>
          <div style={sectionHeaderStyle}>
            <h2 style={sectionTitleStyle}>Rekap Kehadiran</h2>
          </div>
          <div style={{ overflowX: 'auto', paddingBottom: '0.5rem' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
              <thead>
                <tr>
                  <th style={{ ...thStyle, position: 'sticky', left: 0, zIndex: 10, background: '#f8fafc', borderRight: '1px solid #e2e8f0' }}>Nama Siswa</th>
                  {sortedSessions.slice(0, 10).map(s => (
                    <th key={s.id} style={thStyle}>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{format(new Date(s.date_time), 'd MMM')}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {attendanceSummaryRows.map((row) => (
                  <tr key={row.fullName} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ ...tdStyle, position: 'sticky', left: 0, zIndex: 10, background: '#fff', borderRight: '1px solid #e2e8f0', fontWeight: 600 }}>
                      {row.fullName}
                    </td>
                    {row.statuses.slice(0, 10).map((status, i) => (
                      <td key={i} style={{ ...tdStyle, textAlign: 'center' }}>
                        {status ? (
                          status.status === 'PRESENT' ? <span style={{ color: '#16a34a' }}>●</span> :
                            status.status === 'LATE' ? <span style={{ color: '#eab308' }}>◑</span> :
                              <span style={{ color: '#dc2626' }}>✕</span>
                        ) : <span style={{ color: '#e2e8f0' }}>-</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

    </div>
  );
}

function renderInvalidClassMessage(value = '') {
  return (
    <div style={{ padding: '3rem', textAlign: 'center' }}>
      <h1 style={{ fontSize: '1.4rem', fontWeight: 600, color: '#1e293b' }}>Kelas tidak ditemukan</h1>
      <p style={{ color: '#64748b' }}>ID "{value}" tidak valid.</p>
      <Link href="/coach/dashboard" style={{ marginTop: '1rem', display: 'inline-block', color: '#3b82f6', fontWeight: 600 }}>← Kembali ke Dashboard</Link>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const isScheduled = status === 'SCHEDULED';
  const isCompleted = status === 'COMPLETED';
  const isCancelled = status === 'CANCELLED';

  const color = isCompleted ? '#16a34a' : isCancelled ? '#dc2626' : '#3b82f6';
  const bg = isCompleted ? '#dcfce7' : isCancelled ? '#fee2e2' : '#eff6ff';
  const label = isCompleted ? 'Selesai' : isCancelled ? 'Dibatalkan' : 'Terjadwal';

  return (
    <span style={{ padding: '0.25rem 0.6rem', background: bg, color: color, borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700, display: 'inline-block' }}>
      {label}
    </span>
  );
}

function isValidUuid(value: string): boolean {
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(value);
}

// Styles
const pageContainerStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '2rem',
  maxWidth: '1200px',
  width: '100%',
  margin: '0 auto',
  padding: '0 1.5rem 3rem',
};

const cardStyle: CSSProperties = {
  background: '#ffffff',
  borderRadius: '16px',
  border: '1px solid #e2e8f0',
  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
  padding: '1.5rem',
  width: '100%',
  overflow: 'hidden',
};

const sectionHeaderStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: '1rem'
};

const sectionTitleStyle: CSSProperties = {
  fontSize: '1.1rem',
  fontWeight: 700,
  color: '#1e293b',
  margin: 0
};

const nextSessionCardStyle: CSSProperties = {
  border: '1px solid #dbeafe',
  borderRadius: '12px',
  padding: '1.5rem',
  background: '#eff6ff',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: '1rem',
  flexWrap: 'wrap'
};

const openSessionButtonStyle: CSSProperties = {
  background: '#3b82f6',
  color: '#fff',
  padding: '0.75rem 1.25rem',
  borderRadius: '8px',
  fontWeight: 600,
  textDecoration: 'none',
  boxShadow: '0 4px 6px -1px rgba(59, 130, 246, 0.2)',
  transition: 'transform 0.2s',
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.5rem'
};

const thStyle: CSSProperties = {
  padding: '0.75rem 1rem',
  textAlign: 'left',
  fontSize: '0.85rem',
  color: '#64748b',
  borderBottom: '1px solid #e2e8f0',
  background: '#f8fafc',
  whiteSpace: 'nowrap'
};

const tdStyle: CSSProperties = {
  padding: '0.75rem 1rem',
  borderBottom: '1px solid #f1f5f9',
  color: '#334155',
  verticalAlign: 'middle'
};
