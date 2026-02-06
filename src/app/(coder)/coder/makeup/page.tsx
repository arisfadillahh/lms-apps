import type { CSSProperties } from 'react';
import { Clock, Calendar, CheckCircle2, AlertCircle, Upload } from 'lucide-react';

import { getSessionOrThrow } from '@/lib/auth';
import { makeUpTasksDao, sessionsDao, classesDao } from '@/lib/dao';

import MakeUpUploadForm from './MakeUpUploadForm';
import UploadTutorialModal from './UploadTutorialModal';

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

  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'PENDING_UPLOAD':
        return { label: 'Belum Dikumpulkan', color: '#f59e0b', bg: '#fef3c7', icon: <Upload size={14} /> };
      case 'SUBMITTED':
        return { label: 'Menunggu Review', color: '#3b82f6', bg: '#dbeafe', icon: <AlertCircle size={14} /> };
      case 'REVIEWED':
        return { label: 'Selesai Direview', color: '#10b981', bg: '#d1fae5', icon: <CheckCircle2 size={14} /> };
      default:
        return { label: status, color: '#6b7280', bg: '#f3f4f6', icon: null };
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  return (
    <div style={containerStyle}>
      <header style={headerStyle}>
        <div>
          <h1 style={titleStyle}>Tugas Susulan</h1>
          <p style={descStyle}>Kumpulkan karya susulan untuk sesi yang terlewat sebelum batas waktu yang ditentukan.</p>
        </div>
        <UploadTutorialModal />
      </header>

      <div style={tasksContainerStyle}>
        {enriched.length === 0 ? (
          <div style={emptyStateStyle}>
            <CheckCircle2 size={48} color="#94a3b8" />
            <p>Tidak ada tugas susulan saat ini</p>
          </div>
        ) : (
          enriched
            .sort((a, b) => new Date(a.task.due_date).getTime() - new Date(b.task.due_date).getTime())
            .map(({ task, className, session }) => {
              const statusInfo = getStatusInfo(task.status);
              return (
                <div key={task.id} style={cardStyle}>
                  {/* Main Info Row */}
                  <div style={mainRowStyle}>
                    {/* Left: Task Info */}
                    <div style={infoColumnStyle}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                        <h2 style={classNameStyle}>{className}</h2>
                        <div style={{ ...statusBadgeStyle, background: statusInfo.bg, color: statusInfo.color }}>
                          {statusInfo.icon}
                          {statusInfo.label}
                        </div>
                      </div>

                      <div style={metaRowStyle}>
                        <div style={metaItemStyle}>
                          <Calendar size={14} />
                          <span>Sesi: {session ? formatDate(session.date_time) : '—'}</span>
                        </div>
                        <span style={separatorStyle}>•</span>
                        <div style={{ ...metaItemStyle, color: '#dc2626', fontWeight: 600 }}>
                          <Clock size={14} />
                          <span>Deadline: {formatDate(task.due_date)}</span>
                        </div>
                      </div>

                      {task.instructions && (
                        <div style={instructionsBoxStyle}>
                          📝 <strong>Instruksi:</strong> {task.instructions}
                        </div>
                      )}

                      {task.feedback && (
                        <div style={feedbackBoxStyle}>
                          💬 <strong>Feedback Coach:</strong> {task.feedback}
                        </div>
                      )}
                    </div>

                    {/* Right: Upload Form */}
                    <div style={uploadColumnStyle}>
                      <MakeUpUploadForm
                        taskId={task.id}
                        submittedFiles={task.submission_files ? JSON.parse(JSON.stringify(task.submission_files)) : null}
                        status={task.status}
                      />
                    </div>
                  </div>
                </div>
              );
            })
        )}
      </div>
    </div>
  );
}

// Styles
const containerStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '2rem',
  paddingBottom: '2rem',
};

const headerStyle: CSSProperties = {
  marginBottom: '1.5rem',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: '2rem',
};

const titleStyle: CSSProperties = {
  fontSize: '1.75rem',
  fontWeight: 700,
  color: '#1e293b',
  marginBottom: '0.5rem',
};

const descStyle: CSSProperties = {
  color: '#64748b',
  fontSize: '0.95rem',
};

const tasksContainerStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '1rem',
};

const cardStyle: CSSProperties = {
  background: '#ffffff',
  borderRadius: '12px',
  border: '1px solid #e2e8f0',
  padding: '1.5rem',
  boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
};

const mainRowStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 300px',
  gap: '2.5rem',
  alignItems: 'start',
};

const infoColumnStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '1rem',
};

const classNameStyle: CSSProperties = {
  fontSize: '1.1rem',
  fontWeight: 700,
  color: '#1e293b',
  margin: 0,
};

const statusBadgeStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.35rem',
  padding: '0.35rem 0.75rem',
  borderRadius: '999px',
  fontSize: '0.75rem',
  fontWeight: 600,
};

const metaRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.75rem',
  fontSize: '0.85rem',
  color: '#64748b',
};

const metaItemStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.35rem',
};

const separatorStyle: CSSProperties = {
  color: '#cbd5e1',
};

const instructionsBoxStyle: CSSProperties = {
  padding: '0.75rem 1rem',
  background: '#fffbeb',
  border: '1px solid #fef3c7',
  borderLeft: '3px solid #f59e0b',
  borderRadius: '6px',
  fontSize: '0.85rem',
  color: '#92400e',
  lineHeight: 1.5,
};

const feedbackBoxStyle: CSSProperties = {
  padding: '0.75rem 1rem',
  background: '#f0fdf4',
  border: '1px solid #bbf7d0',
  borderLeft: '3px solid #10b981',
  borderRadius: '6px',
  fontSize: '0.85rem',
  color: '#15803d',
  lineHeight: 1.5,
};

const uploadColumnStyle: CSSProperties = {
  width: '300px',
};

const emptyStateStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '3rem',
  background: '#f8fafc',
  borderRadius: '12px',
  border: '2px dashed #cbd5e1',
  color: '#94a3b8',
  gap: '1rem',
};
