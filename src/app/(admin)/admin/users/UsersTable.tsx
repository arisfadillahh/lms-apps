'use client';

import { useState, useMemo } from 'react';
import type { UserSummary } from '@/lib/dao/usersDao';
import { Search, X } from 'lucide-react';

import ResetPasswordButton from './ResetPasswordButton';
import ToggleActiveButton from './ToggleActiveButton';
import DeleteUserButton from './DeleteUserButton';
import EditUserButton from './EditUserButton';
import ProgressOverrideButton from './ProgressOverrideButton';
import ActionDropdown from '@/components/admin/ActionDropdown';

interface UsersTableProps {
  users: UserSummary[];
}

type RoleFilter = 'ALL' | 'ADMIN' | 'COACH' | 'CODER';
type StatusFilter = 'ALL' | 'ACTIVE' | 'INACTIVE';

export default function UsersTable({ users }: UsersTableProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('ALL');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');

  const filteredUsers = useMemo(() => {
    return users
      .filter((user) => {
        if (searchQuery) {
          const query = searchQuery.toLowerCase();
          const matchesName = user.full_name.toLowerCase().includes(query);
          const matchesUsername = user.username.toLowerCase().includes(query);
          if (!matchesName && !matchesUsername) return false;
        }
        if (roleFilter !== 'ALL' && user.role !== roleFilter) return false;
        if (statusFilter === 'ACTIVE' && !user.is_active) return false;
        if (statusFilter === 'INACTIVE' && user.is_active) return false;
        return true;
      })
      .sort((a, b) => a.full_name.localeCompare(b.full_name));
  }, [users, searchQuery, roleFilter, statusFilter]);

  const clearFilters = () => {
    setSearchQuery('');
    setRoleFilter('ALL');
    setStatusFilter('ALL');
  };

  const hasActiveFilters = searchQuery || roleFilter !== 'ALL' || statusFilter !== 'ALL';

  const roleBadge = (role: string) => {
    if (role === 'ADMIN') return 'badge-danger';
    if (role === 'COACH') return 'badge-info';
    return 'badge-neutral';
  };

  return (
    <div className="card">
      {/* Header / Filters */}
      <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
        <div className="filters">
          <div className="searchbar" style={{ maxWidth: 320, flex: 'none' }}>
            <Search size={16} />
            <input
              type="text"
              placeholder="Cari nama atau username..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Role filter as chip buttons */}
          <div className="row gap-1" style={{ padding: 3, background: 'var(--surface-2)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
            {(['ALL', 'ADMIN', 'COACH', 'CODER'] as RoleFilter[]).map((r) => (
              <button
                key={r}
                className={`btn btn-sm ${roleFilter === r ? '' : 'btn-ghost'}`}
                style={roleFilter === r ? {} : { border: 0, background: 'transparent' }}
                onClick={() => setRoleFilter(r)}
              >
                {r === 'ALL' ? 'Semua' : r}
                {roleFilter === r && (
                  <span className="chip" style={{ fontSize: 10, padding: '1px 6px' }}>
                    {r === 'ALL'
                      ? users.length
                      : users.filter((u) => u.role === r).length}
                  </span>
                )}
              </button>
            ))}
          </div>

          <select
            className="input"
            style={{ width: 'auto' }}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          >
            <option value="ALL">Semua Status</option>
            <option value="ACTIVE">Aktif</option>
            <option value="INACTIVE">Nonaktif</option>
          </select>

          {hasActiveFilters && (
            <button className="btn btn-sm btn-ghost" onClick={clearFilters}>
              <X size={14} />
              Reset
            </button>
          )}

          <div className="flex1" />
          <span className="chip">{filteredUsers.length} dari {users.length}</span>
        </div>
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table className="table">
          <thead>
            <tr>
              <th>Nama</th>
              <th>Username</th>
              <th>Role</th>
              <th>Program</th>
              <th>Status</th>
              <th>Kontak Orang Tua</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {filteredUsers.length === 0 ? (
              <tr>
                <td colSpan={7} className="empty">
                  {hasActiveFilters ? 'Tidak ada pengguna yang sesuai filter.' : 'Belum ada data pengguna.'}
                </td>
              </tr>
            ) : (
              filteredUsers.map((user) => (
                <tr key={user.id}>
                  <td>
                    <div className="row gap-3">
                      <div className="avatar avatar-lg">
                        {user.full_name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontWeight: 700 }}>{user.full_name}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className="mono muted">@{user.username}</span>
                  </td>
                  <td>
                    <span className={`badge ${roleBadge(user.role)}`}>{user.role}</span>
                  </td>
                  <td>
                    {user.role === 'CODER' ? (
                      <span className="badge badge-neutral">
                        {user.parent_contact_phone && user.parent_contact_phone !== '000000' ? 'Weekly' : 'Ekskul'}
                      </span>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  <td>
                    {user.is_active ? (
                      <span className="badge badge-success">Aktif</span>
                    ) : (
                      <span className="badge badge-neutral">Nonaktif</span>
                    )}
                  </td>
                  <td>
                    <span className="muted" style={{ fontSize: 12.5 }}>
                      {user.role === 'CODER' ? (user.parent_contact_phone ?? '—') : '—'}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <ActionDropdown>
                      <div className="col gap-1" style={{ padding: '4px' }}>
                        <EditUserButton user={user} />
                        <ToggleActiveButton userId={user.id} initialActive={user.is_active} />
                        {user.role === 'CODER' || user.role === 'COACH' ? (
                          <ResetPasswordButton userId={user.id} />
                        ) : null}
                        {user.role === 'CODER' && (
                          <ProgressOverrideButton coderId={user.id} coderName={user.full_name} />
                        )}
                        <DeleteUserButton userId={user.id} />
                      </div>
                    </ActionDropdown>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
