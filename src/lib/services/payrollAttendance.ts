import 'server-only';
import { z } from 'zod';
import * as dao from '@/lib/dao/payrollDao';
import { createPeriod, currentPeriod, PayrollError } from '@/lib/payroll/model';
import { attendancePeriodView } from '@/lib/payroll/attendanceView';
import { payrollCommandSchema, type PayrollCommand } from '@/lib/payroll/validation';
import { attendanceAdmins } from './payrollNotifications';
import { executePayrollCommand } from './payrollCommands';
import type { ActivityRequest } from '@/lib/payroll/activityRequests';

export const attendancePeriodQuery = z.string().regex(/^20\d{2}-(0[1-9]|1[0-2])$/);
export async function attendanceBootstrap(id = currentPeriod().id) {
  if (!attendancePeriodQuery.safeParse(id).success) throw new PayrollError('Periode tidak valid.');
  const [records, config, admins] = await Promise.all([dao.listPayrollPeriods(), dao.getPayrollConfig(), attendanceAdmins()]);
  const record = records.find(r => r.id === id), period = record?.document ?? createPeriod(Number(id.slice(0, 4)), Number(id.slice(5)));
  const people = config.people.filter(p => p.kind === 'COACH').map(p => ({ id: p.id, user_id: p.user_id, name: p.name, active: p.active }));
  const requests = await dao.payrollRows('payroll_activity_requests', '*', { gte: ['activity_at', period.starts_at], lt: ['activity_at', period.ends_at] }) as unknown as ActivityRequest[];
  return {
    selected: record ? attendancePeriodView(record) : null,
    periods: records.map(r => ({ id: r.id, status: r.document.status })), people,
    coaches: people.filter(p => p.user_id).map(p => ({ id: p.user_id!, full_name: p.name })),
    admins: admins.map(a => ({ id: a.id, username: a.username })),
    requests: requests.map(r => ({ id: r.id, revision: r.revision, coach_id: r.coach_id, activity_at: r.activity_at, kind: r.kind, label: r.label, notes: r.notes, status: r.status, mode: r.mode, review_reason: r.review_reason, created_at: r.created_at, reviewed_by: r.reviewed_by, reviewed_at: r.reviewed_at })),
  };
}

const actions = new Set(['create', 'calculate', 'assignPic', 'reviewCorrection', 'reviewActivity', 'activity', 'removeActivity', 'override']);
export function parseAttendanceCommand(raw: unknown): PayrollCommand {
  const parsed = payrollCommandSchema.safeParse(raw);
  if (!parsed.success) throw new PayrollError('Data koreksi tidak valid.');
  const command = parsed.data;
  if (!actions.has(command.action) || (command.action === 'override' && command.amount !== undefined)) throw new PayrollError('Akses ini hanya untuk aktivitas dan koreksi absensi, tanpa nominal atau pembayaran.', 403);
  return command;
}
export async function executeAttendanceCommand(raw: unknown, actor: string) {
  let command = parseAttendanceCommand(raw);
  const config = await dao.getPayrollConfig();
  const coaches = config.people.filter(p => p.kind === 'COACH');
  const profileId = 'profileId' in command ? command.profileId : undefined;
  if (profileId && !coaches.some(p => p.id === profileId && p.active)) throw new PayrollError('Pilih penerima coach aktif.');
  if (command.action === 'override' || command.action === 'removeActivity') {
    const record = await dao.getPayrollPeriod(command.periodId);
    if (!record) throw new PayrollError('Periode tidak ditemukan.', 404);
    const view = attendancePeriodView(record);
    if (command.action === 'override') {
      const sourceKey = command.sourceKey;
      if (!view.activities.some(a => a.key === sourceKey)) throw new PayrollError('Aktivitas coach tidak ditemukan.', 404);
      // Attendance edits must preserve a monetary override set by an authorized admin.
      command = { ...command, amount: record.document.overrides[sourceKey]?.amount };
    } else {
      const id = command.id;
      if (!record.document.activities.some(a => a.id === id && coaches.some(p => p.id === a.profile_id))) throw new PayrollError('Aktivitas coach tidak ditemukan.', 404);
    }
  }
  await executePayrollCommand(command, actor);
  // Never return the underlying command result: calculate/create contain salary documents.
  return { success: true };
}
