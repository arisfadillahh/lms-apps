'use client';

import type { CSSProperties } from 'react';
import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import type { CoachLeaveRequestWithRelations } from '@/lib/dao/coachLeaveDao';

type LeaveApprovalTableProps = {
  requests: CoachLeaveRequestWithRelations[];
  coaches: Array<{ id: string; name: string }>;
};

export default function LeaveApprovalTable({ requests, coaches }: LeaveApprovalTableProps) {
  const router = useRouter();
  const [substituteMap, setSubstituteMap] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    requests.forEach((request) => {
      if (request.substitute_coach_id) {
        initial[request.id] = request.substitute_coach_id;
      }
    });
    return initial;
  });
  const [isPending, startTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  // Track which requests are in "edit mode"
  const [editingIds, setEditingIds] = useState<Set<string>>(new Set());

  const coachOptions = useMemo(() => coaches, [coaches]);

  const toggleEdit = (requestId: string) => {
    setEditingIds((prev) => {
      const next = new Set(prev);
      if (next.has(requestId)) {
        next.delete(requestId);
      } else {
        next.add(requestId);
      }
      return next;
    });
  };

  const updateStatus = (requestId: string, status: 'APPROVED' | 'REJECTED') => {
    setErrorMessage(null);
    setStatusMessage(null);

    if (status === 'APPROVED' && !(substituteMap[requestId] ?? '')) {
      setErrorMessage('Pilih coach pengganti sebelum menyetujui leave');
      return;
    }

    startTransition(async () => {
      try {
        const response = await fetch(`/api/admin/leave/${requestId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status,
            substituteCoachId: substituteMap[requestId] ?? null,
          }),
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          setErrorMessage(payload.error ?? 'Gagal memperbarui status');
          return;
        }

        setStatusMessage('Status diperbarui');
        setEditingIds((prev) => {
          const next = new Set(prev);
          next.delete(requestId);
          return next;
        });
        router.refresh();
        setTimeout(() => setStatusMessage(null), 3000);
      } catch (error) {
        console.error('Update leave request failed', error);
        setErrorMessage('Terjadi kesalahan ketika memperbarui status');
      }
    });
  };

  return (
    <section style={cardStyle}>
      <h2 style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: '0.75rem', color: 'var(--color-text-primary)' }}>Pengajuan Masuk</h2>
      {statusMessage ? <p style={{ color: 'var(--color-success)', fontSize: '0.9rem' }}>{statusMessage}</p> : null}
      {errorMessage ? <p style={{ color: 'var(--color-danger)', fontSize: '0.9rem' }}>{errorMessage}</p> : null}
      {requests.length === 0 ? (
        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.95rem' }}>Tidak ada pengajuan leave.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={{ background: 'rgba(15, 23, 42, 0.04)', textAlign: 'left' }}>
            <tr>
              <th style={thStyle}>Coach</th>
              <th style={thStyle}>Sesi</th>
              <th style={thStyle}>Status</th>
              <th style={thStyle}>Substitute</th>
              <th style={thStyle}>Catatan</th>
              <th style={thStyle}>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {requests.map((request) => {
              const substituteOptions = coachOptions.filter((coach) => coach.id !== request.coach_id);
              const selected = substituteMap[request.id] ?? request.substitute_coach_id ?? '';
              const isEditing = editingIds.has(request.id);
              const isPending_ = request.status === 'PENDING';

              return (
                <tr key={request.id} style={{ borderBottom: `1px solid var(--color-border)` }}>
                  <td style={tdStyle}>{request.coach?.full_name ?? 'Coach'}</td>
                  <td style={tdStyle}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontWeight: 600 }}>{request.class?.name ?? 'Class'}</span>
                      <span style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
                        {request.session ? new Date(request.session.date_time).toLocaleString() : '—'}
                      </span>
                    </div>
                  </td>
                  <td style={tdStyle}>
                    <span style={{ color: statusColor(request.status), fontWeight: 600 }}>{request.status}</span>
                  </td>
                  <td style={tdStyle}>
                    {/* Show dropdown only if PENDING or editing */}
                    {isPending_ || isEditing ? (
                      <select
                        value={selected}
                        onChange={(event) =>
                          setSubstituteMap((prev) => ({
                            ...prev,
                            [request.id]: event.target.value,
                          }))
                        }
                        style={selectStyle}
                        disabled={isPending}
                      >
                        <option value="">Pilih coach</option>
                        {substituteOptions.map((coach) => (
                          <option key={coach.id} value={coach.id}>
                            {coach.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span style={{ color: '#2563eb', fontWeight: 500 }}>
                        {request.substitute?.full_name ?? '—'}
                      </span>
                    )}
                  </td>
                  <td style={tdStyle}>{request.note ?? '—'}</td>
                  <td style={tdActionStyle}>
                    {/* If PENDING or editing, show Approve/Tolak buttons */}
                    {isPending_ || isEditing ? (
                      <>
                        <button
                          type="button"
                          onClick={() => updateStatus(request.id, 'APPROVED')}
                          disabled={isPending}
                          style={approveButtonStyle}
                        >
                          {isPending ? 'Memproses…' : 'Approve'}
                        </button>
                        <button
                          type="button"
                          onClick={() => updateStatus(request.id, 'REJECTED')}
                          disabled={isPending}
                          style={rejectButtonStyle}
                        >
                          Tolak
                        </button>
                        {isEditing && (
                          <button
                            type="button"
                            onClick={() => toggleEdit(request.id)}
                            style={cancelEditButtonStyle}
                          >
                            Batal
                          </button>
                        )}
                      </>
                    ) : (
                      /* Show Edit button for already processed requests */
                      <button
                        type="button"
                        onClick={() => toggleEdit(request.id)}
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
      )}
    </section>
  );
}

function statusColor(status: CoachLeaveRequestWithRelations['status']): string {
  switch (status) {
    case 'APPROVED':
      return 'var(--color-success)';
    case 'REJECTED':
      return 'var(--color-danger)';
    default:
      return 'var(--color-accent)';
  }
}

const cardStyle: CSSProperties = {
  background: 'var(--color-bg-surface)',
  borderRadius: 'var(--radius-lg)',
  border: `1px solid var(--color-border)`,
  padding: '1.25rem 1.5rem',
  overflowX: 'auto',
  boxShadow: 'var(--shadow-medium)',
};

const thStyle: CSSProperties = {
  padding: '0.75rem 1rem',
  fontSize: '0.85rem',
  color: 'var(--color-text-secondary)',
  borderBottom: `1px solid var(--color-border)`,
};

const tdStyle: CSSProperties = {
  padding: '0.85rem 1rem',
  fontSize: '0.9rem',
  color: 'var(--color-text-primary)',
  verticalAlign: 'top',
};

const tdActionStyle: CSSProperties = {
  ...tdStyle,
  display: 'flex',
  gap: '0.5rem',
  flexWrap: 'wrap',
};

const selectStyle: CSSProperties = {
  minWidth: '180px',
  padding: '0.45rem 0.65rem',
  borderRadius: '0.5rem',
  border: `1px solid var(--color-border)`,
  fontSize: '0.85rem',
  background: 'var(--color-bg-surface)',
  color: 'var(--color-text-primary)',
};

const approveButtonStyle: CSSProperties = {
  padding: '0.45rem 0.85rem',
  borderRadius: '0.5rem',
  border: 'none',
  background: '#16a34a',
  color: '#fff',
  fontSize: '0.85rem',
  fontWeight: 600,
  cursor: 'pointer',
};

const rejectButtonStyle: CSSProperties = {
  padding: '0.45rem 0.85rem',
  borderRadius: '0.5rem',
  border: 'none',
  background: '#dc2626',
  color: '#fff',
  fontSize: '0.85rem',
  fontWeight: 600,
  cursor: 'pointer',
};

const editButtonStyle: CSSProperties = {
  padding: '0.45rem 0.85rem',
  borderRadius: '0.5rem',
  border: '1px solid #cbd5e1',
  background: '#fff',
  color: '#334155',
  fontSize: '0.85rem',
  fontWeight: 600,
  cursor: 'pointer',
};

const cancelEditButtonStyle: CSSProperties = {
  padding: '0.45rem 0.85rem',
  borderRadius: '0.5rem',
  border: '1px solid #e2e8f0',
  background: '#f8fafc',
  color: '#64748b',
  fontSize: '0.85rem',
  fontWeight: 500,
  cursor: 'pointer',
};
