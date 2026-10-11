'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Trash2, X } from 'lucide-react';

export default function DeletePortfolioDialog({ id, title, returnPath = '/coder/reports/portfolio' }: { id: string; title: string; returnPath?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const matches = confirmation === title;

  async function remove() {
    if (!matches || loading) return;
    setLoading(true);
    setError('');
    const response = await fetch(`/api/coder/portfolios/${id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirmationTitle: confirmation }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(body.error || 'Portofolio gagal dihapus.');
      setLoading(false);
      return;
    }
    setOpen(false);
    router.push(returnPath);
    router.refresh();
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-2 rounded-xl border-2 border-red-100 px-3 py-2 text-sm font-black text-red-600 hover:bg-red-50">
        <Trash2 size={16} /> Hapus
      </button>
      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4" role="dialog" aria-modal="true" aria-labelledby={`delete-${id}`}>
          <div className="w-full max-w-lg rounded-[2rem] bg-white p-6 shadow-2xl sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-red-100 text-red-600"><AlertTriangle /></div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Tutup dialog" className="rounded-xl p-2 text-slate-400 hover:bg-slate-100"><X /></button>
            </div>
            <h2 id={`delete-${id}`} className="mt-5 text-2xl font-black text-clevio-navy">Hapus portofolio secara permanen?</h2>
            <p className="mt-2 text-sm font-semibold leading-relaxed text-slate-500">
              Seluruh data project dan screenshot akan dihapus, termasuk versi yang sedang tampil di link publik. Tindakan ini tidak dapat dipulihkan.
            </p>
            <label className="mt-5 block text-sm font-black text-slate-700">
              Ketik judul project persis untuk melanjutkan
              <span className="mt-2 block rounded-xl bg-slate-100 px-3 py-2 font-mono text-xs text-slate-600">{title}</span>
              <input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="off" className="mt-3 w-full rounded-xl border-2 border-slate-200 px-4 py-3 outline-none focus:border-red-400" />
            </label>
            {error && <p className="mt-3 text-sm font-bold text-red-600">{error}</p>}
            <button type="button" disabled={!matches || loading} onClick={remove} className="mt-5 w-full rounded-xl bg-red-600 px-4 py-3 font-black text-white disabled:cursor-not-allowed disabled:opacity-40">
              {loading ? 'Menghapus…' : 'Hapus Permanen — Tidak Bisa Dipulihkan'}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
