import { getSupabaseAdmin } from './src/lib/supabaseServer.js';
import { reassignLessonsToSessions } from './src/lib/services/lessonRebalancer.js';

// A mock script to test the reorder logic
// Run with node or ts-node

async function testMaterialShift(classId, sessionId, classLessonId) {
    const supabase = getSupabaseAdmin();
    
    // 1. Get valid sessions
    const { data: validSessions, error: sessionError } = await supabase
        .from('sessions')
        .select('id, date_time')
        .eq('class_id', classId)
        .neq('status', 'CANCELLED')
        .order('date_time', { ascending: true });
        
    const targetSessionIndex = validSessions.findIndex(s => s.id === sessionId);
    console.log("Target Session Index:", targetSessionIndex);
    
    // 2. Get lessons
    const { data: lessons, error: lessonError } = await supabase
      .from('class_lessons')
      .select(`
        id, 
        order_index, 
        title,
        class_blocks!inner (
          id,
          class_id,
          blocks ( order_index )
        )
      `)
      .eq('class_blocks.class_id', classId);
      
    const sortedLessons = lessons.sort((a, b) => {
      const blockOrderA = a.class_blocks?.blocks?.order_index ?? 0;
      const blockOrderB = b.class_blocks?.blocks?.order_index ?? 0;
      if (blockOrderA !== blockOrderB) return blockOrderA - blockOrderB;
      if (a.order_index !== b.order_index) return a.order_index - b.order_index;
      return a.id.localeCompare(b.id);
    });
    
    const lessonToMoveIndex = sortedLessons.findIndex(l => l.id === classLessonId);
    console.log("Lesson To Move Index:", lessonToMoveIndex, sortedLessons[lessonToMoveIndex]?.title);
    
    const lessonToMove = sortedLessons[lessonToMoveIndex];
    sortedLessons.splice(lessonToMoveIndex, 1);
    const insertIndex = Math.min(targetSessionIndex, sortedLessons.length);
    sortedLessons.splice(insertIndex, 0, lessonToMove);
    
    console.log("New Order (first 15):");
    for (let i = 0; i < Math.min(15, sortedLessons.length); i++) {
        console.log(`[${i}] -> ${sortedLessons[i].title} (Block Order: ${sortedLessons[i].class_blocks?.blocks?.order_index})`);
    }
}

// Pass args
const args = process.argv.slice(2);
if (args.length === 3) {
    testMaterialShift(args[0], args[1], args[2]).catch(console.error);
} else {
    console.log("Usage: node test.js <classId> <sessionId> <lessonId>");
}
