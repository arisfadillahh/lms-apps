import type { CSSProperties } from 'react';

import { getSessionOrThrow } from '@/lib/auth';
import { coachLeaveDao, usersDao } from '@/lib/dao';
import { assertRole } from '@/lib/roles';

import LeaveApprovalTable from './LeaveApprovalTable';

export default async function AdminLeavePage() {
  const session = await getSessionOrThrow();
  await assertRole(session, 'ADMIN');

  const [requests, coaches] = await Promise.all([
    coachLeaveDao.listLeaveRequestsWithCoach(),
    usersDao.listUsersByRole('COACH'),
  ]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <header>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 600, marginBottom: '0.5rem' }}>Coach Leave Management</h1>
        <p style={{ color: '#64748b', maxWidth: '52rem' }}>
          Tinjau dan setujui permohonan cuti coach. Ketika disetujui, pilih coach pengganti agar sesi tetap berjalan.
        </p>
      </header>

      <LeaveApprovalTable
        requests={requests}
        coaches={coaches.map((coach) => ({ id: coach.id, name: coach.full_name }))}
      />
    </div>
  );
}
