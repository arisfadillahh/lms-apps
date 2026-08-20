'use client';

import { useState } from 'react';
import { Check, Copy, ExternalLink, School, Share2 } from 'lucide-react';

export default function PortfolioShareCard({ slug, schoolVisible, hasSchool }: { slug: string; schoolVisible: boolean; hasSchool: boolean }) {
  const [visible, setVisible] = useState(schoolVisible);
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const relativeUrl = `/portfolio/${slug}`;

  async function copyLink() {
    await navigator.clipboard.writeText(`${window.location.origin}${relativeUrl}`);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  async function updateSchool(next: boolean) {
    setSaving(true);
    const response = await fetch('/api/coder/portfolio-profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ schoolVisible: next }),
    });
    if (response.ok) setVisible(next);
    setSaving(false);
  }

  return (
    <section className="overflow-hidden rounded-[2rem] bg-clevio-navy p-6 text-white shadow-xl sm:p-8">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-clevio-green"><Share2 size={19} /><span className="text-xs font-black uppercase tracking-[0.18em]">Link publik stabil</span></div>
          <h2 className="text-2xl font-black">Bagikan karya terbaikmu</h2>
          <p className="mt-1 max-w-xl text-sm font-semibold text-blue-100/75">Link ini tetap sama. Hanya karya yang sudah disetujui Coach yang terlihat.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={copyLink} className="inline-flex items-center gap-2 rounded-xl bg-clevio-green px-4 py-3 text-sm font-black text-clevio-navy hover:brightness-105">
            {copied ? <Check size={18} /> : <Copy size={18} />} {copied ? 'Tersalin' : 'Salin Link'}
          </button>
          <a href={relativeUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-white/20 px-4 py-3 text-sm font-black hover:bg-white/10"><ExternalLink size={18} /> Lihat</a>
        </div>
      </div>
      <div className="mt-5 flex items-center gap-3 rounded-2xl bg-white/10 p-4">
        <School size={20} className="shrink-0 text-clevio-green" />
        <label className="flex flex-1 cursor-pointer items-center justify-between gap-3 text-sm font-bold">
          <span>{hasSchool ? 'Tampilkan sekolah di halaman publik' : 'Isi sekolah di Profil jika ingin menampilkannya'}</span>
          <input type="checkbox" checked={visible} disabled={!hasSchool || saving} onChange={(event) => updateSchool(event.target.checked)} className="size-5 accent-[#9dc83b]" />
        </label>
      </div>
    </section>
  );
}
