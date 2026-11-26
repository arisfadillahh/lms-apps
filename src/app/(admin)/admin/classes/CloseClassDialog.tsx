'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { ClassClosure } from '@/lib/dao/classesDao';

type Props = {
  classId: string;
  className: string;
  coachName?: string | null;
  onDismiss: () => void;
  onArchived: (className: string) => void;
};

export default function CloseClassDialog({ classId, className, coachName, onDismiss, onArchived }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const [preview, setPreview] = useState<ClassClosure>();
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const endpoint = `/api/admin/classes/${classId}`;

  useEffect(() => {
    dialog.current?.showModal();
    cancel.current?.focus();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch(endpoint, { cache: 'no-store', signal: controller.signal });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error);
        setPreview(payload);
      } catch (error) {
        if (!controller.signal.aborted) setError(error instanceof Error ? error.message : 'Ringkasan belum bisa dimuat.');
      }
    }
    void load();
    return () => controller.abort();
  }, [endpoint, attempt]);

  async function confirm() {
    if (!preview || preview.pendingPlacements || saving) return;
    setError('');
    setSaving(true);
    try {
      const response = await fetch(endpoint, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmationName: preview.className }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.archived) throw new Error(payload.error || 'Penutupan belum berhasil.');
      onArchived(payload.className);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Penutupan belum bisa dikonfirmasi. Coba lagi.');
      setPreview(undefined);
      setSaving(false);
    }
  }

  return (
    <dialog
      ref={dialog}
      aria-labelledby="close-class-title"
      aria-describedby="close-class-description"
      className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-md overflow-y-auto overscroll-contain rounded-2xl border border-border bg-background p-5 text-foreground shadow-xl backdrop:bg-slate-950/55 backdrop:overscroll-contain sm:p-6"
      onCancel={(event) => { event.preventDefault(); if (!saving) onDismiss(); }}
    >
      <h2 id="close-class-title" className="text-lg font-bold">Tutup &amp; arsipkan kelas?</h2>
      <p id="close-class-description" className="mt-1 text-sm text-muted-foreground">
        {preview?.className ?? className}{coachName ? ` · ${coachName}` : ''}
      </p>

      {preview?.archived ? (
        <p className="mt-5 text-sm" role="status">Kelas ini sudah diarsipkan.</p>
      ) : preview ? (
        <>
          <dl className="my-4 divide-y divide-border rounded-xl border border-border px-4 text-sm">
            <div className="flex items-center justify-between gap-4 py-2.5"><dt>Sesi mendatang dibatalkan</dt><dd className="font-bold tabular-nums">{preview.sessions}</dd></div>
            <div className="flex items-center justify-between gap-4 py-2.5"><dt>Siswa keluar dari daftar aktif</dt><dd className="font-bold tabular-nums">{preview.enrollments}</dd></div>
            <div className="flex items-center justify-between gap-4 py-2.5"><dt>Periode pembayaran dihentikan</dt><dd className="font-bold tabular-nums">{preview.paymentPeriods}</dd></div>
          </dl>
          <p className="text-sm text-muted-foreground">Riwayat sesi, presensi, rapor, fee coach, dan invoice tetap tersimpan. Kelas bisa dilihat di Arsip.</p>
          {preview.openInvoices > 0 && (
            <p className="mt-3 rounded-lg border border-amber-400/50 bg-amber-400/10 px-3 py-2 text-sm">
              Ada {preview.openInvoices} invoice belum lunas yang sudah terbit. Tinjau di <Link className="font-bold underline" href="/admin/payments/invoices">Daftar Invoice</Link>.
            </p>
          )}
          {preview.pendingPlacements > 0 && (
            <p className="mt-3 rounded-lg border border-amber-400/50 bg-amber-400/10 px-3 py-2 text-sm">
              Pindahkan {preview.pendingPlacements} siswa yang masih menunggu penempatan blok sebelum menutup kelas. <Link className="font-bold underline" href={`/admin/classes/${classId}`}>Buka kelas</Link>
            </p>
          )}
        </>
      ) : !error && <p className="mt-5 text-sm" role="status">Memuat ringkasan kelas…</p>}
      {error && <p className="mt-4 text-sm font-semibold text-red-600 dark:text-red-400" role="alert">{error}</p>}

      <div className="mt-5 flex flex-wrap justify-end gap-2">
        <button ref={cancel} className="btn btn-ghost min-h-11" type="button" disabled={saving}
          onClick={() => preview?.archived ? onArchived(preview.className) : onDismiss()}>
          {preview?.archived ? 'Tutup' : 'Batal'}
        </button>
        {error && !preview && (
          <button className="btn btn-primary min-h-11" type="button"
            onClick={() => { setError(''); setAttempt((value) => value + 1); }}>Muat ulang ringkasan</button>
        )}
        {preview && !preview.archived && (
          <button className="min-h-11 rounded-lg bg-red-700 px-4 py-2 text-sm font-bold text-white hover:bg-red-800 disabled:opacity-50"
            type="button" disabled={saving || preview.pendingPlacements > 0} onClick={confirm}>
            {saving ? 'Menutup kelas…' : 'Tutup & arsipkan kelas'}
          </button>
        )}
      </div>
    </dialog>
  );
}
