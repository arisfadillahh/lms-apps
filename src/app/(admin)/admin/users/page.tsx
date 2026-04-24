import { Users, UserCheck, GraduationCap, BookOpen, FileText, Plus } from 'lucide-react';
import { usersDao } from '@/lib/dao';

import CreateUserForm from './CreateUserForm';
import UsersTable from './UsersTable';

function PageHead({ title, desc, actions }: { title: string; desc: string; actions?: React.ReactNode }) {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        <p>{desc}</p>
      </div>
      {actions && <div className="row gap-2">{actions}</div>}
    </div>
  );
}

function Stat({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div className="stat">
      <div className="stat-icon">{icon}</div>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
    </div>
  );
}

export default async function AdminUsersPage() {
  const users = await usersDao.listUsers();
  
  const totalAdmin = users.filter((u) => u.role === 'ADMIN').length;
  const totalCoachAktif = users.filter((u) => u.role === 'COACH' && u.is_active).length;
  const totalCoderAktif = users.filter((u) => u.role === 'CODER' && u.is_active).length;

  return (
    <div className="admin-page-stack">
      <PageHead
        title="Manajemen Pengguna"
        desc="Kelola akun Admin, Coach, dan Coder. Username permanen dan tidak dapat diubah setelah dibuat."
      />

      <div className="grid grid-4" style={{ marginBottom: 18 }}>
        <Stat label="Total User" value={users.length} icon={<Users size={16} />} />
        <Stat label="Admin" value={totalAdmin} icon={<UserCheck size={16} />} />
        <Stat label="Coach Aktif" value={totalCoachAktif} icon={<GraduationCap size={16} />} />
        <Stat label="Coder Aktif" value={totalCoderAktif} icon={<BookOpen size={16} />} />
      </div>

      <CreateUserForm />
      <UsersTable users={users} />
    </div>
  );
}
