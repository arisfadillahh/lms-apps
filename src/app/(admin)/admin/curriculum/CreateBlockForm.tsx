'use client';

import type { CSSProperties } from 'react';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import BlockSoftwareSelector from './BlockSoftwareSelector';

type CreateBlockFormProps = {
  levelId: string;
  suggestedOrderIndex: number;
};

export default function CreateBlockForm({ levelId, suggestedOrderIndex }: CreateBlockFormProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const [name, setName] = useState('');
  const [summary, setSummary] = useState('');
  const [orderIndex, setOrderIndex] = useState(String(suggestedOrderIndex));
  const [selectedSoftwareIds, setSelectedSoftwareIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleOpen = () => {
    setOrderIndex(String(suggestedOrderIndex));
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setName('');
    setSummary('');
    setOrderIndex(String(suggestedOrderIndex));
    setSelectedSoftwareIds([]);
    setError(null);
  };

  const handleSubmit = () => {
    if (!name.trim()) {
      setError('Nama block wajib diisi');
      return;
    }
    setError(null);

    startTransition(async () => {
      try {
        const payload = {
          levelId,
          name: name.trim(),
          summary: summary.trim() || undefined,
          orderIndex: Number(orderIndex),
          softwareIds: selectedSoftwareIds,
        };

        const response = await fetch('/api/admin/curriculum/blocks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          setError(data.error || 'Gagal membuat block');
          return;
        }

        handleClose();
        router.refresh();
      } catch (err) {
        console.error(err);
        setError('Terjadi kesalahan');
      }
    });
  };

  return (
    <>
      <button onClick={handleOpen} style={triggerStyle}>
        + Tambah Block
      </button>

      {open && (
        <div style={backdropStyle} onClick={handleClose}>
          <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
            <h3 style={titleStyle}>Tambah Block Baru</h3>

            <div style={fieldStyle}>
              <label style={labelStyle}>Nama Block *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Contoh: Block 1 - Animasi"
                style={inputStyle}
                autoFocus
              />
            </div>

            <div style={fieldStyle}>
              <label style={labelStyle}>Ringkasan (opsional)</label>
              <textarea
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="Deskripsi singkat block ini..."
                rows={2}
                style={{ ...inputStyle, resize: 'vertical' }}
              />
            </div>

            <div style={fieldStyle}>
              <label style={labelStyle}>Urutan</label>
              <input
                type="number"
                value={orderIndex}
                onChange={(e) => setOrderIndex(e.target.value)}
                min={0}
                style={{ ...inputStyle, width: '100px' }}
              />
            </div>

            <div style={fieldStyle}>
              <label style={labelStyle}>Software yang Digunakan</label>
              <BlockSoftwareSelector
                selectedIds={selectedSoftwareIds}
                onChange={setSelectedSoftwareIds}
              />
            </div>

            {error && <p style={errorStyle}>{error}</p>}

            <div style={actionsStyle}>
              <button onClick={handleClose} style={cancelStyle} disabled={isPending}>
                Batal
              </button>
              <button onClick={handleSubmit} style={submitStyle} disabled={isPending}>
                {isPending ? 'Menyimpan...' : 'Simpan Block'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

const triggerStyle: CSSProperties = {
  padding: '0.6rem 1.2rem',
  borderRadius: '0.5rem',
  border: 'none',
  background: '#1e3a5f',
  color: '#fff',
  fontSize: '0.9rem',
  fontWeight: 600,
  cursor: 'pointer',
};

const backdropStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(15, 23, 42, 0.6)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 99999,
};

const modalStyle: CSSProperties = {
  background: '#fff',
  padding: '1.5rem',
  borderRadius: '1rem',
  width: '100%',
  maxWidth: '520px',
  maxHeight: '90vh',
  overflow: 'auto',
  boxShadow: '0 25px 50px rgba(0,0,0,0.25)',
};

const titleStyle: CSSProperties = {
  margin: '0 0 1.25rem 0',
  fontSize: '1.15rem',
  fontWeight: 600,
  color: '#0f172a',
};

const fieldStyle: CSSProperties = {
  marginBottom: '1rem',
};

const labelStyle: CSSProperties = {
  display: 'block',
  fontSize: '0.85rem',
  fontWeight: 500,
  color: '#334155',
  marginBottom: '0.35rem',
};

const inputStyle: CSSProperties = {
  width: '100%',
  padding: '0.55rem 0.75rem',
  borderRadius: '0.5rem',
  border: '1px solid #cbd5e1',
  fontSize: '0.9rem',
  color: '#0f172a',
};

const actionsStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: '0.75rem',
  marginTop: '1.25rem',
};

const cancelStyle: CSSProperties = {
  padding: '0.55rem 1rem',
  borderRadius: '0.5rem',
  border: '1px solid #e2e8f0',
  background: '#fff',
  color: '#475569',
  fontSize: '0.9rem',
  fontWeight: 600,
  cursor: 'pointer',
};

const submitStyle: CSSProperties = {
  padding: '0.55rem 1rem',
  borderRadius: '0.5rem',
  border: 'none',
  background: '#1e3a5f',
  color: '#fff',
  fontSize: '0.9rem',
  fontWeight: 600,
  cursor: 'pointer',
};

const errorStyle: CSSProperties = {
  color: '#dc2626',
  fontSize: '0.85rem',
  marginTop: '0.5rem',
};
