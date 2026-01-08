'use client';

import { useState } from 'react';
import type React from 'react';

import MarkSessionCompleteButton from '@/app/(coach)/coach/classes/[id]/MarkSessionCompleteButton';

type SessionActionsProps = {
  sessionId: string;
  zoomLink: string;
  canComplete: boolean;
  slideUrl?: string | null;
  slideTitle?: string | null;
};

const DRIVE_UPLOAD_URL =
  'https://drive.google.com/drive/folders/1ywvqZ3wDPhpQDGwdr4hu4izafyGtCqQc?usp=drive_link';

export default function SessionActions({
  sessionId,
  zoomLink,
  canComplete,
  slideUrl,
  slideTitle,
}: SessionActionsProps) {
  const [showSlides, setShowSlides] = useState(false);

  const handleOpenSlides = () => {
    if (!slideUrl) {
      return;
    }
    setShowSlides(true);
  };

  return (
    <>
      <div style={actionsRowStyle}>
        <a
          href={zoomLink}
          target="_blank"
          rel="noreferrer"
          style={{ ...primaryButtonStyle, background: '#2563eb', borderColor: '#2563eb' }}
        >
          Mulai kelas
        </a>
        <a
          href={DRIVE_UPLOAD_URL}
          target="_blank"
          rel="noreferrer"
          style={{ ...primaryButtonStyle, background: '#16a34a', borderColor: '#16a34a' }}
        >
          Upload dokumentasi
        </a>
        <button
          type="button"
          onClick={handleOpenSlides}
          disabled={!slideUrl}
          style={{
            ...primaryButtonStyle,
            background: slideUrl ? '#9333ea' : '#e5e7eb',
            borderColor: slideUrl ? '#9333ea' : '#e5e7eb',
            color: slideUrl ? '#fff' : '#94a3b8',
            cursor: slideUrl ? 'pointer' : 'not-allowed',
          }}
        >
          {slideUrl ? 'Buka slide' : 'Slide belum tersedia'}
        </button>
        {canComplete ? <MarkSessionCompleteButton sessionId={sessionId} /> : null}
      </div>

      {showSlides && slideUrl ? (
        <div style={modalOverlayStyle} role="dialog" aria-modal="true">
          <div style={modalContentStyle}>
            <header style={modalHeaderStyle}>
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                  Slide Pembelajaran
                </h3>
                {slideTitle ? (
                  <p style={{ fontSize: '0.85rem', color: '#64748b' }}>{slideTitle}</p>
                ) : null}
              </div>
              <button type="button" onClick={() => setShowSlides(false)} style={closeButtonStyle}>
                Tutup
              </button>
            </header>
            <div style={modalBodyStyle}>
              <iframe
                title={slideTitle ?? 'Slide pembelajaran'}
                src={slideUrl}
                style={{ width: '100%', height: '100%', border: 'none', borderRadius: '0.75rem' }}
                allow="fullscreen"
                allowFullScreen
              />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

const actionsRowStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '0.75rem',
  alignItems: 'center',
};

const primaryButtonStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '0.55rem 1.1rem',
  borderRadius: '0.5rem',
  border: '1px solid transparent',
  color: '#fff',
  fontWeight: 600,
  fontSize: '0.95rem',
  textDecoration: 'none',
  cursor: 'pointer',
  transition: 'opacity 0.2s ease',
};

const modalOverlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(15, 23, 42, 0.6)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '2rem',
  zIndex: 1000,
};

const modalContentStyle: React.CSSProperties = {
  background: '#fff',
  borderRadius: '0.85rem',
  width: 'min(960px, 90vw)',
  height: 'min(600px, 80vh)',
  boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.35)',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
};

const modalHeaderStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '1rem 1.25rem',
  borderBottom: '1px solid #e2e8f0',
};

const closeButtonStyle: React.CSSProperties = {
  padding: '0.4rem 0.85rem',
  borderRadius: '0.5rem',
  border: '1px solid #cbd5f5',
  background: '#f8fafc',
  color: '#0f172a',
  fontWeight: 600,
  cursor: 'pointer',
};

const modalBodyStyle: React.CSSProperties = {
  flex: 1,
  padding: '1rem 1.25rem 1.25rem',
  background: '#f1f5f9',
};
