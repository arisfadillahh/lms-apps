import type { CSSProperties } from 'react';

import { getSessionOrThrow } from '@/lib/auth';
import { coachLeaveDao, sessionsDao } from '@/lib/dao';
import { assertRole } from '@/lib/roles';

import LeaveRequestTable from './LeaveRequestTable';
import RequestLeaveButton from './RequestLeaveButton';

export default async function CoachLeavePage() {
  const session = await getSessionOrThrow();
  await assertRole(session, 'COACH');

  const [upcomingSessions, leaveRequests] = await Promise.all([
    sessionsDao.listUpcomingSessionsForCoach(session.user.id, 60),
    coachLeaveDao.listLeaveRequestsForCoach(session.user.id),
  ]);

  const pendingSessionIds = new Set(
    leaveRequests
      .filter((request) => request.status === 'PENDING' || request.status === 'APPROVED')
      .map((request) => request.session_id),
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <header>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 600, marginBottom: '0.5rem' }}>Leave Requests</h1>
        <p style={{ color: '#64748b', maxWidth: '48rem' }}>
          Ajukan izin minimum H-7 sebelum sesi dimulai. Admin akan menugaskan coach pengganti sesuai kebutuhan.
        </p>
      </header>

      <section style={cardStyle}>
        <h2 style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: '0.75rem' }}>Upcoming Sessions</h2>
        {upcomingSessions.length === 0 ? (
          <p style={{ color: '#64748b', fontSize: '0.95rem' }}>Tidak ada sesi dalam 60 hari ke depan.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {upcomingSessions.map((item) => {
              const alreadyRequested = pendingSessionIds.has(item.id);
              return (
                <div key={item.id} style={sessionRowStyle}>
                  <div>
                    <p style={{ fontSize: '0.9rem', fontWeight: 600, color: '#0f172a' }}>
                      {item.class_name ?? 'Class'}
                    </p>
                    <p style={{ fontSize: '0.85rem', color: '#475569' }}>{new Date(item.date_time).toLocaleString()}</p>
                  </div>
                  <RequestLeaveButton sessionId={item.id} disabled={alreadyRequested} />
                </div>
              );
            })}
          </div>
        )}
      </section>

      <LeaveRequestTable requests={leaveRequests} />
    </div>
  );
}

const cardStyle: CSSProperties = {
  background: '#ffffff',
  borderRadius: '0.75rem',
  border: '1px solid #e2e8f0',
  padding: '1.25rem 1.5rem',
};

const sessionRowStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: '1rem',
  padding: '0.85rem 1rem',
  borderRadius: '0.65rem',
  border: '1px solid #e2e8f0',
  background: '#f8fafc',
};
