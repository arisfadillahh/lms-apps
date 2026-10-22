import 'server-only';
import { getSupabaseAdmin } from '@/lib/supabaseServer';
import { getInvoiceSettings, getOrCreateCCR, getInvoiceById, formatInvoiceNumber } from '@/lib/dao/invoicesDao';
import { planInvoiceBillingCycle } from '@/lib/invoiceBillingCycle';
import { normalizedParentPhone } from '@/lib/invoiceCheckout';
import type { GenerateInvoicesResponse, InvoiceItem } from '@/lib/types/invoice';

interface BillingAnchor {
  id: string; coder_id: string; class_id: string; start_date: string; end_date: string; status: string; created_at: string; total_amount: number;
  users: { full_name: string; parent_contact_phone: string | null; parent_name: string | null; is_active: boolean; updated_at: string };
  classes: { id: string; name: string; type: string; lifecycle_status: string; start_date: string; end_date: string; archived_at: string | null; levels: { name: string } | null };
  payment_plans: { duration_months: number; discount_percent: number } | null;
  pricing: { base_price_monthly: number } | null;
}

export async function generateIndependentInvoicesForMonth(month: number, year: number): Promise<GenerateInvoicesResponse> {
  const result: GenerateInvoicesResponse = { success: true, generated: 0, skipped: 0, invoices: [], errors: [] };
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  if (!Number.isInteger(month) || month < 1 || month > 12 || !Number.isInteger(year) || year < 2020 || year * 12 + month > Number(today.slice(0, 4)) * 12 + Number(today.slice(5, 7))) {
    return { ...result, success: false, errors: ['Bulan tagihan tidak valid atau belum tiba.'] };
  }
  const db = getSupabaseAdmin(), settings = await getInvoiceSettings();
  if (!settings) return { ...result, success: false, errors: ['Pengaturan invoice belum tersedia.'] };
  const { data: raw, error } = await db.from('coder_payment_periods').select(`*,
    users!coder_payment_periods_coder_id_fkey(full_name,parent_contact_phone,parent_name,is_active,updated_at),
    classes(id,name,type,lifecycle_status,start_date,end_date,archived_at,levels(name)),payment_plans(duration_months,discount_percent),pricing(base_price_monthly)`)
    .not('class_id', 'is', null).order('created_at', { ascending: false });
  if (error) return { ...result, success: false, errors: ['Acuan periode pembayaran tidak dapat dibaca.'] };
  // Include stopped records in the latest-record decision; never fall back to an
  // older ACTIVE/EXPIRED row and accidentally restart a stopped payment plan.
  const latest = new Map<string, BillingAnchor>();
  for (const row of (raw ?? []) as unknown as BillingAnchor[]) {
    const key = `${row.coder_id}|${row.class_id}`;
    if (!latest.has(key)) latest.set(key, row);
  }
  const anchors = [...latest.values()];
  if (!anchors.length) return result;
  const cycleStart = `${year}-${String(month).padStart(2, '0')}-26`;
  const nextMonth = new Date(Date.UTC(year, month, 26)).toISOString().slice(0, 10);
  const staleClassIds = [...new Set(anchors.filter(a => a.classes?.type === 'WEEKLY'
    && a.classes.lifecycle_status === 'ACTIVE' && !a.classes.archived_at && a.classes.end_date < cycleStart).map(a => a.class_id))];
  const [{ data: enrollments, error: ee }, { data: changes, error: ce }, { data: activity, error: ae }, { data: continuing, error: se }] = await Promise.all([
    db.from('enrollments').select('coder_id,class_id,enrolled_at,updated_at,status').in('coder_id', anchors.map(a => a.coder_id)).eq('status', 'ACTIVE'),
    db.from('class_lifecycle_changes' as any).select('class_id,previous_status,new_status,created_at').in('class_id', anchors.map(a => a.class_id)),
    db.from('invoice_billing_status_events' as any).select('coder_id,class_id,active,changed_at').in('coder_id', anchors.map(a => a.coder_id)).order('changed_at', { ascending: false }),
    staleClassIds.length ? db.from('classes').select('id,sessions!inner(date_time,status)').in('id', staleClassIds)
      .gte('sessions.date_time', `${cycleStart}T00:00:00+07:00`).lt('sessions.date_time', `${nextMonth}T00:00:00+07:00`)
      .in('sessions.status', ['SCHEDULED', 'COMPLETED']) : Promise.resolve({ data: [], error: null }),
  ]);
  if (ee || ce || ae || se) return { ...result, success: false, errors: ['Status enrollment, riwayat cuti, atau jadwal kelas tidak dapat diverifikasi. Tidak ada tagihan dibuat.'] };
  const groups = new Map<string, { anchor: BillingAnchor; items: Array<Omit<InvoiceItem, 'id' | 'created_at' | 'invoice_id'>> }>();
  for (const a of anchors) {
    const enrollment = enrollments?.find(e => e.coder_id === a.coder_id && e.class_id === a.class_id);
    if (!enrollment || !a.users?.is_active || !a.classes || a.classes.type !== 'WEEKLY' || a.classes.archived_at) continue;
    const pauses = ((changes ?? []) as unknown as Array<{ class_id: string; previous_status: string; new_status: string; created_at: string }>);
    const hasPauseSinceAnchor = pauses.some(c => c.class_id === a.class_id && (c.new_status === 'PAUSED' || c.previous_status === 'PAUSED') && c.created_at.slice(0, 10) >= a.end_date);
    const events = (activity ?? []) as unknown as Array<{ coder_id: string; class_id: string | null; active: boolean; changed_at: string }>;
    const accountActiveSince = events.find(e => e.coder_id === a.coder_id && e.class_id === null)?.changed_at ?? a.users.updated_at;
    const enrollmentActiveSince = events.find(e => e.coder_id === a.coder_id && e.class_id === a.class_id)?.changed_at ?? enrollment.updated_at;
    const activeSince = [enrollment.enrolled_at, accountActiveSince, enrollmentActiveSince].filter(Boolean).sort().at(-1)!;
    const continuedClass = (continuing as unknown as Array<{ id: string; sessions: Array<{ date_time: string; status: string }> }> | null)
      ?.find(c => c.id === a.class_id);
    const continued = Array.isArray(continuedClass?.sessions)
      ? continuedClass.sessions.find(s => ['SCHEDULED', 'COMPLETED'].includes(s.status)) : undefined;
    const continuationTime = continued ? new Date(continued.date_time) : null;
    const continuationSessionDate = continuationTime && Number.isFinite(continuationTime.getTime())
      ? new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).format(continuationTime) : null;
    const cycle = planInvoiceBillingCycle({ anchorEnd: a.end_date, durationMonths: a.payment_plans?.duration_months ?? 0,
      month, year, today, enrolledAt: activeSince, classStart: a.classes.start_date, classEnd: a.classes.end_date,
      lifecycle: a.classes.lifecycle_status, periodStatus: a.status, hasPauseSinceAnchor, continuationSessionDate });
    if (!cycle) {
      result.skipped++;
      if (hasPauseSinceAnchor) result.errors.push(`Kelas ${a.classes.name}: riwayat cuti memerlukan review acuan tagihan oleh admin.`);
      else if (activeSince.slice(0, 10) > `${year}-${String(month).padStart(2, '0')}-26`) result.errors.push(`Kelas ${a.classes.name}: bulan sebelum batas aktif kembali tidak ditagih. Riwayat lama yang tidak lengkap memerlukan review admin.`);
      continue;
    }
    const phone = normalizedParentPhone(a.users.parent_contact_phone ?? '');
    if (!/^62\d{8,13}$/.test(phone) || !a.payment_plans || !a.pricing) { result.skipped++; continue; }
    const base = Math.round(a.pricing.base_price_monthly * a.payment_plans.duration_months);
    const discount = Math.floor(base * (a.payment_plans.discount_percent / 100));
    if (base <= 0 || discount < 0 || discount >= base || !Number.isSafeInteger(base)) { result.skipped++; continue; }
    const group = groups.get(phone) ?? { anchor: a, items: [] };
    group.items.push({ coder_id: a.coder_id, coder_name: a.users.full_name, class_name: a.classes.name,
      level_name: a.classes.levels?.name ?? '-', payment_period_id: a.id, base_price: base, discount_amount: discount, final_price: base - discount,
      billing_start_date: cycle.start, billing_end_date: cycle.end, billing_duration_months: a.payment_plans.duration_months });
    groups.set(phone, group);
  }
  for (const [phone, group] of groups) {
    const ccr = await getOrCreateCCR(phone, group.anchor.users.parent_name ?? undefined);
    if (!ccr) { result.errors.push('Identitas keluarga tidak dapat disiapkan.'); continue; }
    const start = group.items.map(i => i.billing_start_date!).sort()[0];
    const end = group.items.map(i => i.billing_end_date!).sort().at(-1)!;
    const due = new Date(Date.UTC(year, month - 1, settings.generate_day + settings.due_days)).toISOString().slice(0, 10);
    const { data: saved, error: saveError } = await db.rpc('upsert_invoice_billing_cycle' as never, {
      p_invoice: { ccr_id: ccr.id, invoice_number: formatInvoiceNumber(ccr.ccr_code, month, year), parent_phone: phone,
        parent_name: ccr.parent_name || group.anchor.users.parent_name || `Orang Tua dari ${group.anchor.users.full_name}`,
        period_month: month, period_year: year, period_start_date: start, period_end_date: end, due_date: due }, p_items: group.items,
    } as never);
    const record = saved as unknown as { id: string; created: boolean } | null;
    if (saveError || !record || typeof record.id !== 'string') { result.errors.push('Gagal menyimpan satu kelompok tagihan; tidak ada periode belajar ditambah.'); continue; }
    if (!record.created) { result.skipped++; continue; }
    const invoice = await getInvoiceById(record.id);
    if (invoice) { result.generated++; result.invoices.push(invoice); }
  }
  result.success = result.errors.length === 0 || result.generated > 0;
  return result;
}
