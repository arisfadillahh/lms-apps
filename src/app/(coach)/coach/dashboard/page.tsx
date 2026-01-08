import type { CSSProperties } from 'react';

import { getSessionOrThrow } from '@/lib/auth';
import { getCoachClassesWithBlocks } from '@/lib/services/coach';

export default async function CoachDashboardPage() {
  const session = await getSessionOrThrow();
  const classes = await getCoachClassesWithBlocks(session.user.id);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <header>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 600, marginBottom: '0.75rem' }}>Coach Dashboard</h1>
        <p style={{ color: '#64748b', maxWidth: '48rem' }}>
          Monitor your classes, upcoming blocks, and the next scheduled session. Use the class details page to manage
          attendance, materials, and rubrics.
        </p>
      </header>

      <section style={cardStyle}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={{ background: '#f1f5f9', textAlign: 'left' }}>
            <tr>
              <th style={thStyle}>Class</th>
              <th style={thStyle}>Current Block</th>
              <th style={thStyle}>Next Block</th>
              <th style={thStyle}>Next Session</th>
            </tr>
          </thead>
          <tbody>
            {classes.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ padding: '1rem', textAlign: 'center', color: '#6b7280' }}>
                  You are not assigned to any classes yet.
                </td>
              </tr>
            ) : (
              classes.map((klass, index) => {
                const rowKey = klass.classId ?? `missing-${index}`;
                if (!klass.classId) {
                  console.warn('Coach class summary missing classId', klass);
                }
                return (
                  <tr key={rowKey} style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={tdStyle}>
                      {klass.classId ? (
                        <a href={`/coach/classes/${klass.classId}`} style={{ color: '#2563eb', fontWeight: 600 }}>
                          {klass.name}
                        </a>
                      ) : (
                        <span style={{ color: '#b91c1c', fontWeight: 600 }}>{klass.name} (ID tidak valid)</span>
                      )}
                      <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>{klass.type}</div>
                    </td>
                    <td style={tdStyle}>
                      {klass.currentBlock
                        ? `${klass.currentBlock.name ?? 'Current Block'} • ${formatDateRange(klass.currentBlock.startDate, klass.currentBlock.endDate)}`
                        : '—'}
                    </td>
                    <td style={tdStyle}>
                      {klass.upcomingBlock
                        ? `${klass.upcomingBlock.name ?? 'Next Block'} • ${formatDateRange(
                            klass.upcomingBlock.startDate,
                            klass.upcomingBlock.endDate,
                          )}`
                        : '—'}
                    </td>
                    <td style={tdStyle}>
                      {klass.nextSessionDate ? new Date(klass.nextSessionDate).toLocaleString() : 'No upcoming session'}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}

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
  verticalAlign: 'top',
};

function formatDateRange(start: string, end: string): string {
  const startDate = new Date(start).toLocaleDateString();
  const endDate = new Date(end).toLocaleDateString();
  return `${startDate} → ${endDate}`;
}
