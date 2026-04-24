import { getSessionOrThrow } from '@/lib/auth';
import { usersDao } from '@/lib/dao';
import ProfileForm from '@/components/profile/ProfileForm';
import PageHead from '@/components/admin/PageHead';

export default async function AdminProfilePage() {
    const session = await getSessionOrThrow();
    const user = await usersDao.getUserById(session.user.id);

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

    return (
        <div style={{ width: '100%', padding: '2rem 1rem' }}>
            <PageHead
                title="Profile & Keamanan"
                desc="Kelola informasi pribadi dan keamanan akun Admin"
            />

            <ProfileForm user={userProfile} />
        </div>
    );
}
