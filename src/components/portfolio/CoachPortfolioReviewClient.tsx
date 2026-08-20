'use client';

import { useState } from 'react';
import { CheckCircle2, ExternalLink, Image as ImageIcon, Loader2, MessageSquareWarning, X } from 'lucide-react';

type ReviewPortfolio = {
  id: string;
  title: string;
  project_type: string;
  summary: string;
  description: string;
  role_contribution: string;
  tools: string[];
  how_to_play: string;
  playable_url: string;
  learning_reflection: string;
  next_steps: string;
  skills: string[];
  program_type: 'WEEKLY' | 'EKSKUL';
  submitted_at: string | null;
  coderName: string;
  className: string;
  blockName: string | null;
  screenshots: Array<{ id: string; public_url: string; sort_order: number }>;
};

export default function CoachPortfolioReviewClient({ initialPortfolios }: { initialPortfolios: ReviewPortfolio[] }) {
  const [portfolios, setPortfolios] = useState(initialPortfolios);
  const [selected, setSelected] = useState<ReviewPortfolio | null>(null);
  const [revision, setRevision] = useState(false);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function decide(decision: 'APPROVE' | 'REVISION') {
    if (!selected || loading) return;
    if (decision === 'REVISION' && note.trim().length < 5) {
      setError('Tulis arahan revisi minimal 5 karakter.');
      return;
    }
    setLoading(true);
    setError('');
    const response = await fetch(`/api/coach/portfolios/${selected.id}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(decision === 'APPROVE' ? { decision } : { decision, note }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(body.error || 'Review gagal disimpan.');
      setLoading(false);
      return;
    }
    setPortfolios((items) => items.filter((item) => item.id !== selected.id));
    setSelected(null);
    setRevision(false);
    setNote('');
    setLoading(false);
  }

  if (portfolios.length === 0) {
    return <div className="rounded-2xl border border-slate-700 bg-slate-900/60 p-12 text-center"><CheckCircle2 className="mx-auto text-emerald-400" size={46} /><h2 className="mt-4 text-xl font-black text-white">Semua sudah direview</h2><p className="mt-1 text-sm font-semibold text-slate-400">Belum ada kiriman portofolio yang menunggu.</p></div>;
  }

  return (
    <>
      <div className="grid gap-4 lg:grid-cols-2">
        {portfolios.map((portfolio) => (
          <button key={portfolio.id} type="button" onClick={() => setSelected(portfolio)} className="group grid overflow-hidden rounded-2xl border border-slate-700 bg-slate-900/60 text-left transition hover:border-blue-400 sm:grid-cols-[150px_1fr]">
            <div className="flex aspect-video items-center justify-center bg-slate-800 sm:aspect-auto">
              {portfolio.screenshots[0] ? <img src={portfolio.screenshots[0].public_url} alt={`Cover ${portfolio.title}`} className="h-full w-full object-cover" /> : <ImageIcon className="text-slate-600" />}
            </div>
            <div className="p-5"><div className="flex flex-wrap gap-2"><span className="rounded-full bg-blue-500/15 px-2.5 py-1 text-xs font-black text-blue-300">{portfolio.program_type === 'WEEKLY' ? 'Weekly' : 'Ekskul'}</span><span className="rounded-full bg-amber-500/15 px-2.5 py-1 text-xs font-black text-amber-300">Menunggu review</span></div><h2 className="mt-3 text-lg font-black text-white group-hover:text-blue-300">{portfolio.title}</h2><p className="mt-1 text-sm font-semibold text-slate-400">{portfolio.coderName} · {portfolio.className}</p><p className="mt-3 line-clamp-2 text-sm text-slate-400">{portfolio.summary}</p></div>
          </button>
        ))}
      </div>

      {selected && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 p-4" role="dialog" aria-modal="true" aria-labelledby="portfolio-review-title">
        <div className="max-h-[calc(100dvh-2rem)] w-full max-w-4xl overflow-y-auto rounded-3xl border border-slate-700 bg-[#0a1428] p-5 text-white shadow-2xl sm:p-8">
          <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[0.2em] text-blue-300">{selected.coderName} · {selected.className}</p><h2 id="portfolio-review-title" className="mt-2 text-3xl font-black">{selected.title}</h2><p className="mt-1 text-slate-400">{selected.project_type} {selected.blockName ? `· ${selected.blockName}` : ''}</p></div><button type="button" onClick={() => setSelected(null)} aria-label="Tutup" className="rounded-xl p-2 text-slate-400 hover:bg-slate-800"><X /></button></div>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{selected.screenshots.map((image, index) => <img key={image.id} src={image.public_url} alt={`Screenshot ${index + 1} ${selected.title}`} className="aspect-video w-full rounded-xl object-cover" />)}</div>
          <div className="mt-7 grid gap-5 lg:grid-cols-2">
            <ReviewText label="Deskripsi & tujuan" value={selected.description} />
            <ReviewText label="Kontribusi Coder" value={selected.role_contribution} />
            <ReviewText label="Cara bermain" value={selected.how_to_play} />
            <ReviewText label="Yang dipelajari" value={selected.learning_reflection} />
            <ReviewText label="Pengembangan berikutnya" value={selected.next_steps} />
            <ReviewText label="Tools & skills" value={[...selected.tools, ...selected.skills].join(' · ')} />
          </div>
          <a href={selected.playable_url} target="_blank" rel="noreferrer" className="mt-6 inline-flex items-center gap-2 rounded-xl border border-blue-400/40 px-4 py-3 font-black text-blue-300 hover:bg-blue-500/10"><ExternalLink size={18} /> Coba Project</a>
          {revision && <label className="mt-6 block text-sm font-black text-slate-200">Arahan revisi untuk Coder<textarea value={note} onChange={(event) => setNote(event.target.value)} rows={4} className="mt-2 w-full rounded-xl border border-slate-600 bg-slate-900 p-4 font-semibold outline-none focus:border-amber-400" placeholder="Jelaskan bagian yang perlu diperbaiki secara spesifik…" /></label>}
          {error && <p className="mt-3 font-bold text-red-400">{error}</p>}
          <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            {revision ? <>
              <button type="button" onClick={() => { setRevision(false); setError(''); }} className="rounded-xl border border-slate-600 px-5 py-3 font-black">Batal</button>
              <button type="button" onClick={() => decide('REVISION')} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500 px-5 py-3 font-black text-slate-950 disabled:opacity-50">{loading && <Loader2 className="animate-spin" size={18} />} Kirim Arahan Revisi</button>
            </> : <>
              <button type="button" onClick={() => setRevision(true)} className="inline-flex items-center justify-center gap-2 rounded-xl border border-amber-400/50 px-5 py-3 font-black text-amber-300"><MessageSquareWarning size={18} /> Minta Revisi</button>
              <button type="button" onClick={() => decide('APPROVE')} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-400 px-5 py-3 font-black text-emerald-950 disabled:opacity-50">{loading ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle2 size={18} />} Setujui & Tayangkan</button>
            </>}
          </div>
        </div>
      </div>}
    </>
  );
}

function ReviewText({ label, value }: { label: string; value: string }) {
  return <section className="rounded-2xl bg-slate-900/70 p-4"><h3 className="text-xs font-black uppercase tracking-[0.16em] text-blue-300">{label}</h3><p className="mt-2 whitespace-pre-wrap text-sm font-semibold leading-relaxed text-slate-300">{value}</p></section>;
}
