import { computeLessonSchedule } from './src/lib/services/lessonScheduler';

async function run() {
  const classId = '23a83a47-b026-4ead-9d26-50ed8a56a5ef'; 
  const levelId = '512f14b0-b001-4d39-be3e-2cb78595374e'; // Explorer's level id
  
  try {
    const map = await computeLessonSchedule(classId, levelId);
    console.log("Map size:", map.size);
    const firstFew = Array.from(map.entries()).slice(0, 3);
    for (const [sessId, slot] of firstFew) {
      console.log(`Sess: ${sessId} -> LessonID/TemplateID: ${slot.classLessonId || slot.lessonTemplate.id}`);
    }
  } catch(e) {
    console.error(e);
  }
}
run();
