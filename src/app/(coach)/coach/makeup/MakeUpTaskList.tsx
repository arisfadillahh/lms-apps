'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

type TaskItem = {
  id: string;
  coderName: string;
  className: string;
  dueDate: string;
  status: 'PENDING_UPLOAD' | 'SUBMITTED' | 'REVIEWED' | 'APPROVED' | 'REJECTED';
  submittedAt: string | null | undefined;
  instructions?: string | null;
  sessionDate?: string | null;
  feedback?: string | null;
  submissionFiles?: unknown;
};

type Filter = 'ALL' | 'PENDING_UPLOAD' | 'SUBMITTED' | 'DONE';

type MakeUpTaskListProps = {
  tasks: TaskItem[];
};

function getInitials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase();
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
}

function getSubmittedUrl(submissionFiles: unknown): string | null {
  if (!submissionFiles || !Array.isArray(submissionFiles) || submissionFiles.length === 0) return null;
  const items = submissionFiles as Array<{ url?: string; name?: string }>;
  return items[0]?.url ?? null;
}

function getSubmittedFileName(submissionFiles: unknown): string | null {
  if (!submissionFiles || !Array.isArray(submissionFiles) || submissionFiles.length === 0) return null;
  const items = submissionFiles as Array<{ url?: string; name?: string }>;
  return items[0]?.name ?? items[0]?.url?.split('/').pop() ?? 'File Tugas';
}

const AVATAR_COLORS = [
  'bg-amber-100 text-amber-700',
  'bg-blue-100 text-blue-700',
  'bg-emerald-100 text-emerald-700',
  'bg-violet-100 text-violet-700',
  'bg-rose-100 text-rose-700',
  'bg-cyan-100 text-cyan-700',
];

