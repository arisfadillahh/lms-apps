import type { CSSProperties } from 'react';

import { getSessionOrThrow } from '@/lib/auth';
import { makeUpTasksDao } from '@/lib/dao';
import { assertRole } from '@/lib/roles';

import MakeUpTaskList from './MakeUpTaskList';

export default async function CoachMakeUpPage() {
  const session = await getSessionOrThrow();
  await assertRole(session, 'COACH');

  const tasks = await makeUpTasksDao.listTasksForCoach(session.user.id);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <header>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 600, marginBottom: '0.5rem' }}>Make-Up Tasks</h1>
        <p style={{ color: '#64748b', maxWidth: '48rem' }}>
          Tinjau tugas make-up yang diajukan coder setelah ketidakhadiran. Beri feedback untuk menyelesaikan proses.
        </p>
      </header>

      {tasks.length === 0 ? (
        <div style={emptyStyle}>Belum ada make-up task yang perlu ditinjau.</div>
      ) : (
        <MakeUpTaskList
          tasks={tasks.map((task) => ({
            id: task.id,
            coderName: task.coder?.full_name ?? 'Coder',
            className: task.class?.name ?? 'Class',
            dueDate: task.due_date,
            status: task.status,
            submittedAt: task.submitted_at,
            instructions: task.instructions,
            sessionDate: task.session?.date_time ?? null,
            feedback: task.feedback,
            submissionFiles: task.submission_files ?? undefined,
          }))}
        />
      )}
    </div>
  );
}

const emptyStyle: CSSProperties = {
  padding: '1.2rem 1.5rem',
  borderRadius: '0.75rem',
  border: '1px solid #e2e8f0',
  background: '#ffffff',
  color: '#64748b',
  fontSize: '0.95rem',
};
