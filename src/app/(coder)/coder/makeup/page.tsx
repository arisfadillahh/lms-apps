import type { CSSProperties } from 'react';

import { getSessionOrThrow } from '@/lib/auth';
import { makeUpTasksDao, sessionsDao, classesDao } from '@/lib/dao';

import MakeUpUploadForm from './MakeUpUploadForm';

export default async function CoderMakeUpPage() {
  const session = await getSessionOrThrow();
  const tasks = await makeUpTasksDao.listMakeUpTasksByCoder(session.user.id);

  const enriched = await Promise.all(
    tasks.map(async (task) => {
      const sessionRecord = await sessionsDao.getSessionById(task.session_id);
      const classRecord = sessionRecord ? await classesDao.getClassById(sessionRecord.class_id) : null;
      return {
        task,
        session: sessionRecord,
        className: classRecord?.name ?? 'Class',
      };
    }),
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <header>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 600, marginBottom: '0.75rem' }}>Make-Up Tasks</h1>
        <p style={{ color: '#64748b' }}>Upload your make-up work before the due date so your coach can review it.</p>
      </header>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {enriched.length === 0 ? (
          <p style={{ color: '#6b7280' }}>No make-up tasks assigned.</p>
        ) : (
          enriched
            .sort((a, b) => new Date(a.task.due_date).getTime() - new Date(b.task.due_date).getTime())
            .map(({ task, className, session }) => (
              <section key={task.id} style={cardStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
                  <div>
                    <h2 style={{ fontSize: '1.1rem', fontWeight: 600 }}>{className}</h2>
                    <p style={{ fontSize: '0.9rem', color: '#475569' }}>
                      Session: {session ? new Date(session.date_time).toLocaleString() : '—'}
                    </p>
                    <p style={{ fontSize: '0.9rem', color: '#475569' }}>Due: {new Date(task.due_date).toLocaleString()}</p>
                    <p style={{ fontSize: '0.9rem', color: statusColor(task.status) }}>Status: {task.status}</p>
                    {task.instructions ? (
                      <p style={{ fontSize: '0.85rem', color: '#1f2937', marginTop: '0.35rem' }}>
                        Instruksi: {task.instructions}
                      </p>
                    ) : null}
                    {task.feedback ? (
                      <p style={{ fontSize: '0.85rem', color: '#16a34a', marginTop: '0.35rem' }}>Coach feedback: {task.feedback}</p>
                    ) : null}
                  </div>
                  {task.status === 'PENDING_UPLOAD' ? <MakeUpUploadForm taskId={task.id} /> : null}
                </div>
              </section>
            ))
        )}
      </div>
    </div>
  );
}

const cardStyle: CSSProperties = {
  background: '#ffffff',
  borderRadius: '0.75rem',
  border: '1px solid #e5e7eb',
  padding: '1.25rem 1.5rem',
};

function statusColor(status: string): string {
  switch (status) {
    case 'REVIEWED':
      return '#16a34a';
    case 'SUBMITTED':
      return '#1e3a5f';
    default:
      return '#b91c1c';
  }
}
