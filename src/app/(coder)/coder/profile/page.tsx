import { getSessionOrThrow } from '@/lib/auth';
import { getUserById } from '@/lib/dao/usersDao';
import CoderSettingsAccordion from '@/components/profile/CoderSettingsAccordion';
import { StaggerContainer, StaggerItem } from '../StaggerWrapper';

export default async function CoderProfilePage() {
  const session = await getSessionOrThrow();
  const user = await getUserById(session.user.id);

  if (!user) {
    return <div>User not found</div>;
  }

  // Unified Coder Profile Data
  const unifiedProfile = {
    username: user.username,
    fullName: user.full_name,
    avatarPath: (user as any).avatar_path || null,
    birthDate: user.birth_date || null,
    gender: user.gender || null,
    schoolName: user.school_name || null,
    schoolGrade: user.school_grade || null,
    parentName: user.parent_name || null,
    parentEmail: user.parent_email || null,
    parentContactPhone: user.parent_contact_phone || null,
    address: user.address || null,
  };

  return (
    <StaggerContainer className="flex-1 flex justify-center py-10 px-4 sm:px-10 overflow-y-auto">
      <StaggerItem className="w-full flex justify-center">
        <CoderSettingsAccordion profile={unifiedProfile} />
      </StaggerItem>
    </StaggerContainer>
  );
}
