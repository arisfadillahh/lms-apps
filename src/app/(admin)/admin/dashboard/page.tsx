import type { CSSProperties } from 'react';
import { format } from 'date-fns';

import { classesDao, sessionsDao, usersDao } from '@/lib/dao';

export default async function AdminDashboardPage() {
  const [classes, coaches, coders] = await Promise.all([
    classesDao.listClasses(),
    usersDao.listUsersByRole('COACH'),
    usersDao.listUsersByRole('CODER'),
  ]);

  const upcomingSessions = (await Promise.all(
    classes.map((klass) => sessionsDao.listSessionsByClass(klass.id)),
  ))
    .flat()
    .filter((session) => new Date(session.date_time) >= new Date())
    .sort((a, b) => new Date(a.date_time).getTime() - new Date(b.date_time).getTime())
    .slice(0, 5);

  return (
    <div>
      <h1 style={{ fontSize: '1.6rem', fontWeight: 600, marginBottom: '1.5rem', color: 'var(--color-text-primary)' }}>Admin Dashboard</h1>
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1.5rem' }}>
        <div style={cardStyle}>
          <p style={cardLabel}>Classes</p>
          <p style={cardValue}>{classes.length}</p>
        </div>
        <div style={cardStyle}>
          <p style={cardLabel}>Coaches</p>
          <p style={cardValue}>{coaches.length}</p>
        </div>
        <div style={cardStyle}>
          <p style={cardLabel}>Coders</p>
          <p style={cardValue}>{coders.length}</p>
        </div>
      </section>

      <section style={{ marginTop: '2.5rem' }}>
        <h2 style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: '1rem' }}>Upcoming Sessions</h2>
        <div style={{ background: 'var(--color-bg-surface)', borderRadius: 'var(--radius-lg)', border: `1px solid var(--color-border)`, overflow: 'hidden', boxShadow: 'var(--shadow-medium)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ background: 'rgba(15, 23, 42, 0.04)', textAlign: 'left' }}>
              <tr>
                <th style={thStyle}>Date</th>
                <th style={thStyle}>Class</th>
                <th style={thStyle}>Status</th>
              </tr>
            </thead>
            <tbody>
              {upcomingSessions.length === 0 ? (
                <tr>
                  <td colSpan={3} style={{ padding: '1rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                    No upcoming sessions scheduled.
                  </td>
                </tr>
              ) : (
                upcomingSessions.map((session) => (
                  <tr key={session.id} style={{ borderBottom: `1px solid var(--color-border)` }}>
                    <td style={tdStyle}>{format(new Date(session.date_time), 'eee, dd MMM yyyy HH:mm')}</td>
                    <td style={tdStyle}>{classes.find((klass) => klass.id === session.class_id)?.name ?? 'Class'}</td>
                    <td style={tdStyle}>{session.status}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

const cardStyle: CSSProperties = {
  background: 'var(--color-bg-surface)',
  borderRadius: 'var(--radius-lg)',
  padding: '1.5rem',
  border: `1px solid var(--color-border)`,
  boxShadow: 'var(--shadow-medium)',
  color: 'var(--color-text-primary)',
};

const cardLabel: CSSProperties = {
  fontSize: '0.9rem',
  color: 'var(--color-text-muted)',
  marginBottom: '0.5rem',
};

const cardValue: CSSProperties = {
  fontSize: '2rem',
  fontWeight: 600,
  color: 'var(--color-text-primary)',
};

const thStyle: CSSProperties = {
  padding: '0.75rem 1rem',
  fontSize: '0.85rem',
  color: 'var(--color-text-secondary)',
  borderBottom: `1px solid var(--color-border)`,
};

const tdStyle: CSSProperties = {
  padding: '0.85rem 1rem',
  fontSize: '0.9rem',
  color: 'var(--color-text-primary)',
};
