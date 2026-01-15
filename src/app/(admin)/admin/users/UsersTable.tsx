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
    <section style={{ background: '#ffffff', borderRadius: '0.75rem', border: '1px solid #e5e7eb' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead style={{ background: '#f1f5f9', textAlign: 'left' }}>
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
              <td colSpan={6} style={{ padding: '1rem', textAlign: 'center', color: '#6b7280' }}>
                Belum ada user.
              </td>
            </tr>
          ) : (
            sorted.map((user) => (
              <tr key={user.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                <td style={tdStyle}>{user.full_name}</td>
                <td style={tdStyle}>{user.username}</td>
                <td style={tdStyle}>{user.role}</td>
                <td style={tdStyle}>{user.is_active ? 'Aktif' : 'Nonaktif'}</td>
                <td style={tdStyle}>{user.role === 'CODER' ? user.parent_contact_phone ?? '—' : '—'}</td>
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
    </section>
  );
}

const thStyle: CSSProperties = {
  padding: '0.75rem 1rem',
  fontSize: '0.85rem',
  color: '#475569',
  borderBottom: '1px solid #e2e8f0',
};

const tdStyle: CSSProperties = {
  padding: '0.85rem 1rem',
  fontSize: '0.9rem',
  color: '#1f2937',
};
