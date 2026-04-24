'use client';

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
    <div className="card">
      {statusMessage && (
        <div style={{ padding: '10px 16px', background: '#e9f7ed', color: '#117a3a', borderBottom: '1px solid var(--border)', fontSize: 13, fontWeight: 600 }}>
          ✓ {statusMessage}
        </div>
      )}
      {errorMessage && (
        <div style={{ padding: '10px 16px', background: '#fde7ea', color: '#b4192e', borderBottom: '1px solid var(--border)', fontSize: 13, fontWeight: 600 }}>
          ⚠ {errorMessage}
        </div>
      )}
      {requests.length === 0 ? (
        <div className="empty">Tidak ada pengajuan leave.</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Coach</th>
                <th>Sesi</th>
                <th>Status</th>
                <th>Pengganti</th>
                <th>Catatan</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {requests.map((request) => {
                const substituteOptions = coachOptions.filter((coach) => coach.id !== request.coach_id);
                const selected = substituteMap[request.id] ?? request.substitute_coach_id ?? '';
                const isEditing = editingIds.has(request.id);
                const isPending_ = request.status === 'PENDING';

                return (
                  <tr key={request.id}>
                    <td>
                      <div className="row gap-2">
                        <div className="avatar">{(request.coach?.full_name ?? 'C').slice(0, 2).toUpperCase()}</div>
                        <span style={{ fontWeight: 600 }}>{request.coach?.full_name ?? 'Coach'}</span>
                      </div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{request.class?.name ?? '—'}</div>
                      <div className="muted" style={{ fontSize: 11.5, marginTop: 2 }}>
                        {request.session ? new Date(request.session.date_time).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}
                      </div>
                    </td>
                    <td>
                      {request.status === 'APPROVED' && <span className="badge badge-success">Disetujui</span>}
                      {request.status === 'PENDING' && <span className="badge badge-warn">Menunggu</span>}
                      {request.status === 'REJECTED' && <span className="badge badge-danger">Ditolak</span>}
                    </td>
                    <td>
                      {isPending_ || isEditing ? (
                        <select
                          className="input"
                          style={{ width: 'auto', minWidth: 160 }}
                          value={selected}
                          onChange={(e) =>
                            setSubstituteMap((prev) => ({
                              ...prev,
                              [request.id]: e.target.value,
                            }))
                          }
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
                        <span style={{ fontWeight: 500 }}>{request.substitute?.full_name ?? '—'}</span>
                      )}
                    </td>
                    <td className="muted" style={{ fontSize: 12.5 }}>{request.note ?? '—'}</td>
                    <td style={{ textAlign: 'right' }}>
                      <div className="row gap-1" style={{ justifyContent: 'flex-end' }}>
                        {isPending_ || isEditing ? (
                          <>
                            <button
                              type="button"
                              onClick={() => updateStatus(request.id, 'APPROVED')}
                              disabled={isPending}
                              className="btn btn-sm btn-primary"
                            >
                              ✓ Setujui
                            </button>
                            <button
                              type="button"
                              onClick={() => updateStatus(request.id, 'REJECTED')}
                              disabled={isPending}
                              className="btn btn-sm"
                              style={{ color: '#b4192e' }}
                            >
                              ✕ Tolak
                            </button>
                            {isEditing && (
                              <button
                                type="button"
                                onClick={() => toggleEdit(request.id)}
                                className="btn btn-sm btn-ghost"
                              >
                                ↩
                              </button>
                            )}
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() => toggleEdit(request.id)}
                            className="btn btn-sm btn-ghost"
                          >
                            ✏️ Edit
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
      )}
    </div>
  );
}
