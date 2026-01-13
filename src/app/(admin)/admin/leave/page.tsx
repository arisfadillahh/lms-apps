import type { CSSProperties } from 'react';

import { getSessionOrThrow } from '@/lib/auth';
import { coachLeaveDao, usersDao, sessionsDao, classesDao } from '@/lib/dao';
import { assertRole } from '@/lib/roles';

import LeaveApprovalTable from './LeaveApprovalTable';
import EmergencyLeaveForm from './EmergencyLeaveForm';

export default async function AdminLeavePage() {
  const session = await getSessionOrThrow();
  await assertRole(session, 'ADMIN');

  const [requests, coaches, classes] = await Promise.all([
    coachLeaveDao.listLeaveRequestsWithCoach(),
    usersDao.listUsersByRole('COACH'),
    classesDao.listClasses(),
  ]);

  // Fetch upcoming sessions from all classes for emergency leave dropdown
  const allSessionsPromises = classes.map((c) => sessionsDao.listSessionsByClass(c.id));
  const allSessionsArrays = await Promise.all(allSessionsPromises);
  const now = new Date();

  // Flatten and filter to only future sessions
  const upcomingSessions = allSessionsArrays
    .flat()
    .filter((s) => new Date(s.date_time) > now && s.status === 'SCHEDULED')
    .map((s) => {
      const klass = classes.find((c) => c.id === s.class_id);
      const coach = coaches.find((c) => c.id === klass?.coach_id);
      return {
        id: s.id,
        dateTime: s.date_time,
        className: klass?.name ?? 'Class',
        coachId: klass?.coach_id ?? '',
        coachName: coach?.full_name ?? 'Coach',
      };
    })
    .sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime());

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 600, marginBottom: '0.5rem' }}>Coach Leave Management</h1>
          <p style={{ color: '#64748b', maxWidth: '52rem' }}>
            Tinjau dan setujui permohonan cuti coach. Ketika disetujui, pilih coach pengganti agar sesi tetap berjalan.
          </p>
        </div>
        <EmergencyLeaveForm
          sessions={upcomingSessions}
          coaches={coaches.map((coach) => ({ id: coach.id, name: coach.full_name }))}
        />
      </header>

      <LeaveApprovalTable
        requests={requests}
        coaches={coaches.map((coach) => ({ id: coach.id, name: coach.full_name }))}
      />
    </div>
  );
}
