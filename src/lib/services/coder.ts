import { attendanceDao, classLessonsDao, classesDao, coderProgressDao, lessonTemplatesDao, materialsDao, rubricsDao, sessionsDao } from '@/lib/dao';
import { getSoftwareByBlockId } from '@/lib/dao/blockSoftwareDao';
import { computeLessonSchedule, formatLessonTitle } from '@/lib/services/lessonScheduler';

export type CoderClassProgress = {
  classId: string;
  name: string;
  type: 'WEEKLY' | 'EKSKUL';
  levelName?: string | null;
  currentBlockName?: string | null;
  upcomingBlockName?: string | null;
  upNext?: {
    blockId: string;
    name: string;
    status: 'UPCOMING' | 'CURRENT' | 'COMPLETED';
    startDate: string;
    endDate: string;
    estimatedSessions?: number | null;
    software?: Array<{
      id: string;
      name: string;
      version: string | null;
      description: string | null;
      installation_url: string | null;
      installation_instructions: string | null;
      minimum_specs: Record<string, string> | null;
      access_info: string | null;
    }>;
    lessons?: Array<{
      id: string;
      title: string;
      summary: string | null;
      orderIndex?: number;
      slideUrl: string | null;
      status: 'COMPLETED' | 'NEXT' | 'UPCOMING' | 'LOCKED';
      completedAt?: string[];
      scheduledAt?: string[];
    }>;
  } | null;
  coach?: {
    name: string;
    avatarUrl: string | null;
    whatsappNumber: string | null;
  } | null;
  schedule?: {
    days: string[];
    timeInfo: string | null;
    zoomLink?: string | null;
  } | null;
  completedBlocks: number;
  totalBlocks: number | null;
  lastAttendanceAt?: string | null;
  semesterTag?: string | null;
  pendingBlocks?: Array<{
    blockId: string;
    name: string;
    status: 'UPCOMING' | 'CURRENT' | 'COMPLETED';
    startDate: string;
    endDate: string;
  }>;
  journeyBlocks: Array<{
    blockId: string;
    name: string;
    status: 'UPCOMING' | 'CURRENT' | 'COMPLETED';
    startDate: string;
    endDate: string;
    orderIndex: number | null;
  }>;
};

