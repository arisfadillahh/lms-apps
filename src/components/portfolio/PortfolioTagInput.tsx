'use client';

import { useId, useState } from 'react';
import { X } from 'lucide-react';
import { portfolioTagKey, uniquePortfolioTags } from '@/lib/portfolioTags';

export default function PortfolioTagInput({ name, label, initial, suggestions, onChange }: {
  name: string; label: string; initial: string[]; suggestions: string[]; onChange: () => void;
}) {
  const id = useId();
  const [tags, setTags] = useState(() => uniquePortfolioTags(initial));
  const [text, setText] = useState('');
  const add = (value: string) => {
    setTags((current) => uniquePortfolioTags([...current, ...value.split(',')]));
    setText(''); onChange();
  };
  return <div>
    <label htmlFor={id} className="block text-sm font-black text-slate-700">{label}</label>
    <p id={`${id}-hint`} className="mt-1 text-xs text-slate-500">Pilih saran atau ketik sendiri. Tekan Enter untuk menambahkan.</p>
    <input type="hidden" name={name} value={uniquePortfolioTags([...tags, ...text.split(',')]).join(', ')} />
    <div className="mt-2 flex flex-wrap gap-2">{tags.map((tag) => <span key={portfolioTagKey(tag)} className="inline-flex max-w-full items-center gap-1 rounded-xl bg-pastel-blue px-3 py-1 text-sm font-bold text-clevio-navy"><span className="break-words">{tag}</span><button type="button" aria-label={`Hapus tag ${tag}`} className="grid size-8 shrink-0 place-items-center" onClick={() => { setTags(tags.filter((item) => item !== tag)); onChange(); }}><X size={16} /></button></span>)}</div>
    <input id={id} aria-describedby={`${id}-hint`} value={text} onChange={(event) => { setText(event.target.value); onChange(); }} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ',') { event.preventDefault(); add(text); } }} className="mt-2 w-full rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 font-semibold text-slate-700" placeholder="Tambah pilihan sendiri…" />
    <div className="mt-2 flex flex-wrap gap-2">{suggestions.filter((item) => !tags.some((tag) => portfolioTagKey(tag) === portfolioTagKey(item))).map((item) => <button key={item} type="button" className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600" onClick={() => { setTags((current) => uniquePortfolioTags([...current, ...text.split(','), item])); setText(''); onChange(); }}>{item}</button>)}</div>
  </div>;
}
