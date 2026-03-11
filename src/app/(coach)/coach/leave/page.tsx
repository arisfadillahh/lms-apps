import { getSessionOrThrow } from '@/lib/auth';
import { coachLeaveDao, classesDao, sessionsDao, usersDao } from '@/lib/dao';
import { assertRole } from '@/lib/roles';
import { computeLessonSchedule, formatLessonTitle } from '@/lib/services/lessonScheduler';

import LeaveRequestTable from './LeaveRequestTable';
import CreateLeaveRequestDialog from './CreateLeaveRequestDialog';
import CoachDashboardHeader from '@/components/coach/CoachDashboardHeader';

export default async function CoachLeavePage() {
  const session = await getSessionOrThrow();
  await assertRole(session, 'COACH');

  const [upcomingSessions, leaveRequests, coachUser] = await Promise.all([
    sessionsDao.listUpcomingSessionsForCoach(session.user.id, 60),
    coachLeaveDao.listLeaveRequestsForCoach(session.user.id),
    usersDao.getUserById(session.user.id),
  ]);

  const headerUser = {
    id: session.user.id,
    fullName: coachUser?.full_name ?? session.user.username,
    role: 'COACH',
    avatarPath: coachUser?.avatar_path ?? null,
  };

  const pendingSessionIds = new Set(
    leaveRequests
      .filter((r) => r.status === 'PENDING' || r.status === 'APPROVED')
      .map((r) => r.session_id),
  );

  const availableRaw = upcomingSessions.filter((s) => !pendingSessionIds.has(s.id));

  // Gather unique class_ids so we can fetch their lesson schedules for preview
  const uniqueClassIds = [...new Set(availableRaw.map((s) => s.class_id))];
  const classRecords = await Promise.all(uniqueClassIds.map((id) => classesDao.getClassById(id)));
  const classMap = new Map(classRecords.filter(Boolean).map((c) => [c!.id, c!]));

  // Build per-class lesson schedule maps
  const scheduleMapByClass = new Map<string, Awaited<ReturnType<typeof computeLessonSchedule>>>();
  await Promise.all(
    uniqueClassIds.map(async (classId) => {
      const cls = classMap.get(classId);
      if (!cls) return;
      const schedMap = await computeLessonSchedule(
        cls.id,
        cls.level_id ?? null,
        (cls as any).ekskul_lesson_plan_id ?? null,
      );
      scheduleMapByClass.set(classId, schedMap);
    }),
  );

  // Enrich sessions with block + lesson info
  const availableSessions = availableRaw.map((session) => {
    const schedMap = scheduleMapByClass.get(session.class_id);
    const slot = schedMap?.get(session.id);
    return {
      ...session,
      block_name: slot?.block.name ?? null,
      lesson_title: slot ? formatLessonTitle(slot) : null,
    };
  });

  const approvedCount  = leaveRequests.filter((r) => r.status === 'APPROVED').length;
  const pendingCount   = leaveRequests.filter((r) => r.status === 'PENDING').length;
  const rejectedCount  = leaveRequests.filter((r) => r.status === 'REJECTED').length;

  return (
    <>
      {/* Sticky Top Navbar — same as dashboard */}
      <CoachDashboardHeader user={headerUser} />

      <div className="-mx-8 pb-20 bg-slate-50 font-sans">

        {/* Page Header */}
        <div className="p-6 sm:p-8 pb-0">
        <div className="flex flex-wrap items-end justify-between gap-6">
          {/* Title */}
          <div className="max-w-xl">
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">Perizinan</h1>
            <p className="text-slate-500 mt-2">
              Kelola dan pantau status riwayat pengajuan izin sesi kelas Anda secara transparan dan teratur.
            </p>
          </div>

          {/* Summary pills + CTa */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex h-10 items-center gap-2 rounded-full bg-emerald-100 px-4 border border-emerald-200">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span className="text-emerald-700 text-sm font-bold">
                {String(approvedCount).padStart(2, '0')} Disetujui
              </span>
            </div>
            <div className="flex h-10 items-center gap-2 rounded-full bg-amber-100 px-4 border border-amber-200">
              <span className="w-2 h-2 rounded-full bg-amber-500"></span>
              <span className="text-amber-700 text-sm font-bold">
                {String(pendingCount).padStart(2, '0')} Pending
              </span>
            </div>
            <CreateLeaveRequestDialog availableSessions={availableSessions} />
          </div>
        </div>

        {/* Status Overview Strip */}
        <div className="mt-8 grid grid-cols-3 bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="p-6 text-center border-r border-slate-100">
            <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Disetujui</p>
            <p className="text-3xl font-black text-emerald-600">{String(approvedCount).padStart(2, '0')}</p>
          </div>
          <div className="p-6 text-center border-r border-slate-100">
            <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Pending Review</p>
            <p className="text-3xl font-black text-amber-500">{String(pendingCount).padStart(2, '0')}</p>
          </div>
          <div className="p-6 text-center">
            <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Ditolak</p>
            <p className="text-3xl font-black text-red-500">{String(rejectedCount).padStart(2, '0')}</p>
          </div>
        </div>
      </div>

      {/* Timeline Content */}
      <div className="px-6 sm:px-8 pt-8">
        <LeaveRequestTable requests={leaveRequests} />
      </div>

    </div>
    </>
  );
}
