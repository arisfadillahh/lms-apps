import { getSessionOrThrow } from '@/lib/auth';
import { coachLeaveDao, classesDao, sessionsDao, usersDao } from '@/lib/dao';
import { assertRole } from '@/lib/roles';
import { computeLessonSchedule, formatLessonTitle } from '@/lib/services/lessonScheduler';

import LeaveRequestTable from './LeaveRequestTable';
import CreateLeaveRequestDialog from './CreateLeaveRequestDialog';

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
    <div className="-mx-8 pt-0 pb-20 bg-slate-50 font-sans min-h-screen">

      {/* Page Header */}
      <div className="p-6 sm:p-8 pb-0 max-w-7xl mx-auto w-full">
        <div className="flex flex-wrap items-start justify-between gap-6 mb-8">
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
              <span className="material-symbols-outlined text-blue-500 text-3xl">event_busy</span>
              Pengajuan Izin
            </h1>
            <p className="text-slate-500 mt-2">
              Ajukan izin jika kamu berhalangan hadir mengajar, dan pantau status persetujuannya di sini.
            </p>
          </div>
          <div className="flex items-center gap-3 mt-1">
            <CreateLeaveRequestDialog availableSessions={availableSessions} />
          </div>
        </div>

        {/* Status Overview Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white border border-slate-200 p-5 rounded-2xl flex items-center gap-4 shadow-sm">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-emerald-50 text-emerald-600">
              <span className="material-symbols-outlined">check_circle</span>
            </div>
            <div>
              <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Disetujui</p>
              <p className="text-2xl font-black text-slate-800">{approvedCount}</p>
            </div>
          </div>

          <div className="bg-white border border-slate-200 p-5 rounded-2xl flex items-center gap-4 shadow-sm">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-amber-50 text-amber-500">
              <span className="material-symbols-outlined">hourglass_empty</span>
            </div>
            <div>
              <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Menunggu</p>
              <p className="text-2xl font-black text-slate-800">{pendingCount}</p>
            </div>
          </div>

          <div className="bg-white border border-slate-200 p-5 rounded-2xl flex items-center gap-4 shadow-sm">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-red-50 text-red-500">
              <span className="material-symbols-outlined">cancel</span>
            </div>
            <div>
              <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Ditolak</p>
              <p className="text-2xl font-black text-slate-800">{rejectedCount}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Timeline Content */}
      <div className="px-6 sm:px-8 pt-8 max-w-7xl mx-auto w-full">
        <LeaveRequestTable requests={leaveRequests} />
      </div>

    </div>
  );
}
