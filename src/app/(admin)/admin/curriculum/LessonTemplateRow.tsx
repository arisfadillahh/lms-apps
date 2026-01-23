'use client';

import type { CSSProperties } from 'react';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil, Save, X, ExternalLink } from 'lucide-react';

import type { LessonTemplateRecord } from '@/lib/dao/lessonTemplatesDao';
import LessonExampleUploader from '@/components/admin/LessonExampleUploader';
import DeleteLessonButton from './DeleteLessonButton';

type LessonTemplateRowProps = {
  lesson: LessonTemplateRecord;
};

export default function LessonTemplateRow({ lesson }: LessonTemplateRowProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(lesson.title);
  const [summary, setSummary] = useState(lesson.summary ?? '');
  const [orderIndex, setOrderIndex] = useState(String(lesson.order_index));
  const [estimatedMeetingCount, setEstimatedMeetingCount] = useState(
    lesson.estimated_meeting_count !== null ? String(lesson.estimated_meeting_count) : '',
  );
  const [slideUrl, setSlideUrl] = useState(lesson.slide_url ?? '');
  const [makeUpInstructions, setMakeUpInstructions] = useState(lesson.make_up_instructions ?? '');
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const resetForm = () => {
    setTitle(lesson.title);
    setSummary(lesson.summary ?? '');
    setOrderIndex(String(lesson.order_index));
    setEstimatedMeetingCount(lesson.estimated_meeting_count !== null ? String(lesson.estimated_meeting_count) : '');
    setSlideUrl(lesson.slide_url ?? '');
    setMakeUpInstructions(lesson.make_up_instructions ?? '');
  };

  const handleSave = () => {
    setMessage(null);
    setErrorMessage(null);

    const payload: Record<string, unknown> = {};

    if (title !== lesson.title) payload.title = title;
    if (summary.trim() !== (lesson.summary ?? '')) payload.summary = summary.trim() || undefined;
    if (slideUrl.trim() !== (lesson.slide_url ?? '')) payload.slideUrl = slideUrl.trim() || undefined;

    const orderValue = Number(orderIndex);
    if (!Number.isNaN(orderValue) && orderValue !== lesson.order_index) {
      payload.orderIndex = orderValue;
    }

    const nextSessions =
      estimatedMeetingCount.trim() === '' ? null : Number(estimatedMeetingCount);
    if (nextSessions !== lesson.estimated_meeting_count) {
      payload.estimatedMeetingCount = nextSessions;
    }

    if (makeUpInstructions.trim() !== (lesson.make_up_instructions ?? '')) {
      payload.makeUpInstructions = makeUpInstructions.trim() || undefined;
    }

    if (Object.keys(payload).length === 0) {
      setMessage('Tidak ada perubahan');
      setTimeout(() => setMessage(null), 2000);
      return;
    }

    startTransition(async () => {
      try {
        const response = await fetch(`/api/admin/curriculum/lessons/${lesson.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          setErrorMessage(data.error ?? 'Gagal memperbarui lesson');
          return;
        }

        setMessage('Lesson diperbarui');
        setEditing(false);
        router.refresh();
        setTimeout(() => setMessage(null), 3000);
      } catch (error) {
        console.error('Update lesson error', error);
        setErrorMessage('Terjadi kesalahan');
      }
    });
  };

  return (
    <div id={`lesson-${lesson.id}`} style={containerStyle}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
        <div style={headerRowStyle}>
          <strong style={{ color: 'var(--color-text-primary)' }}>{lesson.title}</strong>
          {editing ? (
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button type="button" onClick={handleSave} style={actionButtonStyle} disabled={isPending} title="Simpan">
                <Save size={16} />
                <span>Simpan</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditing(false);
                  resetForm();
                }}
                style={cancelButtonStyle}
                disabled={isPending}
                title="Batal"
              >
                <X size={16} />
              </button>
              <div style={separatorStyle} />
              <DeleteLessonButton lessonId={lesson.id} lessonTitle={lesson.title} />
            </div>
          ) : (
            <button type="button" onClick={() => setEditing(true)} style={editButtonStyle} title="Edit lesson">
              <Pencil size={14} />
              <span>Edit</span>
            </button>
          )}
        </div>
        {editing ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={fieldGroupStyle}>
              <label style={labelStyle}>Judul Lesson</label>
              <input type="text" value={title} onChange={(event) => setTitle(event.target.value)} style={inputStyle} />
            </div>
            <div style={fieldGroupStyle}>
              <label style={labelStyle}>Ringkasan</label>
              <textarea
                value={summary}
                rows={2}
                onChange={(event) => setSummary(event.target.value)}
                style={{ ...inputStyle, resize: 'vertical' }}
              />
            </div>
            <div style={fieldGroupStyle}>
              <label style={labelStyle}>URL Slide</label>
              <input
                type="url"
                value={slideUrl}
                onChange={(event) => setSlideUrl(event.target.value)}
                placeholder="https://docs.google.com/presentation/..."
                style={inputStyle}
              />
            </div>
          </div>
        ) : (
          <>
            {lesson.summary ? <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem' }}>{lesson.summary}</p> : null}
            {lesson.slide_url ? (
              <a href={lesson.slide_url} target="_blank" rel="noreferrer" style={linkStyle}>
                <ExternalLink size={12} style={{ marginRight: '0.25rem' }} />
                Buka Slide
              </a>
            ) : (
              <span style={{ fontSize: '0.8rem', color: '#cbd5f5' }}>Belum ada link slide</span>
            )}
            <div style={exampleRowStyle}>
              <span>Contoh Game (template)</span>
              {lesson.example_url ? (
                <a href={lesson.example_url} target="_blank" rel="noreferrer" style={linkStyle}>
                  Lihat
                </a>
              ) : (
                <span style={{ fontSize: '0.8rem', color: '#cbd5f5' }}>Belum ada</span>
              )}
            </div>
          </>
        )}
        <div style={{ display: 'flex', gap: '1rem', fontSize: '0.8rem', color: 'var(--color-text-muted)', flexWrap: 'wrap', marginTop: '0.5rem' }}>
          <span>Urutan: {lesson.order_index}</span>
          <span>Sesi: {lesson.estimated_meeting_count ?? '—'}</span>
          {lesson.make_up_instructions ? <span>Instruksi make-up tersedia</span> : null}
        </div>
      </div>
      <div style={{ minWidth: '220px', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {editing ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <div style={{ ...fieldGroupStyle, flex: '1', minWidth: '80px' }}>
                <label style={labelStyle}>Urutan</label>
                <input
                  type="number"
                  value={orderIndex}
                  onChange={(event) => setOrderIndex(event.target.value)}
                  style={{ ...inputStyle, width: '100%' }}
                />
              </div>
              <div style={{ ...fieldGroupStyle, flex: '1', minWidth: '100px' }}>
                <label style={labelStyle}>Jumlah Pertemuan</label>
                <input
                  type="number"
                  value={estimatedMeetingCount}
                  onChange={(event) => setEstimatedMeetingCount(event.target.value)}
                  style={{ ...inputStyle, width: '100%' }}
                  min={0}
                />
              </div>
            </div>
            <div style={fieldGroupStyle}>
              <label style={labelStyle}>Instruksi Make-Up</label>
              <textarea
                value={makeUpInstructions}
                onChange={(event) => setMakeUpInstructions(event.target.value)}
                rows={2}
                style={{ ...inputStyle, resize: 'vertical' }}
              />
            </div>
          </div>
        ) : null}
        {message ? <span style={{ fontSize: '0.75rem', color: 'var(--color-success)' }}>{message}</span> : null}
        {errorMessage ? <span style={{ fontSize: '0.75rem', color: 'var(--color-danger)' }}>{errorMessage}</span> : null}
        <LessonExampleUploader
          endpoint={`/api/admin/curriculum/lessons/${lesson.id}/example`}
          currentUrl={lesson.example_url}
          label="Contoh Game (template)"
          emptyHint="Belum ada contoh game untuk template ini."
          uploadSuccessMessage="Contoh game template diperbarui"
          deleteSuccessMessage="Contoh game template dihapus"
        />
      </div>
    </div>
  );
}

const containerStyle: CSSProperties = {
  display: 'flex',
  gap: '1rem',
  padding: '0.85rem 1rem',
  borderRadius: 'var(--radius-lg)',
  border: `1px solid var(--color-border)`,
  background: 'var(--color-bg-surface)',
  alignItems: 'flex-start',
  boxShadow: 'var(--shadow-medium)',
};

const inputStyle: CSSProperties = {
  padding: '0.45rem 0.6rem',
  borderRadius: '0.5rem',
  border: `1px solid #cbd5e1`,
  fontSize: '0.85rem',
  color: '#0f172a',
  background: '#ffffff',
};

const separatorStyle: CSSProperties = {
  width: '1px',
  height: '24px',
  background: '#e2e8f0',
  margin: '0 0.25rem',
};

const linkStyle: CSSProperties = {
  fontSize: '0.8rem',
  color: '#1e3a5f',
  fontWeight: 600,
};

const headerRowStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: '0.5rem',
};

const editButtonStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.35rem',
  padding: '0.4rem 0.75rem',
  border: '1px solid #d4dbe6',
  borderRadius: '0.5rem',
  background: '#f8fafc',
  cursor: 'pointer',
  fontSize: '0.8rem',
  color: '#475569',
  transition: 'all 0.15s ease',
};

const actionButtonStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.35rem',
  padding: '0.4rem 0.75rem',
  border: 'none',
  borderRadius: '0.5rem',
  background: '#1e3a5f',
  cursor: 'pointer',
  fontSize: '0.8rem',
  color: '#ffffff',
  fontWeight: 500,
};

const cancelButtonStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '0.4rem',
  border: '1px solid #d4dbe6',
  borderRadius: '0.5rem',
  background: '#ffffff',
  cursor: 'pointer',
  color: '#64748b',
};

const fieldGroupStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.25rem',
};

const labelStyle: CSSProperties = {
  fontSize: '0.75rem',
  fontWeight: 600,
  color: '#334155',
};

const exampleRowStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  fontSize: '0.8rem',
  color: 'var(--color-text-secondary)',
};
