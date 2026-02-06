'use client';

import type { CSSProperties } from 'react';
import { useState } from 'react';
import { ExternalLink, Edit2, Check } from 'lucide-react';

interface MakeUpUploadFormProps {
  taskId: string;
  submittedFiles?: unknown;
  status: 'PENDING_UPLOAD' | 'SUBMITTED' | 'REVIEWED';
}

export default function MakeUpUploadForm({ taskId, submittedFiles, status }: MakeUpUploadFormProps) {
  const [driveLink, setDriveLink] = useState('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const validateGoogleDriveLink = (url: string): boolean => {
    return url.includes('drive.google.com') || url.includes('docs.google.com');
  };

  const submit = async () => {
    setStatusMessage(null);
    setErrorMessage(null);

    const url = driveLink.trim();

    if (!url) {
      setErrorMessage('Link Google Drive tidak boleh kosong');
      return;
    }

    if (!validateGoogleDriveLink(url)) {
      setErrorMessage('Pastikan link dari Google Drive');
      return;
    }

    const files = [{ name: 'Karya Makeup', url }];

    setIsPending(true);
    try {
      const response = await fetch(`/api/coder/makeup/${taskId}/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        setErrorMessage(payload.error ?? 'Gagal mengirim karya');
        return;
      }

      setStatusMessage('Berhasil! Coach akan segera meninjau karya kamu.');
      setDriveLink('');
      setIsEditing(false);

      // Reload after short delay to show updated status
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } finally {
      setIsPending(false);
    }
  };

  // Parse submitted files
  const getSubmittedUrl = (): string | null => {
    if (!submittedFiles || !Array.isArray(submittedFiles) || submittedFiles.length === 0) {
      return null;
    }
    const items = submittedFiles as Array<{ url?: string }>;
    return items[0]?.url || null;
  };

  const submittedUrl = getSubmittedUrl();
  const isSubmitted = status === 'SUBMITTED' || status === 'REVIEWED';

  // Show submitted link with edit button
  if (isSubmitted && !isEditing) {
    return (
      <div style={containerStyle}>
        <div style={{ ...submittedBoxStyle, animation: 'fadeIn 0.3s ease-in' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Karya yang Dikumpulkan
          </div>
          {submittedUrl ? (
            <>
              <a
                href={submittedUrl}
                target="_blank"
                rel="noreferrer"
                style={viewLinkStyle}
              >
                <ExternalLink size={16} />
                Lihat Karya
              </a>
              {status === 'SUBMITTED' && (
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  style={editButtonStyle}
                >
                  <Edit2 size={16} />
                  Edit Link
                </button>
              )}
            </>
          ) : (
            <p style={{ fontSize: '0.85rem', color: '#94a3b8', margin: 0 }}>Link tidak tersedia</p>
          )}
        </div>

        {status === 'REVIEWED' && (
          <div style={reviewedNoticeStyle}>
            <Check size={16} />
            Sudah direview oleh coach
          </div>
        )}

        <style>{keyframesStyle}</style>
      </div>
    );
  }

  // Show upload form
  return (
    <div style={containerStyle}>
      <div style={{ ...formCardStyle, animation: 'fadeIn 0.3s ease-in' }}>
        <div style={formHeaderStyle}>Link Google Drive</div>
        <input
          type="text"
          value={driveLink}
          onChange={(event) => setDriveLink(event.target.value)}
          placeholder="https://drive.google.com/file/d/..."
          style={inputStyle}
          disabled={isPending}
          autoFocus={isEditing}
        />
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            type="button"
            onClick={submit}
            disabled={isPending || !driveLink.trim()}
            style={submitButtonStyle}
          >
            {isPending ? 'Mengirim...' : isEditing ? 'Update Karya' : 'Kirim Karya'}
          </button>
          {isEditing && (
            <button
              type="button"
              onClick={() => {
                setIsEditing(false);
                setDriveLink('');
                setErrorMessage(null);
              }}
              style={cancelButtonStyle}
              disabled={isPending}
            >
              Batal
            </button>
          )}
        </div>
      </div>

      {statusMessage && (
        <div style={successMessageStyle}>{statusMessage}</div>
      )}
      {errorMessage && (
        <div style={errorMessageStyle}>{errorMessage}</div>
      )}

      <style>{keyframesStyle}</style>
    </div>
  );
}

// Styles
const containerStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.75rem',
  width: '100%',
};

const formCardStyle: CSSProperties = {
  padding: '1rem',
  background: '#f8fafc',
  border: '1px solid #e2e8f0',
  borderRadius: '8px',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.75rem',
};

const formHeaderStyle: CSSProperties = {
  fontSize: '0.75rem',
  fontWeight: 600,
  color: '#475569',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
};

const inputStyle: CSSProperties = {
  width: '100%',
  borderRadius: '6px',
  border: '1px solid #cbd5e1',
  padding: '0.65rem',
  fontSize: '0.85rem',
  fontFamily: 'inherit',
};

const submitButtonStyle: CSSProperties = {
  flex: 1,
  padding: '0.65rem 1rem',
  borderRadius: '6px',
  border: 'none',
  background: '#3b82f6',
  color: '#fff',
  fontWeight: 600,
  fontSize: '0.85rem',
  cursor: 'pointer',
  boxShadow: '0 2px 4px rgba(59, 130, 246, 0.2)',
};

const cancelButtonStyle: CSSProperties = {
  padding: '0.65rem 1rem',
  borderRadius: '6px',
  border: '1px solid #cbd5e1',
  background: '#fff',
  color: '#64748b',
  fontWeight: 600,
  fontSize: '0.85rem',
  cursor: 'pointer',
};

const submittedBoxStyle: CSSProperties = {
  padding: '1rem',
  background: '#f8fafc',
  border: '1px solid #e2e8f0',
  borderRadius: '8px',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.75rem',
};

const viewLinkStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '0.5rem',
  padding: '0.65rem 1rem',
  borderRadius: '6px',
  background: '#3b82f6',
  color: '#fff',
  fontWeight: 600,
  fontSize: '0.85rem',
  textDecoration: 'none',
  boxShadow: '0 2px 4px rgba(59, 130, 246, 0.2)',
};

const editButtonStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '0.5rem',
  padding: '0.65rem 1rem',
  borderRadius: '6px',
  background: '#fff',
  border: '1px solid #cbd5e1',
  color: '#64748b',
  fontWeight: 600,
  fontSize: '0.85rem',
  cursor: 'pointer',
};

const reviewedNoticeStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  padding: '0.65rem 1rem',
  background: '#f0fdf4',
  border: '1px solid #bbf7d0',
  borderRadius: '6px',
  color: '#15803d',
  fontSize: '0.8rem',
  fontWeight: 500,
};

const successMessageStyle: CSSProperties = {
  padding: '0.6rem',
  background: '#f0fdf4',
  border: '1px solid #bbf7d0',
  borderRadius: '6px',
  color: '#15803d',
  fontSize: '0.8rem',
  fontWeight: 500,
};

const errorMessageStyle: CSSProperties = {
  padding: '0.6rem',
  background: '#fef2f2',
  border: '1px solid #fecaca',
  borderRadius: '6px',
  color: '#b91c1c',
  fontSize: '0.8rem',
  fontWeight: 500,
};

// Keyframes for animations
const keyframesStyle = `
  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateY(-10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
`;
