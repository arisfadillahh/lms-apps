import { getCoderProgress } from './src/lib/services/coder';
import { getAccessibleLessonsForCoder } from './src/lib/services/coder';

async function run() {
  const coderId = '8792a668-1ffc-4fbf-b916-47c7d74e132a'; 
  const classId = '23a83a47-b026-4ead-9d26-50ed8a56a5ef'; // Explorer Sabtu
  
  try {
    const progress = await getCoderProgress(coderId);
    const taziaProgress = progress.find(p => p.classId === classId);
    
    if (taziaProgress) {
        console.log("Found progress for Explorer Sabtu:");
        console.log("Current Block Name:", taziaProgress.currentBlockName);
        console.log("UpNext status:", taziaProgress.upNext?.status);
        console.log("UpNext lessons count:", taziaProgress.upNext?.lessons?.length);
        
        const first5Lessons = taziaProgress.upNext?.lessons?.slice(0, 5) || [];
        console.log("First 5 lessons status:", first5Lessons.map(l => l.status));
    } else {
        console.log("No progress found for this class!");
    }

    const overview = await getAccessibleLessonsForCoder(coderId);
    const taziaOverview = overview.find(o => o.classId === classId);
    if (taziaOverview) {
        console.log("Overview Blocks:", taziaOverview.blocks.length);
        if (taziaOverview.blocks.length > 0) {
            console.log("Lessons in first block:", taziaOverview.blocks[0].lessons.length);
        }
    } else {
        console.log("No accessible lessons found for this class!");
    }
  } catch(e) {
    console.error(e);
  }
}
run();
