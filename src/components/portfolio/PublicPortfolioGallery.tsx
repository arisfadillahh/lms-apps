'use client';

import { useEffect, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { ArrowUpRight, Code2, ExternalLink, Gamepad2, Github, Lightbulb, Play, Sparkles, Target, X } from 'lucide-react';

import type { PublishedPortfolioSnapshot } from '@/lib/coderPortfolio';
import motionStyles from './PublicPortfolioExperience.module.css';

export type PublicProject = { id: string; snapshot: PublishedPortfolioSnapshot; publishedAt: string | null };

const ACCENTS = ['#9dc83b', '#00b0d7', '#c9147b', '#ff9400'];

export default function PublicPortfolioGallery({ projects }: { projects: PublicProject[] }) {
  const [selected, setSelected] = useState<PublicProject | null>(null);

  useEffect(() => {
    if (!selected) return;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') setSelected(null); };
    const html = document.documentElement;
    const body = document.body;
    const previousHtmlOverflow = html.style.overflow;
    const previousBodyOverflow = body.style.overflow;
    html.style.overflow = 'hidden';
    body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);
    return () => {
      html.style.overflow = previousHtmlOverflow;
      body.style.overflow = previousBodyOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [selected]);

  if (projects.length === 0) {
    return <section id="projects" data-portfolio-reveal className="relative z-10 mx-auto max-w-6xl px-5 py-24 text-center sm:px-8"><Sparkles className="mx-auto text-clevio-green" size={42} /><h2 className="mt-4 text-3xl font-black">Karya sedang dipersiapkan</h2><p className="mt-2 font-semibold text-white/60">Project yang sudah disetujui Coach akan muncul di sini.</p></section>;
  }

  return <>
    <section id="projects" data-portfolio-reveal className="relative z-10 mx-auto w-full max-w-6xl px-5 py-24 sm:px-8 sm:py-28">
      <div className="mb-10 grid gap-4 sm:grid-cols-[90px_1fr] sm:gap-5"><div className="pt-2 text-xs font-black tracking-[.18em] text-clevio-green">02</div><div><h2 className="m-0 max-w-full text-[clamp(2.75rem,13vw,5.1rem)] font-black uppercase leading-[.9] tracking-[-.048em] sm:text-[clamp(3rem,6.6vw,5.1rem)]">Project Universe</h2><p className="mt-5 max-w-2xl text-base font-semibold leading-relaxed text-white/65">Setiap project adalah cerita tentang ide, proses, tantangan, dan hal baru yang dipelajari.</p></div></div>
      <div className="grid gap-4 md:grid-cols-12">{projects.map((project, index) => <ProjectCard key={project.id} project={project} index={index} onOpen={setSelected} />)}</div>
    </section>
    {selected && <ProjectModal project={selected} onClose={() => setSelected(null)} />}
  </>;
}

function ProjectCard({ project, index, onOpen }: { project: PublicProject; index: number; onOpen: (project: PublicProject) => void }) {
  const accent = ACCENTS[index % ACCENTS.length];
  const cover = project.snapshot.screenshots[0];
  const style = { '--portfolio-accent': accent } as CSSProperties;
  const spanClass = index === 2 ? 'md:col-span-7' : index === 3 ? 'md:col-span-5' : 'md:col-span-6';
  const handlePointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.pointerType === 'touch' || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - rect.left) / Math.max(rect.width, 1) - 0.5;
    const y = (event.clientY - rect.top) / Math.max(rect.height, 1) - 0.5;
    event.currentTarget.style.setProperty('--project-tilt-x', `${y * -2.4}deg`);
    event.currentTarget.style.setProperty('--project-tilt-y', `${x * 3}deg`);
  };
  const resetTilt = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.currentTarget.style.setProperty('--project-tilt-x', '0deg');
    event.currentTarget.style.setProperty('--project-tilt-y', '0deg');
  };

  return <button type="button" onClick={() => onOpen(project)} onPointerMove={handlePointerMove} onPointerLeave={resetTilt} aria-label={`Buka cerita project ${project.snapshot.title}`} style={style} className={`${motionStyles.projectTilt} group relative min-h-[360px] w-full overflow-hidden rounded-[1.6rem] border border-white/10 bg-white/[.05] text-left shadow-2xl transition duration-300 hover:border-[color:var(--portfolio-accent)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-clevio-cyan/60 sm:min-h-[430px] sm:rounded-[2rem] ${spanClass}`}>
    <div className="absolute inset-0 overflow-hidden" style={{ background: `radial-gradient(circle at 72% 27%, ${accent}77, transparent 22%), linear-gradient(145deg, ${accent}55, #0f1945 68%)` }}>
      {cover ? <img src={cover.publicUrl} alt="" className="h-full w-full object-cover opacity-25 mix-blend-screen transition duration-500 group-hover:scale-105 group-hover:opacity-40" /> : <Gamepad2 className="absolute right-16 top-16 text-white/20" size={120} />}
      <div className="absolute inset-0 bg-gradient-to-t from-[#0e1740] via-[#0e1740]/25 to-transparent" />
      <span className="absolute left-6 top-6 grid size-14 place-items-center rounded-2xl text-[#0e1740] shadow-xl" style={{ background: `${accent}dd` }}><Gamepad2 size={30} /></span>
      <span className="absolute right-7 top-8 text-xs font-black tracking-[.15em] text-white/50">0{index + 1}</span>
    </div>
    <div className="absolute inset-x-5 bottom-5 z-10 sm:inset-x-6 sm:bottom-6"><span className="text-[10px] font-black uppercase tracking-[.15em]" style={{ color: accent }}>{project.snapshot.projectType}</span><h3 className="mt-2 text-[clamp(1.85rem,9vw,3rem)] font-black leading-[.94] tracking-[-.04em] sm:text-[clamp(2rem,4vw,3rem)]">{project.snapshot.title}</h3><p className="mt-3 line-clamp-3 max-w-xl text-sm font-semibold leading-relaxed text-white/65">{project.snapshot.summary}</p><div className="mt-5 flex items-center justify-between gap-4 border-t border-white/15 pt-4 text-xs font-black text-white/75"><span>View Project Story</span><span className="grid size-11 shrink-0 place-items-center rounded-full bg-white text-[#0e1740] transition group-hover:rotate-12"><ArrowUpRight size={20} /></span></div></div>
  </button>;
}

