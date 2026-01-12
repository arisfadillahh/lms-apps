import { getSessionOrThrow } from '@/lib/auth';
import { getUserById } from '@/lib/dao/usersDao';
import ProfileForm from '@/components/profile/ProfileForm';

export default async function CoachProfilePage() {
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
        <div className="container mx-auto px-4 py-8">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-slate-800">Profile & Keamanan</h1>
                <p className="text-slate-500">Kelola informasi pribadi dan keamanan akun Coach</p>
            </div>

            <ProfileForm user={userProfile} />
        </div>
    );
}
