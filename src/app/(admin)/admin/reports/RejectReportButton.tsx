'use client';

import { useTransition, useState } from 'react';
import { useRouter } from 'next/navigation';

interface RejectReportButtonProps {
  reportId: string;
  disabled?: boolean;
}

export default function RejectReportButton({ reportId, disabled }: RejectReportButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showModal, setShowModal] = useState(false);
  const [notes, setNotes] = useState('');

  const handleReject = () => {
    if (!notes.trim()) {
      window.alert('Mohon isi catatan revisi untuk Coach.');
      return;
    }

    startTransition(async () => {
      try {
        const response = await fetch(`/api/admin/reports/${reportId}/reject`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ revisionNotes: notes })
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload.error ?? 'Gagal mengembalikan rapor');
        }

        setShowModal(false);
        setNotes('');
        router.refresh();
      } catch (err: any) {
        window.alert(err.message);
      }
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setShowModal(true)}
        disabled={disabled || isPending}
        style={{
          padding: '0.45rem 0.85rem',
          borderRadius: '0.5rem',
          border: '1px solid #ef4444',
          background: '#fff',
          color: '#ef4444',
          fontSize: '0.85rem',
          fontWeight: 600,
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled || isPending ? 0.6 : 1,
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.4rem',
          transition: 'all 0.2s'
        }}
      >
        <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>undo</span>
        Nilai Ulang
      </button>

      {showModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '1rem'
        }}>
          <div style={{
            background: '#fff',
            padding: '1.5rem',
            borderRadius: '1rem',
            width: '100%',
            maxWidth: '400px',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)'
          }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.5rem' }}>Nilai Ulang Rapor</h3>
            <p style={{ fontSize: '0.9rem', color: '#64748b', marginBottom: '1rem' }}>
              Masukkan alasan revisi. Pesan ini akan dikirimkan ke WhatsApp Coach.
            </p>
            
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Contoh: Nilai kreativitas terlalu rendah, mohon cek kembali project-nya."
              style={{
                width: '100%',
                minHeight: '100px',
                padding: '0.75rem',
                borderRadius: '0.5rem',
                border: '1px solid #e2e8f0',
                fontSize: '0.9rem',
                marginBottom: '1rem',
                outline: 'none',
                fontFamily: 'inherit'
              }}
            />

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowModal(false)}
                disabled={isPending}
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: '0.5rem',
                  border: '1px solid #e2e8f0',
                  background: '#fff',
                  color: '#64748b',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Batal
              </button>
              <button
                onClick={handleReject}
                disabled={isPending}
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: '0.5rem',
                  border: 'none',
                  background: '#ef4444',
                  color: '#fff',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                {isPending ? 'Memproses...' : 'Ya, Nilai Ulang'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
