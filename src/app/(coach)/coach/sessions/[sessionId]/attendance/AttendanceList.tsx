'use client';

import type { CSSProperties } from 'react';
import { useState, useTransition, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Check, X, Edit2, RotateCcw } from 'lucide-react';

interface Attendee {
  coderId: string;
  fullName: string;
  attendance: {
    status: AttendanceStatus;
    reason: string | null;
  } | null;
}

interface AttendanceListProps {
  sessionId: string;
  attendees: Attendee[];
}

type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'LATE'; // Added LATE support if needed later, but sticking to basics for now

export default function AttendanceList({ sessionId, attendees }: AttendanceListProps) {
  const router = useRouter();
  const [records, setRecords] = useState(() =>
    attendees.map((attendee) => ({
      coderId: attendee.coderId,
      fullName: attendee.fullName,
      status: attendee.attendance?.status ?? null,
      reason: attendee.attendance?.reason ?? '',
    })),
  );
  const [isPending, startTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // UX: Modal for Absent Reason
  const [absentCandidateId, setAbsentCandidateId] = useState<string | null>(null);
  const [absentReason, setAbsentReason] = useState('');
  const reasonInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (absentCandidateId && reasonInputRef.current) {
      reasonInputRef.current.focus();
    }
  }, [absentCandidateId]);

  const updateRecord = (coderId: string, updates: Partial<{ status: AttendanceStatus | null; reason: string }>) => {
    setRecords((prev) =>
      prev.map((record) =>
        record.coderId === coderId
          ? {
            ...record,
            ...updates,
          }
          : record,
      ),
    );
  };

  const submit = (coderId: string, status: AttendanceStatus, reason?: string) => {
    const record = records.find((item) => item.coderId === coderId);
    if (!record) return;
    setErrorMessage(null);
    setStatusMessage(null);

    startTransition(async () => {
      const payload: Record<string, unknown> = {
        sessionId,
        coderId,
        status,
      };
      // Always send reason if absent
      if (status === 'ABSENT') {
        payload.reason = reason?.trim() ?? '';
      }

      try {
        const response = await fetch('/api/coach/attendance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          setErrorMessage(data.error ?? 'Gagal menyimpan absensi');
          return;
        }

        updateRecord(coderId, { status, reason: status === 'ABSENT' ? reason?.trim() ?? '' : '' });
        setStatusMessage('Berhasil disimpan');
        // Auto clear
        setTimeout(() => setStatusMessage(null), 2000);
        router.refresh();
      } catch (err) {
        console.error(err);
        setErrorMessage('Terjadi kesalahan koneksi');
      }
    });
  };

  const handleAbsentClick = (coderId: string, currentReason?: string) => {
    setAbsentCandidateId(coderId);
    setAbsentReason(currentReason || '');
  };

  const confirmAbsent = () => {
    if (absentCandidateId) {
      if (!absentReason.trim()) {
        alert('Alasan wajib diisi!');
        return;
      }
      submit(absentCandidateId, 'ABSENT', absentReason);
      setAbsentCandidateId(null);
      setAbsentReason('');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {errorMessage ? <div style={{ padding: '0.75rem', borderRadius: '8px', background: '#fee2e2', color: '#b91c1c', fontSize: '0.9rem' }}>{errorMessage}</div> : null}
      {statusMessage ? <div style={{ padding: '0.75rem', borderRadius: '8px', background: '#dcfce7', color: '#16a34a', fontSize: '0.9rem' }}>{statusMessage}</div> : null}

      <div style={{ overflowX: 'auto' }}>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={nameHeaderStyle}>Nama Coder</th>
              <th style={statusHeaderStyle}>Status Kehadiran</th>
              <th style={actionHeaderStyle}>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {records.map((record) => {
              const isAbsent = record.status === 'ABSENT';
              const isPresent = record.status === 'PRESENT';
              const isMarked = record.status !== null;

              return (
                <tr key={record.coderId} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={nameCellStyle}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: '0.95rem', color: '#334155' }}>{record.fullName}</span>
                      {isAbsent && record.reason && (
                        <span style={{ fontSize: '0.8rem', color: '#ef4444', fontStyle: 'italic' }}>
                          "{record.reason}"
                        </span>
                      )}
                    </div>
                  </td>
                  <td style={statusCellStyle}>
                    {isMarked ? (
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        padding: '0.3rem 0.6rem',
                        borderRadius: '6px',
                        fontSize: '0.8rem',
                        fontWeight: 700,
                        background: isPresent ? '#dcfce7' : '#fee2e2',
                        color: isPresent ? '#15803d' : '#b91c1c',
                        border: isPresent ? '1px solid #bbf7d0' : '1px solid #fecaca'
                      }}>
                        {isPresent ? 'HADIR' : 'TIDAK HADIR'}
                      </span>
                    ) : (
                      <span style={{ fontSize: '0.85rem', color: '#94a3b8', fontStyle: 'italic' }}>Belum diabsen</span>
                    )}
                  </td>
                  <td style={actionCellStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center' }}>
                      <button
                        type="button"
                        onClick={() => submit(record.coderId, 'PRESENT')}
                        disabled={isPending}
                        title="Hadir"
                        style={{
                          ...actionButtonStyle,
                          background: isPresent ? '#22c55e' : '#fff',
                          color: isPresent ? '#fff' : '#22c55e',
                          border: '1px solid #22c55e',
                        }}
                      >
                        <Check size={18} strokeWidth={3} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAbsentClick(record.coderId, record.reason)}
                        disabled={isPending}
                        title="Tidak Hadir"
                        style={{
                          ...actionButtonStyle,
                          background: isAbsent ? '#ef4444' : '#fff',
                          color: isAbsent ? '#fff' : '#ef4444',
                          border: '1px solid #ef4444',
                        }}
                      >
                        <X size={18} strokeWidth={3} />
                      </button>
                      {isMarked && (
                        <button
                          type="button"
                          onClick={() => updateRecord(record.coderId, { status: null, reason: '' })}
                          style={{ ...actionButtonStyle, border: '1px solid #cbd5e1', color: '#64748b' }}
                          title="Reset"
                        >
                          <RotateCcw size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Reason Modal */}
      {absentCandidateId && (
        <div style={modalOverlayStyle}>
          <div style={modalContentStyle}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.5rem' }}>Alasan Tidak Hadir</h3>
            <p style={{ marginBottom: '1rem', color: '#64748b', fontSize: '0.9rem' }}>
              Wajib mengisi alasan ketidakhadiran coder.
            </p>
            <input
              ref={reasonInputRef}
              type="text"
              value={absentReason}
              onChange={e => setAbsentReason(e.target.value)}
              placeholder="Contoh: Sakit, Ijin, Tanpa Keterangan..."
              style={modalInputStyle}
              onKeyDown={e => e.key === 'Enter' && confirmAbsent()}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
              <button
                onClick={() => setAbsentCandidateId(null)}
                style={cancelModalButtonStyle}
              >
                Batal
              </button>
              <button
                onClick={confirmAbsent}
                style={submitModalButtonStyle}
              >
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const tableStyle: CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  background: '#fff',
  borderRadius: '12px',
  overflow: 'hidden',
  boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
  border: '1px solid #e2e8f0'
};

const nameHeaderStyle: CSSProperties = {
  padding: '1rem',
  textAlign: 'left',
  background: '#f8fafc',
  color: '#64748b',
  fontSize: '0.8rem',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  borderBottom: '1px solid #e2e8f0'
};

const statusHeaderStyle: CSSProperties = {
  ...nameHeaderStyle,
  textAlign: 'center'
};

const actionHeaderStyle: CSSProperties = {
  ...nameHeaderStyle,
  textAlign: 'center'
};

const nameCellStyle: CSSProperties = {
  padding: '1rem',
  fontWeight: 600,
  color: '#1e293b'
};

const statusCellStyle: CSSProperties = {
  padding: '1rem',
  textAlign: 'center'
};

const actionCellStyle: CSSProperties = {
  padding: '1rem',
  textAlign: 'center'
};

const actionButtonStyle: CSSProperties = {
  width: '36px',
  height: '36px',
  borderRadius: '8px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  transition: 'all 0.1s',
  background: '#fff',
};

const modalOverlayStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.5)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 100
};

const modalContentStyle: CSSProperties = {
  background: '#fff',
  padding: '1.5rem',
  borderRadius: '16px',
  width: '90%',
  maxWidth: '400px',
  boxShadow: '0 10px 25px rgba(0,0,0,0.1)'
};

const modalInputStyle: CSSProperties = {
  width: '100%',
  padding: '0.75rem',
  borderRadius: '8px',
  border: '1px solid #cbd5e1',
  fontSize: '1rem',
  outline: 'none'
};

const submitModalButtonStyle: CSSProperties = {
  padding: '0.6rem 1.2rem',
  background: '#1e3a5f',
  color: '#fff',
  fontWeight: 600,
  borderRadius: '8px',
  border: 'none',
  cursor: 'pointer'
};

const cancelModalButtonStyle: CSSProperties = {
  padding: '0.6rem 1.2rem',
  background: 'transparent',
  color: '#64748b',
  borderRadius: '8px',
  border: '1px solid #cbd5e1',
  cursor: 'pointer'
};
