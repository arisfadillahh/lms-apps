import { UserCheck, Clock, CalendarIcon } from 'lucide-react';

import { getSessionOrThrow } from '@/lib/auth';
import { coachLeaveDao, sessionsDao } from '@/lib/dao';
import { assertRole } from '@/lib/roles';

import LeaveRequestTable from './LeaveRequestTable';
import CreateLeaveRequestDialog from './CreateLeaveRequestDialog';

export default async function CoachLeavePage() {
  const session = await getSessionOrThrow();
  await assertRole(session, 'COACH');

  const [upcomingSessions, leaveRequests] = await Promise.all([
    sessionsDao.listUpcomingSessionsForCoach(session.user.id, 60), // Fetch next 60 days
    coachLeaveDao.listLeaveRequestsForCoach(session.user.id),
  ]);

  const pendingSessionIds = new Set(
    leaveRequests
      .filter((request) => request.status === 'PENDING' || request.status === 'APPROVED')
      .map((request) => request.session_id),
  );

  // Sessions suitable for new leave requests
  const availableSessions = upcomingSessions.filter(s => !pendingSessionIds.has(s.id));

  // Stats
  const approvedCount = leaveRequests.filter(r => r.status === 'APPROVED').length;
  const pendingCount = leaveRequests.filter(r => r.status === 'PENDING').length;

  return (
    <div className="container max-w-5xl mx-auto py-10 px-4 sm:px-6 lg:px-8 space-y-10">

      {/* Header & Stats Section */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-2">
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Perizinan</h1>
          <p className="text-slate-500 text-lg max-w-xl">
            Ajukan izin ketidakhadiran dengan memilih sesi yang tersedia. Riwayat pengajuan Anda akan muncul di bawah.
          </p>
        </div>

        <div className="flex flex-col gap-3 justify-center">
          <CreateLeaveRequestDialog availableSessions={availableSessions} />
          <div className="flex gap-4 justify-center text-sm text-slate-500">
            <div className="flex flex-col items-center bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100 min-w-[80px]">
              <span className="font-bold text-emerald-600 text-lg">{approvedCount}</span>
              <span className="text-xs font-medium uppercase tracking-wider">Disetujui</span>
            </div>
            <div className="flex flex-col items-center bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100 min-w-[80px]">
              <span className="font-bold text-amber-600 text-lg">{pendingCount}</span>
              <span className="text-xs font-medium uppercase tracking-wider">Pending</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content: History List */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
            <Clock className="w-5 h-5" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">Riwayat Pengajuan</h2>
        </div>

        <LeaveRequestTable requests={leaveRequests} />
      </div>

    </div>
  );
}
