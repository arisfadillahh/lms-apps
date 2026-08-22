import Link from 'next/link';
import { getSessionOrThrow } from '@/lib/auth';
import { attendanceDao, classesDao, sessionsDao, usersDao } from '@/lib/dao';
import { computeLessonSchedule, formatLessonTitle } from '@/lib/services/lessonScheduler';
import { canExtendBeforeNextLessonSession } from '@/lib/services/lessonExtensionBoundary';
import { getSupabaseAdmin } from '@/lib/supabaseServer';

import AttendanceWrapper from './AttendanceWrapper';
import type { AttendanceStatus } from './AttendanceList';

const EKSKUL_REVIEW_LEVEL_NAME = 'Ekskul';
const SUBMITTED_EKSKUL_REPORT_STATUSES = new Set(['SUBMITTED', 'PUBLISHED', 'SENT']);

type PageProps = {
  params: Promise<{ sessionId: string }>;
};

function isValidUuid(value: string): boolean {
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(value);
}

export default async function SessionAttendancePage({ params }: PageProps) {
  const session = await getSessionOrThrow();
  const resolvedParams = await params;
  const rawSessionId = resolvedParams.sessionId ?? '';
  const sessionId = decodeURIComponent(rawSessionId).trim();

  if (!sessionId || !isValidUuid(sessionId)) {
    return renderError('Session ID tidak valid', 'Parameter URL salah.');
  }

  const sessionRecord = await sessionsDao.getSessionById(sessionId);

  if (!sessionRecord) {
    return renderError('Sesi tidak ditemukan', 'Sesi ini mungkin sudah dihapus.');
  }

  const classRecord = await classesDao.getClassById(sessionRecord.class_id);
  if (!classRecord) {
    return renderError('Kelas tidak ditemukan', 'Data kelas hilang.');
  }

  if (classRecord.coach_id !== session.user.id && sessionRecord.substitute_coach_id !== session.user.id) {
    return renderError('Akses Ditolak', 'Anda bukan coach untuk sesi ini.');
  }

  const ekskulLessonPlanId =
    (classRecord as { ekskul_lesson_plan_id?: string | null }).ekskul_lesson_plan_id ?? null;

  const [enrollments, classSessions, lessonScheduleMap] = await Promise.all([
    classesDao.listEnrollmentsByClass(classRecord.id, { includeInactive: true }),
    sessionsDao.listSessionsByClass(classRecord.id),
    computeLessonSchedule(
      classRecord.id,
      classRecord.level_id ?? null,
      ekskulLessonPlanId
    ),
  ]);

  const attendanceRecords = classSessions.length
    ? await attendanceDao.listAttendanceForSessions(classSessions.map((item) => item.id))
    : [];

  const attendanceBySession = new Map<string, Map<string, { status: string; reason: string | null }>>();
  attendanceRecords.forEach((record) => {
    if (!attendanceBySession.has(record.session_id)) {
      attendanceBySession.set(record.session_id, new Map());
    }
    attendanceBySession
      .get(record.session_id)!
      .set(record.coder_id, { status: record.status, reason: record.reason ?? null });
  });

  const coders = await usersDao.getUsersByIds(enrollments.map((enrollment) => enrollment.coder_id));
  const coderMap = new Map(coders.map((coder) => [coder.id, coder.full_name]));

  const currentSessionMap =
    attendanceBySession.get(sessionRecord.id) ?? new Map<string, { status: string; reason: string | null }>();

  // Filter active coders only unless they have attendance record
  const attendees = enrollments
    .filter(e => e.status === 'ACTIVE' || currentSessionMap.has(e.coder_id))
    .map((enrollment) => ({
      coderId: enrollment.coder_id,
      fullName: coderMap.get(enrollment.coder_id) ?? 'Unknown Coder',
      attendance: currentSessionMap.get(enrollment.coder_id)
        ? {
          status: currentSessionMap.get(enrollment.coder_id)!.status as AttendanceStatus,
          reason: currentSessionMap.get(enrollment.coder_id)!.reason,
        }
        : null,
    }));

  const currentLessonSlot = lessonScheduleMap.get(sessionRecord.id);
  const slideUrl = currentLessonSlot?.lessonTemplate.slide_url ?? null;
  const slideTitle = currentLessonSlot ? formatLessonTitle(currentLessonSlot) : null;
  const lessonSummary = currentLessonSlot?.lessonTemplate.summary ?? 'Tidak ada ringkasan materi.';
  const isEkskulClass = classRecord.type === 'EKSKUL';
  const orderedSessions = classSessions
    .filter((item) => item.status !== 'CANCELLED')
    .sort((a, b) => new Date(a.date_time).getTime() - new Date(b.date_time).getTime());
  const nextLessonSession = currentLessonSlot
    ? orderedSessions
      .slice(Math.max(0, orderedSessions.findIndex((item) => item.id === sessionRecord.id) + 1))
      .map((item) => ({ item, slot: lessonScheduleMap.get(item.id) }))
      .find((candidate) => candidate.slot && candidate.slot.globalIndex > currentLessonSlot.globalIndex)
    : undefined;
  const nextLessonAttendanceCount = nextLessonSession
    ? (attendanceBySession.get(nextLessonSession.item.id)?.size ?? 0)
    : 0;
  const canExtendBeforeNextLesson = nextLessonSession
    ? canExtendBeforeNextLessonSession({
      dateTime: nextLessonSession.item.date_time,
      status: nextLessonSession.item.status,
      hasAttendance: nextLessonAttendanceCount > 0,
    })
    : true;
  const canExtendLesson = Boolean(
    !isEkskulClass
    && currentLessonSlot?.classLessonId
    && currentLessonSlot.partNumber === currentLessonSlot.totalParts
    && canExtendBeforeNextLesson
  );

  // Compute attendance stats
  const totalCoders = attendees.length;
  const markedCoders = attendees.filter((a) => a.attendance !== null).length;
  const presentCoders = attendees.filter((a) => a.attendance?.status === 'PRESENT').length;
  const attendancePercentage = totalCoders > 0 ? Math.round((presentCoders / totalCoders) * 100) : 0;

  // Compute block name
  const blockName = isEkskulClass
    ? 'Ekskul'
    : (lessonScheduleMap.get(sessionRecord.id)?.block.name ?? 'General');

  // Detect if this is the LAST session of this block (for evaluation button)
  const currentSlot = lessonScheduleMap.get(sessionRecord.id);
  const currentBlockId = currentSlot?.block.id ?? null;
  let isLastSessionOfBlock = false;
  if (!isEkskulClass && currentBlockId) {
    const blockSessions = classSessions.filter(s => {
      const slot = lessonScheduleMap.get(s.id);
      return slot?.block.id === currentBlockId;
    });
    const sortedBlockSessions = blockSessions.sort((a, b) =>
      new Date(a.date_time).getTime() - new Date(b.date_time).getTime()
    );
    isLastSessionOfBlock = sortedBlockSessions[sortedBlockSessions.length - 1]?.id === sessionRecord.id;
  }

  // Check if an eval session already exists for this attendance session
  let existingEvalSessionId: string | null = null;
  let templateId: string | null = null;
  if (isLastSessionOfBlock && currentBlockId) {
    const supabase = getSupabaseAdmin();
    const blockEvaluationClient = supabase as unknown as {
      from(table: 'block_evaluation_sessions'): {
        select(columns: string): {
          eq(column: string, value: string): {
            maybeSingle(): Promise<{ data: { id: string } | null }>;
          };
        };
      };
    };
    const { data: existingEval } = await blockEvaluationClient
      .from('block_evaluation_sessions')
      .select('id')
      .eq('session_id', sessionRecord.id)
      .maybeSingle();
    existingEvalSessionId = existingEval?.id ?? null;

    // Get template for this class's level
    const { data: classLevel } = await supabase
      .from('classes')
      .select('level_id')
      .eq('id', classRecord.id)
      .single();
    if (classLevel?.level_id) {
      const { data: tmpl } = await supabase
        .from('block_evaluation_templates')
        .select('id')
        .eq('level_id', classLevel.level_id)
        .maybeSingle();
      templateId = tmpl?.id ?? null;
    }
    if (!templateId) {
      const { data: fallbackTmpl } = await supabase
        .from('block_evaluation_templates')
        .select('id')
        .is('level_id', null)
        .maybeSingle();
      templateId = fallbackTmpl?.id ?? null;
    }
  }

  const activeEnrollmentCoderIds = enrollments
    .filter((enrollment) => enrollment.status === 'ACTIVE')
    .map((enrollment) => enrollment.coder_id);

  const isEkskulLessonSession =
    isEkskulClass && sessionRecord.status !== 'CANCELLED' && lessonScheduleMap.has(sessionRecord.id);
  const ekskulCurrentSessionAttendance = attendanceBySession.get(sessionRecord.id) ?? new Map();
  const ekskulMissingAttendanceCount = isEkskulLessonSession
    ? activeEnrollmentCoderIds.filter((coderId) => !ekskulCurrentSessionAttendance.has(coderId)).length
    : 0;
  const ekskulReportUrl = isEkskulLessonSession
    ? '/coach/reports'
    : null;
  const ekskulReportLockedReason = isEkskulLessonSession && sessionRecord.status !== 'COMPLETED'
    ? 'Simpan presensi sesi ini dulu sebelum generate rapor.'
    : isEkskulLessonSession && ekskulMissingAttendanceCount > 0
      ? `Lengkapi ${ekskulMissingAttendanceCount} presensi sesi ini dulu sebelum generate rapor.`
      : null;
  const canOpenEkskulReport =
    isEkskulLessonSession && sessionRecord.status === 'COMPLETED' && ekskulMissingAttendanceCount === 0;
  let ekskulReportStatus: 'SUBMITTED' | null = null;
  if (isEkskulLessonSession && currentLessonSlot && activeEnrollmentCoderIds.length > 0) {
    const supabase = getSupabaseAdmin();
    const reviewLevelId = classRecord.level_id ?? await resolveEkskulReviewLevelId();
    const reviewBlockName = `Ekskul - ${formatLessonTitle(currentLessonSlot)}`;

    if (reviewLevelId) {
      const { data: reviewBlock } = await supabase
        .from('blocks')
        .select('id')
        .eq('level_id', reviewLevelId)
        .eq('name', reviewBlockName)
        .limit(1)
        .maybeSingle();

      if (reviewBlock?.id) {
        const { data: reportStatuses } = await supabase
          .from('block_reports')
          .select('coder_id, status')
          .eq('class_id', classRecord.id)
          .eq('block_id', reviewBlock.id)
          .in('coder_id', activeEnrollmentCoderIds);

        const statusByCoderId = new Map((reportStatuses ?? []).map((report) => [report.coder_id, report.status]));
        const submittedReportCount = activeEnrollmentCoderIds.filter((coderId) =>
          SUBMITTED_EKSKUL_REPORT_STATUSES.has(statusByCoderId.get(coderId) ?? ''),
        ).length;

        if (submittedReportCount === activeEnrollmentCoderIds.length) {
          ekskulReportStatus = 'SUBMITTED';
        }
      }
    }
  }

  const sessionStart = new Date(sessionRecord.date_time);
  const sessionEnd = new Date(sessionStart.getTime() + 90 * 60000);
  const formattedDate = sessionStart.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' });
  const formattedTime = `${sessionStart.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} - ${sessionEnd.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB`;

  // Monthly recap stats
  const currentMonth = sessionStart.getMonth();
  const currentYear = sessionStart.getFullYear();
  const monthSessions = classSessions.filter(s => {
    const d = new Date(s.date_time);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear && s.status !== 'CANCELLED';
  });
  const allMonthAttendance = attendanceRecords.filter(r =>
    monthSessions.some(s => s.id === r.session_id)
  );
  const presentCount = allMonthAttendance.filter(r => r.status === 'PRESENT').length;
  const excusedCount = allMonthAttendance.filter(r => r.status === 'EXCUSED').length;
  const avgAttendance = monthSessions.length > 0 && totalCoders > 0
    ? Math.round((presentCount / (monthSessions.length * totalCoders)) * 100)
    : 0;

  return (
    <div className="-mx-8 -mt-0 pb-32 bg-slate-50 font-sans">

      {/* Breadcrumb + Context Bar */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-20 px-6 py-3 flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href={`/coach/classes/${classRecord.id}`} className="p-1 hover:bg-slate-100 rounded-lg transition-colors flex items-center justify-center">
            <span className="material-symbols-outlined text-slate-500">arrow_back</span>
          </Link>
          <nav className="flex items-center text-sm font-medium">
            <span className="text-slate-400">Classes</span>
            <span className="mx-2 text-slate-300">/</span>
            <span className="text-slate-900 truncate max-w-[200px] sm:max-w-xs">{classRecord.name}</span>
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${sessionRecord.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-600'
            }`}>
            {sessionRecord.status}
          </span>
        </div>
      </div>

      <div className="p-4 sm:p-6 lg:p-8 space-y-6 w-full">
        {/* Session Hero Card */}
        <div className="bg-slate-800 rounded-2xl p-6 sm:p-8 grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 text-white relative overflow-hidden shadow-xl shadow-slate-200 dark:shadow-none">
          <div className="absolute top-0 right-0 opacity-10 pointer-events-none">
            <span className="material-symbols-outlined text-[12rem] -mr-12 -mt-12">pattern</span>
          </div>

          {/* Column 1: DateTime */}
          <div className="flex items-center gap-4 sm:gap-5 border-b md:border-b-0 md:border-r border-slate-700/50 pb-4 md:pb-0 md:pr-4">
            <div className="w-12 h-12 sm:w-14 sm:h-14 bg-slate-700 rounded-2xl flex flex-col items-center justify-center text-white shrink-0 border border-slate-600">
              <span className="material-symbols-outlined text-xl sm:text-2xl mb-0.5">calendar_today</span>
            </div>
            <div>
              <p className="text-slate-400 text-[10px] sm:text-xs font-medium uppercase tracking-widest mb-1">Session Date</p>
              <p className="text-base sm:text-lg font-bold">{formattedDate}</p>
              <p className="text-slate-300 text-xs sm:text-sm">{formattedTime}</p>
            </div>
          </div>

          {/* Column 2: Details */}
          <div className="flex flex-col justify-center border-b md:border-b-0 md:border-r border-slate-700/50 pb-4 md:pb-0 md:pr-4 relative z-10">
            <div className="flex items-center gap-2 mb-2">
              <span className="bg-emerald-500/20 text-emerald-400 text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded uppercase">Block {blockName}</span>
            </div>
            <h2 className="text-lg sm:text-xl font-bold leading-tight mb-1">{slideTitle ?? 'Session Administration'}</h2>
            <p className="text-slate-400 text-xs sm:text-sm line-clamp-2">{lessonSummary}</p>
          </div>

          {/* Column 3: Stats */}
          <div className="flex items-center gap-4 sm:gap-6 justify-start md:justify-end relative z-10">
            <div className="text-left md:text-right">
              <p className="text-2xl sm:text-3xl font-bold">{attendancePercentage}%</p>
              <p className="text-slate-400 text-xs font-medium">{presentCoders} dari {totalCoders} coder hadir</p>
            </div>
            {/* Simple Donut Chart Representation */}
            <div className="relative w-14 h-14 sm:w-16 sm:h-16 shrink-0">
              <svg className="w-full h-full transform -rotate-90">
                <circle className="text-slate-700" cx="50%" cy="50%" fill="transparent" r="40%" stroke="currentColor" strokeWidth="6"></circle>
                <circle
                  className="text-emerald-500 transition-all duration-1000 ease-out"
                  cx="50%" cy="50%" fill="transparent" r="40%" stroke="currentColor"
                  strokeDasharray="250%"
                  strokeDashoffset={`${250 - (250 * attendancePercentage) / 100}%`}
                  strokeWidth="6"
                  strokeLinecap="round"
                ></circle>
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="material-symbols-outlined text-slate-400 text-base sm:text-lg">how_to_reg</span>
              </div>
            </div>
          </div>
        </div>

        {/* Progress Section */}
        <div className="bg-white rounded-2xl p-5 sm:p-6 shadow-sm border border-slate-200">
          <div className="flex justify-between items-end mb-3">
            <div>
              <h3 className="font-bold text-slate-900">Presensi Kedatangan</h3>
              <p className="text-xs text-slate-500">Sudah diisi: <span className="font-bold text-emerald-600">{markedCoders}/{totalCoders}</span> coder</p>
            </div>
            <span className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-widest">{attendancePercentage}% Complete</span>
          </div>
          <div className="h-2 sm:h-3 w-full bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${attendancePercentage}%` }}></div>
          </div>
        </div>

        {/* AttendanceWrapper handles the list + action strip + slide modal */}
        <AttendanceWrapper
          sessionId={sessionRecord.id}
          attendees={attendees}
          canComplete={sessionRecord.status === 'SCHEDULED'}
          slideUrl={slideUrl}
          slideTitle={slideTitle}
          isLastSessionOfBlock={isLastSessionOfBlock}
          classId={classRecord.id}
          blockId={currentBlockId ?? undefined}
          templateId={templateId}
          existingEvalSessionId={existingEvalSessionId}
          ekskulReportUrl={ekskulReportUrl}
          canOpenEkskulReport={canOpenEkskulReport}
          ekskulReportLockedReason={ekskulReportLockedReason}
          ekskulReportStatus={ekskulReportStatus}
          canExtendLesson={canExtendLesson}
          extendLessonTitle={slideTitle}
          nextLessonPart={(currentLessonSlot?.totalParts ?? 0) + 1}
        />

        {/* Monthly Recap Section */}
        <div className="mt-6 border-t border-slate-200 pt-6">
          <div className="flex items-center justify-between w-full mb-5">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-slate-400">analytics</span>
              <h3 className="font-bold text-slate-900">Rekap Kehadiran Bulanan</h3>
            </div>
            <span className="material-symbols-outlined text-slate-400">expand_more</span>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <div className="p-4 bg-white rounded-2xl border border-slate-200">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total Sesi Bln Ini</p>
              <p className="text-2xl font-bold text-slate-900">{monthSessions.length} <span className="text-xs font-medium text-slate-400">Sessions</span></p>
            </div>
            <div className="p-4 bg-white rounded-2xl border border-slate-200">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Avg. Attendance</p>
              <p className="text-2xl font-bold text-emerald-500">{avgAttendance}%</p>
            </div>
            <div className="p-4 bg-white rounded-2xl border border-slate-200">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Excused Absence</p>
              <p className="text-2xl font-bold text-blue-500">{excusedCount}</p>
            </div>
            <div className="p-4 bg-white rounded-2xl border border-slate-200">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Active Coder</p>
              <p className="text-2xl font-bold text-slate-900">{totalCoders}/{totalCoders}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function renderError(title: string, message: string) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 bg-slate-50">
      <div className="bg-white rounded-2xl p-8 max-w-md w-full text-center shadow-lg border border-slate-200">
        <span className="material-symbols-outlined text-red-500 text-6xl mb-4">error</span>
        <h1 className="text-xl font-bold text-slate-900 mb-2">{title}</h1>
        <p className="text-slate-500 mb-6">{message}</p>
        <a href="/coach/dashboard" className="text-blue-600 font-semibold hover:underline inline-flex items-center gap-1">
          <span className="material-symbols-outlined text-sm">arrow_back</span>
          Kembali ke Dashboard
        </a>
      </div>
    </div>
  );
}

async function resolveEkskulReviewLevelId() {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from('levels')
    .select('id')
    .eq('name', EKSKUL_REVIEW_LEVEL_NAME)
    .limit(1)
    .maybeSingle();

  return data?.id ?? null;
}
