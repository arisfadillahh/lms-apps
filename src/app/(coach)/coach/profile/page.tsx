import { getSessionOrThrow } from '@/lib/auth';
import { getUserById } from '@/lib/dao/usersDao';
import ProfileForm from '@/components/profile/ProfileForm';

type CoachProfileFields = {
    coach_bio?: string | null;
    coach_skills?: string[] | null;
    notif_new_class?: boolean | null;
    notif_leave_update?: boolean | null;
    notif_session_reminder?: boolean | null;
};

export default async function CoachProfilePage() {
    const session = await getSessionOrThrow();
    const user = await getUserById(session.user.id);

    if (!user) {
        return <div>User not found</div>;
    }

    const coachUser = user as typeof user & CoachProfileFields;

    const userProfile = {
        username: user.username,
        fullName: user.full_name,
        avatarPath: user.avatar_path || null,
        role: user.role,
        parentContactPhone: user.parent_contact_phone,
        // Coach-specific
        coachBio: coachUser.coach_bio ?? '',
        coachSkills: coachUser.coach_skills ?? [],
        // Notification prefs
        notifNewClass: coachUser.notif_new_class ?? true,
        notifLeaveUpdate: coachUser.notif_leave_update ?? true,
        notifSessionReminder: coachUser.notif_session_reminder ?? false,
    };

    return <ProfileForm user={userProfile} />;
}
