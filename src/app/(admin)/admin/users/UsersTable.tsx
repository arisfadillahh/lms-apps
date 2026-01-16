'use client';

import { useState, useMemo } from 'react';
import type { CSSProperties } from 'react';
import type { UserSummary } from '@/lib/dao/usersDao';
import { Search, Filter, X } from 'lucide-react';

import ResetPasswordButton from './ResetPasswordButton';
import ToggleActiveButton from './ToggleActiveButton';
import DeleteUserButton from './DeleteUserButton';
import EditUserButton from './EditUserButton';

interface UsersTableProps {
  users: UserSummary[];
}

type RoleFilter = 'ALL' | 'ADMIN' | 'COACH' | 'CODER';
type StatusFilter = 'ALL' | 'ACTIVE' | 'INACTIVE';

export default function UsersTable({ users }: UsersTableProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('ALL');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');

  // Filter and sort users
  const filteredUsers = useMemo(() => {
    return users
      .filter((user) => {
        // Search filter
        if (searchQuery) {
          const query = searchQuery.toLowerCase();
          const matchesName = user.full_name.toLowerCase().includes(query);
          const matchesUsername = user.username.toLowerCase().includes(query);
          if (!matchesName && !matchesUsername) return false;
        }

        // Role filter
        if (roleFilter !== 'ALL' && user.role !== roleFilter) return false;

        // Status filter
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

  return (
    <section style={sectionStyle}>
      {/* Header with Filters */}
      <div style={headerStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <h3 style={titleStyle}>Daftar Pengguna</h3>
          <span style={countBadgeStyle}>{filteredUsers.length} dari {users.length}</span>
        </div>

        {/* Filter Controls */}
        <div style={filtersContainerStyle}>
          {/* Search Input */}
          <div style={searchContainerStyle}>
            <Search size={16} color="#94a3b8" style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              placeholder="Cari nama atau username..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={searchInputStyle}
            />
          </div>

          {/* Role Filter */}
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as RoleFilter)}
            style={selectStyle}
          >
            <option value="ALL">Semua Role</option>
            <option value="ADMIN">Admin</option>
            <option value="COACH">Coach</option>
            <option value="CODER">Coder</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            style={selectStyle}
          >
            <option value="ALL">Semua Status</option>
            <option value="ACTIVE">Aktif</option>
            <option value="INACTIVE">Nonaktif</option>
          </select>

          {/* Clear Filters */}
          {hasActiveFilters && (
            <button onClick={clearFilters} style={clearButtonStyle}>
              <X size={14} />
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="users-table-wrapper" style={{ overflowX: 'auto', overflowY: 'visible' }}>
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
            {filteredUsers.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>
                  {hasActiveFilters ? 'Tidak ada pengguna yang sesuai filter.' : 'Belum ada data pengguna.'}
                </td>
              </tr>
            ) : (
              filteredUsers.map((user) => (
                <tr key={user.id} style={trStyle}>
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

      {/* Responsive CSS */}
      <style>{`
        @media (max-width: 768px) {
          .users-filters {
            flex-direction: column !important;
            align-items: stretch !important;
          }
        }
      `}</style>
    </section>
  );
}

// Styles
const sectionStyle: CSSProperties = {
  background: '#ffffff',
  borderRadius: '16px',
  border: '1px solid #e2e8f0',
  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
  overflow: 'hidden',
};

const headerStyle: CSSProperties = {
  padding: '1.25rem 1.5rem',
  borderBottom: '1px solid #f1f5f9',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  flexWrap: 'wrap',
  gap: '1rem',
};

const titleStyle: CSSProperties = {
  fontSize: '1.1rem',
  fontWeight: 700,
  color: '#1e293b',
  margin: 0,
};

const countBadgeStyle: CSSProperties = {
  fontSize: '0.75rem',
  color: '#64748b',
  background: '#f1f5f9',
  padding: '0.25rem 0.6rem',
  borderRadius: '999px',
};

const filtersContainerStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.75rem',
  flexWrap: 'wrap',
};

const searchContainerStyle: CSSProperties = {
  position: 'relative',
};

const searchInputStyle: CSSProperties = {
  padding: '0.6rem 0.75rem 0.6rem 2.25rem',
  fontSize: '0.85rem',
  border: '1px solid #e2e8f0',
  borderRadius: '8px',
  outline: 'none',
  width: '200px',
  background: '#f8fafc',
};

const selectStyle: CSSProperties = {
  padding: '0.6rem 0.75rem',
  fontSize: '0.85rem',
  border: '1px solid #e2e8f0',
  borderRadius: '8px',
  outline: 'none',
  background: '#f8fafc',
  cursor: 'pointer',
};

const clearButtonStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.35rem',
  padding: '0.6rem 0.75rem',
  fontSize: '0.85rem',
  background: '#fee2e2',
  color: '#dc2626',
  border: 'none',
  borderRadius: '8px',
  cursor: 'pointer',
  fontWeight: 500,
};

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

const trStyle: CSSProperties = {
  borderBottom: '1px solid #f1f5f9',
  transition: 'background 0.2s',
};
