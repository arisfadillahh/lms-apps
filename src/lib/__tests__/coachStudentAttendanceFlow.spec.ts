import { beforeEach, describe, expect, it, vi } from 'vitest';

const mock = vi.hoisted(() => ({
  auth: vi.fn(), assertRole: vi.fn(), session: vi.fn(), klass: vi.fn(), leave: vi.fn(), enrollments: vi.fn(),
  mark: vi.fn(), attendance: vi.fn(), classLesson: vi.fn(), status: vi.fn(), grant: vi.fn(), future: vi.fn(),
  autoAssign: vi.fn(), syncBlocks: vi.fn(), reports: vi.fn(), syncPayroll: vi.fn(), started: vi.fn(),
  notifications: vi.fn(), user: vi.fn(), unassign: vi.fn(), revalidate: vi.fn(),
}));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/auth', () => ({ getSessionOrThrow: mock.auth }));
vi.mock('@/lib/roles', () => ({ assertRole: mock.assertRole }));
vi.mock('@/lib/sessionTiming', () => ({ hasSessionStarted: mock.started, SESSION_NOT_STARTED_MESSAGE: 'Sesi belum dimulai.' }));
vi.mock('next/cache', () => ({ revalidatePath: mock.revalidate }));
vi.mock('@/lib/dao', () => ({
  sessionsDao: { getSessionById: mock.session, updateSessionStatus: mock.status },
  classesDao: { getClassById: mock.klass, listEnrollmentsByClass: mock.enrollments },
  coachLeaveDao: { getApprovedLeaveForSession: mock.leave },
  attendanceDao: { markAttendance: mock.mark, listAttendanceBySession: mock.attendance },
  classLessonsDao: { getClassLessonBySession: mock.classLesson, unassignLessonsFromSessions: mock.unassign },
  coderSessionAccessDao: { grantSessionAccessForCompletedSession: mock.grant },
  reportsDao: {}, usersDao: { getUserById: mock.user }, notificationsDao: { createNotification: mock.notifications },
}));
vi.mock('@/lib/dao/sessionsDao', () => ({ ensureFutureSessions: mock.future }));
vi.mock('@/lib/services/lessonAutoAssign', () => ({ autoAssignLessonsForClass: mock.autoAssign, syncBlockStatusesForClass: mock.syncBlocks }));
vi.mock('@/lib/services/aiReports', () => ({ generateDraftReportsForClasses: mock.reports }));
vi.mock('@/lib/services/payrollStudentAttendanceSync', () => ({ syncStudentAttendancePayroll: mock.syncPayroll }));
vi.mock('@/lib/env', () => ({ getAppBaseUrl: () => 'http://localhost:3005' }));
vi.mock('@/lib/services/lessonScheduler', () => ({ computeLessonSchedule: vi.fn() }));
vi.mock('@/lib/services/whatsappClient', () => ({ sendAbsentNotification: vi.fn() }));
vi.mock('@/lib/dao/invoicesDao', () => ({ getInvoiceSettings: vi.fn() }));

import { POST } from '@/app/api/coach/attendance/route';
import { PATCH } from '@/app/api/coach/sessions/[id]/status/route';
import { assignedSessionCoachId } from '@/lib/coachSessionAccess';

const sessionId = '10000000-0000-4000-8000-000000000001';
const coderId = '20000000-0000-4000-8000-000000000001';
const otherCoder = '20000000-0000-4000-8000-000000000002';
const primaryCoach = '30000000-0000-4000-8000-000000000001';
const substituteCoach = '30000000-0000-4000-8000-000000000002';
const dateTime = '2026-11-12T08:00:00.000Z';
const enrollment = (coder_id = coderId, extra = {}) => ({ coder_id, enrolled_at: '2026-01-01T00:00:00Z', ended_at: null, status: 'ACTIVE', ...extra });
const mark = (extra = {}) => POST(new Request('http://localhost/api/coach/attendance', { method: 'POST', body: JSON.stringify({ sessionId, coderId, status: 'PRESENT', ...extra }) }));
const complete = () => PATCH(new Request('http://localhost/api/coach/sessions/status', { method: 'PATCH', body: JSON.stringify({ status: 'COMPLETED' }) }), { params: Promise.resolve({ id: sessionId }) });