export async function getCoderProgress(coderId: string): Promise<CoderClassProgress[]> {
  const [classes, attendance, supabase] = await Promise.all([
    classesDao.listClassesForCoder(coderId),
    attendanceDao.listAttendanceByCoder(coderId),
    import('@/lib/supabaseServer').then(m => m.getSupabaseAdmin())
  ]);

  return Promise.all(
    classes.map(async (klass) => {
      // Common data
      const submissions = await rubricsDao.listRubricSubmissionsByCoder(klass.id, coderId);
      const sessions = await sessionsDao.listSessionsByClass(klass.id);
      const sessionIdSet = new Set(sessions.map((session) => session.id));
      const lastAttendance = attendance
        .filter(
          (record) =>
            (record.status === 'PRESENT' || record.status === 'LATE') &&
            sessionIdSet.has(record.session_id),
        )
        .sort((a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime())[0];
      const semesterTag = submissions.find((submission) => submission.semester_tag)?.semester_tag ?? null;

      // Extract schedule
      const scheduleDays = Array.from(new Set(sessions.filter(s => s.status !== 'CANCELLED').map(s => new Date(s.date_time).toLocaleDateString('id-ID', { weekday: 'long' }))));
      const firstSessionTemplate = sessions.find(s => s.status !== 'CANCELLED');
      const timeInfo = firstSessionTemplate ? new Date(firstSessionTemplate.date_time).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : null;

      // Fetch Coach Info
      let coachInfo = null;
      let coachAvatarUrl = null;
      if (klass.coach_id) {
        const { data: coachData } = await supabase.from('users').select('*').eq('id', klass.coach_id).single();
        if (coachData) {
          const cData = coachData as any;
          if (cData.avatar_url) {
            const { data: publicUrlData } = supabase.storage.from('avatars').getPublicUrl(cData.avatar_url);
            coachAvatarUrl = publicUrlData.publicUrl;
          }
          coachInfo = {
            name: cData.full_name,
            avatarUrl: coachAvatarUrl,
            whatsappNumber: cData.parent_contact_phone || cData.phone || null
          };
        }
      }

      // Fetch Level Name
      let levelName: string | null = null;
      if (klass.level_id) {
        const { data: levelData } = await supabase.from('levels').select('name').eq('id', klass.level_id).maybeSingle();
        if (levelData) {
          levelName = levelData.name;
        }
      }

      // --- EKSKUL HANDLING ---
      if (klass.type === 'EKSKUL') {
        let upNext: CoderClassProgress['upNext'] = null;
        let totalBlocks = 1; // Ekskul counts as 1 block/plan
        let completedBlocks = 0; // Logic for completion? Maybe if class end date passed?
        let journeyBlocks: CoderClassProgress['journeyBlocks'] = [];

        if (klass.ekskul_lesson_plan_id) {
          const plan = await import('@/lib/dao/ekskulPlansDao').then(m => m.getEkskulPlanWithDetails(klass.ekskul_lesson_plan_id!));

          if (plan) {
            // Determine status
            const now = new Date();
            const start = new Date(klass.start_date);
            const end = new Date(klass.end_date);
            let status: 'UPCOMING' | 'CURRENT' | 'COMPLETED' = 'UPCOMING';
            if (now > end) status = 'COMPLETED';
            else if (now >= start) status = 'CURRENT';

            completedBlocks = status === 'COMPLETED' ? 1 : 0;

            const software = plan.ekskul_plan_software.map(ps => ({
              id: ps.software.id,
              name: ps.software.name,
              version: ps.software.version,
              description: ps.software.description,
              installation_url: ps.software.installation_url,
              installation_instructions: ps.software.installation_instructions,
              minimum_specs: ps.software.minimum_specs as Record<string, string> | null,
              access_info: ps.software.access_info,
            }));

            // Find next upcoming session for Ekskul
            const nextSession = sessions
              .filter(s => (new Date(s.date_time) >= now && s.status !== 'COMPLETED' && s.status !== 'CANCELLED'))
              .sort((a, b) => new Date(a.date_time).getTime() - new Date(b.date_time).getTime())[0];

            // Calculate estimated total lessons
            const totalLessons = plan.ekskul_lessons.length;

            // For Ekskul journey - use lessons as nodes instead of blocks
            // Estimate progress based on completed sessions vs total lessons
            const completedSessions = sessions.filter(s => s.status === 'COMPLETED').length;

            journeyBlocks = plan.ekskul_lessons
              .sort((a, b) => a.order_index - b.order_index)
              .map((lesson, index) => {
                // Determine lesson status based on session progress
                let lessonStatus: 'UPCOMING' | 'CURRENT' | 'COMPLETED' = 'UPCOMING';
                if (index < completedSessions) {
                  lessonStatus = 'COMPLETED';
                } else if (index === completedSessions) {
                  lessonStatus = 'CURRENT';
                }

                // Estimate dates for each lesson
                const lessonStartDate = new Date(klass.start_date);
                lessonStartDate.setDate(lessonStartDate.getDate() + (index * 7)); // Roughly weekly
                const lessonEndDate = new Date(lessonStartDate);
                lessonEndDate.setDate(lessonEndDate.getDate() + 7);

                return {
                  blockId: lesson.id, // Use lesson id as blockId for compatibility
                  name: lesson.title,
                  status: lessonStatus,
                  startDate: lessonStartDate.toISOString(),
                  endDate: lessonEndDate.toISOString(),
                  orderIndex: index,
                };
              });

            upNext = {
              blockId: plan.id,
              name: plan.name, // Use Plan Name as "Block" Name
              status: status,
              startDate: klass.start_date,
              endDate: klass.end_date,
              estimatedSessions: plan.ekskul_lessons.reduce((acc, l) => acc + (l.estimated_meetings || 1), 0),
              software: software,
              lessons: nextSession ? [{
                id: nextSession.id,
                title: `Sesi: ${new Date(nextSession.date_time).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short' })}`,
                summary: `Jam ${new Date(nextSession.date_time).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`,
                orderIndex: 0,
                slideUrl: null,
                status: 'NEXT' as const,
                scheduledAt: [nextSession.date_time]
              }] : []
            };
          }
        }

        return {
          classId: klass.id,
          name: klass.name,
          type: klass.type,
          levelName,
          currentBlockName: upNext?.name ?? null,
          upcomingBlockName: null,
          upNext,
          coach: coachInfo,
          schedule: {
            days: scheduleDays,
            timeInfo: timeInfo,
            zoomLink: klass.zoom_link || null
          },
          completedBlocks,
          totalBlocks,
          lastAttendanceAt: lastAttendance?.recorded_at ?? null,
          semesterTag,
          pendingBlocks: [],
          journeyBlocks, // Now populated with lessons for Ekskul
        };
      }

      // --- WEEKLY HANDLING (Existing Logic) ---
      const blocks = await classesDao.getClassBlocks(klass.id);
      const lessonMap = klass.level_id ? await computeLessonSchedule(klass.id, klass.level_id) : new Map();

      // Fetch personalized journey order
      const journey = klass.level_id ? await coderProgressDao.getCoderJourney(coderId, klass.level_id) : [];
      const journeyOrderMap = new Map(journey.map(j => [j.block_id, j.journey_order]));

      // Fix: Calculate progress based on Journey Status (supports Manual Override), not just Submissions
      const completedBlocks = journey.filter(j => j.status === 'COMPLETED').length;
      const totalBlocks = blocks.length;
      const currentBlock = blocks.find((block) => block.status === 'CURRENT');
      const upcomingBlock = blocks.find((block) => block.status === 'UPCOMING');

      // Sort blocks by journey_order if available, else standard order
      const sortedBlocks = [...blocks].sort((a, b) => {
        const orderA = journeyOrderMap.get(a.block_id);
        const orderB = journeyOrderMap.get(b.block_id);

        if (orderA !== undefined && orderB !== undefined) {
          return orderA - orderB;
        }
        if (orderA !== undefined) return -1;
        if (orderB !== undefined) return 1;

        // Fallback: Priority to Date (Chronological)
        const dateA = new Date(a.start_date).getTime();
        const dateB = new Date(b.start_date).getTime();
        if (dateA !== dateB) {
          return dateA - dateB;
        }

        // Tie-breaker
        if (a.block_order_index != null && b.block_order_index != null) {
          return a.block_order_index - b.block_order_index;
        }
        return 0;
      });

      const pendingBlocks =
        sortedBlocks.filter((block) => block.status !== 'COMPLETED').map((block) => ({
          blockId: block.block_id,
          name: block.block_name ?? 'Block',
          status: block.status,
          startDate: block.start_date,
          endDate: block.end_date,
        }));

      // Use the sorted index as the display order
      const journeyBlocks = sortedBlocks.map((block, index) => {
        // Find personal status override
        const personal = journey.find(j => j.block_id === block.block_id);
        let displayStatus = block.status; // Default to class schedule status

        if (personal) {
          if (personal.status === 'COMPLETED') displayStatus = 'COMPLETED';
          else if (personal.status === 'IN_PROGRESS') displayStatus = 'CURRENT';
          else displayStatus = 'UPCOMING'; // PENDING -> UPCOMING
        }

        return {
          blockId: block.block_id,
          name: block.block_name ?? 'Block',
          status: displayStatus,
          startDate: block.start_date,
          endDate: block.end_date,
          orderIndex: index,
        };
      });

      let upNext: CoderClassProgress['upNext'] = null;

      const currentOrUpcoming =
        sortedBlocks.find((block) => block.status === 'CURRENT') ??
        sortedBlocks.find((block) => block.status === 'UPCOMING');

      if (currentOrUpcoming) {
        const software = await getSoftwareByBlockId(currentOrUpcoming.block_id);


        const blockLessons = await lessonTemplatesDao.listLessonsByBlock(currentOrUpcoming.block_id);
        const sessionDateMap = new Map(sessions.map(s => [s.id, { date: s.date_time, status: s.status }]));

        const now = new Date();

        // 1. Get the actual block sessions based on computeLessonSchedule
        const blockSessions: { sessionId: string; date: string; status: string; orderIndex: number }[] = [];
        for (const lesson of blockLessons) {
            const sIds = [...lessonMap.entries()].filter(([_, mapping]) => mapping.lessonTemplate.id === lesson.id).map(([sId]) => sId);
            for (const sId of sIds) {
                const sInfo = sessionDateMap.get(sId);
                if (sInfo && sInfo.status !== 'CANCELLED') {
                     blockSessions.push({ sessionId: sId, date: sInfo.date, status: sInfo.status, orderIndex: (lesson as any).order_index ?? 0 });
                }
            }
        }

        // 2. Find the index where the block is currently active (first uncompleted session or future session)
        let firstFutureOrActiveLessonIndex = blockLessons.length;
        for (let i = 0; i < blockLessons.length; i++) {
          const lesson = blockLessons[i];
          let isFutureOrActive = false;
          
          const sIds = [...lessonMap.entries()].filter(([_, mapping]) => mapping.lessonTemplate.id === lesson.id).map(([sId]) => sId);
          for (const sId of sIds) {
            const sInfo = sessionDateMap.get(sId);
            if (sInfo && sInfo.status !== 'COMPLETED' && new Date(sInfo.date) > now) {
              isFutureOrActive = true;
              break;
            } else if (sInfo && sInfo.status === 'SCHEDULED' && new Date(sInfo.date) <= now) {
              isFutureOrActive = true; // Still active right now
              break;
            }
          }
          
          if (isFutureOrActive) {
            firstFutureOrActiveLessonIndex = i;
            break;
          }
        }

        let hasMarkedNext = false;
        const allLessonsList = blockLessons.map((lesson, index) => {
          const sessionIdsForLesson = [...lessonMap.entries()].filter(([_, mapping]) => mapping.lessonTemplate.id === lesson.id).map(([sId, _]) => sId);
          let isCompleted = false;
          let completedAtDates: string[] = [];
          let scheduledAtDates: string[] = [];

          for (const sId of sessionIdsForLesson) {
             if (sessionDateMap.has(sId)) {
                const sessionInfo = sessionDateMap.get(sId)!;
                scheduledAtDates.push(sessionInfo.date);
                if (sessionInfo.status === 'COMPLETED') {
                   isCompleted = true;
                   completedAtDates.push(sessionInfo.date);
                }
             }
          }

          let lessonStatus: 'COMPLETED' | 'NEXT' | 'UPCOMING' | 'LOCKED' = 'UPCOMING';
          
          if (isCompleted) {
            lessonStatus = 'COMPLETED';
          } else if (scheduledAtDates.length > 0 && !hasMarkedNext) {
            lessonStatus = 'NEXT';
            hasMarkedNext = true;
          } else if (scheduledAtDates.length > 0) {
             lessonStatus = 'UPCOMING';
          } else {
             lessonStatus = 'LOCKED';
          }
          
          // Override: If it's *before* the first future session, it's skipped -> COMPLETED
          if (lessonStatus === 'LOCKED' || lessonStatus === 'UPCOMING') {
             if (index < firstFutureOrActiveLessonIndex) {
               lessonStatus = 'COMPLETED';
             } else if (index === firstFutureOrActiveLessonIndex && !hasMarkedNext) {
               lessonStatus = 'NEXT';
               hasMarkedNext = true;
             } else if (index > firstFutureOrActiveLessonIndex) {
               lessonStatus = 'LOCKED';
             }
          }

          return {
            id: lesson.id,
            title: lesson.title,
            summary: lesson.summary ?? null,
            orderIndex: (lesson as any).order_index ?? index,
            slideUrl: lesson.slide_url,
            status: lessonStatus,
            completedAt: completedAtDates.length > 0 ? completedAtDates : undefined,
            scheduledAt: scheduledAtDates.length > 0 ? scheduledAtDates : undefined
          };
        });

        upNext = {
          blockId: currentOrUpcoming.block_id,
          name: currentOrUpcoming.block_name ?? 'Block',
          status: currentOrUpcoming.status,
          startDate: currentOrUpcoming.start_date,
          endDate: currentOrUpcoming.end_date,
          estimatedSessions: (await lessonTemplatesDao.listLessonsByBlock(currentOrUpcoming.block_id))
            .reduce((acc, l) => acc + (l.estimated_meeting_count || 1), 0),
          software: software.map(s => ({
            id: s.id,
            name: s.name,
            version: s.version,
            description: s.description,
            installation_url: s.installation_url,
            installation_instructions: s.installation_instructions,
            minimum_specs: s.minimum_specs as Record<string, string> | null,
            access_info: s.access_info,
          })),
          lessons: allLessonsList,
        };
      } else if (sortedBlocks.length > 0) {
        const wrapAround = sortedBlocks[0];
        const software = await getSoftwareByBlockId(wrapAround.block_id);
        upNext = {
          blockId: wrapAround.block_id,
          name: wrapAround.block_name ?? 'Block',
          status: wrapAround.status,
          startDate: wrapAround.start_date,
          endDate: wrapAround.end_date,
          estimatedSessions: (await lessonTemplatesDao.listLessonsByBlock(wrapAround.block_id))
            .reduce((acc, l) => acc + (l.estimated_meeting_count || 1), 0),
          software: software.map(s => ({
            id: s.id,
            name: s.name,
            version: s.version,
            description: s.description,
            installation_url: s.installation_url,
            installation_instructions: s.installation_instructions,
            minimum_specs: s.minimum_specs as Record<string, string> | null,
            access_info: s.access_info,
          })),
          lessons: [],
        };
      }

      return {
        classId: klass.id,
        name: klass.name,
        type: klass.type,
        levelName,
        currentBlockName: currentBlock?.block_name ?? null,
        upcomingBlockName: upcomingBlock?.block_name ?? null,
        upNext,
        coach: coachInfo,
        schedule: {
          days: scheduleDays,
          timeInfo: timeInfo,
          zoomLink: klass.zoom_link || null
        },
        completedBlocks,
        totalBlocks,
        lastAttendanceAt: lastAttendance?.recorded_at ?? null,
        semesterTag,
        pendingBlocks,
        journeyBlocks,
      };
    }),
  );
}

export type CoderLessonOverview = {
  classId: string;
  name: string;
  blocks: Array<{
    id: string;
    name: string;
    status: 'UPCOMING' | 'CURRENT' | 'COMPLETED';
    startDate: string;
    endDate: string;
    lessons: Array<{
      id: string;
      title: string;
      summary: string | null;
      orderIndex: number;
      slideUrl: string | null;
      exampleUrl: string | null;
      sessionDate: string | null;
    }>;
  }>;
};

export async function getAccessibleLessonsForCoder(coderId: string): Promise<CoderLessonOverview[]> {
  const classes = await classesDao.listClassesForCoder(coderId);
  const now = new Date();

  return Promise.all(
    classes.map(async (klass) => {
      // --- EKSKUL HANDLING ---
      if (klass.type === 'EKSKUL') {
        if (!klass.ekskul_lesson_plan_id) {
          return {
            classId: klass.id,
            name: klass.name,
            blocks: [],
          };
        }

        const plan = await import('@/lib/dao/ekskulPlansDao').then(m => m.getEkskulPlanWithDetails(klass.ekskul_lesson_plan_id!));
        if (!plan) {
          return {
            classId: klass.id,
            name: klass.name,
            blocks: [],
          };
        }

        const sessions = await sessionsDao.listSessionsByClass(klass.id);
        const completedSessions = sessions.filter(s => s.status === 'COMPLETED').length;

        // Map Ekskul Lessons to "Accessible Lessons"
        // Logic: Lesson is accessible if index < completedSessions OR if it's the current one (index == completedSessions)
        const accessibleLessons = plan.ekskul_lessons
          .sort((a, b) => a.order_index - b.order_index)
          .filter((lesson, index) => {
            // Determine if lesson is accessible
            // For Ekskul, we assume sequential access based on sessions
            // If we have N completed sessions, then lessons 0..N are accessible (N is current/upcoming)
            // Or maybe only completed ones? User said "Materi yang sudah dipelajari".
            // But regular logic includes "upcoming session <= now".

            // Let's mimic strict logic:
            // Any lesson that "corresponds" to a session that is PAST or COMPLETED is accessible.

            // If there are more lessons than sessions, those far future lessons are not accessible?
            // Simple proxy: if index <= completedSessions + 1?

            // Let's stick to: ALL lessons in the plan are visible but their STATUS differs?
            // getAccessibleLessonsForCoder usually filters strictly. 

            // Let's show all lessons that "have happened" or "are happening".
            if (index < completedSessions) return true; // Past

            // Current session?
            const currentSession = sessions
              .filter(s => new Date(s.date_time) >= now && s.status !== 'COMPLETED' && s.status !== 'CANCELLED')
              .sort((a, b) => new Date(a.date_time).getTime() - new Date(b.date_time).getTime())[0];

            if (index === completedSessions && currentSession && new Date(currentSession.date_time) <= now) {
              return true;
            }

            return false;
            // Actually user said "Materi yang sudah dipelajari". 
            // So maybe strict past?
            // But in regular logic (lines 391-395), it shows if session date <= now.
          })
          .map((lesson, index) => {
            // Try to find matching session date?
            // We assume 1-to-1 mapping based on order
            // This is an estimation for Ekskul as they don't link directly in DB usually

            // Completed sessions
            const sortedSessions = sessions
              .filter(s => s.status === 'COMPLETED')
              .sort((a, b) => new Date(a.date_time).getTime() - new Date(b.date_time).getTime());

            let sessionDate: string | null = null;
            if (index < sortedSessions.length) {
              sessionDate = sortedSessions[index].date_time;
            } else if (index === sortedSessions.length) {
              // Check if there is a current/upcoming session
              const nextSession = sessions
                .filter(s => new Date(s.date_time) >= now && s.status !== 'COMPLETED' && s.status !== 'CANCELLED')
                .sort((a, b) => new Date(a.date_time).getTime() - new Date(b.date_time).getTime())[0];

              if (nextSession) sessionDate = nextSession.date_time;
            }

            return {
              id: lesson.id,
              title: lesson.title,
              summary: null, // Ekskul lessons do not have description in current type definition
              orderIndex: lesson.order_index,
              slideUrl: lesson.slide_url ?? null,
              exampleUrl: null, // Ekskul doesn't have example_url on lesson table usually?
              sessionDate: sessionDate
            };
          });

        return {
          classId: klass.id,
          name: klass.name,
          blocks: [{
            id: plan.id, // Use plan ID as block ID
            name: 'Modul Ekskul',
            status: 'CURRENT', // Rough estimate
            startDate: klass.start_date,
            endDate: klass.end_date,
            lessons: accessibleLessons
          }]
        };
      }

      // --- WEEKLY HANDLING ---
      const [blocks, sessions, enrollment] = await Promise.all([
        classesDao.getClassBlocks(klass.id),
        sessionsDao.listSessionsByClass(klass.id),
        classesDao.getEnrollment(klass.id, coderId),
      ]);
      const sessionMap = new Map(sessions.map((session) => [session.id, session]));

      const enrollmentDate = enrollment ? new Date(enrollment.enrolled_at) : new Date(0); // Default to epoch if no date (shouldn't happen)

      const blockEntries = await Promise.all(
        blocks.map(async (block) => {
          // RESTRICTION: Hide block if it strictly ended BEFORE the user enrolled.
          // Example: Block ends Jan 31. User joins Feb 1. Block is hidden.
          // If Block ends Feb 28. User joins Feb 1. Block is visible.
          if (new Date(block.end_date) < enrollmentDate) {
            return null;
          }

          // RESTRICTION: Hide block if it is still in the future (UPCOMING)
          if (block.status === 'UPCOMING' || new Date(block.start_date) > new Date()) {
            return null;
          }
          const lessons = await classLessonsDao.listLessonsByClassBlock(block.id);
          const now = new Date();
          
          let firstFutureOrActiveLessonIndex = lessons.length;
          for (let i = 0; i < lessons.length; i++) {
             const lesson = lessons[i];
             let isFutureOrActive = false;
             if (lesson.session_id && sessionMap.has(lesson.session_id)) {
                const session = sessionMap.get(lesson.session_id)!;
                if (session.status !== 'COMPLETED' && new Date(session.date_time) > now) {
                   isFutureOrActive = true;
                }
             }
             if (isFutureOrActive) {
                firstFutureOrActiveLessonIndex = i;
                break;
             }
          }

          const accessibleLessons = lessons
            .filter((lesson, index) => {
              if (block.status === 'COMPLETED') return true;
              
              if (lesson.session_id && sessionMap.has(lesson.session_id)) {
                 const session = sessionMap.get(lesson.session_id)!;
                 if (session.status === 'COMPLETED' || new Date(session.date_time) <= now) return true;
              }
              if (lesson.unlock_at && new Date(lesson.unlock_at) <= now) return true;
              
              // Include skipped past lessons
              if (index <= firstFutureOrActiveLessonIndex) return true;
              
              return false;
            })
            .sort((a, b) => a.order_index - b.order_index)
            .map((lesson) => ({
              id: lesson.id,
              title: lesson.title,
              summary: lesson.template_summary ?? null,
              orderIndex: lesson.order_index,
              slideUrl: lesson.slide_url ?? null,
              exampleUrl: (lesson as any).example_url ?? (lesson as any).coach_example_url ?? null,
              sessionDate: lesson.session_id && sessionMap.has(lesson.session_id)
                ? sessionMap.get(lesson.session_id)!.date_time
                : null,
            }));

          return {
            id: block.id,
            name: block.block_name ?? 'Block',
            status: block.status,
            startDate: block.start_date,
            endDate: block.end_date,
            lessons: accessibleLessons,
          };
        }),
      );

      return {
        classId: klass.id,
        name: klass.name,
        blocks: blockEntries.filter((b): b is NonNullable<typeof b> => b !== null),
      };
    }),
  );
}

export async function getVisibleMaterialsForCoder(coderId: string) {
  const classes = await classesDao.listClassesForCoder(coderId);
  const nowIso = new Date().toISOString();
  const results = await Promise.all(
    classes.map(async (klass) => {
      const sessions = await sessionsDao.listSessionsByClass(klass.id);
      const now = new Date();
      const accessibleSessions = new Set(
        sessions
          .filter((session) => new Date(session.date_time) <= now)
          .map((session) => session.id),
      );

      const materials = await materialsDao.listVisibleMaterialsForCoder({
        classId: klass.id,
        nowIso,
        lastAccessibleSessionIds: accessibleSessions,
      });

      return {
        classId: klass.id,
        name: klass.name,
        materials,
      };
    }),
  );

  return results;
}

export async function getLessonDetailForCoder(coderId: string, lessonId: string) {
  const lesson = await classLessonsDao.getClassLessonById(lessonId);
  if (!lesson) {
    // Try fetching as Ekskul Lesson
    const ekskulLesson = await import('@/lib/dao/ekskulPlansDao').then(m => m.getEkskulLessonById(lessonId));
    if (!ekskulLesson) return null;

    // Note: Ekskul lessons logic for access is slightly different (based on enrollment in the ekskul class)
    // We need to find the plan, then find the class that uses this plan and user is enrolled in.
    // Simplify: Check if user is enrolled in ANY class that has this ekskul plan id?  
    // But query is "lessonId". We know the lesson belongs to a plan.

    const planId = ekskulLesson.plan_id;
    if (!planId) return null;

    // Find active ekskul class for this coder that uses this plan
    const coderClasses = await classesDao.listClassesForCoder(coderId);
    const activeEkskulClass = coderClasses.find(c => c.type === 'EKSKUL' && c.ekskul_lesson_plan_id === planId);

    if (!activeEkskulClass) return null;

    // Check access - similar to list logic
    // If it's Ekskul, we might just allow access to everything if enrolled?
    // Or follow the "session completed" logic?
    // For now, let's allow access if enrolled, to fix the 404. 
    // User said "Materi yang sudah dipelajari".

    // Calculate session date mapping
    const plan = await import('@/lib/dao/ekskulPlansDao').then(m => m.getEkskulPlanWithDetails(planId));
    let sessionDate: string | null = null;

    if (plan) {
      // Sort lessons to find the index of the current lesson
      const sortedLessons = plan.ekskul_lessons.sort((a, b) => a.order_index - b.order_index);
      const lessonIndex = sortedLessons.findIndex(l => l.id === lessonId);

      if (lessonIndex !== -1) {
        const sessions = await sessionsDao.listSessionsByClass(activeEkskulClass.id);
        const sortedSessions = sessions
          .filter(s => s.status !== 'CANCELLED') // Should we exclude cancelled? Probably yes.
          .sort((a, b) => new Date(a.date_time).getTime() - new Date(b.date_time).getTime());

        if (lessonIndex < sortedSessions.length) {
          sessionDate = sortedSessions[lessonIndex].date_time;
        }
      }
    }

    return {
      id: ekskulLesson.id,
      class_block_id: 'EKSKUL', // Dummy
      lesson_template_id: null,
      title: ekskulLesson.title,
      summary: ekskulLesson.summary,
      order_index: ekskulLesson.order_index ?? 0,
      session_id: null,
      unlock_at: null,
      make_up_instructions: null,
      slide_url: ekskulLesson.slide_url,
      coach_example_url: null,
      coach_example_storage_path: null,
      created_at: ekskulLesson.created_at ?? new Date().toISOString(),
      updated_at: ekskulLesson.created_at ?? new Date().toISOString(),
      sessionDate: sessionDate
    };
  }

  const block = await classesDao.getClassBlockById(lesson.class_block_id);
  if (!block) return null;

  // Check enrollment
  const enrollment = await classesDao.getEnrollment(block.class_id, coderId);
  if (!enrollment || enrollment.status !== 'ACTIVE') return null;

  // RESTRICTION: Block Ended Before Enrollment?
  const enrollmentDate = new Date(enrollment.enrolled_at);
  if (new Date(block.end_date) < enrollmentDate) {
    return null;
  }

  const session = lesson.session_id ? await sessionsDao.getSessionById(lesson.session_id) : null;
  const now = new Date();

  const isAccessible = await (async () => {
    if (block.status === 'COMPLETED') return true;
    if (session?.status === 'COMPLETED') return true;
    if (session && new Date(session.date_time) <= now) return true;
    if (lesson.unlock_at && new Date(lesson.unlock_at) <= now) return true;
    
    // Check if it's a skipped lesson that comes before the currently active/future session
    const classSessions = await sessionsDao.listSessionsByClass(block.class_id);
    const sessionMap = new Map(classSessions.map((s) => [s.id, s]));
    const blockLessons = await classLessonsDao.listLessonsByClassBlock(block.id);
    
    let firstFutureOrActiveLessonIndex = blockLessons.length;
    for (let i = 0; i < blockLessons.length; i++) {
        const bl = blockLessons[i];
        if (bl.session_id && sessionMap.has(bl.session_id)) {
            const s = sessionMap.get(bl.session_id)!;
            if (s.status !== 'COMPLETED' && new Date(s.date_time) > now) {
                firstFutureOrActiveLessonIndex = i;
                break;
            }
        }
    }
    
    const targetLessonIndex = blockLessons.findIndex(bl => bl.id === lesson.id);
    if (targetLessonIndex !== -1 && targetLessonIndex <= firstFutureOrActiveLessonIndex) {
        return true;
    }

    return false;
  })();

  if (!isAccessible) return null;

  return {
    ...lesson,
    sessionDate: session?.date_time ?? null,
  };
}