export default function MakeUpTaskList({ tasks }: MakeUpTaskListProps) {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>('ALL');
  const [feedbackMap, setFeedbackMap] = useState<Record<string, string>>({});
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [errorMap, setErrorMap] = useState<Record<string, string>>({});
  const [successIds, setSuccessIds] = useState<Set<string>>(new Set());
  const [, startTransition] = useTransition();

  const pendingUploadCount = tasks.filter((t) => t.status === 'PENDING_UPLOAD').length;
  const submittedCount = tasks.filter((t) => t.status === 'SUBMITTED').length;

  const filteredTasks = tasks.filter((t) => {
    if (filter === 'ALL') return true;
    if (filter === 'PENDING_UPLOAD') return t.status === 'PENDING_UPLOAD';
    if (filter === 'SUBMITTED') return t.status === 'SUBMITTED';
    if (filter === 'DONE') return t.status === 'REVIEWED' || t.status === 'APPROVED' || t.status === 'REJECTED';
    return true;
  });

  const handleReview = (taskId: string, action: 'APPROVED' | 'REJECTED') => {
    if (loadingId) return;
    setLoadingId(taskId);
    setErrorMap((prev) => ({ ...prev, [taskId]: '' }));

    startTransition(async () => {
      try {
        const res = await fetch(`/api/coach/makeup/${taskId}/review`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: action, feedback: feedbackMap[taskId]?.trim() ?? '' }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setErrorMap((prev) => ({ ...prev, [taskId]: data.error ?? 'Gagal menyimpan review' }));
        } else {
          setSuccessIds((prev) => new Set(prev).add(taskId));
          setTimeout(() => router.refresh(), 1500);
        }
      } catch {
        setErrorMap((prev) => ({ ...prev, [taskId]: 'Terjadi kesalahan' }));
      } finally {
        setLoadingId(null);
      }
    });
  };

  const tabs: { key: Filter; label: string; count?: number }[] = [
    { key: 'ALL', label: 'Semua' },
    { key: 'SUBMITTED', label: 'Menunggu Review', count: submittedCount },
    { key: 'PENDING_UPLOAD', label: 'Perlu Upload', count: pendingUploadCount },
    { key: 'DONE', label: 'Selesai' },
  ];

  return (
    <div>
      {/* Summary badges */}
      <div className="flex flex-wrap gap-3 mb-6">
        {submittedCount > 0 && (
          <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 px-4 py-2 rounded-xl">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            <span className="text-amber-700 text-sm font-bold">{submittedCount} Menunggu Review</span>
          </div>
        )}
        {pendingUploadCount > 0 && (
          <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 px-4 py-2 rounded-xl">
            <span className="w-2 h-2 rounded-full bg-blue-500" />
            <span className="text-blue-700 text-sm font-bold">{pendingUploadCount} Perlu Upload</span>
          </div>
        )}
      </div>

      {/* Filter tabs */}
      <div className="mb-8">
        <div className="inline-flex p-1.5 bg-slate-100 rounded-2xl">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setFilter(tab.key)}
              className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-all whitespace-nowrap ${filter === tab.key
                  ? 'bg-white shadow-sm text-slate-900'
                  : 'text-slate-500 hover:text-slate-700'
                }`}
            >
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span className={`ml-2 text-xs font-bold px-1.5 py-0.5 rounded-full ${filter === tab.key ? 'bg-slate-100 text-slate-600' : 'bg-slate-200 text-slate-500'
                  }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Task cards */}
      {filteredTasks.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center">
          <span className="material-symbols-outlined text-slate-300 text-5xl mb-3 block">assignment_turned_in</span>
          <p className="text-slate-500 font-medium">Tidak ada tugas susulan di kategori ini.</p>
        </div>
      ) : (
        <div className="space-y-5 max-w-5xl">
          {filteredTasks.map((task, idx) => {
            const isSubmitted = task.status === 'SUBMITTED';
            const isPendingUpload = task.status === 'PENDING_UPLOAD';
            const isDone = task.status === 'REVIEWED' || task.status === 'APPROVED' || task.status === 'REJECTED';
            const isSuccess = successIds.has(task.id);
            const err = errorMap[task.id];
            const fileUrl = getSubmittedUrl(task.submissionFiles);
            const fileName = getSubmittedFileName(task.submissionFiles);
            const avatarColor = AVATAR_COLORS[idx % AVATAR_COLORS.length];

            let borderColor = 'border-slate-200';
            let leftAccent = 'border-l-slate-300';
            if (isSubmitted) { borderColor = 'border-amber-200'; leftAccent = 'border-l-amber-400'; }
            if (isPendingUpload) { borderColor = 'border-blue-200'; leftAccent = 'border-l-blue-400'; }
            if (isDone) { borderColor = 'border-emerald-200'; leftAccent = 'border-l-emerald-400'; }

            return (
              <div
                key={task.id}
                className={`bg-white border border-l-4 ${borderColor} ${leftAccent} rounded-xl shadow-sm hover:shadow-md transition-all overflow-hidden ${isDone ? 'opacity-80' : ''}`}
              >
                <div className="p-6">
                  {/* Card header */}
                  <div className="flex justify-between items-start mb-5">
                    <div className="flex gap-4">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg shrink-0 ${avatarColor}`}>
                        {getInitials(task.coderName)}
                      </div>
                      <div>
                        <h3 className="font-bold text-lg text-slate-900">{task.coderName}</h3>
                        <div className="flex flex-wrap items-center gap-2 text-slate-500 text-sm mt-0.5">
                          <span className="font-semibold text-emerald-600">{task.className}</span>
                          {task.sessionDate && (
                            <>
                              <span className="w-1 h-1 rounded-full bg-slate-300" />
                              <span>Sesi: {formatDate(task.sessionDate)}</span>
                            </>
                          )}
                          {task.dueDate && (
                            <>
                              <span className="w-1 h-1 rounded-full bg-slate-300" />
                              <span className="text-rose-500 font-medium">Deadline: {formatDate(task.dueDate)}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Status badge */}
                    {isSubmitted && (
                      <span className="px-3 py-1 bg-amber-100 text-amber-700 text-xs font-bold rounded-full uppercase tracking-wider shrink-0">
                        Menunggu Review
                      </span>
                    )}
                    {isPendingUpload && (
                      <span className="px-3 py-1 bg-blue-100 text-blue-700 text-xs font-bold rounded-full uppercase tracking-wider shrink-0">
                        Perlu Upload
                      </span>
                    )}
                    {task.status === 'APPROVED' && (
                      <div className="flex items-center gap-1 text-emerald-600 shrink-0">
                        <span className="material-symbols-outlined text-sm">check_circle</span>
                        <span className="text-xs font-bold uppercase tracking-wider">Approved</span>
                      </div>
                    )}
                    {task.status === 'REJECTED' && (
                      <div className="flex items-center gap-1 text-rose-500 shrink-0">
                        <span className="material-symbols-outlined text-sm">cancel</span>
                        <span className="text-xs font-bold uppercase tracking-wider">Rejected</span>
                      </div>
                    )}
                    {task.status === 'REVIEWED' && (
                      <div className="flex items-center gap-1 text-emerald-600 shrink-0">
                        <span className="material-symbols-outlined text-sm">check_circle</span>
                        <span className="text-xs font-bold uppercase tracking-wider">Selesai</span>
                      </div>
                    )}
                  </div>

                  {/* Instructions box */}
                  {task.instructions && (
                    <div className="bg-slate-50 border border-slate-100 p-4 rounded-xl mb-5">
                      <p className="text-sm text-slate-600 italic">
                        &ldquo;Instruksi: {task.instructions}&rdquo;
                      </p>
                    </div>
                  )}

                  {/* SUBMITTED: show file, feedback textarea, approve/reject */}
                  {isSubmitted && !isSuccess && (
                    <div className="flex flex-col gap-4">
                      {/* File attachment */}
                      {fileUrl ? (
                        <div className="flex items-center gap-3">
                          <a
                            href={fileUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 border border-slate-200 px-3 py-1.5 rounded-lg transition-colors"
                          >
                            <span className="material-symbols-outlined text-sm text-emerald-600">link</span>
                            <span className="text-xs font-medium text-slate-700 truncate max-w-xs">{fileName}</span>
                          </a>
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400 italic">Belum ada file yang dilampirkan.</p>
                      )}

                      {/* Feedback textarea */}
                      <textarea
                        value={feedbackMap[task.id] ?? ''}
                        onChange={(e) => setFeedbackMap((prev) => ({ ...prev, [task.id]: e.target.value }))}
                        className="w-full border border-slate-200 rounded-xl text-sm p-3 min-h-[80px] resize-none focus:ring-1 focus:ring-emerald-400 focus:border-emerald-400 outline-none font-sans"
                        placeholder="Tulis feedback untuk coder..."
                        disabled={loadingId === task.id}
                      />

                      {/* Error */}
                      {err && (
                        <p className="text-xs text-rose-500 font-medium">{err}</p>
                      )}

                      {/* Actions */}
                      <div className="flex justify-end gap-3 pt-1">
                        <button
                          type="button"
                          onClick={() => handleReview(task.id, 'REJECTED')}
                          disabled={!!loadingId}
                          className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold text-rose-600 hover:bg-rose-50 transition-colors disabled:opacity-50"
                        >
                          <span className="material-symbols-outlined text-lg">close</span>
                          Reject
                        </button>
                        <button
                          type="button"
                          onClick={() => handleReview(task.id, 'APPROVED')}
                          disabled={!!loadingId}
                          className="flex items-center gap-2 px-6 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-50"
                        >
                          <span className="material-symbols-outlined text-lg">check</span>
                          {loadingId === task.id ? 'Menyimpan...' : 'Approve'}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* SUCCESS: show confirmation */}
                  {isSuccess && (
                    <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 p-4 rounded-xl">
                      <span className="material-symbols-outlined text-emerald-500">task_alt</span>
                      <p className="text-sm font-medium text-emerald-700">Review berhasil disimpan!</p>
                    </div>
                  )}

                  {/* PENDING_UPLOAD: waiting for coder */}
                  {isPendingUpload && (
                    <div className="flex items-center gap-3 bg-blue-50 border border-blue-100 p-4 rounded-xl">
                      <span className="material-symbols-outlined text-blue-500">hourglass_empty</span>
                      <p className="text-sm font-medium text-blue-700">Menunggu coder upload file tugas</p>
                    </div>
                  )}

                  {/* DONE: show feedback that was given */}
                  {isDone && task.feedback && (
                    <div className="bg-slate-50 p-4 rounded-xl">
                      <p className="text-xs font-bold text-slate-400 uppercase mb-2">Feedback Coach:</p>
                      <p className="text-sm text-slate-600">&ldquo;{task.feedback}&rdquo;</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
