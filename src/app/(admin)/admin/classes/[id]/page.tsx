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
import type { SessionRecord } from '@/lib/dao/sessionsDao';
import { autoAssignLessonsForClass } from '@/lib/services/lessonAutoAssign';

import AssignSubstituteForm from './AssignSubstituteForm';
import CancelSessionButton from './CancelSessionButton';
import EnrollCoderForm from './EnrollCoderForm';
import EkskulCompetencyEditor from './EkskulCompetencyEditor';
import BlockScheduleEditor from './BlockScheduleEditor';
import RemoveCoderButton from './RemoveCoderButton';
import SetCoderStatusButton from './SetCoderStatusButton';
import SessionRowActions from './SessionRowActions';

type ClassBlockRow = Awaited<ReturnType<typeof classesDao.getClassBlocks>>[number];
type BlockSummary = {
  block: ClassBlockRow;
  totalLessons: number;
  assignedLessons: number;
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
  const classBlocks = await classesDao.getClassBlocks(classIdParam);

  const blockSummaries: BlockSummary[] = await Promise.all(
    classBlocks.map(async (block) => {
      const classLessons = await classLessonsDao.listLessonsByClassBlock(block.id);
      const sortedLessons = classLessons.slice().sort((a, b) => a.order_index - b.order_index);
      const assignedLessons = sortedLessons.filter((lesson) => lesson.session_id).length;
      const nextLesson = sortedLessons.find((lesson) => !lesson.session_id);

      return {
        block,
        totalLessons: sortedLessons.length,
        assignedLessons,
        nextLessonTitle: nextLesson?.title ?? null,
        lessons: sortedLessons,
      };
    }),
  );

  const availableBlockTemplates =
    klass.level_id != null ? await blocksDao.listBlocksByLevel(klass.level_id) : [];

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

  const lessonBySessionId = new Map<string, ClassLessonRecord>();
  blockSummaries.forEach(({ lessons }) => {
    lessons.forEach((lesson) => {
      if (lesson.session_id) {
        lessonBySessionId.set(lesson.session_id, lesson);
      }
    });
  });

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
      <header style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
        <h1 style={{ fontSize: '1.7rem', fontWeight: 600 }}>{klass.name}</h1>
        <p style={{ color: '#64748b', fontSize: '0.95rem' }}>
          {klass.type} • Coach: {coachMap.get(klass.coach_id) ?? 'Unassigned'} • Schedule: {klass.schedule_day} @ {klass.schedule_time}
        </p>
      </header>

      {klass.type === 'WEEKLY' ? (
        <section style={cardStyle}>
          <div style={sectionHeaderStyle}>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Blok Kurikulum</h2>
              <p style={{ color: '#64748b', fontSize: '0.9rem', marginTop: '0.35rem' }}>
                Urutan block dan lesson mengikuti kurikulum level ini. Sistem otomatis memasangkan lesson ke sesi berikutnya, jadi admin cukup
                memantau blok aktif dan yang akan datang.
              </p>
            </div>
            <Link href="/admin/curriculum" style={sectionLinkStyle}>
              Kelola kurikulum →
            </Link>
          </div>

          <div style={blockSummaryGridStyle}>
            <BlockInfoCard
              label="Blok saat ini"
              summary={currentBlockSummary}
              emphasis
              action={
                currentBlockSummary ? (
                  <BlockScheduleEditor
                    classId={classIdParam}
                    availableBlocks={availableBlockTemplates}
                    defaultStartDate={currentBlockSummary.block.start_date ?? klass.start_date}
                    defaultBlockId={currentBlockSummary.block.block_id ?? undefined}
                    triggerLabel="Edit block ini"
                    triggerContent={<span aria-hidden="true">✏️</span>}
                    buttonStyleOverride={blockActionButtonStyle}
                  />
                ) : null
              }
            />
            <BlockInfoCard
              label="Blok berikutnya"
              summary={nextBlockSummary}
              action={
                nextBlockSummary ? (
                  <BlockScheduleEditor
                    classId={classIdParam}
                    availableBlocks={availableBlockTemplates}
                    defaultStartDate={nextBlockSummary.block.start_date ?? klass.start_date}
                    defaultBlockId={nextBlockSummary.block.block_id ?? undefined}
                    triggerLabel="Edit blok ini"
                    triggerContent={<span aria-hidden="true">✏️</span>}
                    buttonStyleOverride={blockActionButtonStyle}
                  />
                ) : null
              }
            />
          </div>

        </section>
      ) : (
        <section style={{ background: '#ffffff', borderRadius: '0.75rem', border: '1px solid #e5e7eb' }}>
          <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #e2e8f0' }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 600 }}>Ekskul Competencies per Session</h2>
            <p style={{ color: '#64748b', fontSize: '0.9rem' }}>
              Tetapkan kompetensi atau fokus kegiatan untuk setiap sesi ekskul.
            </p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1rem 1.25rem' }}>
            {sessions.length === 0 ? (
              <p style={{ color: '#64748b' }}>Belum ada sesi dijadwalkan.</p>
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

      <section style={{ background: '#ffffff', borderRadius: '0.75rem', border: '1px solid #e5e7eb' }}>
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #e2e8f0' }}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 600 }}>Sessions</h2>
          <p style={{ color: '#64748b', fontSize: '0.9rem' }}>Assign substitute coaches when needed.</p>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={{ background: '#f8fafc', textAlign: 'left' }}>
            <tr>
              <th style={thStyle}>Date</th>
              <th style={thStyle}>Status</th>
              <th style={thStyle}>Substitute Teacher</th>
              <th style={{ ...thStyle, textAlign: 'center' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {sessions.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ padding: '1rem', textAlign: 'center', color: '#6b7280' }}>
                  No sessions generated.
                </td>
              </tr>
            ) : (
              sessions.map((session) => (
                <tr key={session.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <td style={tdStyle}>{new Date(session.date_time).toLocaleString()}</td>
                  <td style={tdStyle}>{session.status}</td>
                  <td style={tdStyle}>
                    <SessionRowActions
                      sessionId={session.id}
                      coaches={coaches}
                      currentSubstituteId={session.substitute_coach_id}
                      currentStatus={session.status as 'SCHEDULED' | 'COMPLETED' | 'CANCELLED'}
                      showDropdownOnly
                    />
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'center' }}>
                    <SessionRowActions
                      sessionId={session.id}
                      coaches={coaches}
                      currentSubstituteId={session.substitute_coach_id}
                      currentStatus={session.status as 'SCHEDULED' | 'COMPLETED' | 'CANCELLED'}
                      showButtonsOnly
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      <section style={{ background: '#ffffff', borderRadius: '0.75rem', border: '1px solid #e5e7eb' }}>
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 600 }}>Enrollments</h2>
            <p style={{ color: '#64748b', fontSize: '0.9rem' }}>Coders enrolled in this class.</p>
          </div>
          <EnrollCoderForm classId={classIdParam} coders={availableCoders} />
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={{ background: '#f8fafc', textAlign: 'left' }}>
            <tr>
              <th style={thStyle}>Coder</th>
              <th style={thStyle}>Enrolled At</th>
              <th style={thStyle}>Status</th>
              <th style={thStyle}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {enrollments.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ padding: '1rem', textAlign: 'center', color: '#6b7280' }}>
                  No coders enrolled yet.
                </td>
              </tr>
            ) : (
              enrollments.map((enrollment) => (
                <tr key={enrollment.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <td style={tdStyle}>{coderMap.get(enrollment.coder_id) ?? 'Coder'}</td>
                  <td style={tdStyle}>{enrollment.enrolled_at ? new Date(enrollment.enrolled_at).toLocaleDateString() : '—'}</td>
                  <td style={tdStyle}>
                    {enrollment.status === 'ACTIVE' ? (
                      <span style={{ color: '#15803d', fontWeight: 600 }}>Active</span>
                    ) : (
                      <span style={{ color: '#b45309', fontWeight: 600 }}>Inactive</span>
                    )}
                  </td>
                  <td style={tdStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
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
      </section>
    </div>
  );
}

function renderInvalidClassId(value: string) {
  console.warn('[AdminClassDetailPage] Invalid class id parameter:', value);
  return (
    <div style={{ padding: '2rem', background: '#ffffff', borderRadius: '0.75rem', border: '1px solid #e5e7eb' }}>
      <h1 style={{ fontSize: '1.4rem', fontWeight: 600, marginBottom: '0.5rem' }}>Kelas tidak ditemukan</h1>
      <p style={{ color: '#64748b' }}>
        Parameter ID kelas tidak valid{value ? `: "${value}"` : ''}. Silakan kembali ke daftar kelas dan pilih ulang.
      </p>
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
        <strong style={{ fontSize: '1.05rem', color: '#0f172a' }}>Belum tersedia</strong>
        <p style={blockInfoMetaStyle}>Tambah block di kurikulum agar jadwal otomatis tersedia.</p>
      </div>
    );
  }

  const { block, totalLessons, assignedLessons, nextLessonTitle } = summary;
  const nextLessonDescription =
    totalLessons === 0
      ? 'Belum ada lesson di block ini'
      : nextLessonTitle
        ? `Lesson berikutnya: ${nextLessonTitle}`
        : 'Semua lesson sudah terpasang ke sesi';

  return (
    <div style={blockInfoCardStyle(emphasis)}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem' }}>
        <div>
          <p style={blockInfoLabelStyle}>{label}</p>
          <strong style={{ fontSize: '1.1rem', color: '#0f172a' }}>{block.block_name ?? 'Block'}</strong>
          <p style={blockInfoMetaStyle}>
            {formatDate(block.start_date)} – {formatDate(block.end_date)}
          </p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', alignItems: 'flex-end' }}>
          {action}
          <span style={statusBadgeStyle(block.status)}>{block.status}</span>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', marginTop: '0.8rem' }}>
        <p style={{ color: '#1f2937', fontSize: '0.9rem', fontWeight: 600 }}>
          Lesson terpasang: {assignedLessons}/{totalLessons}
        </p>
        <p style={{ color: '#475569', fontSize: '0.85rem' }}>{nextLessonDescription}</p>
        {block.pitching_day_date ? (
          <p style={{ color: '#94a3b8', fontSize: '0.8rem' }}>Pitching day: {formatDate(block.pitching_day_date)}</p>
        ) : null}
      </div>
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

const pageContainerStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '2rem',
  maxWidth: '1200px',
  width: '100%',
  margin: '0 auto',
  padding: '0 1.25rem 2.5rem',
};

const cardStyle: CSSProperties = {
  background: 'var(--color-bg-surface)',
  borderRadius: 'var(--radius-lg)',
  border: '1px solid var(--color-border)',
  boxShadow: 'var(--shadow-medium)',
  width: '100%',
  overflow: 'hidden',
};

const sectionHeaderStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: '1rem',
  padding: '1.25rem 1.5rem',
  borderBottom: '1px solid #e2e8f0',
};

const sectionLinkStyle: CSSProperties = {
  color: '#2563eb',
  fontWeight: 600,
  textDecoration: 'none',
  fontSize: '0.9rem',
};

const blockSummaryGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
  gap: '1.25rem',
  padding: '1.5rem',
};

const statusBadgeStyle = (status: string): CSSProperties => ({
  padding: '0.25rem 0.7rem',
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

const blockInfoCardStyle = (emphasis?: boolean): CSSProperties => ({
  border: '1px solid #e2e8f0',
  borderRadius: '0.9rem',
  padding: '1.1rem 1.25rem',
  background: emphasis ? '#f8fafc' : '#ffffff',
  boxShadow: emphasis ? 'var(--shadow-medium)' : 'none',
});

const blockInfoLabelStyle: CSSProperties = {
  textTransform: 'uppercase',
  fontSize: '0.75rem',
  letterSpacing: '0.08em',
  color: '#94a3b8',
  marginBottom: '0.15rem',
};

const blockInfoMetaStyle: CSSProperties = {
  fontSize: '0.85rem',
  color: '#475569',
  marginTop: '0.2rem',
};

const blockActionButtonStyle: CSSProperties = {
  padding: '0.35rem 0.75rem',
  fontSize: '0.8rem',
};

const thStyle: CSSProperties = {
  padding: '0.75rem 1rem',
  fontSize: '0.85rem',
  color: '#475569',
  borderBottom: '1px solid #e2e8f0',
};

const tdStyle: CSSProperties = {
  padding: '0.85rem 1rem',
  fontSize: '0.9rem',
  color: '#1f2937',
};
