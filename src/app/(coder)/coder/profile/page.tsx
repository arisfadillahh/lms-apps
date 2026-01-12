import { getSessionOrThrow } from '@/lib/auth';
import { getUserById } from '@/lib/dao/usersDao';
import ProfileForm from '@/components/profile/ProfileForm';

export default async function CoderProfilePage() {
  const session = await getSessionOrThrow();
  const user = await getUserById(session.user.id);

  if (!user) {
    return <div>User not found</div>;
  }

  // Map to frontend interface
  const userProfile = {
    fullName: user.full_name,
    avatarPath: (user as any).avatar_path || null,
    role: user.role
  };

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto', padding: '2rem 1rem' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.875rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.5rem' }}>Profile & Keamanan</h1>
        <p style={{ color: '#64748b' }}>Kelola informasi pribadi dan keamanan akun Anda</p>
      </div>

      <ProfileForm user={userProfile} />
    </div>
  );
}
