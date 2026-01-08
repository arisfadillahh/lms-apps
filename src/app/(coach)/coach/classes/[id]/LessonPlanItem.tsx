'use client';

import type { CSSProperties } from 'react';
import { useMemo, useState } from 'react';

import type { ClassLessonRecord } from '@/lib/dao/classLessonsDao';
import type { LessonTemplateRecord } from '@/lib/dao/lessonTemplatesDao';
import { normalizeSlideUrl } from '@/lib/slides';

type LessonPlanItemProps = {
  lesson: ClassLessonRecord;
  template: LessonTemplateRecord | null;
  highlight?: 'current' | 'next';
};

export default function LessonPlanItem({ lesson, template, highlight }: LessonPlanItemProps) {
  const [open, setOpen] = useState(false);

  const rawSlideUrl = lesson.slide_url ?? template?.slide_url ?? null;
  const normalizedSlideUrl = useMemo(() => normalizeSlideUrl(rawSlideUrl) ?? rawSlideUrl, [rawSlideUrl]);
  const embedUrl = useMemo(() => (normalizedSlideUrl ? toGoogleSlidesEmbed(normalizedSlideUrl) : null), [normalizedSlideUrl]);
  const summary = lesson.summary ?? template?.summary ?? null;
  const durationMinutes = lesson.duration_minutes ?? template?.duration_minutes ?? null;
  const makeUpInstructions = lesson.make_up_instructions ?? template?.make_up_instructions ?? null;

  return (
    <>
      <div style={{ ...cardStyle, ...getHighlightStyle(highlight) }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          <strong style={{ color: '#0f172a' }}>
            #{(lesson.order_index ?? 0) + 1} {lesson.title}
          </strong>
          {summary ? <p style={{ color: '#475569', fontSize: '0.85rem' }}>{summary}</p> : null}
          {normalizedSlideUrl ? (
            <span style={hintStyle}>Slide tersedia. Buka untuk melihat detail.</span>
          ) : (
            <span style={mutedStyle}>Belum ada link Google Slides.</span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {highlight ? <span style={highlight === 'current' ? currentBadgeStyle : nextBadgeStyle}>{highlight === 'current' ? 'Lesson saat ini' : 'Lesson berikutnya'}</span> : null}
          <button type="button" onClick={() => setOpen(true)} style={primaryButton}>
            Lihat Lesson Plan
          </button>
        </div>
      </div>

      {open ? (
        <div style={modalBackdropStyle}>
          <div style={modalContainerStyle}>
            <header style={modalHeaderStyle}>
              <div>
                <p style={modalSubtitleStyle}>Lesson plan</p>
                <h3 style={modalTitleStyle}>
                  #{(lesson.order_index ?? 0) + 1} {lesson.title}
                </h3>
              </div>
              <button type="button" onClick={() => setOpen(false)} style={closeButtonStyle}>
                ✕
              </button>
            </header>

            <div style={modalBodyStyle}>
              {embedUrl ? (
                <iframe
                  src={embedUrl}
                  title={`Slide ${lesson.title}`}
                  style={iframeStyle}
                  allow="fullscreen"
                  allowFullScreen
                  loading="lazy"
                />
              ) : normalizedSlideUrl ? (
                <a href={normalizedSlideUrl} target="_blank" rel="noreferrer" style={linkStyle}>
                  Buka Google Slides di tab baru
                </a>
              ) : (
                <span style={mutedStyle}>Belum ada slide yang disiapkan untuk lesson ini.</span>
              )}

              <section style={detailSectionStyle}>
                <h4 style={detailHeadingStyle}>Detail Lesson</h4>
                <ul style={detailListStyle}>
                  <li>
                    <strong>Urutan:</strong> {lesson.order_index + 1}
                  </li>
                  <li>
                    <strong>Durasi:</strong> {durationMinutes ?? '—'} menit
                  </li>
                </ul>
                {summary ? <p style={detailParagraphStyle}>{summary}</p> : null}
                {makeUpInstructions ? (
                  <div style={makeUpBoxStyle}>
                    <strong style={{ display: 'block', marginBottom: '0.35rem' }}>Instruksi make-up</strong>
                    <p style={detailParagraphStyle}>{makeUpInstructions}</p>
                  </div>
                ) : null}
              </section>

              <section style={detailSectionStyle}>
                <h4 style={detailHeadingStyle}>Contoh Game</h4>
                {lesson.coach_example_url ? (
                  <a href={lesson.coach_example_url} target="_blank" rel="noreferrer" style={linkStyle}>
                    Buka contoh game yang disiapkan admin
                  </a>
                ) : (
                  <span style={mutedStyle}>Belum ada file contoh game. Hubungi admin untuk menambahkannya.</span>
                )}
              </section>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function toGoogleSlidesEmbed(url: string): string {
  const normalized = normalizeSlideUrl(url) ?? url;
  return normalized;
}

const cardStyle: CSSProperties = {
  border: '1px solid #e2e8f0',
  borderRadius: '0.75rem',
  padding: '0.85rem 1rem',
  background: '#f8fafc',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.6rem',
};

const hintStyle: CSSProperties = {
  fontSize: '0.75rem',
  color: '#2563eb',
  fontWeight: 600,
};

const mutedStyle: CSSProperties = {
  fontSize: '0.8rem',
  color: '#94a3b8',
};

const primaryButton: CSSProperties = {
  alignSelf: 'flex-start',
  padding: '0.45rem 0.85rem',
  borderRadius: '0.5rem',
  border: 'none',
  background: '#2563eb',
  color: '#fff',
  fontSize: '0.85rem',
  fontWeight: 600,
  cursor: 'pointer',
};

function getHighlightStyle(highlight?: 'current' | 'next'): CSSProperties {
  if (highlight === 'current') {
    return {
      borderColor: '#2563eb',
      background: 'rgba(37, 99, 235, 0.1)',
    };
  }
  if (highlight === 'next') {
    return {
      borderColor: '#f97316',
      background: 'rgba(249, 115, 22, 0.1)',
    };
  }
  return {};
}

const currentBadgeStyle: CSSProperties = {
  padding: '0.2rem 0.6rem',
  borderRadius: '999px',
  background: '#2563eb',
  color: '#fff',
  fontSize: '0.75rem',
  fontWeight: 600,
};

const nextBadgeStyle: CSSProperties = {
  ...currentBadgeStyle,
  background: '#f97316',
};

const modalBackdropStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(15, 23, 42, 0.55)',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  padding: '1.5rem',
  zIndex: 1000,
};

const modalContainerStyle: CSSProperties = {
  width: '100%',
  maxWidth: '960px',
  maxHeight: '95vh',
  overflow: 'hidden',
  borderRadius: '1rem',
  background: '#ffffff',
  display: 'flex',
  flexDirection: 'column',
  boxShadow: '0 20px 40px rgba(15, 23, 42, 0.2)',
};

const modalHeaderStyle: CSSProperties = {
  padding: '1rem 1.25rem',
  borderBottom: '1px solid #e2e8f0',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: '1rem',
};

const modalSubtitleStyle: CSSProperties = {
  fontSize: '0.8rem',
  color: '#64748b',
  marginBottom: '0.25rem',
};

const modalTitleStyle: CSSProperties = {
  fontSize: '1.25rem',
  fontWeight: 600,
  color: '#0f172a',
};

const closeButtonStyle: CSSProperties = {
  border: 'none',
  background: 'transparent',
  fontSize: '1.25rem',
  cursor: 'pointer',
  color: '#475569',
};

const modalBodyStyle: CSSProperties = {
  padding: '1.25rem',
  display: 'flex',
  flexDirection: 'column',
  gap: '1.25rem',
  overflowY: 'auto',
};

const iframeStyle: CSSProperties = {
  width: '100%',
  minHeight: '420px',
  border: '1px solid #e2e8f0',
  borderRadius: '0.75rem',
};

const detailSectionStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.6rem',
  border: '1px solid #e2e8f0',
  borderRadius: '0.75rem',
  padding: '0.9rem 1rem',
  background: '#f8fafc',
};

const detailHeadingStyle: CSSProperties = {
  fontSize: '1rem',
  fontWeight: 600,
  color: '#0f172a',
};

const detailListStyle: CSSProperties = {
  display: 'flex',
  gap: '1.5rem',
  listStyle: 'none',
  padding: 0,
  margin: 0,
  fontSize: '0.85rem',
  color: '#475569',
  flexWrap: 'wrap',
};

const detailParagraphStyle: CSSProperties = {
  fontSize: '0.9rem',
  color: '#334155',
  lineHeight: 1.6,
  whiteSpace: 'pre-line',
};

const makeUpBoxStyle: CSSProperties = {
  borderRadius: '0.65rem',
  background: 'rgba(37, 99, 235, 0.08)',
  padding: '0.75rem',
  color: '#1d4ed8',
};

const linkStyle: CSSProperties = {
  fontSize: '0.85rem',
  color: '#2563eb',
  fontWeight: 600,
};
