import { NextResponse } from 'next/server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';

import { getSessionOrThrow } from '@/lib/auth';
import { attendanceDao, classLessonsDao, classesDao, coachLeaveDao, sessionsDao } from '@/lib/dao';
import { assertRole } from '@/lib/roles';
import { hasSessionStarted, SESSION_NOT_STARTED_MESSAGE } from '@/lib/sessionTiming';
import { evaluateStudentAttendance, isEnrollmentAtSession } from '@/lib/payroll/studentAttendanceState';
import { assignedSessionCoachId } from '@/lib/coachSessionAccess';
import { syncStudentAttendancePayroll } from '@/lib/services/payrollStudentAttendanceSync';

const updateStatusSchema = z.object({
  status: z.enum(['COMPLETED', 'CANCELLED']),
});

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const session = await getSessionOrThrow();
    const coachSession = await assertRole(session, 'COACH');

    const params = await context.params;
    const sessionId = params.id;

    // Validate UUID format to prevent database errors
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sessionId)) {
      return NextResponse.json({ error: 'Invalid session ID' }, { status: 400 });
    }

    const sessionRecord = await sessionsDao.getSessionById(sessionId);
    if (!sessionRecord) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const classRecord = await classesDao.getClassById(sessionRecord.class_id);
    if (!classRecord) {
      return NextResponse.json({ error: 'Class not found' }, { status: 404 });
    }

    const approvedLeave = await coachLeaveDao.getApprovedLeaveForSession(sessionId);
    const isAssignedCoach = assignedSessionCoachId(classRecord.coach_id, sessionRecord.substitute_coach_id, approvedLeave) === coachSession.user.id;

    if (!isAssignedCoach) {
      return NextResponse.json({ error: 'Forbidden: Not your class' }, { status: 403 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const parsed = updateStatusSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
    }

    if (parsed.data.status === 'COMPLETED' && !hasSessionStarted(sessionRecord.date_time)) {
      return NextResponse.json({ error: SESSION_NOT_STARTED_MESSAGE }, { status: 409 });
    }

    if (parsed.data.status === 'COMPLETED') {
      if (sessionRecord.status === 'CANCELLED') {
        return NextResponse.json({ error: 'Sesi dibatalkan. Hubungi admin untuk mengaktifkan kembali sesi.' }, { status: 409 });
      }
      const [enrollments, attendance] = await Promise.all([
        classesDao.listEnrollmentsByClass(classRecord.id, { activeCodersOnly: true }),
        attendanceDao.listAttendanceBySession(sessionId),
      ]);
      const expected = enrollments.filter(enrollment => isEnrollmentAtSession(enrollment, sessionRecord.date_time)).map(enrollment => enrollment.coder_id);
      const state = evaluateStudentAttendance(expected, attendance);
      if (!state.expected || state.recorded !== state.expected) {
        return NextResponse.json({ error: 'Lengkapi dan simpan presensi semua coder sebelum menyelesaikan sesi.' }, { status: 409 });
      }
    }

    await sessionsDao.updateSessionStatus(sessionId, parsed.data.status);

    if (parsed.data.status === 'COMPLETED') {
      const { coderSessionAccessDao } = await import('@/lib/dao');
      await coderSessionAccessDao.grantSessionAccessForCompletedSession(sessionId);
      const { ensureFutureSessions } = await import('@/lib/dao/sessionsDao');
      await ensureFutureSessions(sessionRecord.class_id);
    }

    if (parsed.data.status === 'CANCELLED') {
      await classLessonsDao.unassignLessonsFromSessions([sessionId]);
    }

    const { autoAssignLessonsForClass, syncBlockStatusesForClass } = await import('@/lib/services/lessonAutoAssign');
    const autoAssignMode =
      parsed.data.status === 'CANCELLED' || sessionRecord.status === 'CANCELLED'
        ? 'rebuild_future'
        : 'preserve';
    await autoAssignLessonsForClass(sessionRecord.class_id, { mode: autoAssignMode });
    await syncBlockStatusesForClass(sessionRecord.class_id);

    if (parsed.data.status === 'COMPLETED') {
      const { generateDraftReportsForClasses } = await import('@/lib/services/aiReports');
      await generateDraftReportsForClasses([sessionRecord.class_id]);
    }

    revalidatePath('/coach/classes/[id]', 'page');
    revalidatePath('/coach/classes');

    if (parsed.data.status === 'COMPLETED') {
      try { await syncStudentAttendancePayroll(sessionId, sessionRecord.date_time); }
      catch { console.error('[Payroll] Attendance saved; sync will retry via cron'); }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('API /coach/sessions/[id]/status error:', error);
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
