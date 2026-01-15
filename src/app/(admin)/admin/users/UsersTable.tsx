import type { CSSProperties } from 'react';
import type { UserSummary } from '@/lib/dao/usersDao';

import ResetPasswordButton from './ResetPasswordButton';
import ToggleActiveButton from './ToggleActiveButton';
import DeleteUserButton from './DeleteUserButton';
import EditUserButton from './EditUserButton';

interface UsersTableProps {
  users: UserSummary[];
}

export default function UsersTable({ users }: UsersTableProps) {
  const sorted = [...users].sort((a, b) => a.full_name.localeCompare(b.full_name));

  return (
    <section style={{
      background: '#ffffff',
      borderRadius: '16px',
      border: '1px solid #e2e8f0',
      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
      overflow: 'hidden'
    }}>
      <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #f1f5f9' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1e293b', margin: 0 }}>Daftar Pengguna</h3>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={{ background: '#f8fafc', textAlign: 'left' }}>
            <tr>
              <th style={thStyle}>Nama</th>
              <th style={thStyle}>Username</th>
              <th style={thStyle}>Role</th>
              <th style={thStyle}>Status</th>
              <th style={thStyle}>Kontak Orang Tua</th>
              <th style={thStyle}>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>
                  Belum ada data pengguna.
                </td>
              </tr>
            ) : (
              sorted.map((user) => (
                <tr key={user.id} style={{ borderBottom: '1px solid #f1f5f9', transition: 'background 0.2s' }} className="hover:bg-slate-50">
                  <td style={tdStyle}>
                    <div style={{ fontWeight: 600, color: '#1e293b' }}>{user.full_name}</div>
                  </td>
                  <td style={tdStyle}>{user.username}</td>
                  <td style={tdStyle}>
                    <span style={{
                      padding: '0.25rem 0.75rem',
                      borderRadius: '9999px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      background: user.role === 'ADMIN' ? '#f0f9ff' : user.role === 'COACH' ? '#f0fdf4' : '#fef2f2',
                      color: user.role === 'ADMIN' ? '#0369a1' : user.role === 'COACH' ? '#15803d' : '#b91c1c'
                    }}>
                      {user.role}
                    </span>
                  </td>
                  <td style={tdStyle}>
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      color: user.is_active ? '#059669' : '#94a3b8',
                      fontSize: '0.85rem',
                      fontWeight: 500
                    }}>
                      <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: user.is_active ? '#10b981' : '#cbd5e1' }} />
                      {user.is_active ? 'Aktif' : 'Nonaktif'}
                    </span>
                  </td>
                  <td style={tdStyle}><span style={{ color: '#64748b' }}>{user.role === 'CODER' ? user.parent_contact_phone ?? '—' : '—'}</span></td>
                  <td style={tdStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <EditUserButton user={user} />
                      <ToggleActiveButton userId={user.id} initialActive={user.is_active} />
                      {user.role === 'CODER' || user.role === 'COACH' ? <ResetPasswordButton userId={user.id} /> : null}
                      <DeleteUserButton userId={user.id} />
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

const thStyle: CSSProperties = {
  padding: '1rem 1.5rem',
  fontSize: '0.75rem',
  color: '#64748b',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  fontWeight: 600,
  borderBottom: '1px solid #e2e8f0',
};

const tdStyle: CSSProperties = {
  padding: '1rem 1.5rem',
  fontSize: '0.9rem',
  color: '#334155',
  verticalAlign: 'middle',
};
