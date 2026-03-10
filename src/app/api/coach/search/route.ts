import { NextResponse } from 'next/server';
import { getSessionOrThrow } from '@/lib/auth';
import { classesDao, materialsDao, sessionsDao } from '@/lib/dao';

export async function GET(request: Request) {
    try {
        const session = await getSessionOrThrow();
        const { searchParams } = new URL(request.url);
        const query = searchParams.get('q') || '';

        if (!query || query.length < 2) {
            return NextResponse.json({ success: true, results: { classes: [], materials: [] } });
        }

        const coachId = session.user.id;

        // 1. Get Coach's own classes and substitute classes
        const [ownClasses, subClasses] = await Promise.all([
            classesDao.listClassesForCoach(coachId),
            classesDao.listClassesWhereCoachIsSubstitute(coachId)
        ]);

        // Merge and deduplicate
        const classIds = Array.from(new Set([
            ...ownClasses.map(c => c.id),
            ...subClasses.map(c => c.id)
        ]));

        // Fetch all classes details to filter by name
        // (Note: For performance in large systems, we'd do this in SQL, 
        // but for current scale, fetching and filtering is fine)
        const allRelevantClasses = await Promise.all(
            classIds.map(id => classesDao.getClassById(id))
        );

        const filteredClasses = allRelevantClasses
            .filter(c => c && c.name.toLowerCase().includes(query.toLowerCase()))
            .map(c => ({
                id: c!.id,
                name: c!.name,
                type: 'class'
            }));

        // 2. Get Searchable Materials and Lessons strictly from Coach's Scheduled Sessions
        const { getAllCoachSessions } = await import('@/lib/services/coach');
        const coachSessions = await getAllCoachSessions(coachId);

        // Filter sessions that have not been cancelled
        const activeSessions = coachSessions.filter(s => s.status !== 'CANCELLED');

        // Extract class_id and class_block_name from these specific sessions
        // Since ExtendedSession doesn't natively have class_block_id exposed directly,
        // we use the block_name from the lesson object to filter materials if needed,
        // or we rely on the class_id to get materials and optionally filter by title.
        const activeClassIds = new Set(activeSessions.map(s => s.class_id));
        const activeBlockNames = new Set(
            activeSessions.map(s => s.lesson?.block_name).filter(Boolean)
        );

        // 3. Get Searchable Materials
        // Only fetch materials for classes that have active sessions on the dashboard
        const materialsPromises = Array.from(activeClassIds).map(cid => materialsDao.listMaterialsByClass(cid));
        const materialsNested = await Promise.all(materialsPromises);
        const allMaterials = materialsNested.flat();

        const activeMaterials = allMaterials
            .filter(m =>
            // Filter by search query
            (m.title.toLowerCase().includes(query.toLowerCase()) ||
                (m.description && m.description.toLowerCase().includes(query.toLowerCase())))
            )
            .map(m => ({
                id: m.id,
                name: m.title,
                type: 'material',
                class_id: m.class_id
            }));

        // 4. Get Searchable Lessons
        // Map lessons directly from the populated `lesson` object in `ExtendedSession`
        // Ensure uniqueness by session.id to avoid duplicate lesson entries
        const uniqueLessonsMap = new Map();

        activeSessions.forEach(session => {
            if (
                session.lesson &&
                session.lesson.title &&
                session.lesson.title.toLowerCase().includes(query.toLowerCase())
            ) {
                // We use session.id as the unique key to avoid duplicate visual results
                // even if multiple sessions use the same underlying lesson template
                if (!uniqueLessonsMap.has(session.id)) {
                    uniqueLessonsMap.set(session.id, {
                        id: `session-${session.id}`, // Generate a unique ID for the frontend link
                        name: session.lesson.title,
                        type: 'lesson',
                        class_id: session.class_id,
                        lesson_id: session.lesson.id
                    });
                }
            }
        });

        const filteredLessons = Array.from(uniqueLessonsMap.values());

        return NextResponse.json({
            success: true,
            results: {
                classes: filteredClasses,
                materials: activeMaterials,
                lessons: filteredLessons
            }
        });

    } catch (error: any) {
        console.error('Coach Search Error:', error);
        return NextResponse.json({ error: 'Search failed' }, { status: 500 });
    }
}
