'use client';

import Link from 'next/link';
import { useState, type CSSProperties, type ReactNode } from 'react';

type BlockListItem = {
  id: string;
  title: string;
  summary?: string | null;
  order: number;
  lessonCount: number;
  manageUrl: string;
  editDetail: ReactNode;
  deleteAction?: ReactNode;
};

type BlockListProps = {
  items: BlockListItem[];
};

export default function BlockList({ items }: BlockListProps) {
  const [activeEditId, setActiveEditId] = useState<string | null>(null);
  const editModal = items.find((item) => item.id === activeEditId) ?? null;

  return (
    <>
      <ul style={listStyle}>
        {items.map((item) => (
          <li key={item.id} style={listItemStyle}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <strong style={{ fontSize: '1rem', color: '#0f172a' }}>
                {item.order + 1}. {item.title}
              </strong>
              {item.summary ? <p style={{ fontSize: '0.85rem', color: '#64748b' }}>{item.summary}</p> : null}
              <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Total lesson: {item.lessonCount}</span>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <Link href={item.manageUrl} style={primaryButtonStyle}>
                Kelola Lesson
              </Link>
              <button
                type="button"
                onClick={() => setActiveEditId(item.id)}
                style={iconButtonStyle}
                title="Edit informasi block"
              >
                ✏️
              </button>
              {item.deleteAction ?? null}
            </div>
          </li>
        ))}
      </ul>

      {editModal ? (
        <Modal onClose={() => setActiveEditId(null)} title={`Edit block • ${editModal.title}`}>
          {editModal.editDetail}
        </Modal>
      ) : null}
    </>
  );
}

function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        <div style={modalHeaderStyle}>
          <strong style={{ fontSize: '1.1rem', color: '#0f172a' }}>{title}</strong>
          <button type="button" onClick={onClose} style={closeButtonStyle}>
            ×
          </button>
        </div>
        <div style={{ overflowY: 'auto', maxHeight: '75vh' }}>{children}</div>
      </div>
    </div>
  );
}

const listStyle: CSSProperties = {
  listStyle: 'none',
  padding: 0,
  margin: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: '0.75rem',
};

const listItemStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  border: '1px solid #e2e8f0',
  borderRadius: '0.75rem',
  padding: '0.85rem 1rem',
  background: '#fff',
  gap: '1rem',
  flexWrap: 'wrap',
};

const primaryButtonStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '0.4rem 0.85rem',
  borderRadius: '0.5rem',
  background: '#2563eb',
  color: '#ffffff',
  fontWeight: 600,
  cursor: 'pointer',
  fontSize: '0.85rem',
  border: 'none',
  transition: 'background 0.2s',
  textDecoration: 'none',
};

const iconButtonStyle: CSSProperties = {
  padding: '0.4rem',
  borderRadius: '0.5rem',
  border: '1px solid #cbd5f5',
  background: '#f8fafc',
  color: '#0f172a',
  cursor: 'pointer',
  fontSize: '1rem',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '32px',
  height: '32px',
};

const overlayStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(15, 23, 42, 0.35)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 60,
};

const modalStyle: CSSProperties = {
  width: 'min(720px, 92vw)',
  background: '#ffffff',
  borderRadius: '1rem',
  boxShadow: '0 25px 80px rgba(15, 23, 42, 0.25)',
  padding: '1.25rem 1.5rem',
  display: 'flex',
  flexDirection: 'column',
  gap: '1rem',
};

const modalHeaderStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
};

const closeButtonStyle: CSSProperties = {
  border: 'none',
  background: 'transparent',
  fontSize: '1.5rem',
  lineHeight: 1,
  cursor: 'pointer',
};
