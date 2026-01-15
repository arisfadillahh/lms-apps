'use client';

import type { CSSProperties } from 'react';
import { useState, useTransition, useEffect } from 'react';
import { useRouter } from 'next/navigation';

import type { BlockRecord } from '@/lib/dao/blocksDao';
import BlockSoftwareSelector from './BlockSoftwareSelector';

type UpdateBlockFormProps = {
  block: BlockRecord;
};

export default function UpdateBlockForm({ block }: UpdateBlockFormProps) {
  const router = useRouter();
  const [name, setName] = useState(block.name);
  const [summary, setSummary] = useState(block.summary ?? '');
  const [orderIndex, setOrderIndex] = useState<string>(String(block.order_index));
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Software state
  const [selectedSoftwareIds, setSelectedSoftwareIds] = useState<string[]>([]);
  const [softwareLoaded, setSoftwareLoaded] = useState(false);

  // Load current software for this block
  useEffect(() => {
    async function loadSoftware() {
      try {
        const response = await fetch(`/api/admin/curriculum/blocks/${block.id}/software`);
        if (response.ok) {
          const data = await response.json();
          setSelectedSoftwareIds(data.map((s: { id: string }) => s.id));
        }
      } catch (error) {
        console.error('Failed to load block software', error);
      } finally {
        setSoftwareLoaded(true);
      }
    }
    loadSoftware();
  }, [block.id]);

  const handleSubmit = () => {
    setMessage(null);
    setErrorMessage(null);

    const payload: Record<string, unknown> = {};

    if (name !== block.name) payload.name = name;
    if (summary.trim() !== (block.summary ?? '')) payload.summary = summary.trim() || undefined;
    if (Number(orderIndex) !== block.order_index) payload.orderIndex = Number(orderIndex);

    startTransition(async () => {
      try {
        // Update block details if changed
        if (Object.keys(payload).length > 0) {
          const response = await fetch(`/api/admin/curriculum/blocks/${block.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            setErrorMessage(data.error ?? 'Gagal menyimpan perubahan');
            return;
          }
        }

        // Update software
        await fetch(`/api/admin/curriculum/blocks/${block.id}/software`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ softwareIds: selectedSoftwareIds }),
        });

        setMessage('Perubahan disimpan');
        router.refresh();
        setTimeout(() => setMessage(null), 3000);
      } catch (error) {
        console.error('Update block error', error);
        setErrorMessage('Terjadi kesalahan');
      }
    });
  };

  return (
    <div style={formContainerStyle}>
      <div style={rowStyle}>
        <label style={labelStyle}>Nama</label>
        <input type="text" value={name} onChange={(event) => setName(event.target.value)} style={inputStyle} />
      </div>
      <div style={rowStyle}>
        <label style={labelStyle}>Ringkasan</label>
        <textarea value={summary} onChange={(event) => setSummary(event.target.value)} rows={2} style={textareaStyle} />
      </div>
      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={rowStyle}>
          <label style={labelStyle}>Urutan</label>
          <input
            type="number"
            value={orderIndex}
            onChange={(event) => setOrderIndex(event.target.value)}
            style={inputStyle}
          />
        </div>
      </div>

      {/* Software Selection */}
      <div style={{ ...rowStyle, marginTop: '0.5rem', paddingTop: '0.75rem', borderTop: '1px solid #e2e8f0' }}>
        <label style={labelStyle}>Software yang Digunakan</label>
        {softwareLoaded ? (
          <BlockSoftwareSelector
            selectedIds={selectedSoftwareIds}
            onChange={setSelectedSoftwareIds}
          />
        ) : (
          <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Memuat...</span>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.5rem' }}>
        <button
          type="button"
          onClick={handleSubmit}
          style={buttonStyle}
          disabled={isPending}
        >
          {isPending ? 'Menyimpan…' : 'Simpan Perubahan'}
        </button>
        {message ? <span style={{ fontSize: '0.8rem', color: 'var(--color-success)' }}>{message}</span> : null}
        {errorMessage ? <span style={{ fontSize: '0.8rem', color: 'var(--color-danger)' }}>{errorMessage}</span> : null}
      </div>
    </div>
  );
}

const formContainerStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.75rem',
  padding: '0.85rem 1rem',
  borderRadius: 'var(--radius-lg)',
  border: `1px solid var(--color-border)`,
  background: 'var(--color-bg-surface)',
  boxShadow: 'var(--shadow-medium)',
};

const rowStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.35rem',
};

const labelStyle: CSSProperties = {
  fontSize: '0.85rem',
  fontWeight: 500,
  color: '#334155', // Slate-700, darker than before
};

const inputStyle: CSSProperties = {
  padding: '0.5rem 0.65rem',
  borderRadius: '0.5rem',
  border: `1px solid #cbd5e1`, // Slate-300
  fontSize: '0.9rem',
  color: '#0f172a', // Slate-900
  background: '#ffffff',
};

const textareaStyle: CSSProperties = {
  ...inputStyle,
  resize: 'vertical',
  minHeight: '3.2rem',
};

const buttonStyle: CSSProperties = {
  padding: '0.5rem 1.1rem',
  borderRadius: '0.5rem',
  border: 'none',
  background: '#1e3a5f',
  color: '#ffffff',
  fontWeight: 600,
  cursor: 'pointer',
};

