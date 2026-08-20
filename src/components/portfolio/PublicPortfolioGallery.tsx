'use client';

import { useState } from 'react';
import { ArrowUpRight, Code2, ExternalLink, Gamepad2, Github, Lightbulb, Play, Sparkles, Target, X } from 'lucide-react';
import type { PublishedPortfolioSnapshot } from '@/lib/coderPortfolio';

export type PublicProject = { id: string; snapshot: PublishedPortfolioSnapshot; publishedAt: string | null };

export default function PublicPortfolioGallery({ projects }: { projects: PublicProject[] }) {
  const [selected, setSelected] = useState<PublicProject | null>(null);

  if (projects.length === 0) {
    return <section id="projects" className="mx-auto max-w-6xl px-5 py-20 text-center"><Sparkles className="mx-auto text-lime-300" size={42} /><h2 className="mt-4 text-3xl font-black text-white">Karya sedang dipersiapkan</h2><p className="mt-2 font-semibold text-slate-400">Project yang sudah disetujui Coach akan muncul di sini.</p></section>;
  }

  return (
    <>
      <section id="projects" className="mx-auto max-w-6xl px-5 py-20 sm:px-8">
        <div className="mb-9 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div><p className="text-xs font-black uppercase tracking-[0.25em] text-lime-300">Project Universe</p><h2 className="mt-2 text-3xl font-black text-white sm:text-5xl">Karya yang bisa kamu jelajahi</h2></div>
          <p className="max-w-sm text-sm font-semibold leading-relaxed text-slate-400">Setiap project adalah cerita tentang ide, proses, tantangan, dan hal baru yang dipelajari.</p>
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          {projects.map((project, index) => {
            const cover = project.snapshot.screenshots[0];
            return <button key={project.id} type="button" onClick={() => setSelected(project)} className="group overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.055] text-left shadow-2xl transition duration-300 hover:-translate-y-1 hover:border-lime-300/50">
              <div className="relative aspect-[16/10] overflow-hidden bg-[#172240]">
                {cover ? <img src={cover.publicUrl} alt={cover.altText || `Cover ${project.snapshot.title}`} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" /> : <div className="flex h-full items-center justify-center"><Gamepad2 className="text-blue-300/50" size={64} /></div>}
                <div className="absolute inset-0 bg-gradient-to-t from-[#07101f] via-transparent to-transparent" />
                <span className={`absolute left-5 top-5 rounded-full px-3 py-1.5 text-xs font-black ${project.snapshot.programType === 'WEEKLY' ? 'bg-blue-300 text-blue-950' : 'bg-purple-300 text-purple-950'}`}>{project.snapshot.programType === 'WEEKLY' ? 'Weekly' : 'Ekskul'}</span>
                <span className="absolute bottom-5 right-5 flex size-11 items-center justify-center rounded-full bg-lime-300 text-slate-950 shadow-lg transition group-hover:rotate-12"><ArrowUpRight /></span>
              </div>
              <div className="p-6 sm:p-7"><p className="text-xs font-black uppercase tracking-[0.18em] text-blue-300">{project.snapshot.projectType}</p><h3 className="mt-2 text-2xl font-black text-white">{project.snapshot.title}</h3><p className="mt-3 line-clamp-2 text-sm font-semibold leading-relaxed text-slate-400">{project.snapshot.summary}</p><div className="mt-5 flex flex-wrap gap-2">{project.snapshot.skills.slice(0, 4).map((skill) => <span key={`${index}-${skill}`} className="rounded-full border border-white/10 px-3 py-1 text-xs font-bold text-slate-300">{skill}</span>)}</div></div>
            </button>;
          })}
        </div>
      </section>

      {selected && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-3 sm:p-6" role="dialog" aria-modal="true" aria-labelledby="public-project-title">
        <article className="max-h-[calc(100dvh-1.5rem)] w-full max-w-5xl overflow-y-auto rounded-[2rem] border border-white/10 bg-[#0a1428] text-white shadow-2xl">
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-[#0a1428]/95 px-5 py-4 backdrop-blur sm:px-8"><div><p className="text-xs font-black uppercase tracking-[0.18em] text-lime-300">{selected.snapshot.projectType}</p><h2 id="public-project-title" className="text-xl font-black sm:text-2xl">{selected.snapshot.title}</h2></div><button type="button" onClick={() => setSelected(null)} aria-label="Tutup detail project" className="rounded-xl border border-white/10 p-2 text-slate-300 hover:bg-white/10"><X /></button></div>
          <div className="p-5 sm:p-8">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{selected.snapshot.screenshots.map((image, index) => <img key={`${image.publicUrl}-${index}`} src={image.publicUrl} alt={image.altText || `Screenshot ${index + 1}`} className={`w-full rounded-2xl object-cover ${index === 0 ? 'sm:col-span-2 lg:col-span-2' : ''}`} />)}</div>
            <p className="mt-7 text-lg font-semibold leading-relaxed text-slate-300">{selected.snapshot.description}</p>
            <div className="mt-7 grid gap-4 md:grid-cols-2">
              <DetailCard icon={<Code2 />} label="Kontribusiku" value={selected.snapshot.roleContribution} />
              <DetailCard icon={<Play />} label="Cara mencoba" value={selected.snapshot.howToPlay} />
              <DetailCard icon={<Lightbulb />} label="Yang kupelajari" value={selected.snapshot.learningReflection} />
              <DetailCard icon={<Target />} label="Berikutnya" value={selected.snapshot.nextSteps} />
            </div>
            <div className="mt-7 flex flex-wrap gap-2">{[...selected.snapshot.tools, ...selected.snapshot.skills].map((item) => <span key={item} className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-black text-blue-200">{item}</span>)}</div>
            <div className="mt-8 flex flex-wrap gap-3"><a href={selected.snapshot.playableUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-lime-300 px-5 py-3 font-black text-slate-950"><ExternalLink size={18} /> Mainkan Project</a>{selected.snapshot.repositoryUrl && <a href={selected.snapshot.repositoryUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-white/20 px-5 py-3 font-black"><Github size={18} /> Source Code</a>}{selected.snapshot.videoUrl && <a href={selected.snapshot.videoUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-white/20 px-5 py-3 font-black"><Play size={18} /> Video Demo</a>}</div>
          </div>
        </article>
      </div>}
    </>
  );
}

function DetailCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-5"><div className="flex items-center gap-2 text-blue-300">{icon}<h3 className="text-xs font-black uppercase tracking-[0.17em]">{label}</h3></div><p className="mt-3 whitespace-pre-wrap text-sm font-semibold leading-relaxed text-slate-300">{value}</p></section>;
}
