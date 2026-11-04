'use client';
import type { ReactNode } from 'react';
import { isPaid, type PeriodDocument } from '@/lib/payroll/model';
import styles from './PayrollAdmin.module.css';

export default function PayrollWorkflow({ period, children }: { period: PeriodDocument; children: ReactNode }) {
  const paid = period.slips.filter(s => isPaid(period, s.profile_id)).length;
  const sent = period.slips.filter(s => ['SENT', 'LMS_ONLY', 'SIMULATED'].includes(period.deliveries[`${s.profile_id}:${period.version}:SLIP`]?.status)).length;
  const total = period.slips.length;
  const step = period.status === 'DRAFT' ? (period.calculated_at ? 1 : 0) : paid < total ? 2 : 3;
  const complete = period.status === 'FINAL' && total > 0 && sent === total;
  const titles = ['Siapkan rekap periode ini', 'Periksa rekap sebelum finalisasi', 'Catat pembayaran yang sudah selesai', complete ? 'Penggajian periode ini selesai' : 'Kirim slip setelah pembayaran'];
  const descriptions = [
    'Hitung aktivitas, gaji pokok, dan tunjangan penerima terlebih dahulu.',
    'Buka Rincian untuk memeriksa aktivitas atau koreksi. Kirim rekap absensi agar coach dapat memeriksa datanya.',
    `Pilih penerima di Pembayaran & slip, lalu tandai setelah transfer bank selesai. ${paid} dari ${total} penerima sudah tercatat.`,
    complete ? 'Slip tersimpan di arsip. Riwayat dan versi sebelumnya tetap bisa dibuka.' : `${paid} dari ${total} penerima sudah dibayar; ${sent} slip sudah terkirim atau tersedia di LMS. Pilih penerima untuk mengirim slip.`,
  ];
  return <section className={styles.workflow} aria-label="Alur penggajian">
    <ol className={styles.steps}>{['Siapkan rekap', 'Periksa & finalisasi', 'Catat transfer', 'Kirim slip'].map((label, index) => <li key={label} aria-current={!complete && index === step ? 'step' : undefined} data-complete={complete || index < step}><span>{complete || index < step ? '✓' : index + 1}</span>{label}</li>)}</ol>
    <div className={styles.workflowBody}><div><h2>{titles[step]}</h2><p className={styles.muted}>{descriptions[step]}</p></div><div className={styles.actions}>{children}</div></div>
  </section>;
}
