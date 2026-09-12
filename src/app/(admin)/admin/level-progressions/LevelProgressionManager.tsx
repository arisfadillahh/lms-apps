'use client';

import { useMemo, useState } from 'react';
import { CheckCircle2, Clock3, Search, UserRoundCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';

export type ProgressionView = {
  id: string; status: 'WAITING_PLACEMENT' | 'PLACED' | 'PROGRAM_COMPLETED'; completedAt: string;
  placedAt: string | null; coderName: string; sourceLevel: string; targetLevel: string | null;
  sourceClass: string; targetClass: string | null; completedBlocks: number; totalBlocks: number;
  completedBlockNames: string[]; pendingBlockNames: string[];
  classes: Array<{ id: string; name: string; schedule: string; coach: string }>;
};

export default function LevelProgressionManager({ rows }: { rows: ProgressionView[] }) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<'WAITING' | 'HISTORY'>('WAITING');
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const visible = useMemo(() => rows.filter((row) => {
    const tabMatch = tab === 'WAITING' ? row.status === 'WAITING_PLACEMENT' : row.status !== 'WAITING_PLACEMENT';
    const haystack = `${row.coderName} ${row.sourceClass} ${row.sourceLevel} ${row.targetLevel ?? ''}`.toLowerCase();
    return tabMatch && haystack.includes(query.trim().toLowerCase());
  }), [rows, query, tab]);

  async function place(row: ProgressionView) {
    const classId = selected[row.id];
    if (!classId || !window.confirm(`Tempatkan ${row.coderName} ke kelas yang dipilih?`)) return;
    setBusy(row.id); setError(null);
    const response = await fetch(`/api/admin/level-progressions/${row.id}/place`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ classId }),
    });
    const payload = await response.json();
    if (!response.ok) setError(payload.error ?? 'Penempatan gagal.');
    else router.refresh();
    setBusy(null);
  }

  return <div className="col gap-4">
    <div className="row flex-wrap items-center justify-between gap-3">
      <div className="row gap-2 rounded-lg bg-slate-100 p-1">
        <button className={`btn btn-sm ${tab === 'WAITING' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab('WAITING')}><Clock3 size={16}/> Menunggu</button>
        <button className={`btn btn-sm ${tab === 'HISTORY' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab('HISTORY')}><CheckCircle2 size={16}/> Riwayat</button>
      </div>
      <label className="relative min-w-0 sm:min-w-80">
        <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
        <input className="input w-full pl-10" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari Coder, kelas, atau level"/>
      </label>
    </div>
    {error && <div className="alert alert-error">{error}</div>}
    {visible.length === 0 ? <div className="card p-8 text-center text-slate-500">Belum ada data pada bagian ini.</div> :
      <div className="grid gap-3">{visible.map((row) => <article key={row.id} className="card p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="row flex-wrap items-center gap-2"><h2 className="text-lg font-bold text-slate-950">{row.coderName}</h2><span className="badge">{row.completedBlocks}/{row.totalBlocks} blok selesai</span></div>
            <p className="mt-1 text-sm text-slate-600">{row.sourceLevel} · {row.sourceClass}</p>
            <p className="mt-2 text-sm font-semibold text-slate-800">{row.status === 'PROGRAM_COMPLETED' ? 'Program selesai' : row.status === 'PLACED' ? `Ditempatkan ke ${row.targetClass}` : `Naik ke ${row.targetLevel}`}</p>
            <p className="mt-1 text-xs text-slate-500">Selesai {new Date(row.completedAt).toLocaleString('id-ID')}</p>
            <details className="mt-3 text-sm">
              <summary className="cursor-pointer font-semibold text-blue-700">Lihat detail progres blok</summary>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <div><p className="text-xs font-bold uppercase text-emerald-700">Selesai</p><p className="mt-1 text-slate-600">{row.completedBlockNames.join(', ') || '-'}</p></div>
                <div><p className="text-xs font-bold uppercase text-amber-700">Belum selesai</p><p className="mt-1 text-slate-600">{row.pendingBlockNames.join(', ') || '-'}</p></div>
              </div>
            </details>
          </div>
          {row.status === 'WAITING_PLACEMENT' && <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto">
            <select className="input min-w-0 sm:min-w-72" value={selected[row.id] ?? ''} onChange={(event) => setSelected((value) => ({...value, [row.id]: event.target.value}))}>
              <option value="">Pilih kelas {row.targetLevel}</option>
              {row.classes.map((klass) => <option key={klass.id} value={klass.id}>{klass.name} · {klass.schedule} · {klass.coach}</option>)}
            </select>
            <button className="btn btn-primary whitespace-nowrap" disabled={!selected[row.id] || busy === row.id} onClick={() => place(row)}><UserRoundCheck size={17}/>{busy === row.id ? 'Memproses...' : 'Tempatkan'}</button>
          </div>}
        </div>
      </article>)}</div>}
  </div>;
}
