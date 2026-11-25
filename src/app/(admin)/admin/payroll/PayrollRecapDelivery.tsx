'use client';

import { Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { reimbursementIsOpen } from '@/lib/payroll/reimbursementDeadline';
import type { PayrollPerson, PeriodDocument } from '@/lib/payroll/model';
import styles from './PayrollAdmin.module.css';

type Props = {
  period: PeriodDocument;
  people: PayrollPerson[];
  clock: number;
  busy: boolean;
  send: (kind: 'RECAP' | 'REIMBURSEMENT', ids: string[]) => void;
};

export default function PayrollRecapDelivery({ period, people, clock, busy, send }: Props) {
  const rows = people.filter(person => person.active).map(person => {
    const key = `${person.id}:period:RECAP`;
    const automatic = period.deliveries[key];
    const manual = period.deliveries[`${key}:MANUAL`];
    const previous = [automatic, manual].find(delivery => delivery?.status === 'SENT')
      ?? [automatic, manual].find(delivery => delivery?.status === 'LMS_ONLY')
      ?? manual ?? automatic;
    return { person, status: previous?.status, error: previous?.error };
  });
  const whatsapp = rows.filter(row => row.status === 'SENT').length;
  const lms = rows.filter(row => row.status === 'LMS_ONLY').length;
  const pending = rows.filter(row => !['SENT', 'LMS_ONLY', 'SENDING', 'SIMULATED'].includes(row.status ?? ''));
  const sending = rows.filter(row => row.status === 'SENDING').length;
  const extension = period.reimbursement_extension;
  const recipient = rows.find(row => row.person.id === extension?.profile_id)?.person;
  const showLink = recipient && reimbursementIsOpen(period, recipient.id, new Date(clock));
  const linkDelivery = recipient ? period.deliveries[`${recipient.id}:period:REIMBURSEMENT:MANUAL`] : undefined;
  const labels = { SENT: 'Terkirim WA', LMS_ONLY: 'Terkirim di LMS', FAILED: 'Gagal', NO_CONTACT: 'Nomor belum ada', SENDING: 'Sedang dikirim', SIMULATED: 'Simulasi' };

  return <section className={`${styles.panel} ${styles.recapDelivery}`} aria-labelledby="payroll-recap-delivery">
    <div className={styles.recapDeliveryHead}>
      <div>
        <h2 id="payroll-recap-delivery">Pengiriman rekap</h2>
        <p className={styles.muted} role="status">
          {whatsapp} via WA · {lms} di LMS{pending.length ? ` · ${pending.length} belum terkirim` : ''}{sending ? ` · ${sending} sedang dikirim` : ''}
        </p>
      </div>
      {pending.length > 0 && <Button size="sm" disabled={busy} onClick={() => send('RECAP', pending.map(row => row.person.id))}>
        <Send aria-hidden="true" /> Kirim ke {pending.length} penerima
      </Button>}
    </div>
    {showLink && <div className={styles.recapDeliveryHead}>
      <p className={styles.muted}>Reimbursement susulan · {recipient.name}</p>
      {linkDelivery?.status === 'SENT' || linkDelivery?.status === 'LMS_ONLY'
        ? <strong>{labels[linkDelivery.status]}</strong>
        : <Button size="sm" variant="outline" disabled={busy || linkDelivery?.status === 'SENDING'} onClick={() => send('REIMBURSEMENT', [recipient.id])}>Kirim link reimbursement</Button>}
    </div>}
    <details className={styles.disclosure}>
      <summary>Lihat status penerima</summary>
      <ul className={styles.recapDeliveryList}>
        {rows.map(({ person, status, error }) => <li key={person.id}>
          <span>{person.name}{error && <small className={styles.rowmeta}>{error.replace(/\d{7,}/g, '•••')}</small>}</span>
          <strong>{status ? labels[status] : 'Belum dikirim'}</strong>
        </li>)}
      </ul>
    </details>
  </section>;
}
