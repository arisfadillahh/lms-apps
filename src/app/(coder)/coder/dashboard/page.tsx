import type { CSSProperties } from 'react';

import { getSessionOrThrow } from '@/lib/auth';
import { getCoderProgress } from '@/lib/services/coder';

import JourneyMap from './JourneyMap';

export default async function CoderDashboardPage() {
  const session = await getSessionOrThrow();
  const progress = await getCoderProgress(session.user.id);
  const upcomingBlocks = progress
    .filter((item) => item.type === 'WEEKLY' && item.upNext)
    .map((item) => ({
      classId: item.classId,
      className: item.name,
      block: item.upNext!,
    }));

  const journeyProgress = progress
    .filter((item) => item.type === 'WEEKLY' && item.journeyBlocks.length > 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <header>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 600, marginBottom: '0.75rem' }}>Welcome back, {session.user.fullName}</h1>
        <p style={{ color: '#64748b' }}>Track your class progress and upcoming blocks.</p>
      </header>

      {upcomingBlocks.length > 0 ? (
        <section style={upNextSectionStyle}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: '0.75rem' }}>Up Next</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {upcomingBlocks.map(({ classId, className, block }) => (
              <div key={`${classId}-${block.blockId}`} style={upNextCardStyle}>
                <div>
                  <p style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    {className}
                  </p>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: '#0f172a', marginTop: '0.35rem' }}>{block.name}</h3>
                  <p style={{ color: '#475569', fontSize: '0.85rem', marginTop: '0.35rem' }}>
                    Status: <span style={{ fontWeight: 600 }}>{formatStatus(block.status)}</span>
                  </p>
                </div>
                <div style={{ minWidth: '200px', textAlign: 'right', color: '#475569', fontSize: '0.85rem' }}>
                  <p>
                    Jadwal:{' '}
                    <strong>
                      {new Date(block.startDate).toLocaleDateString()} - {new Date(block.endDate).toLocaleDateString()}
                    </strong>
                  </p>
                  <p>
                    Estimasi sesi: <strong>{block.estimatedSessions ?? '—'}</strong>
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {journeyProgress.length > 0 ? <JourneyMap courses={journeyProgress} /> : null}

      <section style={cardStyle}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={{ background: '#f1f5f9', textAlign: 'left' }}>
            <tr>
              <th style={thStyle}>Class</th>
              <th style={thStyle}>Completed</th>
              <th style={thStyle}>Current Block</th>
              <th style={thStyle}>Next Block</th>
              <th style={thStyle}>Last Attendance</th>
            </tr>
          </thead>
          <tbody>
            {progress.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: '1rem', textAlign: 'center', color: '#6b7280' }}>
                  You are not enrolled in any classes yet.
                </td>
              </tr>
            ) : (
              progress.map((item) => (
                <tr key={item.classId} style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <td style={tdStyle}>{item.name}</td>
                  <td style={tdStyle}>
                    {item.totalBlocks ? `${item.completedBlocks}/${item.totalBlocks} blocks` : item.semesterTag ?? '—'}
                  </td>
                  <td style={tdStyle}>{item.currentBlockName ?? '—'}</td>
                  <td style={tdStyle}>{item.upcomingBlockName ?? '—'}</td>
                  <td style={tdStyle}>{item.lastAttendanceAt ? new Date(item.lastAttendanceAt).toLocaleString() : '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

    </div>
  );
}

function formatStatus(status: 'UPCOMING' | 'CURRENT' | 'COMPLETED'): string {
  switch (status) {
    case 'CURRENT':
      return 'Sedang berjalan';
    case 'COMPLETED':
      return 'Selesai';
    default:
      return 'Menunggu';
  }
}

const upNextSectionStyle: CSSProperties = {
  background: '#ffffff',
  borderRadius: '0.75rem',
  border: '1px solid #e5e7eb',
  padding: '1.25rem 1.5rem',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.75rem',
};

const upNextCardStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: '1rem',
  borderRadius: '0.75rem',
  border: '1px solid #e2e8f0',
  padding: '0.85rem 1rem',
  background: '#f8fafc',
};

const cardStyle: CSSProperties = {
  background: '#ffffff',
  borderRadius: '0.75rem',
  border: '1px solid #e5e7eb',
  padding: '1.25rem 1.5rem',
  overflowX: 'auto',
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
