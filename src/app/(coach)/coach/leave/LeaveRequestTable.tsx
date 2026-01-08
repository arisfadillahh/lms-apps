import type { CSSProperties } from 'react';

import type { CoachLeaveRequestWithRelations } from '@/lib/dao/coachLeaveDao';

type LeaveRequestTableProps = {
  requests: CoachLeaveRequestWithRelations[];
};

export default function LeaveRequestTable({ requests }: LeaveRequestTableProps) {
  return (
    <section style={cardStyle}>
      <h2 style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: '0.75rem', color: 'var(--color-text-primary)' }}>Riwayat Pengajuan</h2>
      {requests.length === 0 ? (
        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.95rem' }}>Belum ada pengajuan izin.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={{ background: 'rgba(15, 23, 42, 0.04)', textAlign: 'left' }}>
            <tr>
              <th style={thStyle}>Sesi</th>
              <th style={thStyle}>Status</th>
              <th style={thStyle}>Substitute</th>
              <th style={thStyle}>Catatan</th>
            </tr>
          </thead>
          <tbody>
            {requests.map((request) => (
              <tr key={request.id} style={{ borderBottom: `1px solid var(--color-border)` }}>
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
                  {request.approved_at ? (
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                      {new Date(request.approved_at).toLocaleString()}
                    </div>
                  ) : null}
                </td>
                <td style={tdStyle}>{request.substitute?.full_name ?? '—'}</td>
                <td style={tdStyle}>{request.note ?? '—'}</td>
              </tr>
            ))}
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
