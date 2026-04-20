import { getSessionOrThrow } from '@/lib/auth';
import { getAccessibleLessonsForCoder, getVisibleMaterialsForCoder } from '@/lib/services/coder';

import MaterialsBlockTabs from './MaterialsBlockTabs';

export default async function CoderMaterialsPage() {
  const session = await getSessionOrThrow();
  const [lessonPlans, materialsByClass] = await Promise.all([
    getAccessibleLessonsForCoder(session.user.id),
    getVisibleMaterialsForCoder(session.user.id),
  ]);

  return (
    <MaterialsBlockTabs
      lessonPlans={lessonPlans}
      materialsByClass={materialsByClass}
    />
  );
}
