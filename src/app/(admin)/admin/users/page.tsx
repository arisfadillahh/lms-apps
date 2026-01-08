import { usersDao } from '@/lib/dao';

import CreateUserForm from './CreateUserForm';
import UsersTable from './UsersTable';

export default async function AdminUsersPage() {
  const users = await usersDao.listUsers();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 600, marginBottom: '0.75rem' }}>User Management</h1>
        <p style={{ color: '#64748b', maxWidth: '48rem' }}>
          Create and manage Admin, Coach, and Coder accounts. Usernames are immutable. Only Admin users can see parent
          contact information.
        </p>
      </div>
      <CreateUserForm />
      <UsersTable users={users} />
    </div>
  );
}
