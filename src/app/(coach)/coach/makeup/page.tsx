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

      {/* Page header */}
      <div className="bg-white border-b border-slate-200 px-6 sm:px-8 py-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">Tugas Susulan</h1>
            <p className="text-slate-500 mt-1 text-sm">Kelola dan tinjau tugas tambahan siswa</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-6 sm:px-8 pt-6">
        {taskItems.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center max-w-2xl">
            <span className="material-symbols-outlined text-slate-300 text-5xl mb-4 block">assignment_turned_in</span>
            <h3 className="font-bold text-slate-700 mb-2">Tidak ada tugas susulan</h3>
            <p className="text-slate-400 text-sm">Semua siswa hadir atau belum ada yang mengumpulkan tugas susulan.</p>
          </div>
        ) : (
          <MakeUpTaskList tasks={taskItems} />
        )}
      </div>
    </div>
  );
}
