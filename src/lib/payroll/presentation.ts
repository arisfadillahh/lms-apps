import { paidAmount, type PeriodDocument, type Slip } from './model';

export const rupiah = (value: number) => `Rp${value.toLocaleString('id-ID')}`;
export const dateWib = (value: string) => new Date(value).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', dateStyle: 'medium', timeStyle: 'short' });
export const payrollCategory = (kind: string) => ({ SALARY: 'Gaji pokok', ALLOWANCE: 'Tunjangan rutin', ADJUSTMENT: 'Tambahan / potongan', WEEKLY: 'Kelas Weekly', EKSKUL: 'Kelas Ekskul', TRIAL: 'Trial', GOAL: 'Bonus goal', EVENT: 'Event', TRAINING_ONLINE: 'Training online', TRAINING_OFFLINE: 'Training offline', OBSERVATION_ONLINE: 'Observasi online', OBSERVATION_OFFLINE: 'Observasi offline' } as Record<string, string>)[kind] ?? kind;
export function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]!));
}
export function payrollSlipRows(slip: Slip): { label: string; quantity: string; amount: number }[] {
  const groups = [
    { kinds: ['WEEKLY', 'EKSKUL'], label: 'Fee mengajar kelas', unit: 'sesi' },
    { kinds: ['TRIAL'], label: 'Fee trial', unit: 'sesi' },
    { kinds: ['GOAL'], label: 'Bonus goal', unit: 'anak' },
  ];
  const groupedKinds = new Set(groups.flatMap(group => group.kinds));
  const rows = slip.lines.filter(line => !groupedKinds.has(line.kind)).map(line => ({ label: line.label, quantity: '', amount: line.amount }));
  for (const group of groups) {
    const lines = slip.lines.filter(line => group.kinds.includes(line.kind) && line.amount !== 0);
    if (lines.length) rows.push({
      label: group.label,
      quantity: `${lines.reduce((sum, line) => sum + line.quantity, 0).toLocaleString('id-ID')} ${group.unit}`,
      amount: lines.reduce((sum, line) => sum + line.amount, 0),
    });
  }
  return rows;
}
export function renderPayrollHtml(period: PeriodDocument, slip: Slip, version = period.version, logoSrc = '/images/clevio-logo.png'): string {
  const historical = period.history.find(h => h.version === version);
  const final = Boolean(historical);
  const transferred = period.transfers.filter(t => t.profile_id === slip.profile_id && t.version <= version).reduce((n, t) => n + t.amount, 0);
  const rows = payrollSlipRows(slip);
  return `<!doctype html><html lang="id"><head><meta charset="utf-8"><title>Slip gaji ${escapeHtml(period.id)}</title><style>
  @page{size:A4;margin:16mm 14mm}*{box-sizing:border-box}body{font:10px/1.5 Arial,Helvetica,sans-serif;color:#1b2550;margin:0}h1{font-size:25px;line-height:1.15;margin:5px 0 10px}h2{font-size:12px;margin:16px 0 8px}.brand{font-size:12px;letter-spacing:2px;font-weight:700;color:#22367b}.header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #22367b;padding-bottom:12px}.muted{color:#5e6a8b}.tag{font-size:10px;border:1px solid #80989e;border-radius:4px;padding:4px 8px;display:inline-block}.identity{display:grid;grid-template-columns:1fr 1fr;gap:10px 25px;margin:10px 0}.label{font-size:9px;text-transform:uppercase;letter-spacing:1px;color:#5e6a8b}.value{font-size:12px;font-weight:700;margin-top:3px}.notice{border-left:3px solid #ad6b00;padding:8px 10px;background:#fff8e8;margin:14px 0;line-height:1.6}table{width:100%;border-collapse:collapse;table-layout:fixed}thead{display:table-header-group}th{text-align:left;font-size:9px;letter-spacing:.5px;background:#eef1fa;padding:6px 7px;border-bottom:1px solid #c2cae0}td{padding:6px 7px;border-bottom:1px solid #dde2f0;vertical-align:top;overflow-wrap:anywhere}tr{break-inside:avoid}.number{text-align:right;white-space:nowrap}.details{font-size:8px;color:#5e6a8b;margin-top:4px}.summary{display:flex;justify-content:flex-end;margin-top:12px;break-inside:avoid}.totals{width:290px}.totalrow{display:flex;justify-content:space-between;padding:5px 9px;gap:15px}.totalrow.main{background:#22367b;color:white;font-size:14px;font-weight:bold}.footer{border-top:1px solid #c2cae0;padding-top:8px;margin-top:14px;font-size:9px;color:#5e6a8b;break-inside:avoid}.summarytable td{padding:6px 8px}.signature{margin-top:6px;font-size:9px}strong{font-weight:700}
  .header{padding:24px;border:0;border-bottom:4px solid #9dc83b;border-radius:12px;background:radial-gradient(circle at 90% 10%,#00b0d744,transparent 55%),linear-gradient(135deg,#172554,#22367b 65%,#1e40af);color:#fff;align-items:center;gap:20px}.brand img{width:155px;height:auto;display:block}.brandNote{font-size:8px;color:#dce8ff;letter-spacing:2px;margin-top:12px}.documentTitle{text-align:right}.documentTitle h1{color:#fff;margin:7px 0}.tag{border-color:#91b4df;color:#e8f5ff;font-size:8px}.identity{padding:18px 4px;gap:16px 28px;border-bottom:1px solid #dde2f0}.value{font-size:13px}.label{font-size:8px;letter-spacing:1px}.summary .totals{border:1px solid #dde2f0;border-radius:10px;overflow:hidden}.totalrow{padding:7px 12px}.totalrow.main{border-left:4px solid #9dc83b;background:#22367b}.number{font-variant-numeric:tabular-nums}thead th{background:#eef1fa;color:#22367b}h2{color:#22367b}body{font-family:Arial,Helvetica,sans-serif}td{padding:8px 7px}.details{font-size:9px}.footer{font-size:8px}@media screen{body{font-size:13px;padding:18px;background:#fff}.details{font-size:11px}th{font-size:11px}.label{font-size:10px}.value{font-size:15px}.brandNote{font-size:9px}.footer{font-size:11px}}@media screen and (max-width:520px){body{padding:10px;font-size:12px}.header{padding:18px;align-items:flex-start;flex-direction:column}.documentTitle{text-align:left}.identity{grid-template-columns:1fr 1fr;gap:18px 12px}.brand img{width:140px}.summary .totals{width:100%}td,th{padding:8px 4px}.details{font-size:10px}}
  @media print{td{padding:6px 7px}}
  </style></head><body><div class="header"><div class="brand"><img src="${escapeHtml(logoSrc)}" alt="Clevio Innovator Camp" /><div class="brandNote">PEOPLE &amp; FINANCE</div></div><div class="documentTitle"><span class="tag">${final ? 'FINAL' : 'DRAFT / SEMENTARA'}</span><h1>Slip gaji</h1><div>${escapeHtml(new Date(period.year, period.month - 1, 1).toLocaleString('id-ID', { month: 'long', year: 'numeric' }))} · Versi ${version}</div></div></div>
  <div class="identity"><div><div class="label">Penerima</div><div class="value">${escapeHtml(slip.name)}</div><div>${escapeHtml(slip.job_title || slip.kind)}</div></div><div><div class="label">Kontrak</div><div class="value">${escapeHtml(slip.contract)}</div></div><div><div class="label">Rentang aktivitas</div><div>${escapeHtml(dateWib(period.starts_at))} WIB sampai akhir tanggal 25</div></div><div><div class="label">Status transfer</div><div>${transferred >= slip.total && period.transfers.some(t => t.profile_id === slip.profile_id && t.version <= version) ? 'Sudah ditransfer / diselesaikan' : 'Belum diselesaikan'}</div></div></div>
  ${!final ? '<div class="notice">Pratinjau draft. Nominal belum final dan dokumen ini bukan bukti transfer.</div>' : ''}
  <h2>Ringkasan penghasilan</h2><table><thead><tr><th style="width:70%">Komponen</th><th style="width:30%" class="number">Nominal</th></tr></thead><tbody>${rows.map(row => `<tr><td><strong>${escapeHtml(row.label)}</strong>${row.quantity ? `<div class="details">${escapeHtml(row.quantity)}</div>` : ''}</td><td class="number">${rupiah(row.amount)}</td></tr>`).join('') || '<tr><td colspan="2">Belum ada komponen penghasilan pada periode ini.</td></tr>'}</tbody></table>
  <div class="summary"><div class="totals"><div class="totalrow main"><span>Penghasilan bersih</span><span>${rupiah(slip.total)}</span></div></div></div>
  <div class="footer">${final ? `Difinalisasi ${escapeHtml(dateWib(historical!.finalized_at))} WIB. ` : `Dihitung ${period.calculated_at ? escapeHtml(dateWib(period.calculated_at)) + ' WIB' : 'belum tersedia'}. `}Perubahan tarif/profil berikutnya tidak mengubah versi final ini. Koreksi menghasilkan versi baru dengan riwayat tersimpan.<div class="signature">Dokumen diterbitkan melalui Clevio LMS. Hubungi admin untuk penjelasan atau koreksi.</div></div></body></html>`;
}
export function transferSummary(period: PeriodDocument, slip: Slip) {
  const paid = paidAmount(period, slip.profile_id);
  return { paid, remaining: Math.max(0, slip.total - paid), overpaid: Math.max(0, paid - slip.total) };
}
