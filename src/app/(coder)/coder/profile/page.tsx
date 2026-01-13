import { getSessionOrThrow } from '@/lib/auth';
import { getUserById } from '@/lib/dao/usersDao';
import ProfileForm from '@/components/profile/ProfileForm';
import CoderProfileForm from '@/components/profile/CoderProfileForm';

export default async function CoderProfilePage() {
  const session = await getSessionOrThrow();
  const user = await getUserById(session.user.id);

  if (!user) {
    return <div>User not found</div>;
  }

  // Map to frontend interface
  const userProfile = {
    username: user.username,
    fullName: user.full_name,
    avatarPath: (user as any).avatar_path || null,
    role: user.role
  };

  // Coder-specific profile data
  const coderProfile = {
    fullName: user.full_name,
    birthDate: user.birth_date || null,
    gender: user.gender || null,
    schoolName: user.school_name || null,
    schoolGrade: user.school_grade || null,
    parentName: user.parent_name || null,
    parentEmail: user.parent_email || null,
    parentContactPhone: user.parent_contact_phone || null,
    address: user.address || null,
    referralSource: user.referral_source || null,
  };

  return (
    <div style={{ width: '100%', padding: '2rem 1rem' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.875rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.5rem' }}>Profile & Keamanan</h1>
        <p style={{ color: '#64748b' }}>Kelola informasi pribadi dan keamanan akun Anda</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        <ProfileForm user={userProfile} />
        <CoderProfileForm profile={coderProfile} />
      </div>
    </div>
  );
}

