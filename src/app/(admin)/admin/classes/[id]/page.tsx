import type { CSSProperties, ReactNode } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import {
  blocksDao,
  classLessonsDao,
  classesDao,
  sessionsDao,
  usersDao,
  exkulCompetenciesDao,
} from '@/lib/dao';
import type { ClassLessonRecord } from '@/lib/dao/classLessonsDao';
import { autoAssignLessonsForClass } from '@/lib/services/lessonAutoAssign';

import AssignSubstituteForm from './AssignSubstituteForm';
import EnrollCoderForm from './EnrollCoderForm';
import CoderJourneyOverride from './CoderJourneyOverride';
import EkskulCompetencyEditor from './EkskulCompetencyEditor';
import RemoveCoderButton from './RemoveCoderButton';
import SetCoderStatusButton from './SetCoderStatusButton';
import SessionRowActions from './SessionRowActions';
import SessionsTable from './SessionsTable';

type ClassBlockRow = Awaited<ReturnType<typeof classesDao.getClassBlocks>>[number];
type BlockSummary = {
  block: ClassBlockRow;
  totalLessons: number;
  completedLessons: number;
  nextLessonTitle: string | null;
  lessons: ClassLessonRecord[];
};

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function AdminClassDetailPage({ params }: PageProps) {
  const resolvedParams = await params;
  const rawId = resolvedParams.id ?? '';
  const classIdParam = decodeURIComponent(rawId).trim();

  if (!classIdParam || classIdParam === 'undefined' || classIdParam === 'null') {
    return renderInvalidClassId(classIdParam);
  }

  if (!isValidUuid(classIdParam)) {
    return renderInvalidClassId(classIdParam);
  }

  const klass = await classesDao.getClassById(classIdParam);
  if (!klass) {
    notFound();
  }

  if (klass.type === 'WEEKLY') {
    try {
      await autoAssignLessonsForClass(classIdParam);
    } catch (error) {
      console.error('[AdminClassDetailPage] Failed to auto-assign lessons before render', error);
    }
  }

  // Ensure future sessions exist (Rolling 12 sessions)
  await sessionsDao.ensureFutureSessions(classIdParam);

  const [sessions, enrollments, coaches, coders] = await Promise.all([
    sessionsDao.listSessionsByClass(classIdParam),
    classesDao.listEnrollmentsByClass(classIdParam, { includeInactive: true }),
    usersDao.listUsersByRole('COACH'),
    usersDao.listUsersByRole('CODER'),
  ]);

  const sessionMap = new Map(sessions.map(s => [s.id, s]));
  const classBlocks = await classesDao.getClassBlocks(classIdParam);

  const blockSummaries: BlockSummary[] = await Promise.all(
    classBlocks.map(async (block) => {
      const classLessons = await classLessonsDao.listLessonsByClassBlock(block.id);
      const sortedLessons = classLessons.slice().sort((a, b) => a.order_index - b.order_index);

      // Calculate progress: Logic "Waterfall" / "Implicit Completion"
      // Find the last lesson that is COMPLETED. All lessons before it are considered completed.
      let lastCompletedIndex = -1;

      for (let i = 0; i < sortedLessons.length; i++) {
        const lesson = sortedLessons[i];
        if (lesson.session_id) {
          const session = sessionMap.get(lesson.session_id);
          if (session?.status === 'COMPLETED') {
            lastCompletedIndex = i;
          }
        }
      }

      const completedLessons = lastCompletedIndex + 1;
      const nextLesson = sortedLessons[lastCompletedIndex + 1];

      return {
        block,
        totalLessons: sortedLessons.length,
        completedLessons,
        nextLessonTitle: nextLesson?.title ?? null,
        lessons: sortedLessons,
      };
    }),
  );

  const sortedBlocks = blockSummaries
    .slice()
    .sort((a, b) => new Date(a.block.start_date).getTime() - new Date(b.block.start_date).getTime());

  const currentBlockSummary =
    sortedBlocks.find((entry) => entry.block.status === 'CURRENT') ??
    sortedBlocks[0] ??
    null;

  const nextBlockSummary =
    sortedBlocks
      .filter((entry) => entry.block.status === 'UPCOMING' && (!currentBlockSummary || entry.block.id !== currentBlockSummary.block.id))
      .sort((a, b) => new Date(a.block.start_date).getTime() - new Date(b.block.start_date).getTime())[0] ?? null;

  const coachMap = new Map(coaches.map((coach) => [coach.id, coach.full_name]));
  const coderMap = new Map(coders.map((coder) => [coder.id, coder.full_name]));
  const enrolledCoderIds = new Set(enrollments.map((enrollment) => enrollment.coder_id));
  const availableCoders = coders.filter((coder) => !enrolledCoderIds.has(coder.id));

  const competenciesMap =
    klass.type === 'EKSKUL'
      ? await exkulCompetenciesDao.listBySessionIds(sessions.map((session) => session.id))
      : {};

  return (
    <div style={pageContainerStyle}>
      {/* Background decoration */}
      <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '300px', background: 'linear-gradient(180deg, #f0f9ff 0%, rgba(255,255,255,0) 100%)', zIndex: -1 }} />

      <header style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <Link href="/admin/classes" style={{ textDecoration: 'none', color: '#64748b', fontSize: '0.9rem', fontWeight: 500 }}>
            ← Kembali ke Daftar Kelas
          </Link>
        </div>
        <h1 style={{ fontSize: '2rem', fontWeight: 800, color: '#1e293b', letterSpacing: '-0.02em', margin: 0 }}>{klass.name}</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <span style={{
            padding: '0.3rem 0.6rem',
            borderRadius: '6px',
            fontSize: '0.8rem',
            fontWeight: 600,
            background: klass.type === 'WEEKLY' ? '#eff6ff' : '#fdf4ff',
            color: klass.type === 'WEEKLY' ? '#3b82f6' : '#d946ef',
            border: klass.type === 'WEEKLY' ? '1px solid #dbeafe' : '1px solid #fae8ff'
          }}>
            {klass.type}
          </span>
          <span style={{ color: '#64748b', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>•</span>
            Coach Utama: <strong style={{ color: '#334155' }}>{coachMap.get(klass.coach_id) ?? 'Unassigned'}</strong>
            <span>•</span>
            Jadwal: {klass.schedule_day}, {klass.schedule_time} WIB
          </span>
        </div>
      </header>

      {klass.type === 'WEEKLY' ? (
        <section style={cardStyle}>
          <div style={sectionHeaderStyle}>
            <div>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1e293b', margin: 0 }}>Kurikulum & Aktivitas</h2>
              <p style={{ color: '#64748b', fontSize: '0.9rem', marginTop: '0.25rem', lineHeight: '1.5' }}>
                Status Block saat ini dan yang akan datang. Lesson otomatis dipasangkan ke sesi.
              </p>
            </div>
            <Link href="/admin/curriculum" style={sectionLinkStyle}>
              Kelola Kurikulum Master →
            </Link>
          </div>

          <div style={blockSummaryGridStyle}>
            <BlockInfoCard
              label="BLOCK SAAT INI"
              summary={currentBlockSummary}
              emphasis
              action={null}
            />
            <BlockInfoCard
              label="BLOCK BERIKUTNYA"
              summary={nextBlockSummary}
              action={null}
            />
          </div>
        </section>
      ) : (
        <section style={cardStyle}>
          <div style={sectionHeaderStyle}>
            <div>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1e293b', margin: 0 }}>Kompetensi Ekskul</h2>
              <p style={{ color: '#64748b', fontSize: '0.9rem', marginTop: '0.25rem' }}>
                Tetapkan kompetensi atau fokus kegiatan untuk setiap sesi ekskul.
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1.5rem' }}>
            {sessions.length === 0 ? (
              <p style={{ color: '#94a3b8', fontStyle: 'italic', textAlign: 'center' }}>Belum ada sesi dijadwalkan.</p>
            ) : (
              sessions.map((sessionItem) => (
                <EkskulCompetencyEditor
                  key={sessionItem.id}
                  sessionId={sessionItem.id}
                  sessionDate={sessionItem.date_time}
                  initialCompetencies={
                    Array.isArray(competenciesMap[sessionItem.id]?.competencies)
                      ? (competenciesMap[sessionItem.id]?.competencies as unknown[])
                        .map((item) => String(item))
                      : []
                  }
                />
              ))
            )}
          </div>
        </section>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '2rem' }}>
        {/* Sessions Table */}
        <SessionsTable sessions={sessions} coachMap={coachMap} />

        {/* Enrollments Table */}
        <section style={cardStyle}>
          <div style={{ ...sectionHeaderStyle, flexWrap: 'wrap' }}>
            <div>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1e293b', margin: 0 }}>Daftar Coder</h2>
              <p style={{ color: '#64748b', fontSize: '0.9rem', marginTop: '0.25rem' }}>Siswa yang terdaftar.</p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem' }}>
              <EnrollCoderForm classId={classIdParam} coders={availableCoders} />
            </div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ background: '#f8fafc', textAlign: 'left' }}>
                <tr>
                  <th style={thStyle}>Nama Coder</th>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {enrollments.length === 0 ? (
                  <tr>
                    <td colSpan={3} style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>
                      Belum ada siswa terdaftar.
                    </td>
                  </tr>
                ) : (
                  enrollments.map((enrollment) => (
                    <tr key={enrollment.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={tdStyle}>
                        <span style={{ fontWeight: 600, color: '#1e293b' }}>{coderMap.get(enrollment.coder_id) ?? 'Unknown'}</span>
                        <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                          Sejak {enrollment.enrolled_at ? new Date(enrollment.enrolled_at).toLocaleDateString() : '—'}
                        </div>
                      </td>
                      <td style={tdStyle}>
                        {enrollment.status === 'ACTIVE' ? (
                          <span style={{ color: '#15803d', fontWeight: 600, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981' }} /> Active
                          </span>
                        ) : (
                          <span style={{ color: '#b45309', fontWeight: 600, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#f59e0b' }} /> Inactive
                          </span>
                        )}
                      </td>
                      <td style={tdStyle}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                          <CoderJourneyOverride
                            classId={classIdParam}
                            coderId={enrollment.coder_id}
                            coderName={coderMap.get(enrollment.coder_id) ?? 'Unknown'}
                          />
                          {enrollment.status === 'ACTIVE' ? (
                            <>
                              <SetCoderStatusButton classId={classIdParam} coderId={enrollment.coder_id} targetStatus="INACTIVE" />
                              <RemoveCoderButton classId={classIdParam} coderId={enrollment.coder_id} />
                            </>
                          ) : (
                            <>
                              <SetCoderStatusButton classId={classIdParam} coderId={enrollment.coder_id} targetStatus="ACTIVE" />
                              <RemoveCoderButton classId={classIdParam} coderId={enrollment.coder_id} />
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

    </div>
  );
}

function renderInvalidClassId(value: string) {
  return (
    <div style={{ padding: '2rem', background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', maxWidth: '600px', margin: '3rem auto', textAlign: 'center' }}>
      <h1 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '0.5rem', color: '#1e293b' }}>Kelas tidak ditemukan</h1>
      <p style={{ color: '#64748b' }}>
        Parameter ID kelas tidak valid ("{value}"). Silakan kembali ke daftar kelas.
      </p>
      <Link href="/admin/classes" style={{ display: 'inline-block', marginTop: '1.5rem', color: '#3b82f6', fontWeight: 600 }}>← Kembali ke Daftar Kelas</Link>
    </div>
  );
}

type BlockInfoCardProps = {
  label: string;
  summary: BlockSummary | null;
  emphasis?: boolean;
  action?: ReactNode;
};

function BlockInfoCard({ label, summary, emphasis, action }: BlockInfoCardProps) {
  if (!summary) {
    return (
      <div style={blockInfoCardStyle(emphasis)}>
        <p style={blockInfoLabelStyle}>{label}</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', margin: '0.5rem 0' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: '1.2rem', color: '#94a3b8' }}>?</span>
          </div>
          <div>
            <strong style={{ fontSize: '1rem', color: '#64748b' }}>Belum tersedia</strong>
          </div>
        </div>
        <p style={blockInfoMetaStyle}>Tambah block di kurikulum untuk mengaktifkan.</p>
      </div>
    );
  }

  const { block, totalLessons, completedLessons, nextLessonTitle } = summary;
  const nextLessonDescription =
    totalLessons === 0
      ? 'Belum ada lesson di block ini'
      : nextLessonTitle
        ? `Lesson berikutnya: ${nextLessonTitle}`
        : 'Semua lesson sudah selesai';

  return (
    <div style={blockInfoCardStyle(emphasis)} className={emphasis ? 'emphasis-card' : ''}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem' }}>
        <div>
          <p style={blockInfoLabelStyle}>{label}</p>
          <div style={{ marginBottom: '0.25rem' }}>
            <strong style={{ fontSize: '1.2rem', color: '#1e293b', lineHeight: 1.2 }}>{block.block_name ?? 'Block'}</strong>
          </div>
          <p style={blockInfoMetaStyle}>
            {formatDate(block.start_date)} – {formatDate(block.end_date)}
          </p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', alignItems: 'flex-end' }}>
          {action}
          <span style={statusBadgeStyle(block.status)}>{block.status}</span>
        </div>
      </div>

      <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: emphasis ? '1px solid rgba(59, 130, 246, 0.1)' : '1px solid #f1f5f9' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
          <span style={{ fontSize: '0.85rem', color: '#64748b' }}>Progress:</span>
          <div style={{ height: '6px', flex: 1, background: '#f1f5f9', borderRadius: '99px', overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: totalLessons > 0 ? `${(completedLessons / totalLessons) * 100}%` : '0%',
              background: emphasis ? '#3b82f6' : '#94a3b8',
              borderRadius: '99px'
            }} />
          </div>
          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#334155' }}>{completedLessons}/{totalLessons}</span>
        </div>
        <p style={{ color: '#64748b', fontSize: '0.85rem', marginTop: '0.5rem', fontStyle: 'italic' }}>
          {nextLessonDescription}
        </p>
        {block.pitching_day_date && (
          <div style={{ marginTop: '0.5rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem', background: '#fff7ed', color: '#c2410c', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600 }}>
            📅 Pitching: {formatDate(block.pitching_day_date)}
          </div>
        )}
      </div>
    </div>
  );
}

function isValidUuid(value: string): boolean {
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(value);
}

function formatDate(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
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
  width: '100%',
  overflow: 'hidden',
};

const sectionHeaderStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: '1rem',
  padding: '1.25rem 1.5rem',
  borderBottom: '1px solid #f1f5f9',
};

const sectionLinkStyle: CSSProperties = {
  color: '#3b82f6',
  fontWeight: 600,
  textDecoration: 'none',
  fontSize: '0.9rem',
  padding: '0.35rem 0.75rem',
  background: '#eff6ff',
  borderRadius: '8px',
  transition: 'background 0.2s',
};

const blockSummaryGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
  gap: '1.5rem',
  padding: '1.5rem',
};

const statusBadgeStyle = (status: string): CSSProperties => ({
  padding: '0.25rem 0.6rem',
  borderRadius: '6px',
  fontSize: '0.75rem',
  fontWeight: 700,
  color: status === 'COMPLETED' ? '#16a34a' : status === 'CURRENT' ? '#1d4ed8' : '#c2410c',
  background: status === 'COMPLETED' ? '#dcfce7' : status === 'CURRENT' ? '#dbeafe' : '#ffedd5',
  textTransform: 'uppercase',
  letterSpacing: '0.05em'
});

const blockInfoCardStyle = (emphasis?: boolean): CSSProperties => ({
  border: emphasis ? '1px solid #bfdbfe' : '1px solid #e2e8f0',
  borderRadius: '16px',
  padding: '1.25rem',
  background: emphasis ? '#eff6ff' : '#ffffff',
  boxShadow: emphasis ? '0 4px 6px -1px rgba(59, 130, 246, 0.1)' : 'none',
  display: 'flex',
  flexDirection: 'column',
  height: '100%'
});

const blockInfoLabelStyle: CSSProperties = {
  textTransform: 'uppercase',
  fontSize: '0.75rem',
  letterSpacing: '0.05em',
  color: '#64748b',
  fontWeight: 700,
  marginBottom: '0.5rem',
};

const blockInfoMetaStyle: CSSProperties = {
  fontSize: '0.85rem',
  color: '#64748b',
};

const thStyle: CSSProperties = {
  padding: '1rem',
  fontSize: '0.75rem',
  color: '#64748b',
  borderBottom: '1px solid #e2e8f0',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  fontWeight: 600,
};

const tdStyle: CSSProperties = {
  padding: '1rem',
  fontSize: '0.9rem',
  color: '#334155',
  borderBottom: '1px solid #f1f5f9',
  verticalAlign: 'middle',
};
