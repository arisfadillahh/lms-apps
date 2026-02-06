'use client';

import type { CSSProperties } from 'react';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ExternalLink, CheckCircle2, AlertCircle, X, FileText } from 'lucide-react';

type TaskItem = {
  id: string;
  coderName: string;
  className: string;
  dueDate: string;
  status: 'PENDING_UPLOAD' | 'SUBMITTED' | 'REVIEWED';
  submittedAt: string | null | undefined;
  instructions?: string | null;
  sessionDate?: string | null;
  feedback?: string | null;
  submissionFiles?: unknown;
};

type MakeUpTaskListProps = {
  tasks: TaskItem[];
};

export default function MakeUpTaskList({ tasks }: MakeUpTaskListProps) {
  const router = useRouter();
  const [selectedTask, setSelectedTask] = useState<TaskItem | null>(null);
  const [feedback, setFeedback] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const openReviewModal = (task: TaskItem) => {
    setSelectedTask(task);
    setFeedback(task.feedback ?? '');
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  const closeModal = () => {
    setSelectedTask(null);
    setFeedback('');
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  const submitReview = () => {
    if (!selectedTask) return;

    setErrorMessage(null);
    setSuccessMessage(null);

    startTransition(async () => {
      try {
        const response = await fetch(`/api/coach/makeup/${selectedTask.id}/review`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'REVIEWED', feedback: feedback.trim() }),
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          setErrorMessage(payload.error ?? 'Gagal menyimpan review');
          return;
        }

        setSuccessMessage('Berhasil! Tugas sudah direview.');
        setTimeout(() => {
          closeModal();
          router.refresh();
        }, 1500);
      } catch (error) {
        console.error('Review error', error);
        setErrorMessage('Terjadi kesalahan');
      }
    });
  };

  const getSubmittedUrl = (submissionFiles: unknown): string | null => {
    if (!submissionFiles || !Array.isArray(submissionFiles) || submissionFiles.length === 0) {
      return null;
    }
    const items = submissionFiles as Array<{ url?: string }>;
    return items[0]?.url || null;
  };

  const getStatusInfo = (status: TaskItem['status']) => {
    switch (status) {
      case 'PENDING_UPLOAD':
        return { label: 'Menunggu', color: '#f59e0b', bg: '#fef3c7' };
      case 'SUBMITTED':
        return { label: 'Perlu Review', color: '#3b82f6', bg: '#dbeafe' };
      case 'REVIEWED':
        return { label: 'Selesai', color: '#10b981', bg: '#d1fae5' };
      default:
        return { label: status, color: '#6b7280', bg: '#f3f4f6' };
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
    });
  };

  return (
    <section>
      {errorMessage && (
        <div style={alertErrorStyle}>
          <AlertCircle size={16} />
          {errorMessage}
        </div>
      )}
      {successMessage && (
        <div style={alertSuccessStyle}>
          <CheckCircle2 size={16} />
          {successMessage}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {tasks.map((task) => {
          const statusInfo = getStatusInfo(task.status);
          return (
            <div key={task.id} style={cardStyle}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
                  <h3 style={nameStyle}>{task.coderName}</h3>
                  <span style={{ ...statusBadgeStyle, background: statusInfo.bg, color: statusInfo.color }}>
                    {statusInfo.label}
                  </span>
                </div>
                <div style={metaStyle}>
                  <span>{task.className}</span>
                  <span style={separatorStyle}>•</span>
                  <span>Deadline: {formatDate(task.dueDate)}</span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                {task.status === 'SUBMITTED' && (
                  <button
                    type="button"
                    onClick={() => openReviewModal(task)}
                    style={reviewButtonStyle}
                  >
                    <FileText size={16} />
                    Perlu Review
                  </button>
                )}
                {task.status === 'REVIEWED' && (
                  <div style={reviewedBadgeStyle}>
                    <CheckCircle2 size={16} />
                    Sudah Direview
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Review Modal */}
      {selectedTask && (
        <div style={modalOverlayStyle} onClick={closeModal}>
          <div style={modalContentStyle} onClick={(e) => e.stopPropagation()}>
            <div style={modalHeaderStyle}>
              <div>
                <h3 style={modalTitleStyle}>{selectedTask.coderName}</h3>
                <p style={modalSubtitleStyle}>{selectedTask.className}</p>
              </div>
              <button type="button" onClick={closeModal} style={closeButtonStyle}>
                <X size={20} />
              </button>
            </div>

            <div style={modalBodyStyle}>
              {selectedTask.instructions && (
                <div style={instructionsBoxStyle}>
                  <strong>Instruksi:</strong> {selectedTask.instructions}
                </div>
              )}

              <div>
                <div style={sectionLabelStyle}>Karya yang Dikumpulkan</div>
                {getSubmittedUrl(selectedTask.submissionFiles) ? (
                  <a
                    href={getSubmittedUrl(selectedTask.submissionFiles)!}
                    target="_blank"
                    rel="noreferrer"
                    style={viewWorkButtonStyle}
                  >
                    <ExternalLink size={18} />
                    Lihat Karya
                  </a>
                ) : (
                  <p style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Belum ada</p>
                )}
              </div>

              <div>
                <label style={sectionLabelStyle}>Feedback untuk Coder (Opsional)</label>
                <textarea
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  rows={3}
                  placeholder="Tulis feedback di sini..."
                  style={textareaStyle}
                  disabled={isPending}
                />
              </div>

              <button
                type="button"
                onClick={submitReview}
                disabled={isPending}
                style={submitButtonStyle}
              >
                <CheckCircle2 size={18} />
                {isPending ? 'Menyimpan...' : 'Selesai Review'}
              </button>

              {errorMessage && (
                <div style={{ padding: '0.75rem', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', color: '#b91c1c', fontSize: '0.85rem' }}>
                  {errorMessage}
                </div>
              )}
              {successMessage && (
                <div style={{ padding: '0.75rem', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '6px', color: '#15803d', fontSize: '0.85rem' }}>
                  {successMessage}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

// Minimal Card Styles
const cardStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '1rem',
  padding: '0.875rem 1rem',
  background: '#fff',
  border: '1px solid #e2e8f0',
  borderRadius: '8px',
  boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
};

const nameStyle: CSSProperties = {
  fontSize: '0.95rem',
  fontWeight: 700,
  color: '#1e293b',
  margin: 0,
};

const metaStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  fontSize: '0.8rem',
  color: '#64748b',
};

const separatorStyle: CSSProperties = {
  color: '#cbd5e1',
};

const statusBadgeStyle: CSSProperties = {
  padding: '0.25rem 0.6rem',
  borderRadius: '999px',
  fontSize: '0.7rem',
  fontWeight: 600,
  flexShrink: 0,
};

const reviewButtonStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.4rem',
  padding: '0.5rem 0.875rem',
  background: '#3b82f6',
  color: '#fff',
  border: 'none',
  borderRadius: '6px',
  fontSize: '0.85rem',
  fontWeight: 600,
  cursor: 'pointer',
  flexShrink: 0,
};

const reviewedBadgeStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.4rem',
  padding: '0.5rem 0.875rem',
  background: '#f0fdf4',
  color: '#10b981',
  border: '1px solid #bbf7d0',
  borderRadius: '6px',
  fontSize: '0.85rem',
  fontWeight: 600,
  flexShrink: 0,
};

// Modal Styles
const modalOverlayStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(15, 23, 42, 0.7)',
  backdropFilter: 'blur(4px)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '2rem',
  zIndex: 9999,
};

const modalContentStyle: CSSProperties = {
  background: '#fff',
  borderRadius: '12px',
  width: 'min(500px, 90vw)',
  maxHeight: '85vh',
  overflow: 'hidden',
  boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
  display: 'flex',
  flexDirection: 'column',
};

const modalHeaderStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  padding: '1.25rem 1.5rem',
  borderBottom: '1px solid #e2e8f0',
};

const modalTitleStyle: CSSProperties = {
  fontSize: '1.1rem',
  fontWeight: 700,
  color: '#1e293b',
  margin: 0,
};

const modalSubtitleStyle: CSSProperties = {
  fontSize: '0.85rem',
  color: '#64748b',
  marginTop: '0.25rem',
};

const closeButtonStyle: CSSProperties = {
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  padding: '0.25rem',
  color: '#64748b',
  display: 'flex',
};

const modalBodyStyle: CSSProperties = {
  padding: '1.5rem',
  overflowY: 'auto',
  display: 'flex',
  flexDirection: 'column',
  gap: '1.25rem',
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

const sectionLabelStyle: CSSProperties = {
  fontSize: '0.8rem',
  fontWeight: 700,
  color: '#475569',
  marginBottom: '0.5rem',
  display: 'block',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
};

const viewWorkButtonStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '0.5rem',
  padding: '0.75rem 1.25rem',
  background: '#3b82f6',
  color: '#fff',
  borderRadius: '8px',
  fontSize: '0.9rem',
  fontWeight: 600,
  textDecoration: 'none',
  boxShadow: '0 2px 4px rgba(59, 130, 246, 0.2)',
};

const textareaStyle: CSSProperties = {
  width: '100%',
  borderRadius: '6px',
  border: '1px solid #cbd5e1',
  padding: '0.75rem',
  fontSize: '0.85rem',
  resize: 'vertical',
  fontFamily: 'inherit',
  lineHeight: 1.5,
};

const submitButtonStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '0.5rem',
  padding: '0.75rem 1.25rem',
  background: '#10b981',
  color: '#fff',
  border: 'none',
  borderRadius: '8px',
  fontSize: '0.95rem',
  fontWeight: 600,
  cursor: 'pointer',
  boxShadow: '0 2px 4px rgba(16, 185, 129, 0.2)',
};

const alertErrorStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  padding: '0.75rem 1rem',
  background: '#fef2f2',
  border: '1px solid #fecaca',
  borderRadius: '8px',
  color: '#b91c1c',
  fontSize: '0.85rem',
  fontWeight: 500,
  marginBottom: '1rem',
};

const alertSuccessStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  padding: '0.75rem 1rem',
  background: '#f0fdf4',
  border: '1px solid #bbf7d0',
  borderRadius: '8px',
  color: '#15803d',
  fontSize: '0.85rem',
  fontWeight: 500,
  marginBottom: '1rem',
};
