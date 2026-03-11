import { getSessionOrThrow } from '@/lib/auth';
import { getUserById } from '@/lib/dao/usersDao';
import ProfileForm from '@/components/profile/ProfileForm';

export default async function CoachProfilePage() {
    const session = await getSessionOrThrow();
    const user = await getUserById(session.user.id);

    if (!user) {
        return <div>User not found</div>;
    }

    const userProfile = {
        username: user.username,
        fullName: user.full_name,
        avatarPath: (user as any).avatar_path || null,
        role: user.role,
        // Coach-specific
        coachBio: (user as any).coach_bio ?? '',
        coachSkills: (user as any).coach_skills ?? [],
        // Notification prefs
        notifNewClass: (user as any).notif_new_class ?? true,
        notifLeaveUpdate: (user as any).notif_leave_update ?? true,
        notifSessionReminder: (user as any).notif_session_reminder ?? false,
    };

    return <ProfileForm user={userProfile} />;
}
