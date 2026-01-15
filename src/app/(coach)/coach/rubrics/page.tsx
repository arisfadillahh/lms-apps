import Link from 'next/link';
import type { CSSProperties } from 'react';

import { getSessionOrThrow } from '@/lib/auth';
import { classesDao } from '@/lib/dao';
import type { ClassBlockRecord, ClassRecord } from '@/lib/dao/classesDao';

import EkskulRubricLauncher from './EkskulRubricLauncher';

type WeeklyClassWithBlocks = {
  klass: ClassRecord;
  blocks: Array<ClassBlockRecord & { block_name?: string | null }>;
};

type EkskulClass = {
  klass: ClassRecord;
};

function canSubmitWeeklyRubric(status: ClassBlockRecord['status']): boolean {
  return status === 'CURRENT' || status === 'COMPLETED';
}

function formatDate(value: string | null): string {
  if (!value) {
    return '—';
  }
  return new Date(value).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

function inferSemesterTag(startDate: string, endDate: string): string {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const year = start.getFullYear();
  const sameYear = start.getFullYear() === end.getFullYear();
  const semesterIndex = start.getMonth() < 6 ? 1 : 2;
  return sameYear ? `${year}-S${semesterIndex}` : `${year}/${end.getFullYear()}-S${semesterIndex}`;
}

export default async function CoachRubricsPage() {
  const session = await getSessionOrThrow();
  const classes = await classesDao.listClassesForCoach(session.user.id);

  const weeklyClasses: WeeklyClassWithBlocks[] = [];
  const ekskulClasses: EkskulClass[] = [];

  for (const klass of classes) {
    if (klass.type === 'WEEKLY') {
      const blocks = await classesDao.getClassBlocks(klass.id);
      weeklyClasses.push({ klass, blocks });
    } else if (klass.type === 'EKSKUL') {
      ekskulClasses.push({ klass });
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <header>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 600, marginBottom: '0.75rem' }}>Rubrik Coach</h1>
        <p style={{ color: '#64748b', maxWidth: '52rem' }}>
          Lengkapi penilaian rubrik untuk block Weekly yang sudah selesai dan rekap Ekskul per semester. Sistem akan
          menggunakan data ini untuk generate rapor otomatis.
        </p>
      </header>

      <section style={cardStyle}>
        <h2 style={sectionTitleStyle}>Weekly Blocks</h2>
        {weeklyClasses.length === 0 ? (
          <p style={emptyStateStyle}>Belum ada kelas Weekly yang ditugaskan.</p>
        ) : (
          weeklyClasses.map(({ klass, blocks }) => (
            <div key={klass.id} style={classGroupStyle}>
              <div style={classHeaderStyle}>
                <div>
                  <h3 style={classNameStyle}>{klass.name}</h3>
                  <p style={classMetaStyle}>
                    {klass.schedule_day} • {klass.schedule_time}
                  </p>
                </div>
                <Link href={`/coach/classes/${klass.id}`} style={classLinkStyle}>
                  Detail kelas →
                </Link>
              </div>
              {blocks.length === 0 ? (
                <p style={emptyStateStyle}>Belum ada block yang diinstansiasi.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {blocks.map((block) => {
                    const slug = `${encodeURIComponent(klass.id)}__${encodeURIComponent(block.id)}`;
                    const allowed = canSubmitWeeklyRubric(block.status);
                    return (
                      <div key={block.id} style={blockCardStyle}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                          <strong style={{ color: '#0f172a' }}>{block.block_name ?? 'Block'}</strong>
                          <div style={blockMetaStyle}>
                            <span>Status: {block.status}</span>
                            <span>
                              Jadwal: {formatDate(block.start_date)} – {formatDate(block.end_date)}
                            </span>
                            <span>Pitching day: {formatDate(block.pitching_day_date)}</span>
                          </div>
                        </div>
                        {allowed ? (
                          <Link href={`/coach/rubrics/weekly/${slug}`} style={primaryButtonStyle}>
                            Isi rubrik
                          </Link>
                        ) : (
                          <span style={disabledBadgeStyle}>Belum dapat diisi</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))
        )}
      </section>

      <section style={cardStyle}>
        <h2 style={sectionTitleStyle}>Ekskul</h2>
        {ekskulClasses.length === 0 ? (
          <p style={emptyStateStyle}>Belum ada kelas Ekskul yang ditugaskan.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {ekskulClasses.map(({ klass }) => {
              const defaultSemesterTag = inferSemesterTag(klass.start_date, klass.end_date);
              return (
                <div key={klass.id} style={classGroupStyle}>
                  <div style={classHeaderStyle}>
                    <div>
                      <h3 style={classNameStyle}>{klass.name}</h3>
                      <p style={classMetaStyle}>
                        {formatDate(klass.start_date)} – {formatDate(klass.end_date)}
                      </p>
                    </div>
                    <Link href={`/coach/classes/${klass.id}`} style={classLinkStyle}>
                      Detail kelas →
                    </Link>
                  </div>
                  <p style={{ color: '#475569', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                    Masukkan tag semester (contoh: 2024-S1) lalu buka form rubrik untuk setiap coder.
                  </p>
                  <EkskulRubricLauncher classId={klass.id} defaultSemesterTag={defaultSemesterTag} />
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

const cardStyle: CSSProperties = {
  background: '#ffffff',
  borderRadius: '0.75rem',
  border: '1px solid #e5e7eb',
  padding: '1.5rem',
  boxShadow: 'var(--shadow-small)',
  display: 'flex',
  flexDirection: 'column',
  gap: '1.25rem',
};

const sectionTitleStyle: CSSProperties = {
  fontSize: '1.2rem',
  fontWeight: 600,
  color: '#0f172a',
};

const emptyStateStyle: CSSProperties = {
  color: '#6b7280',
  fontSize: '0.9rem',
};

const classGroupStyle: CSSProperties = {
  border: '1px solid #e2e8f0',
  borderRadius: '0.75rem',
  padding: '1rem 1.25rem',
  background: '#f8fafc',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.85rem',
};

const classHeaderStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: '1rem',
  flexWrap: 'wrap',
};

const classNameStyle: CSSProperties = {
  fontSize: '1.05rem',
  fontWeight: 600,
  color: '#0f172a',
};

const classMetaStyle: CSSProperties = {
  fontSize: '0.85rem',
  color: '#64748b',
};

const classLinkStyle: CSSProperties = {
  color: '#1e3a5f',
  fontWeight: 600,
  textDecoration: 'none',
  fontSize: '0.9rem',
};

const blockCardStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: '1rem',
  padding: '0.85rem 1rem',
  borderRadius: '0.65rem',
  border: '1px solid #cbd5f5',
  background: '#fff',
  flexWrap: 'wrap',
};

const blockMetaStyle: CSSProperties = {
  display: 'flex',
  gap: '1rem',
  flexWrap: 'wrap',
  fontSize: '0.85rem',
  color: '#475569',
};

const primaryButtonStyle: CSSProperties = {
  padding: '0.5rem 1rem',
  borderRadius: '0.5rem',
  background: '#1e3a5f',
  color: '#fff',
  textDecoration: 'none',
  fontWeight: 600,
  fontSize: '0.9rem',
};

const disabledBadgeStyle: CSSProperties = {
  padding: '0.4rem 0.8rem',
  borderRadius: '999px',
  border: '1px dashed #cbd5f5',
  color: '#94a3b8',
  fontSize: '0.85rem',
};