function ProjectModal({ project, onClose }: { project: PublicProject; onClose: () => void }) {
  const accent = ACCENTS[project.snapshot.title.length % ACCENTS.length];
  return <div className="fixed inset-0 z-[1200] grid h-[100dvh] w-screen items-end overflow-hidden bg-[#050a22]/85 p-0 backdrop-blur-xl sm:place-items-center sm:p-6" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <article className="!max-h-[100dvh] !w-screen !max-w-none overflow-x-hidden overflow-y-auto rounded-t-[1.75rem] border border-white/15 bg-gradient-to-br from-[#172862] to-[#0e1740] text-white shadow-[0_40px_110px_rgba(0,0,0,.45)] sm:!max-h-[calc(100dvh-3rem)] sm:!w-full sm:!max-w-5xl sm:rounded-[2rem]" role="dialog" aria-modal="true" aria-labelledby="public-project-title">
      <button type="button" onClick={onClose} aria-label="Tutup detail project" className="sticky right-4 top-4 z-20 float-right mr-4 mt-4 grid size-11 place-items-center rounded-full border border-white/15 bg-[#0e1740]/75 backdrop-blur"><X size={20} /></button>
      <header className="relative flex min-h-[260px] flex-col justify-end overflow-hidden p-5 sm:min-h-[330px] sm:p-9" style={{ background: `radial-gradient(circle at 77% 29%, ${accent}77, transparent 27%), linear-gradient(145deg, ${accent}33, #0e1740)` }}><div className="absolute -right-16 -top-28 size-96 rounded-full border-[38px] opacity-35" style={{ borderColor: accent }} /><span className="relative z-10 grid size-14 place-items-center rounded-2xl text-[#0e1740]" style={{ background: accent }}><Gamepad2 size={30} /></span><span className="relative z-10 mt-5 text-[10px] font-black uppercase tracking-[.15em]" style={{ color: accent }}>{project.snapshot.projectType}</span><h2 id="public-project-title" className="relative z-10 mt-2 max-w-3xl break-words text-[clamp(2.2rem,11vw,4.3rem)] font-black leading-[.92] tracking-[-.045em] sm:text-[clamp(2.7rem,6vw,4.3rem)]">{project.snapshot.title}</h2><p className="relative z-10 mt-3 max-w-2xl font-semibold leading-relaxed text-white/65">{project.snapshot.summary}</p></header>
      <div className="p-5 sm:p-9"><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{project.snapshot.screenshots.map((image, index) => <img key={`${image.publicUrl}-${index}`} src={image.publicUrl} alt={image.altText || `Screenshot ${index + 1}`} className={`w-full rounded-2xl object-cover ${index === 0 ? 'sm:col-span-2 lg:col-span-2' : ''}`} />)}</div><p className="mt-7 text-lg font-semibold leading-relaxed text-white/75">{project.snapshot.description}</p><div className="mt-7 grid gap-3 md:grid-cols-2"><DetailCard icon={<Target />} label="Ide & tantangan" value={project.snapshot.summary} /><DetailCard icon={<Code2 />} label="Kontribusiku" value={project.snapshot.roleContribution} /><DetailCard icon={<Lightbulb />} label="Yang kupelajari" value={project.snapshot.learningReflection} /><DetailCard icon={<Target />} label="Berikutnya" value={project.snapshot.nextSteps} /></div><div className="mt-7 flex flex-wrap gap-2">{[...project.snapshot.tools, ...project.snapshot.skills].map((item, index) => <span key={`${item}-${index}`} className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-black text-blue-200">{item}</span>)}</div><div className="mt-8 flex flex-wrap gap-3">{project.snapshot.playableUrl && <a href={project.snapshot.playableUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-clevio-green px-5 font-black text-[#0e1740]"><ExternalLink size={18} /> Mainkan Project</a>}{project.snapshot.repositoryUrl && <a href={project.snapshot.repositoryUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-white/20 px-5 font-black"><Github size={18} /> Source Code</a>}{project.snapshot.videoUrl && <a href={project.snapshot.videoUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-white/20 px-5 font-black"><Play size={18} /> Video Demo</a>}</div></div>
    </article>
  </div>;
}

function DetailCard({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return <section className="rounded-2xl border border-white/10 bg-white/[.04] p-5"><div className="flex items-center gap-2 text-clevio-cyan">{icon}<h3 className="text-xs font-black uppercase tracking-[.17em]">{label}</h3></div><p className="mt-3 whitespace-pre-wrap text-sm font-semibold leading-relaxed text-white/70">{value}</p></section>;
}
