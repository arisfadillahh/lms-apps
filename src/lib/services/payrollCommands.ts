import 'server-only';
import { randomUUID } from 'node:crypto';
import { getSupabaseAdmin } from '@/lib/supabaseServer';
import * as dao from '@/lib/dao/payrollDao';
import { calculatePayroll, payrollMeetingCandidates, requireDraft, requireReason, assertComponentDate } from './payroll';
import { meetingMatchesLine } from '@/lib/payroll/attendanceDetails';
import { finalize, reopen, markTransferred, reverseTransfer, reviewCorrection, PayrollError } from '@/lib/payroll/model';
import { attendanceAdmins } from './payrollNotifications';
import { createNotification } from '@/lib/dao/notificationsDao';
import type { PayrollCommand } from '@/lib/payroll/validation';

export async function executePayrollCommand(command: PayrollCommand, actor: string, now = new Date()): Promise<unknown> {
  const db = getSupabaseAdmin();
  if (command.action === 'reviewActivity') {
    const { reviewActivityRequest } = await import('./payrollActivityRequests');
    return reviewActivityRequest(command, actor);
  }
  if (command.action === 'profile') {
    let name = command.name;
    if (command.kind === 'COACH') {
      if (!command.userId) throw new PayrollError('Pilih akun coach.');
      const { data, error } = await db.from('users').select('id,role,full_name').eq('id', command.userId).maybeSingle();
      if (error || !data || data.role !== 'COACH') throw new PayrollError('Akun coach tidak valid.');
      name = data.full_name;
    }
    if (command.id) {
      const config = await dao.getPayrollConfig();
      const old = config.people.find(p => p.id === command.id);
      if (!old || old.kind !== command.kind || old.user_id !== (command.kind === 'COACH' ? command.userId : null)) throw new PayrollError('Identitas penerima tidak dapat dipindahkan; ubah kontraknya atau buat penerima baru.');
    }
    const profileId = await dao.savePayrollProfile({ id: command.id, user_id: command.kind === 'COACH' ? command.userId : null, kind: command.kind, name, job_title: command.jobTitle, staff_phone: command.kind === 'STAFF' ? command.staffPhone : null, active: command.active }, { effective_from: command.effectiveFrom, contract: command.contract, base_salary: command.baseSalary, working_days: command.kind === 'COACH' && command.contract === 'FULLTIME' ? command.workingDays : null, position_allowance: command.positionAllowance, other_allowances: command.otherAllowances }, actor);
    return { id: profileId };
  }
  if (command.action === 'rates') { await dao.savePayrollRates({ effective_from: command.effectiveFrom, rates: command.rates }, actor); return { success: true }; }
  if (command.action === 'settings') { await dao.savePayrollSettings({ active_from: command.activeFrom, automation_enabled: command.automationEnabled }, actor); return { success: true }; }
  if (command.action === 'create') return dao.ensurePayrollPeriod(command.year, command.month);
  if (command.action === 'classMode') {
    const { error } = await db.rpc('payroll_set_class_mode' as never, { p_class_id: command.classId, p_mode: command.mode, p_actor_id: actor } as never);
    if (error) throw new PayrollError('Kelas tidak ditemukan/gagal diperbarui.');
    return { success: true };
  }
  let record = await dao.getPayrollPeriod(command.periodId);
  if (!record) throw new PayrollError('Periode tidak ditemukan.', 404);
  if (record.revision !== command.revision) throw new PayrollError('Data sudah berubah. Muat ulang terlebih dahulu.', 409);
  if (command.action === 'calculate') return calculatePayroll(record, now, actor);
  if (command.action === 'refreshSource') {
    const { refreshPayrollSource } = await import('./payrollSourceSync');
    return refreshPayrollSource(record, actor);
  }
  if (command.action === 'send') {
    const { sendPayrollBatch } = await import('./payrollDelivery');
    return sendPayrollBatch(record.id, command.profileIds, command.kind, actor, command.resend);
  }
  if (command.action === 'finalize' && record.document.status === 'DRAFT') record = await calculatePayroll(record, now, actor);
  let next = structuredClone(record.document);
  const reason = 'reason' in command ? command.reason : '';
  switch (command.action) {
    case 'assignPic': {
      if (!(await attendanceAdmins()).some(a => a.id === command.userId)) throw new PayrollError('PIC harus admin atau coach lead aktif dengan izin koreksi absensi.');
      next.pic_id = command.userId; break;
    }
    case 'reviewCorrection': next = reviewCorrection(next, command.id, command.status, actor, command.reason, now); break;
    case 'reverseTransfer': next = reverseTransfer(next, command.transferId, actor, command.reason, now); break;
    case 'finalize': next = finalize(next, actor, now); break;
    case 'reopen': next = reopen(next, command.reason); break;
    case 'transfer': next = markTransferred(next, command.profileIds, actor, command.reference, now); break;
    case 'component': {
      requireDraft(record); assertComponentDate(`${command.date}T12:00:00+07:00`, next);
      const id = command.id ?? randomUUID();
      if (command.id && !next.manual.some(m => m.id === id)) throw new PayrollError('Komponen tidak ditemukan.');
      next.manual = [...next.manual.filter(m => m.id !== id), { id, profile_id: command.profileId, date: `${command.date}T12:00:00+07:00`, label: command.label, amount: command.amount, reason: command.reason }];
      next.calculated_at = null; break;
    }
    case 'removeComponent': requireDraft(record); next.manual = next.manual.filter(m => m.id !== command.id); next.calculated_at = null; break;
    case 'activity': {
      requireDraft(record); assertComponentDate(`${command.date}T12:00:00+07:00`, next);
      next.activities.push({ id: randomUUID(), profile_id: command.profileId, date: `${command.date}T12:00:00+07:00`, kind: command.kind, mode: command.mode, delivery: command.delivery, students: command.students, label: `${command.label} — ${command.reason}` });
      next.calculated_at = null; break;
    }
    case 'removeActivity': {
      requireDraft(record);
      if (!next.activities.some(a => a.id === command.id)) throw new PayrollError('Aktivitas manual tidak ditemukan.');
      next.activities = next.activities.filter(a => a.id !== command.id);
      delete next.overrides[`manual-activity:${command.id}`];
      next.calculated_at = null; break;
    }
    case 'override': {
      requireDraft(record);
      const originalSlip = next.slips.find(s => s.lines.some(l => l.key === command.sourceKey));
      const line = originalSlip?.lines.find(l => l.key === command.sourceKey);
      if (!line || ['SALARY', 'ADJUSTMENT', 'ALLOWANCE'].includes(line.kind)) throw new PayrollError('Aktivitas sumber tidak ditemukan.');
      if(command.teachingConfirmed!==undefined && (line.summary || !['WEEKLY','EKSKUL'].includes(line.kind)))throw new PayrollError('Konfirmasi mengajar hanya untuk pertemuan kelas individual.');
      if ((command.quantity !== undefined || command.meetingKeys !== undefined) && !line.summary) throw new PayrollError('Untuk pertemuan tunggal, gunakan status dikecualikan atau pilih coach pengganti.');
      const config = await dao.getPayrollConfig();
      if (command.profileId) {
        if (!config.people.some(p => p.id === command.profileId && p.active)) throw new PayrollError('Penerima pengganti tidak aktif.');
      }
      let quantity = command.quantity;
      if (command.meetingKeys !== undefined) {
        if (line.kind === 'GOAL' || line.kind === 'TRANSPORT') throw new PayrollError('Komponen ini dikoreksi melalui jumlah, bukan pertemuan.');
        const keys = new Set(command.meetingKeys);
        if (keys.size !== command.meetingKeys.length) throw new PayrollError('Pertemuan tidak boleh dipilih dua kali.');
        const owner = config.people.find(p => p.id === (command.profileId ?? originalSlip!.profile_id));
        const candidates = await payrollMeetingCandidates(next, now);
        for (const key of keys) {
          const meeting = candidates.find(m => m.key === key);
          const meetingOwner = next.overrides[key]?.profile_id ? config.people.find(p => p.id === next.overrides[key].profile_id)?.user_id : meeting?.user_id;
          if (!meeting || meeting.cancelled || (meeting.attendance_status && meeting.fee_eligible===false) || next.overrides[key]?.excluded || meetingOwner !== owner?.user_id || !meetingMatchesLine(meeting, line)) throw new PayrollError('Pertemuan tidak sesuai coach, kategori, atau periode. Muat ulang daftar pertemuan.');
          if (Object.entries(next.overrides).some(([other, override]) => other !== command.sourceKey && override.meeting_keys?.includes(key) && !override.excluded)) throw new PayrollError('Pertemuan sudah dipakai pada kategori lain.');
        }
        quantity = keys.size;
        next.meeting_catalog = candidates;
      }
      next.overrides[command.sourceKey] = { profile_id: command.profileId, amount: command.amount, teaching_confirmed:command.teachingConfirmed, quantity, quantity_delta: quantity === undefined ? undefined : quantity-(line.source_quantity ?? line.quantity), meeting_keys: command.meetingKeys, selection_cutoff: command.meetingKeys === undefined ? undefined : now.toISOString(), excluded: line.summary && quantity !== undefined ? false : command.excluded, mode: command.mode, reason: command.reason };
      next.calculated_at = null; break;
    }
    case 'recoverDelivery': {
      const delivery = next.deliveries[command.key];
      if (!delivery || delivery.status !== 'SENDING' || now.getTime() - Date.parse(delivery.at) < 10 * 60000) throw new PayrollError('Hanya pengiriman menggantung lebih dari 10 menit yang dapat dipulihkan.');
      delivery.status = 'FAILED'; delivery.error = 'Status sebelumnya tidak diketahui. Periksa WA sebelum mengirim ulang. ' + command.reason;
      break;
    }
    default: throw new PayrollError('Tindakan tidak dikenal.');
  }
  if (reason) requireReason(reason);
  const saved = await dao.commitPayrollPeriod(record, next, actor, command.action.toUpperCase(), reason);
  if (command.action === 'reviewCorrection') {
    const request = next.corrections!.find(r => r.id === command.id)!;
    await createNotification(request.user_id, `Koreksi absensi ${next.id}`, `Status pengajuan: ${request.status === 'DONE' ? 'Selesai' : request.status === 'REJECTED' ? 'Ditolak' : 'Diproses'}. ${request.response}`, 'PAYROLL', { category: 'PAYROLL', actionUrl: '/coach/payroll', push: false }).catch(() => console.error('[Payroll] Notifikasi koreksi belum terkirim; hasil tersimpan.'));
  }
  return saved;
}
