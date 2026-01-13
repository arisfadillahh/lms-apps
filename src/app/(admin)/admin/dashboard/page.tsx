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
      {/* h1 removed, handled by DashboardHeader */}
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
        <h2 style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: '1rem', color: '#1e293b' }}>Upcoming Sessions</h2>
        <div style={{ background: '#ffffff', borderRadius: '1rem', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ background: '#f8fafc', textAlign: 'left' }}>
              <tr>
                <th style={thStyle}>Date</th>
                <th style={thStyle}>Class</th>
                <th style={thStyle}>Status</th>
              </tr>
            </thead>
            <tbody>
              {upcomingSessions.length === 0 ? (
                <tr>
                  <td colSpan={3} style={{ padding: '1rem', textAlign: 'center', color: '#64748b' }}>
                    No upcoming sessions scheduled.
                  </td>
                </tr>
              ) : (
                upcomingSessions.map((session) => (
                  <tr key={session.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
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
  background: '#ffffff',
  borderRadius: '1rem',
  padding: '1.5rem',
  border: '1px solid #e2e8f0',
  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
  color: '#1e293b',
};

const cardLabel: CSSProperties = {
  fontSize: '0.875rem',
  color: '#64748b',
  marginBottom: '0.5rem',
  fontWeight: 500,
};

const cardValue: CSSProperties = {
  fontSize: '2rem',
  fontWeight: 700,
  color: '#1e293b',
};

const thStyle: CSSProperties = {
  padding: '1rem 1.5rem',
  fontSize: '0.875rem',
  fontWeight: 600,
  color: '#475569',
  borderBottom: '1px solid #e2e8f0',
  textTransform: 'uppercase',
  letterSpacing: '0.05em'
};

const tdStyle: CSSProperties = {
  padding: '1rem 1.5rem',
  fontSize: '0.95rem',
  color: '#334155',
  fontWeight: 500
};
