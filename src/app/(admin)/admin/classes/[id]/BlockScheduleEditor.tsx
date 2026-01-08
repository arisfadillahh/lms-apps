"use client";

import { useState, type CSSProperties } from 'react';

import InstantiateBlockForm from './InstantiateBlockForm';
import type { BlockRecord } from '@/lib/dao/blocksDao';

type BlockScheduleEditorProps = {
  classId: string;
  availableBlocks: BlockRecord[];
  defaultStartDate: string;
  defaultBlockId?: string;
  triggerLabel?: string;
  triggerContent?: React.ReactNode;
  buttonStyleOverride?: CSSProperties;
};

export default function BlockScheduleEditor({
  classId,
  availableBlocks,
  defaultStartDate,
  defaultBlockId,
  triggerLabel = 'Edit block schedule',
  triggerContent,
  buttonStyleOverride,
}: BlockScheduleEditorProps) {
  const [open, setOpen] = useState(false);
  const hasBlocks = availableBlocks.length > 0;

  return (
    <div style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={!hasBlocks}
        style={{ ...editButtonStyle(hasBlocks), ...buttonStyleOverride }}
        aria-label={triggerLabel}
      >
        {triggerContent ?? triggerLabel}
      </button>
      {open ? (
        <div style={overlayStyle}>
          <div style={modalStyle}>
            <div style={modalHeaderStyle}>
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: '#0f172a' }}>Edit block & tanggal mulai</h3>
                <p style={{ color: '#64748b', fontSize: '0.85rem' }}>
                  Pilih block baru dan tanggal mulai. Lesson akan langsung disalin dari template block sesuai urutan kurikulum.
                </p>
              </div>
              <button type="button" onClick={() => setOpen(false)} style={closeButtonStyle}>
                ×
              </button>
            </div>
            {hasBlocks ? (
              <InstantiateBlockForm
                classId={classId}
                availableBlocks={availableBlocks}
                defaultStartDate={defaultStartDate}
                initialBlockId={defaultBlockId}
              />
            ) : (
              <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Belum ada block untuk level ini.</p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

const editButtonStyle = (enabled: boolean): CSSProperties => ({
  padding: '0.55rem 0.9rem',
  borderRadius: '0.5rem',
  border: '1px solid #cbd5f5',
  background: enabled ? '#f8fafc' : '#e2e8f0',
  color: '#0f172a',
  fontWeight: 600,
  cursor: enabled ? 'pointer' : 'not-allowed',
});

const overlayStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(15, 23, 42, 0.35)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 50,
};

const modalStyle: CSSProperties = {
  width: 'min(640px, 90vw)',
  maxHeight: '90vh',
  overflowY: 'auto',
  background: '#ffffff',
  borderRadius: '1rem',
  boxShadow: '0 25px 80px rgba(15, 23, 42, 0.25)',
  padding: '1.5rem',
  display: 'flex',
  flexDirection: 'column',
  gap: '1rem',
};

const modalHeaderStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: '1rem',
};

const closeButtonStyle: CSSProperties = {
  border: 'none',
  background: 'transparent',
  fontSize: '1.5rem',
  lineHeight: 1,
  cursor: 'pointer',
};
