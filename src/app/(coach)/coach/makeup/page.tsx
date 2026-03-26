import { getSessionOrThrow } from '@/lib/auth';
import { makeUpTasksDao } from '@/lib/dao';
import { assertRole } from '@/lib/roles';

import MakeUpTaskList from './MakeUpTaskList';

export const dynamic = 'force-dynamic';

export default async function CoachMakeUpPage() {
  const session = await getSessionOrThrow();
  await assertRole(session, 'COACH');

  const tasks = await makeUpTasksDao.listTasksForCoach(session.user.id);

  const pendingUploadCount = tasks.filter((t) => t.status === 'PENDING_UPLOAD').length;
  const submittedCount = tasks.filter((t) => t.status === 'SUBMITTED').length;
  const reviewedCount = tasks.filter((t) => t.status === 'REVIEWED').length;

  const taskItems = tasks.map((task) => ({
    id: task.id,
    coderName: task.coder?.full_name ?? 'Coder',
    className: task.class?.name ?? 'Class',
    dueDate: task.due_date,
    status: task.status as 'PENDING_UPLOAD' | 'SUBMITTED' | 'REVIEWED',
    submittedAt: task.submitted_at,
    instructions: task.instructions,
    sessionDate: task.session?.date_time ?? null,
    feedback: task.feedback,
    submissionFiles: task.submission_files ?? undefined,
  }));

  return (
    <div className="-mx-8 -mt-0 bg-slate-50 pb-16 font-sans min-h-screen">

      {/* Page Header */}
      <div className="p-6 sm:p-8 pb-0 max-w-7xl mx-auto w-full">
        <div className="mb-8">
          <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <span className="material-symbols-outlined text-emerald-500 text-3xl">assignment_turned_in</span>
            Tugas Susulan
          </h1>
          <p className="text-slate-500 mt-2">
            Pantau dan nilai tugas susulan yang dikumpulkan siswa setelah mereka absen dari sesi belajar.
          </p>
        </div>

        {/* Status Overview Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white border border-slate-200 p-5 rounded-2xl flex items-center gap-4 shadow-sm">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-orange-50 text-orange-500">
              <span className="material-symbols-outlined">pending_actions</span>
            </div>
            <div>
              <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Perlu Direview</p>
              <p className="text-2xl font-black text-slate-800">{submittedCount}</p>
            </div>
          </div>
          
          <div className="bg-white border border-slate-200 p-5 rounded-2xl flex items-center gap-4 shadow-sm">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-cyan-50 text-cyan-600">
              <span className="material-symbols-outlined">upload_file</span>
            </div>
            <div>
              <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Menunggu Siswa</p>
              <p className="text-2xl font-black text-slate-800">{pendingUploadCount}</p>
            </div>
          </div>

          <div className="bg-white border border-slate-200 p-5 rounded-2xl flex items-center gap-4 shadow-sm">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-emerald-50 text-emerald-600">
              <span className="material-symbols-outlined">task_alt</span>
            </div>
            <div>
              <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Selesai Dinilai</p>
              <p className="text-2xl font-black text-slate-800">{reviewedCount}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-6 sm:px-8 py-6 w-full max-w-7xl mx-auto">
        {taskItems.length === 0 ? (
          <div className="bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 p-16 text-center max-w-3xl mx-auto flex flex-col items-center justify-center min-h-[400px]">
            <div className="w-24 h-24 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center mb-6">
                <span className="material-symbols-outlined text-5xl">assignment_turned_in</span>
            </div>
            <h3 className="text-2xl font-black text-slate-800 mb-3 tracking-tight">Belum Ada Tugas Susulan</h3>
            <p className="text-slate-500 text-base max-w-md mx-auto leading-relaxed">Saat ini semua siswa hadir atau belum ada yang mengumpulkan tugas susulan. Bagus untuk terus dipantau!</p>
          </div>
        ) : (
          <MakeUpTaskList tasks={taskItems} />
        )}
      </div>
    </div>
  );
}
