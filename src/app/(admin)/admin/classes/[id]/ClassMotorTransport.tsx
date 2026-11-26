'use client';

import { useId, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, ChevronDown, Route } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MOTOR_TRIP_RATE } from '@/lib/payroll/transport';
import styles from '../../payroll/MotorTransport.module.css';

export default function ClassMotorTransport({ classId, coachId, coachName, enabled }: {
  classId: string;
  coachId: string;
  coachName: string;
  enabled: boolean;
}) {
  const router = useRouter();
  const id = useId();
  const editButton = useRef<HTMLButtonElement>(null);
  const [editing, setEditing] = useState(false);
  const [selected, setSelected] = useState(enabled);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const rate = `Rp${MOTOR_TRIP_RATE.toLocaleString('id-ID')}`;

  function closeEditor() {
    setEditing(false);
    editButton.current?.focus();
  }

  return <section className={styles.card} aria-labelledby={`${id}-title`}>
    <div className={styles.summary}>
      <div className={styles.summaryBody}>
        <span className={styles.symbol}><Route size={20} aria-hidden="true" /></span>
        <div>
          <div className={styles.titleLine}>
            <h2 id={`${id}-title`}>Transport motor</h2>
            <span className={styles.status} data-enabled={enabled}>{enabled ? 'Otomatis aktif' : 'Manual'}</span>
          </div>
          <p>{coachName} · <strong>{rate}</strong> per sesi offline</p>
        </div>
      </div>
      <button
        type="button"
        ref={editButton}
        className={styles.editButton}
        aria-expanded={editing}
        aria-controls={`${id}-editor`}
        disabled={busy}
        onClick={() => {
          if (editing) { closeEditor(); return; }
          setSelected(enabled);
          setError('');
          setMessage('');
          setEditing(true);
        }}
      >
        Atur transport motor
        <ChevronDown size={16} aria-hidden="true" />
      </button>
    </div>
    <div id={`${id}-editor`} hidden={!editing}>
      {editing && <form aria-labelledby={`${id}-title`} className={styles.editor} onSubmit={async event => {
        event.preventDefault();
        if (busy || selected === enabled) return;
        setBusy(true);
        setError('');
        try {
          const response = await fetch(`/api/admin/classes/${classId}/motor-transport`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ coachId, enabled: selected }),
          });
          const body = await response.json();
          if (!response.ok) throw new Error(body.error || 'Gagal menyimpan transport motor.');
          setMessage(selected ? 'Transport motor otomatis diaktifkan.' : 'Transport motor diubah ke pencatatan manual.');
          setEditing(false);
          router.refresh();
          requestAnimationFrame(() => editButton.current?.focus());
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : 'Gagal menyimpan transport motor.');
        } finally {
          setBusy(false);
        }
      }}>
        <fieldset className={styles.choices} disabled={busy}>
          <legend>Cara mencatat transport motor</legend>
          <div className={styles.classOptions}>
            <label className={styles.option}>
              <input type="radio" name="classMotor" checked={selected} onChange={() => setSelected(true)} />
              <span><strong>Otomatis</strong><small>Masuk ke rekap coach utama setelah sesi selesai dan absensi terkonfirmasi.</small></span>
            </label>
            <label className={styles.option}>
              <input type="radio" name="classMotor" checked={!selected} onChange={() => setSelected(false)} />
              <span><strong>Manual</strong><small>Admin mencatat perjalanan di Koreksi sesi.</small></span>
            </label>
          </div>
        </fieldset>
        <p className={styles.hint}>Perubahan berlaku untuk sesi berikutnya. Transport coach pengganti diatur lewat Koreksi sesi.</p>
        {error && <p role="alert" className={styles.error}>{error}</p>}
        <div className={styles.actions}>
          <Button type="button" variant="ghost" disabled={busy} onClick={closeEditor}>Batal</Button>
          <Button type="submit" disabled={busy || selected === enabled}>{busy ? 'Menyimpan…' : 'Simpan pengaturan'}</Button>
        </div>
      </form>}
    </div>
    <p role="status" className={message ? styles.saved : 'sr-only'}>
      {message && <><Check size={16} aria-hidden="true" />{message}</>}
    </p>
  </section>;
}
