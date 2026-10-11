'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Save } from 'lucide-react';

const REPORT_TYPES = [
  ['TOO_DIFFICULT', 'Terlalu Sulit'],
  ['UNCLEAR', 'Materi Kurang Jelas'],
  ['BUG', 'Ada Bug/Error'],
  ['OUTDATED', 'Materi Tidak Relevan'],
  ['OTHER', 'Lainnya'],
] as const;

const STATUSES = [
  ['PENDING', 'Menunggu'],
  ['IN_PROGRESS', 'Diproses'],
  ['RESOLVED', 'Selesai'],
  ['DISMISSED', 'Ditolak'],
] as const;

type Props = {
  reportId: string;
  initialReportType: string;
  initialDescription: string;
  initialStatus: string;
};

export default function LessonReportEditor({
  reportId,
  initialReportType,
  initialDescription,
  initialStatus,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [reportType, setReportType] = useState(initialReportType);
  const [description, setDescription] = useState(initialDescription);
  const [status, setStatus] = useState(initialStatus);
  const [message, setMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

  const handleSave = () => {
    if (description.trim().length < 3) {
      setMessage({ kind: 'error', text: 'Deskripsi minimal 3 karakter.' });
      return;
    }

    setMessage(null);
    startTransition(async () => {
      try {
        const response = await fetch(`/api/admin/lesson-reports/${reportId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reportType, description: description.trim(), status }),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error ?? 'Gagal menyimpan laporan.');

        setMessage({ kind: 'success', text: 'Perubahan laporan berhasil disimpan.' });
        router.refresh();
      } catch (error) {
        setMessage({
          kind: 'error',
          text: error instanceof Error ? error.message : 'Gagal menyimpan laporan.',
        });
      }
    });
  };

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="mb-5">
        <p className="text-xs font-bold uppercase text-blue-700">Tindak lanjut Admin</p>
        <h2 className="mt-1 text-lg font-bold text-slate-950">Edit laporan</h2>
        <p className="mt-1 text-sm text-slate-600">Rapikan isi laporan dan perbarui status penanganannya.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-2 text-sm font-semibold text-slate-800">
          Jenis masalah
          <select
            value={reportType}
            onChange={(event) => setReportType(event.target.value)}
            className="h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
          >
            {REPORT_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>

        <label className="grid gap-2 text-sm font-semibold text-slate-800">
          Status penanganan
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
          >
            {STATUSES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
      </div>

      <label className="mt-4 grid gap-2 text-sm font-semibold text-slate-800">
        Deskripsi masalah
        <textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={7}
          maxLength={1000}
          className="w-full resize-y rounded-lg border border-slate-300 bg-white px-3 py-3 text-sm leading-6 text-slate-950 outline-none placeholder:text-slate-500 focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
        />
      </label>
      <div className="mt-1 text-right text-xs text-slate-500">{description.length}/1000</div>

      {message && (
        <div className={`mt-4 flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold ${message.kind === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-700'}`} role={message.kind === 'error' ? 'alert' : 'status'}>
          {message.kind === 'success' && <CheckCircle2 size={17} />}
          {message.text}
        </div>
      )}

      <div className="mt-5 flex justify-end">
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#22367b] px-5 text-sm font-bold text-white transition hover:bg-[#162b46] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Save size={17} />
          {isPending ? 'Menyimpan...' : 'Simpan perubahan'}
        </button>
      </div>
    </section>
  );
}