describe('student attendance save and session completion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const auth = { user: { id: primaryCoach, role: 'COACH' } };
    mock.auth.mockResolvedValue(auth); mock.assertRole.mockResolvedValue(auth);
    mock.started.mockReturnValue(true);
    mock.session.mockResolvedValue({ id: sessionId, class_id: 'class', date_time: dateTime, status: 'SCHEDULED', substitute_coach_id: null });
    mock.klass.mockResolvedValue({ id: 'class', coach_id: primaryCoach, name: 'Robotics', type: 'WEEKLY' });
    mock.leave.mockResolvedValue(null); mock.enrollments.mockResolvedValue([enrollment()]);
    mock.classLesson.mockResolvedValue({ id: 'lesson', make_up_instructions: 'Kerjakan tugas yang tersedia.' });
    mock.mark.mockResolvedValue({ attendance: { id: 'attendance', status: 'PRESENT' }, makeUpTask: null });
    mock.attendance.mockResolvedValue([{ coder_id: coderId, status: 'PRESENT' }]);
    mock.syncPayroll.mockResolvedValue(undefined); mock.user.mockResolvedValue({ full_name: 'Coder Demo', parent_contact_phone: null });
  });
  it('accepts a roster student after the session starts without any grade requirement', async () => {
    expect((await mark()).status).toBe(200);
    expect(mock.mark).toHaveBeenCalledWith(expect.objectContaining({ coderId, status: 'PRESENT', recordedBy: primaryCoach, createMakeUpTask: false }));
    expect(mock.assertRole).toHaveBeenCalledWith(expect.anything(), 'COACH');
    expect(mock.syncPayroll).not.toHaveBeenCalled();
  });
  it('rejects attendance before start, for cancelled sessions, and from a non-roster student before any write', async () => {
    mock.started.mockReturnValue(false); expect((await mark()).status).toBe(409);
    mock.started.mockReturnValue(true); mock.session.mockResolvedValueOnce({ id: sessionId, class_id: 'class', date_time: dateTime, status: 'CANCELLED' });
    expect((await mark()).status).toBe(409);
    expect((await mark({ coderId: otherCoder })).status).toBe(403);
    expect(mock.mark).not.toHaveBeenCalled();
  });
  it('uses historical enrollment dates rather than today’s active list', async () => {
    mock.enrollments.mockResolvedValue([enrollment(coderId, { status: 'INACTIVE', ended_at: '2026-12-01T00:00:00Z' })]);
    expect((await mark()).status).toBe(200);
    mock.enrollments.mockResolvedValue([enrollment(coderId, { enrolled_at: '2026-11-13T00:00:00Z' })]);
    expect((await mark()).status).toBe(403);
    mock.enrollments.mockResolvedValue([enrollment(coderId, { status: 'INACTIVE', ended_at: '2026-11-11T00:00:00Z' })]);
    expect((await mark()).status).toBe(403);
  });
  it('allows the assigned substitute and prevents the replaced primary coach from editing', async () => {
    mock.session.mockResolvedValue({ id: sessionId, class_id: 'class', date_time: dateTime, status: 'SCHEDULED', substitute_coach_id: substituteCoach });
    expect((await mark()).status).toBe(403);
    mock.assertRole.mockResolvedValue({ user: { id: substituteCoach, role: 'COACH' } });
    expect((await mark()).status).toBe(200);
    expect(mock.mark).toHaveBeenCalledWith(expect.objectContaining({ recordedBy: substituteCoach }));
  });
  it('honors approved leave even when the session assignment has not yet been mirrored', async () => {
    mock.leave.mockResolvedValue({ substitute_coach_id: substituteCoach });
    expect((await mark()).status).toBe(403);
    mock.assertRole.mockResolvedValue({ user: { id: substituteCoach, role: 'COACH' } });
    expect((await mark()).status).toBe(200);
    mock.leave.mockResolvedValue({ substitute_coach_id: null });
    mock.assertRole.mockResolvedValue({ user: { id: primaryCoach, role: 'COACH' } });
    expect((await mark()).status).toBe(403);
  });
  it('keeps normal absent make-up tasks without cancelling or rescheduling the class', async () => {
    mock.mark.mockResolvedValue({ attendance: { id: 'attendance', status: 'ABSENT' }, makeUpTask: { id: 'makeup', due_date: '2026-11-19T08:00:00Z' } });
    expect((await mark({ status: 'ABSENT', reason: 'Sakit' })).status).toBe(200);
    expect(mock.mark).toHaveBeenCalledWith(expect.objectContaining({ status: 'ABSENT', reason: 'Sakit', createMakeUpTask: true }));
    expect(mock.notifications).toHaveBeenCalled(); expect(mock.status).not.toHaveBeenCalled(); expect(mock.unassign).not.toHaveBeenCalled();
  });
  it('syncs corrections to a completed meeting and keeps attendance saved if payroll temporarily fails', async () => {
    mock.session.mockResolvedValue({ id: sessionId, class_id: 'class', date_time: dateTime, status: 'COMPLETED', substitute_coach_id: null });
    mock.syncPayroll.mockRejectedValue(new Error('Private finance detail must not be exposed'));
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    try { expect((await mark()).status).toBe(200); expect(mock.syncPayroll).toHaveBeenCalledWith(sessionId, dateTime); expect(log).toHaveBeenCalledWith('[Payroll] Attendance saved; sync will retry via cron'); }
    finally { log.mockRestore(); }
  });
  it('refuses manual completion with an incomplete or empty roster', async () => {
    mock.enrollments.mockResolvedValue([enrollment(), enrollment(otherCoder)]);
    const partial = await complete(); expect(partial.status).toBe(409); expect((await partial.json()).error).toMatch(/Lengkapi.*presensi/);
    mock.enrollments.mockResolvedValue([]); expect((await complete()).status).toBe(409);
    expect(mock.status).not.toHaveBeenCalled(); expect(mock.syncPayroll).not.toHaveBeenCalled();
  });
  it('allows all-absent operational completion and syncs it without making the meeting a holiday', async () => {
    mock.attendance.mockResolvedValue([{ coder_id: coderId, status: 'ABSENT' }]);
    expect((await complete()).status).toBe(200);
    expect(mock.status).toHaveBeenCalledWith(sessionId, 'COMPLETED'); expect(mock.unassign).not.toHaveBeenCalled();
    expect(mock.syncPayroll).toHaveBeenCalledWith(sessionId, dateTime);
  });
  it('accepts LATE as attendance and uses the same substitute ownership at completion', async () => {
    mock.attendance.mockResolvedValue([{ coder_id: coderId, status: 'LATE' }]);
    mock.session.mockResolvedValue({ id: sessionId, class_id: 'class', date_time: dateTime, status: 'SCHEDULED', substitute_coach_id: substituteCoach });
    expect((await complete()).status).toBe(403);
    mock.assertRole.mockResolvedValue({ user: { id: substituteCoach, role: 'COACH' } });
    expect((await complete()).status).toBe(200);
  });
  it('does not complete a cancelled session even with historical attendance', async () => {
    mock.session.mockResolvedValue({ id: sessionId, class_id: 'class', date_time: dateTime, status: 'CANCELLED', substitute_coach_id: null });
    expect((await complete()).status).toBe(409); expect(mock.status).not.toHaveBeenCalled();
  });
});

describe('actual assigned coach resolution', () => {
  it('uses the actual session assignment first and never falls back to an approved absent coach', () => {
    expect(assignedSessionCoachId(primaryCoach, substituteCoach, { substitute_coach_id: 'other' })).toBe(substituteCoach);
    expect(assignedSessionCoachId(primaryCoach, null, { substitute_coach_id: substituteCoach })).toBe(substituteCoach);
    expect(assignedSessionCoachId(primaryCoach, null, { substitute_coach_id: null })).toBeNull();
    expect(assignedSessionCoachId(primaryCoach, null)).toBe(primaryCoach);
  });
});
