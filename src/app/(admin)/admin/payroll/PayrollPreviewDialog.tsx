'use client';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { renderPayrollHtml } from '@/lib/payroll/presentation';
import type { PeriodDocument, Slip } from '@/lib/payroll/model';
import styles from './PayrollAdmin.module.css';

export default function PayrollPreviewDialog({ period, preview, close }: { period: PeriodDocument; preview: { slip: Slip; version: number } | null; close: () => void }) {
  return <Dialog open={Boolean(preview)} onOpenChange={open => { if (!open) close(); }}><DialogContent className={`${styles.modal} ${styles.previewModal}`} onOpenAutoFocus={event => { event.preventDefault(); (event.target as HTMLElement).querySelector('button')?.focus(); }}>
    <DialogHeader className={styles.modalHeader}><DialogTitle>Pratinjau slip gaji</DialogTitle><DialogDescription>{preview?.slip.name} · Periode {period.id} · Versi {preview?.version}</DialogDescription></DialogHeader>
    {preview && <iframe className={styles.previewFrame} title="Pratinjau slip gaji Clevio" tabIndex={-1} sandbox="allow-same-origin" srcDoc={renderPayrollHtml(period, preview.slip, preview.version)} />}
  </DialogContent></Dialog>;
}
