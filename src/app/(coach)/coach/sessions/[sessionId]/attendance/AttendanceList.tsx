'use client';

import type { CSSProperties } from 'react';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

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

type AttendanceStatus = 'PRESENT' | 'ABSENT';

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
  const [editingId, setEditingId] = useState<string | null>(null);

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
      if (status === 'ABSENT') {
        payload.reason = reason?.trim() ?? '';
      }

      const response = await fetch('/api/coach/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        setErrorMessage(payload.error ?? 'Failed to record attendance');
        return;
      }

      updateRecord(coderId, { status, reason: status === 'ABSENT' ? reason?.trim() ?? '' : '' });
      setEditingId(null);
      setStatusMessage('Attendance saved');
      router.refresh();
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {errorMessage ? <p style={{ color: '#b91c1c' }}>{errorMessage}</p> : null}
      {statusMessage ? <p style={{ color: '#15803d' }}>{statusMessage}</p> : null}
      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={nameHeaderStyle}>Nama</th>
            <th style={statusHeaderStyle}>Status</th>
            <th style={actionHeaderStyle}>Action</th>
          </tr>
        </thead>
        <tbody>
          {records.map((record) => {
            const statusLabel =
              record.status === 'PRESENT'
                ? 'Masuk'
                : record.status === 'ABSENT'
                  ? `Tidak Masuk${record.reason ? ` (${record.reason})` : ''}`
                  : 'Belum diisi';

            const isEditing = editingId === record.coderId || record.status === null;

            const handleMarkPresent = () => {
              submit(record.coderId, 'PRESENT');
            };

            const handleMarkAbsent = () => {
              const reason = window.prompt('Alasan tidak masuk (wajib diisi):', record.reason);
              if (reason === null) return;
              const trimmed = reason.trim();
              if (!trimmed) {
                window.alert('Alasan wajib diisi.');
                return;
              }
              submit(record.coderId, 'ABSENT', trimmed);
            };

            return (
              <tr key={record.coderId}>
                <td style={nameCellStyle}>{record.fullName}</td>
                <td style={statusCellStyle}>{statusLabel}</td>
                <td style={actionCellStyle}>
                  {isEditing ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <button
                        type="button"
                        onClick={handleMarkPresent}
                        disabled={isPending}
                        style={{
                          ...actionButtonStyle,
                          background: '#16a34a',
                        }}
                        aria-label="Tandai hadir"
                      >
                        ✓
                      </button>
                      <button
                        type="button"
                        onClick={handleMarkAbsent}
                        disabled={isPending}
                        style={{
                          ...actionButtonStyle,
                          background: '#dc2626',
                        }}
                        aria-label="Tandai tidak hadir"
                      >
                        ✕
                      </button>
                      {record.status !== null ? (
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          disabled={isPending}
                          style={cancelButtonStyle}
                        >
                          Batal
                        </button>
                      ) : null}
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setEditingId(record.coderId)}
                      disabled={isPending}
                      style={editButtonStyle}
                    >
                      Edit
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const tableStyle: CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  border: '1px solid #e2e8f0',
  borderRadius: '0.75rem',
  overflow: 'hidden',
};

const nameHeaderStyle: CSSProperties = {
  padding: '0.85rem 1rem',
  textAlign: 'left',
  background: '#f1f5f9',
  color: '#475569',
  fontSize: '0.85rem',
  fontWeight: 600,
  width: '40%',
};

const statusHeaderStyle: CSSProperties = {
  ...nameHeaderStyle,
  width: '40%',
};

const actionHeaderStyle: CSSProperties = {
  ...nameHeaderStyle,
  textAlign: 'center',
  width: '20%',
};

const nameCellStyle: CSSProperties = {
  padding: '0.85rem 1rem',
  borderBottom: '1px solid #e2e8f0',
  color: '#0f172a',
  fontWeight: 600,
};

const statusCellStyle: CSSProperties = {
  padding: '0.85rem 1rem',
  borderBottom: '1px solid #e2e8f0',
  color: '#475569',
  fontSize: '0.9rem',
};

const actionCellStyle: CSSProperties = {
  padding: '0.85rem 1rem',
  borderBottom: '1px solid #e2e8f0',
  display: 'flex',
  gap: '0.5rem',
  justifyContent: 'center',
  alignItems: 'center',
};

const actionButtonStyle: CSSProperties = {
  padding: '0.4rem 0.65rem',
  border: 'none',
  borderRadius: '0.45rem',
  color: '#fff',
  cursor: 'pointer',
  fontWeight: 700,
  fontSize: '0.85rem',
};

const editButtonStyle: CSSProperties = {
  padding: '0.4rem 0.65rem',
  borderRadius: '0.45rem',
  border: '1px solid var(--color-border)',
  background: 'var(--color-bg-surface)',
  color: 'var(--color-text-primary)',
  cursor: 'pointer',
  fontWeight: 600,
  fontSize: '0.85rem',
};

const cancelButtonStyle: CSSProperties = {
  padding: '0.3rem 0.6rem',
  borderRadius: '0.45rem',
  border: '1px solid rgba(148, 163, 184, 0.6)',
  background: 'transparent',
  color: 'var(--color-text-muted)',
  cursor: 'pointer',
  fontSize: '0.75rem',
};
