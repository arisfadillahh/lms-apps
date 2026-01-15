'use client';

import { useState } from 'react';
import type React from 'react';
import { Video, BookOpen, CheckCircle, ExternalLink, Play } from 'lucide-react';

import MarkSessionCompleteButton from '@/app/(coach)/coach/classes/[id]/MarkSessionCompleteButton';

type SessionActionsProps = {
  sessionId: string;
  zoomLink: string;
  canComplete: boolean;
  slideUrl?: string | null;
  slideTitle?: string | null;
};

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
      <div style={actionsGridStyle}>
        {/* Main Action Card - Zoom */}
        <div style={actionCardStyle}>
          <div style={{ ...iconWrapperStyle, background: '#eff6ff', color: '#3b82f6' }}>
            <Video size={24} />
          </div>
          <div style={{ flex: 1 }}>
            <h3 style={cardTitleStyle}>Kelas Online</h3>
            <p style={cardDescStyle}>Mulai kelas via Zoom</p>
          </div>
          <a
            href={zoomLink}
            target="_blank"
            rel="noreferrer"
            style={launchButtonStyle}
          >
            <Play size={16} fill="currentColor" /> Mulai
          </a>
        </div>

        {/* Slides Card */}
        <div style={actionCardStyle}>
          <div style={{ ...iconWrapperStyle, background: '#f5f3ff', color: '#8b5cf6' }}>
            <BookOpen size={24} />
          </div>
          <div style={{ flex: 1 }}>
            <h3 style={cardTitleStyle}>Materi & Slide</h3>
            <p style={cardDescStyle}>{slideTitle ? 'Materi tersedia' : 'Belum tersedia'}</p>
          </div>
          <button
            type="button"
            onClick={handleOpenSlides}
            disabled={!slideUrl}
            style={{
              ...secondaryButtonStyle,
              opacity: slideUrl ? 1 : 0.5,
              cursor: slideUrl ? 'pointer' : 'not-allowed',
            }}
          >
            Buka Slide
          </button>
        </div>

        {/* Status Card */}
        {canComplete ? (
          <div style={actionCardStyle}>
            <div style={{ ...iconWrapperStyle, background: '#ecfdf5', color: '#10b981' }}>
              <CheckCircle size={24} />
            </div>
            <div style={{ flex: 1 }}>
              <h3 style={cardTitleStyle}>Status Sesi</h3>
              <p style={cardDescStyle}>Tandai selesai</p>
            </div>
            <div style={{ transform: 'scale(0.95)', transformOrigin: 'right center' }}>
              <MarkSessionCompleteButton sessionId={sessionId} />
            </div>
          </div>
        ) : null}
      </div>

      {showSlides && slideUrl ? (
        <div style={modalOverlayStyle} role="dialog" aria-modal="true">
          <div style={modalContentStyle}>
            <header style={modalHeaderStyle}>
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.25rem', color: '#1e293b' }}>
                  Slide Pembelajaran
                </h3>
                {slideTitle ? (
                  <p style={{ fontSize: '0.9rem', color: '#64748b' }}>{slideTitle}</p>
                ) : null}
              </div>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <a
                  href={slideUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={externalLinkStyle}
                >
                  <ExternalLink size={16} /> Buka di Tab Baru
                </a>
                <button type="button" onClick={() => setShowSlides(false)} style={closeButtonStyle}>
                  Tutup
                </button>
              </div>
            </header>
            <div style={modalBodyStyle}>
              <iframe
                title={slideTitle ?? 'Slide pembelajaran'}
                src={slideUrl.replace('/pub?', '/embed?')}
                style={{ width: '100%', height: '100%', border: 'none', borderRadius: '0.75rem', background: '#f1f5f9' }}
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

const actionsGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
  gap: '1.5rem',
  marginBottom: '2rem',
};

const actionCardStyle: React.CSSProperties = {
  background: '#ffffff',
  border: '1px solid #e2e8f0',
  borderRadius: '16px',
  padding: '1.5rem',
  display: 'flex',
  alignItems: 'center',
  gap: '1rem',
  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
  transition: 'transform 0.2s',
};

const iconWrapperStyle: React.CSSProperties = {
  width: '3.5rem',
  height: '3.5rem',
  borderRadius: '12px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const cardTitleStyle: React.CSSProperties = {
  fontSize: '1rem',
  fontWeight: 700,
  color: '#1e293b',
  marginBottom: '0.25rem',
};

const cardDescStyle: React.CSSProperties = {
  fontSize: '0.9rem',
  color: '#64748b',
};

const launchButtonStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.5rem',
  padding: '0.6rem 1.2rem',
  borderRadius: '10px',
  background: '#3b82f6',
  color: '#fff',
  fontWeight: 600,
  fontSize: '0.9rem',
  textDecoration: 'none',
  border: 'none',
  cursor: 'pointer',
  transition: 'background 0.2s',
  boxShadow: '0 4px 6px -1px rgba(59, 130, 246, 0.3)'
};

const secondaryButtonStyle: React.CSSProperties = {
  ...launchButtonStyle,
  background: '#fff',
  color: '#475569',
  border: '1px solid #cbd5e1',
  boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
};

const modalOverlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(15, 23, 42, 0.75)',
  backdropFilter: 'blur(4px)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '2rem',
  zIndex: 1000,
};

const modalContentStyle: React.CSSProperties = {
  background: '#fff',
  borderRadius: '16px',
  width: 'min(1000px, 95vw)',
  height: 'min(700px, 90vh)',
  boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
};

const modalHeaderStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '1.25rem 1.5rem',
  borderBottom: '1px solid #f1f5f9',
  background: '#fff'
};

const closeButtonStyle: React.CSSProperties = {
  padding: '0.5rem 1rem',
  borderRadius: '8px',
  border: '1px solid #e2e8f0',
  background: '#f8fafc',
  color: '#475569',
  fontWeight: 600,
  cursor: 'pointer',
  fontSize: '0.9rem'
};

const externalLinkStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  color: '#3b82f6',
  fontWeight: 600,
  fontSize: '0.9rem',
  textDecoration: 'none',
  padding: '0.5rem 1rem',
  borderRadius: '8px',
  background: '#eff6ff'
};

const modalBodyStyle: React.CSSProperties = {
  flex: 1,
  padding: '0',
  background: '#000',
};
