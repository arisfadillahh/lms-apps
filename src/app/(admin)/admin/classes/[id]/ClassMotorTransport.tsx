'use client';

import { useId, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, ChevronDown, Route } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CLASS_TRANSPORT_TYPES, MOTOR_TRIP_RATE, type ClassTransportType } from '@/lib/payroll/transport';
import styles from '../../payroll/MotorTransport.module.css';

const rate = `Rp${MOTOR_TRIP_RATE.toLocaleString('id-ID')}`;
const transportOptions: Record<ClassTransportType, { label: string; detail: string }> = {
  MOTOR: { label: 'Motor', detail: `${rate} otomatis per sesi offline yang selesai dan absensinya terkonfirmasi.` },
  PUBLIC_TRANSPORT: { label: 'Transport umum', detail: 'Ongkos sesuai bukti diurus langsung oleh admin.' },
  NONE: { label: 'Tanpa ongkos', detail: 'Pilih untuk coach yang mengajar tanpa penggantian transport.' },
};

export default function ClassMotorTransport({ classId, coachId, coachName, deliveryMode, transportType }: {
  classId: string;
  coachId: string;
  coachName: string;
  deliveryMode: 'ONLINE' | 'OFFLINE';
  transportType: ClassTransportType | null;
}) {
  const router = useRouter();
  const id = useId();
  const editButton = useRef<HTMLButtonElement>(null);
  const [editing, setEditing] = useState(false);
  const [selected, setSelected] = useState(transportType);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const isOffline = deliveryMode === 'OFFLINE';
  const status = isOffline ? transportType ? transportOptions[transportType].label : 'Belum dipilih' : 'Tanpa ongkos';

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
            <h2 id={`${id}-title`}>Transport coach</h2>
            <span className={styles.status} data-enabled={isOffline && transportType === 'MOTOR'}>{status}</span>
          </div>
          <p>{isOffline ? <>{coachName} · {transportType === 'MOTOR' ? <><strong>{rate}</strong> otomatis per sesi</> : transportType === 'PUBLIC_TRANSPORT' ? 'Ongkos diurus admin' : 'Kelas tatap muka'}</> : 'Kelas online · Ongkos transport Rp0'}</p>
        </div>
      </div>
      {isOffline && <button
        type="button"
        ref={editButton}
        className={styles.editButton}
        aria-expanded={editing}
        aria-controls={`${id}-editor`}
        disabled={busy}
        onClick={() => {
          if (editing) { closeEditor(); return; }
          setSelected(transportType);
          setError('');
          setMessage('');
          setEditing(true);
        }}
      >
        Atur transport
        <ChevronDown size={16} aria-hidden="true" />
      </button>}
    </div>
    <div id={`${id}-editor`} hidden={!editing}>
      {isOffline && editing && <form aria-labelledby={`${id}-title`} className={styles.editor} onSubmit={async event => {
        event.preventDefault();
        if (busy || !selected || selected === transportType) return;
        setBusy(true);
        setError('');
        try {
          const response = await fetch(`/api/admin/classes/${classId}/motor-transport`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ coachId, transportType: selected }),
          });
          const body = await response.json();
          if (!response.ok) throw new Error(body.error || 'Gagal menyimpan pengaturan transport.');
          setMessage(`Transport disimpan sebagai ${transportOptions[selected].label.toLowerCase()}.`);
          setEditing(false);
          router.refresh();
          requestAnimationFrame(() => editButton.current?.focus());
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : 'Gagal menyimpan pengaturan transport.');
        } finally {
          setBusy(false);
        }
      }}>
        <fieldset className={styles.choices} disabled={busy}>
          <legend>Jenis transport coach utama</legend>
          <div className={styles.classOptions}>
            {CLASS_TRANSPORT_TYPES.map(type => <label key={type} className={styles.option}>
              <input type="radio" name="classTransport" value={type} checked={selected === type} onChange={() => setSelected(type)} />
              <span><strong>{transportOptions[type].label}</strong><small>{transportOptions[type].detail}</small></span>
            </label>)}
          </div>
        </fieldset>
        <p className={styles.hint}>Perubahan berlaku untuk sesi berikutnya. Transport coach pengganti diatur lewat Koreksi sesi.</p>
        {error && <p role="alert" className={styles.error}>{error}</p>}
        <div className={styles.actions}>
          <Button type="button" variant="ghost" disabled={busy} onClick={closeEditor}>Batal</Button>
          <Button type="submit" disabled={busy || !selected || selected === transportType}>{busy ? 'Menyimpan…' : 'Simpan pengaturan'}</Button>
        </div>
      </form>}
    </div>
    <p role="status" className={message ? styles.saved : 'sr-only'}>
      {message && <><Check size={16} aria-hidden="true" />{message}</>}
    </p>
  </section>;
}
