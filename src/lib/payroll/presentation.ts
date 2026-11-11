import { paidAmount, type PeriodDocument, type Slip } from './model';
import { payrollDocumentStyle } from './documentStyle';

export const rupiah = (value: number) => `Rp${value.toLocaleString('id-ID')}`;
export const dateWib = (value: string) => new Date(value).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', dateStyle: 'medium', timeStyle: 'short' });
export function payrollActivitySummary(slip: Slip): string {
  const count=(kinds:string[])=>slip.lines.filter(l=>kinds.includes(l.kind)&&!l.details.includes('dibatalkan')&&l.fee_eligible!==false).reduce((n,l)=>n+l.quantity,0);
  return [[count(['CLASS_SUMMARY','WEEKLY','EKSKUL']),'kelas'],[count(['TRIAL']),'trial'],[count(['EVENT','TRAINING_ONLINE','TRAINING_OFFLINE','OBSERVATION_ONLINE','OBSERVATION_OFFLINE']),'kegiatan']].filter(([n])=>Number(n)>0).map(([n,label])=>`${n} ${label}`).join(' · ') || 'Belum ada aktivitas';
}
export const payrollCategory = (kind: string) => ({ CLASS_SUMMARY: 'Kelas', SALARY: 'Gaji pokok', ALLOWANCE: 'Tunjangan rutin', ADJUSTMENT: 'Tambahan / potongan', WEEKLY: 'Kelas Weekly', EKSKUL: 'Kelas Ekskul', TRIAL: 'Trial', GOAL: 'Bonus goal', EVENT: 'Event', TRAINING_ONLINE: 'Training online', TRAINING_OFFLINE: 'Training offline', OBSERVATION_ONLINE: 'Observasi online', OBSERVATION_OFFLINE: 'Observasi offline' } as Record<string, string>)[kind] ?? kind;
export function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]!));
}
export function payrollSlipRows(slip: Slip): { label: string; quantity: string; amount: number }[] {
  const groups = [
    { kinds: ['CLASS_SUMMARY', 'WEEKLY', 'EKSKUL'], label: 'Fee mengajar kelas', unit: 'sesi' },
    { kinds: ['TRIAL'], label: 'Fee trial', unit: 'sesi' },
    { kinds: ['GOAL'], label: 'Bonus goal', unit: 'anak' },
  ];
  const groupedKinds = new Set(groups.flatMap(group => group.kinds));
  const rows = slip.lines.filter(line => !groupedKinds.has(line.kind) && line.amount !== 0).map(line => ({ label: line.label, quantity: '', amount: line.amount }));
  for (const group of groups) {
    const lines = slip.lines.filter(line => group.kinds.includes(line.kind) && line.amount !== 0);
    if (lines.length) rows.push({
      label: group.label,
      quantity: lines.reduce((sum, line) => sum + (line.fee_eligible === false || line.details.includes('dibatalkan') ? 0 : line.quantity), 0) ? `${lines.reduce((sum, line) => sum + (line.fee_eligible === false || line.details.includes('dibatalkan') ? 0 : line.quantity), 0).toLocaleString('id-ID')} ${group.unit}` : '',
      amount: lines.reduce((sum, line) => sum + line.amount, 0),
    });
  }
  return rows;
}
export function renderPayrollHtml(period: PeriodDocument, slip: Slip, version = period.version, logoSrc = '/images/clevio-logo.png'): string {
  const historical = period.history.find(h => h.version === version);
  const final = Boolean(historical);
  const transferred = period.transfers.filter(t => t.profile_id === slip.profile_id && t.version <= version).reduce((n, t) => n + t.amount, 0);
  const paid = transferred >= slip.total && period.transfers.some(t => t.profile_id === slip.profile_id && t.version <= version);
  const rows = payrollSlipRows(slip);
  const salaries = new Set(slip.lines.filter(l => l.kind === 'SALARY').map(l => l.label));
  const ordered = [...rows].sort((a,b) => Number(salaries.has(b.label))-Number(salaries.has(a.label)));
  const month = new Date(period.year,period.month-1,1).toLocaleDateString('id-ID',{month:'long',year:'numeric'});
  const shortDate = (date: string) => new Date(date).toLocaleDateString('id-ID',{timeZone:'Asia/Jakarta',day:'numeric',month:'short',year:'numeric'});
  const range = shortDate(period.starts_at) + ' - ' + shortDate(new Date(Date.parse(period.ends_at)-1).toISOString());
  const contract = slip.contract_unconfirmed ? '' : slip.contract === 'FULLTIME' ? 'Fulltime' : 'Mitra';
  const note = final ? `Difinalisasi ${dateWib(historical!.finalized_at)} WIB.` : 'Rekap sementara. Nominal dapat disesuaikan sebelum finalisasi.';
  return `<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Slip gaji ${escapeHtml(period.id)}</title><style>${payrollDocumentStyle}</style></head><body>
  <article class="payslip" aria-label="Slip gaji ${escapeHtml(slip.name)}">
    <header class="document-header"><div class="header-content">
      <img class="brand-logo" src="${escapeHtml(logoSrc)}" alt="Clevio Innovator Camp">
      <div class="document-heading"><h1>SLIP GAJI</h1><p class="document-period">${escapeHtml(month)}</p><span class="document-state">${final ? 'FINAL' : 'DRAFT / SEMENTARA'}</span></div>
    </div><span class="header-circle one"></span><span class="header-circle two"></span></header>
    <section class="summary-grid" aria-label="Penerima dan penghasilan bersih">
      <div class="info-card"><div class="eyebrow"><span class="dot"></span>Penerima</div><h2 class="recipient-name">${escapeHtml(slip.name)}</h2>
        <p class="recipient-role">${escapeHtml(slip.job_title || (slip.kind === 'COACH' ? 'Coach' : 'Staf'))}${contract ? `<span class="contract">${contract}</span>` : ''}</p>
        <div class="activity-period"><span class="meta-label">Periode penghasilan</span><span class="meta-value">${escapeHtml(range)}</span></div>
      </div>
      <div class="info-card net-card"><div><div class="eyebrow"><span class="dot"></span>Penghasilan bersih</div><strong class="net-amount">${rupiah(slip.total)}</strong></div>
        <span class="payment-status${paid ? ' paid' : ''}"><span class="status-dot"></span>${paid ? 'Sudah ditransfer' : 'Belum ditransfer'}</span>
      </div>
    </section>
    <div class="document-body"><section aria-label="Ringkasan penghasilan"><div class="section-heading"><h2>Rincian penghasilan</h2><span class="component-count">${ordered.length} komponen</span></div>
      <dl class="earnings-list">${ordered.map(row => `<div class="earning${salaries.has(row.label) ? ' salary' : ''}${row.amount < 0 ? ' deduction' : ''}"><dt>${escapeHtml(row.label)}${row.quantity ? `<span class="quantity">${escapeHtml(row.quantity)}</span>` : ''}</dt><dd>${rupiah(row.amount)}</dd></div>`).join('')}</dl>
      ${ordered.length ? '' : '<p class="empty">Belum ada komponen penghasilan pada periode ini.</p>'}
    </section><p class="document-note">${escapeHtml(note)}</p>
    <footer class="document-footer"><span class="footer-brand">Clevio Innovator Camp</span><span>People &amp; Finance · Versi ${version}</span></footer></div>
  </article></body></html>`;
}
export function transferSummary(period: PeriodDocument, slip: Slip) {
  const paid = paidAmount(period, slip.profile_id);
  return { paid, remaining: Math.max(0, slip.total - paid), overpaid: Math.max(0, paid - slip.total) };
}
