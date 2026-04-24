import type { CSSProperties } from 'react';

import { getSessionOrThrow } from '@/lib/auth';
import { coachLeaveDao, usersDao, sessionsDao, classesDao } from '@/lib/dao';
import { assertRole } from '@/lib/roles';

import LeaveApprovalTable from './LeaveApprovalTable';
import EmergencyLeaveForm from './EmergencyLeaveForm';
import PageHead from '@/components/admin/PageHead';

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
      <PageHead
        title="Izin Coach"
        desc="Review permintaan izin, pengganti coach, dan follow up operasional pengajaran."
        actions={
          <EmergencyLeaveForm
            sessions={upcomingSessions}
            coaches={coaches.map((coach) => ({ id: coach.id, name: coach.full_name }))}
          />
        }
      />

      <LeaveApprovalTable
        requests={requests}
        coaches={coaches.map((coach) => ({ id: coach.id, name: coach.full_name }))}
      />
    </div>
  );
}
