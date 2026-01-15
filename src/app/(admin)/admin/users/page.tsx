import { usersDao } from '@/lib/dao';

import CreateUserForm from './CreateUserForm';
import UsersTable from './UsersTable';

export default async function AdminUsersPage() {
  const users = await usersDao.listUsers();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div>
        <h1 style={{ fontSize: '1.8rem', fontWeight: 800, color: '#1e293b', marginBottom: '0.5rem', letterSpacing: '-0.02em' }}>Manajemen Pengguna</h1>
        <p style={{ color: '#64748b', maxWidth: '48rem', fontSize: '1rem', lineHeight: '1.6' }}>
          Kelola akun untuk Admin, Coach, dan Coder. Username bersifat permanen dan tidak dapat diubah setelah dibuat.
          Hanya Admin yang dapat melihat kontak orang tua Siswa.
        </p>
      </div>
      <CreateUserForm />
      <UsersTable users={users} />
    </div>
  );
}
