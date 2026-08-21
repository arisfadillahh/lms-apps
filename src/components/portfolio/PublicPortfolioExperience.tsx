'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  BrainCircuit,
  ChevronRight,
  Compass,
  FolderKanban,
  HeartHandshake,
  Menu,
  Rocket,
  Sparkles,
  X,
} from 'lucide-react';

import PublicPortfolioGallery from '@/components/portfolio/PublicPortfolioGallery';
import type { PortfolioExperienceModel } from '@/lib/publicPortfolioExperience';

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <a href="#top" aria-label="Clevio portfolio home" className="inline-flex items-center gap-3">
      <Image src="/images/clevio-logo.png.png" alt="Clevio Innovator Camp" width={150} height={52} className={compact ? 'h-7 w-auto' : 'h-auto w-28 sm:w-36'} priority={!compact} />
    </a>
  );
}

function IntroGate({ model, onEnter }: { model: PortfolioExperienceModel; onEnter: () => void }) {
  return (
    <div className="fixed inset-0 z-[1000] grid grid-rows-[auto_1fr_auto] overflow-hidden bg-[radial-gradient(circle_at_70%_40%,rgba(0,176,215,.19),transparent_26%),radial-gradient(circle_at_65%_51%,rgba(157,200,59,.17),transparent_22%),linear-gradient(145deg,#0e1740,#172862_55%,#111d4c)] px-5 py-6 text-white sm:px-11 sm:py-8" role="dialog" aria-modal="true" aria-label="Masuk portfolio">
      <div className="pointer-events-none absolute inset-0 opacity-60 [background-image:linear-gradient(rgba(255,255,255,.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.04)_1px,transparent_1px)] [background-size:56px_56px] [mask-image:radial-gradient(circle_at_50%_50%,black,transparent_80%)]" />
      <div className="relative z-10 flex items-center justify-between gap-4"><Brand /><span className="text-right text-[10px] font-black uppercase tracking-[.16em] text-white/55 sm:text-xs">{model.season}</span></div>
      <div className="relative z-10 mx-auto grid w-full max-w-6xl items-center gap-10 lg:grid-cols-[1.04fr_.96fr]">
        <div>
          <p className="mb-5 flex items-center gap-2 text-xs font-black uppercase tracking-[.16em] text-clevio-green"><Sparkles size={16} /> Portfolio Experience</p>
          <h1 className="max-w-4xl text-5xl font-black uppercase leading-[.9] tracking-[-.06em] sm:text-7xl lg:text-[clamp(4rem,6.7vw,6.6rem)]">This isn’t a report.<br /><span className="text-transparent [-webkit-text-stroke:1.5px_rgba(255,255,255,.84)]">It’s {model.firstName}’s learning universe.</span></h1>
          <p className="mt-6 max-w-xl text-base font-semibold leading-relaxed text-white/65 sm:text-lg">Masuk ke project, keputusan, eksperimen, dan perkembangan yang terbentuk di balik setiap karya.</p>
          <button type="button" onClick={onEnter} className="mt-7 inline-flex min-h-14 items-center gap-3 rounded-2xl bg-clevio-green px-6 font-black text-[#0e1740] shadow-[0_14px_34px_rgba(157,200,59,.2)] transition hover:-translate-y-1 hover:shadow-[0_20px_44px_rgba(157,200,59,.28)]">Enter Portfolio <ArrowRight size={19} /></button>
        </div>
        <div className="relative mx-auto flex aspect-square w-full max-w-md items-center justify-center">
          <div className="absolute inset-0 rounded-full border border-white/10" />
          <div className="absolute inset-[16%] rounded-full border border-dashed border-clevio-green/40" />
          <div className="absolute inset-[25%] rounded-[45%_55%_62%_38%] bg-gradient-to-br from-clevio-green via-[#c8ef58] to-clevio-cyan opacity-90 shadow-[0_0_65px_rgba(0,176,215,.4)]" />
          <div className="relative z-10 grid size-28 place-items-center rounded-[2rem] border border-white/15 bg-[#0e1740]/85 text-3xl font-black shadow-2xl backdrop-blur sm:size-32">{model.initials}</div>
          <span className="absolute bottom-[20%] z-10 rounded-full border border-clevio-green/35 bg-clevio-green/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[.14em] text-[#dcff84]">Coder Portfolio</span>
        </div>
      </div>
      <div className="relative z-10 flex items-center justify-between gap-4 text-[10px] font-bold uppercase tracking-[.13em] text-white/45"><span className="hidden sm:inline">Clever · Leverage · Human-centric · Greater good</span><span className="ml-auto inline-flex items-center gap-2"><ArrowDown size={16} /> Enter to explore</span></div>
    </div>
  );
}

function ExperienceNav() {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  return (
    <nav className="fixed inset-x-0 top-3 z-50 px-3 sm:top-4 sm:px-5" aria-label="Portfolio navigation">
      <div className="mx-auto flex min-h-16 max-w-6xl items-center justify-between rounded-2xl border border-white/10 bg-[#0e1740]/65 px-4 shadow-[0_14px_45px_rgba(3,11,40,.22)] backdrop-blur-xl sm:px-5">
        <Brand compact />
        <div className={`${open ? 'absolute inset-x-3 top-[4.5rem] grid rounded-2xl border border-white/10 bg-[#0e1740]/95 p-2 shadow-2xl backdrop-blur-xl' : 'hidden'} sm:static sm:flex sm:items-center sm:gap-1 sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none`}>
          <a href="#journey" onClick={close} className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-bold text-white/65 hover:bg-white/10 hover:text-white"><Compass size={16} /> Perjalanan Belajar</a>
          <a href="#projects" onClick={close} className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-bold text-white/65 hover:bg-white/10 hover:text-white"><FolderKanban size={16} /> Project</a>
          <a href="#character" onClick={close} className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-bold text-white/65 hover:bg-white/10 hover:text-white"><HeartHandshake size={16} /> Perjalanan Coder</a>
          <a href="#projects" onClick={close} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-clevio-green px-4 text-sm font-black text-[#0e1740]">Explore <ArrowUpRight size={16} /></a>
        </div>
        <button type="button" className="grid size-11 place-items-center rounded-xl border border-white/10 bg-white/5 sm:hidden" onClick={() => setOpen((value) => !value)} aria-label={open ? 'Tutup menu' : 'Buka menu'} aria-expanded={open}>{open ? <X size={20} /> : <Menu size={20} />}</button>
      </div>
    </nav>
  );
}

function Portal({ model }: { model: PortfolioExperienceModel }) {
  const programLabel = model.programTypes.length > 0
    ? model.programTypes.map((program) => program === 'WEEKLY' ? 'Weekly' : 'Ekskul').join(' · ')
    : 'Coder portfolio';

  return (
    <div className="relative grid min-h-[420px] place-items-center [perspective:1000px] sm:min-h-[560px]">
      <div className="absolute size-[min(560px,88vw)] rounded-full border border-white/10" />
      <div className="absolute size-[min(470px,74vw)] rounded-full border border-dashed border-clevio-green/35" />
      <div className="absolute size-[min(640px,100vw)] rounded-full border border-white/10 opacity-30" />
      <div className="relative flex aspect-square w-[min(480px,78vw)] items-center justify-center rounded-full">
        <div className="absolute size-[56%] rotate-[-7deg] rounded-[42%_58%_64%_36%] bg-gradient-to-br from-clevio-green via-[#caf05d] to-clevio-cyan shadow-[0_0_50px_rgba(0,176,215,.34)]" />
        <div className="relative z-10 grid w-[71%] grid-cols-[auto_1fr_auto] items-center gap-3 rounded-3xl border border-white/15 bg-[#0e1740]/75 p-4 shadow-2xl backdrop-blur-xl">
          <div className="grid size-14 place-items-center rounded-2xl bg-gradient-to-br from-clevio-cyan to-clevio-green text-xl font-black text-[#0e1740]">{model.initials}</div>
          <div className="min-w-0"><span className="block text-[9px] font-black uppercase tracking-[.14em] text-clevio-green">{programLabel}</span><strong className="block truncate text-lg">{model.fullName}</strong><p className="m-0 truncate text-xs text-white/60">{model.levelName || 'Coder'}{model.schoolVisible && model.schoolName ? ` · ${model.schoolName}` : ''}</p></div>
          <Sparkles className="text-clevio-green" size={18} />
        </div>
      </div>
    </div>
  );
}

function Hero({ model }: { model: PortfolioExperienceModel }) {
  return (
    <header id="top" className="relative grid min-h-screen items-center px-5 pb-20 pt-28 sm:px-8">
      <div className="mx-auto grid w-full max-w-6xl items-center gap-8 lg:grid-cols-[.98fr_1.02fr]">
        <div>
          <h1 className="m-0 text-[clamp(4rem,8vw,7.25rem)] font-black uppercase leading-[.82] tracking-[-.058em]">MY CODE,<br /><span className="text-transparent [-webkit-text-stroke:1.5px_rgba(255,255,255,.82)]">MY WORLD.</span></h1>
          <p className="mt-7 max-w-xl text-base font-semibold leading-relaxed text-white/65 sm:text-lg">Portfolio hidup berisi project, ide, eksperimen, dan perkembangan yang dibangun melalui teknologi, kreativitas, kolaborasi, dan keberanian.</p>
          <div className="mt-7 flex flex-wrap gap-3"><a href="#projects" className="inline-flex min-h-12 items-center gap-2 rounded-2xl bg-clevio-green px-5 font-black text-[#0e1740] hover:-translate-y-1">Lihat Project <ArrowUpRight size={18} /></a><a href="#journey" className="inline-flex min-h-12 items-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-5 font-black text-white backdrop-blur hover:bg-white/10">Lihat Perjalanan Belajar <ChevronRight size={17} /></a></div>
          <div className="mt-10 flex flex-wrap gap-8"><Metric label="Projects" value={model.stats.projects} /><Metric label="Skills Practiced" value={model.stats.skills} /><Metric label="Reflections" value={model.stats.reflections} /></div>
        </div>
        <Portal model={model} />
      </div>
      <a href="#journey" className="absolute bottom-5 left-1/2 inline-flex -translate-x-1/2 items-center gap-2 text-[10px] font-black uppercase tracking-[.16em] text-white/45"><ArrowDown size={16} /> Scroll to explore</a>
    </header>
  );
}

function Metric({ label, value }: { label: string; value: number }) { return <div className="grid gap-1"><span className="text-[10px] font-black uppercase tracking-[.15em] text-white/50">{label}</span><strong className="text-xl">{value}</strong></div>; }

function SectionHeader({ number, title, description }: { number: string; title: string; description: string }) {
  return <div className="mb-10 grid gap-4 sm:grid-cols-[90px_1fr] sm:gap-5"><div className="pt-2 text-xs font-black tracking-[.18em] text-clevio-green">{number}</div><div><h2 className="m-0 text-[clamp(3rem,6.6vw,5.1rem)] font-black uppercase leading-[.9] tracking-[-.052em]">{title}</h2><p className="mt-5 max-w-2xl text-base font-semibold leading-relaxed text-white/65">{description}</p></div></div>;
}

function JourneySection({ model }: { model: PortfolioExperienceModel }) {
  const orbitLabels = model.journey.length > 0 ? model.journey.slice(0, 4).map((item) => item.label) : ['Belum ada skill'];

  return <section id="journey" className="relative z-10 px-5 py-24 sm:px-8 sm:py-28"><div className="mx-auto max-w-6xl"><SectionHeader number="01" title="Perjalanan Belajar" description={`Bukan hanya apa yang ${model.firstName} selesaikan, tetapi juga bagaimana cara berpikirnya tumbuh saat membangun karya.`} /><div className="grid gap-4 lg:grid-cols-[1.03fr_.97fr]">
    <article className="relative min-h-[560px] overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-white/[.08] to-white/[.035] p-6 shadow-2xl sm:p-7"><div className="flex items-start gap-3"><span className="grid size-12 place-items-center rounded-2xl bg-clevio-green text-[#0e1740]"><BrainCircuit size={22} /></span><div><small className="block text-[9px] font-black uppercase tracking-[.14em] text-clevio-green">Latest reflection</small><strong className="block max-w-md text-xl leading-tight sm:text-2xl">{model.projects[0]?.snapshot.title || 'Belum ada project terbaru'}</strong></div></div><div className="relative grid min-h-[330px] place-items-center"><div className="absolute size-64 rounded-full border border-white/10 shadow-[0_0_0_34px_rgba(0,176,215,.025),0_0_0_70px_rgba(157,200,59,.02)]" /><div className="relative grid size-40 place-items-center rounded-full bg-gradient-to-br from-clevio-green to-[#c6e854] text-center text-[#0e1740] shadow-[0_25px_60px_rgba(157,200,59,.18)]"><div><Sparkles className="mx-auto" size={26} /><strong className="block text-3xl">{model.stats.reflections}</strong><span className="block text-[9px] font-black uppercase tracking-[.13em]">Refleksi tersimpan</span></div></div>{orbitLabels.map((label, index) => <span key={`${label}-${index}`} className={`absolute rounded-xl border border-white/10 bg-[#0e1740]/80 px-3 py-2 text-xs font-black text-white/75 backdrop-blur ${index === 0 ? 'left-0 top-10' : index === 1 ? 'right-0 top-16' : index === 2 ? 'bottom-9 left-2' : 'bottom-2 right-0'}`}>{label}</span>)}</div><div className="flex gap-3 border-t border-white/10 pt-5 text-clevio-green"><Sparkles className="shrink-0" size={20} /><p className="m-0 text-sm font-semibold leading-relaxed text-white/65">{model.latestStory.learningReflection}</p></div></article>
    <div className="grid gap-3">{model.journey.length > 0 ? model.journey.map((item) => <article key={item.label} className="relative grid min-h-28 grid-cols-[auto_1fr_auto] gap-3 overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-white/[.08] to-white/[.035] p-5"><span className="grid size-10 place-items-center rounded-xl bg-clevio-green text-sm font-black text-[#0e1740]">{item.count}</span><div><strong className="text-base sm:text-lg">{item.label}</strong><p className="m-0 mt-1 text-xs leading-relaxed text-white/60">{item.detail}</p></div><span className="text-xl font-black text-clevio-green">{item.percent}%</span><div className="absolute inset-x-5 bottom-3 h-1 overflow-hidden rounded-full bg-white/10"><i className="block h-full rounded-full bg-gradient-to-r from-clevio-cyan to-clevio-green" style={{ width: `${item.percent}%` }} /></div></article>) : <article className="rounded-3xl border border-dashed border-white/15 p-6 text-white/60">Skill akan muncul setelah ada project yang disetujui Coach.</article>}<article className="rounded-3xl border border-white/10 bg-gradient-to-br from-clevio-cyan/10 to-white/[.035] p-5"><div className="flex items-center gap-2 text-clevio-green"><Sparkles size={21} /><strong>Next step</strong></div><p className="mt-3 text-sm font-semibold leading-relaxed text-white/70">{model.latestStory.nextSteps}</p></article></div>
  </div></div></section>;
}

function CharacterSection({ model }: { model: PortfolioExperienceModel }) {
  const latestProject = model.projects[0]?.snapshot;
  const programLabel = model.programTypes.length > 0
    ? model.programTypes.map((program) => program === 'WEEKLY' ? 'Weekly' : 'Ekskul').join(' · ')
    : 'Belum ada program tercatat';
  const statChips = [
    { label: 'Project', value: model.stats.projects },
    { label: 'Skill', value: model.stats.skills },
    { label: 'Refleksi', value: model.stats.reflections },
  ];

  return (
    <section id="character" className="relative z-10 px-5 py-24 sm:px-8 sm:py-28">
      <div className="mx-auto max-w-6xl">
        <SectionHeader number="03" title="Perjalanan Coder" description={`Ringkasan perkembangan ${model.firstName} dari project yang sudah dibuat, skill yang dipraktikkan, dan langkah berikutnya.`} />
        <div className="grid gap-6 lg:grid-cols-[.96fr_1.04fr]">
          <article className="relative min-h-[560px] overflow-hidden rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_50%_45%,rgba(157,200,59,.22),transparent_26%),linear-gradient(145deg,rgba(255,255,255,.09),rgba(255,255,255,.035))] p-5 shadow-2xl sm:p-8">
            <div className="relative z-10 flex items-start justify-between gap-3">
              <div>
                <small className="block text-[9px] font-black uppercase tracking-[.16em] text-clevio-green">Ringkasan perjalanan</small>
                <strong className="mt-1 block max-w-[18rem] text-xl leading-tight">{latestProject?.title || 'Belum ada project terbaru'}</strong>
              </div>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] font-black uppercase tracking-[.12em] text-white/60">{programLabel}</span>
            </div>
            <div className="relative grid min-h-[350px] place-items-center">
              <div className="absolute size-[min(430px,84vw)] rounded-full border border-white/10" />
              <div className="absolute size-[min(330px,66vw)] rounded-full border border-dashed border-clevio-green/40" />
              <div className="absolute size-[min(500px,96vw)] rounded-full border border-white/10 opacity-25" />
              <div className="relative grid size-[min(220px,54vw)] place-items-center rounded-[43%_57%_62%_38%] bg-gradient-to-br from-clevio-green via-[#c9ef5b] to-clevio-cyan text-[#0e1740] shadow-[0_30px_75px_rgba(0,176,215,.25)]">
                <div className="text-center"><Rocket className="mx-auto mb-3" size={34} /><span className="block text-4xl font-black tracking-[-.06em]">{model.initials}</span><span className="mt-1 block text-[10px] font-black uppercase tracking-[.16em]">{model.firstName}</span></div>
              </div>
              <span className="absolute left-0 top-12 max-w-[45%] rounded-xl border border-white/10 bg-[#0e1740]/85 px-3 py-2 text-xs font-black text-white/75 backdrop-blur">{model.journey[0]?.label || 'Belum ada skill'}</span>
              {model.levelName && <span className="absolute right-0 top-20 max-w-[45%] rounded-xl border border-white/10 bg-[#0e1740]/85 px-3 py-2 text-xs font-black text-white/75 backdrop-blur">{model.levelName}</span>}
              {model.schoolVisible && model.schoolName && <span className="absolute bottom-8 left-0 max-w-[52%] rounded-xl border border-white/10 bg-[#0e1740]/85 px-3 py-2 text-xs font-black text-white/75 backdrop-blur">{model.schoolName}</span>}
            </div>
            <div className="relative z-10 grid grid-cols-3 gap-2 border-t border-white/10 pt-5">
              {statChips.map((stat) => <div key={stat.label} className="rounded-2xl border border-white/10 bg-white/[.045] px-3 py-3"><strong className="block text-xl text-clevio-green">{stat.value}</strong><span className="text-[9px] font-black uppercase tracking-[.12em] text-white/50">{stat.label}</span></div>)}
            </div>
          </article>
          <div className="grid content-center gap-0">
            {model.traits.map((trait, index) => <article key={trait.label} className="grid min-h-28 grid-cols-[44px_1fr] items-start gap-3 border-b border-white/10 py-5 first:pt-0"><span className="text-xs font-black tracking-[.12em] text-clevio-green">0{index + 1}</span><div><strong className="text-lg">{trait.label}</strong><p className="m-0 mt-2 text-sm leading-relaxed text-white/60">{trait.detail}</p></div></article>)}
            <div className="mt-6 rounded-2xl border border-clevio-green/30 bg-clevio-green/10 p-5"><div className="flex items-center gap-2 text-clevio-green"><Sparkles size={20} /><strong>Next step dari project terbaru</strong></div><p className="m-0 mt-3 text-sm font-semibold leading-relaxed text-white/70">{model.latestStory.nextSteps}</p></div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function PublicPortfolioExperience({ model }: { model: PortfolioExperienceModel }) {
  const [entered, setEntered] = useState(false);
  useEffect(() => { document.documentElement.style.scrollBehavior = 'smooth'; return () => { document.documentElement.style.scrollBehavior = ''; }; }, []);
  return <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_13%_10%,rgba(0,176,215,.22),transparent_27%),radial-gradient(circle_at_88%_18%,rgba(157,200,59,.18),transparent_25%),linear-gradient(180deg,#172761_0%,#111d4d_42%,#0e1740_100%)] text-white"><div className="pointer-events-none fixed inset-0 z-0 opacity-50 [background-image:linear-gradient(rgba(255,255,255,.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.035)_1px,transparent_1px)] [background-size:48px_48px] [mask-image:linear-gradient(to_bottom,rgba(0,0,0,.9),transparent_82%)]" />{!entered && <IntroGate model={model} onEnter={() => setEntered(true)} />}<div className={`relative z-10 transition duration-700 ${entered ? 'opacity-100' : 'pointer-events-none h-screen overflow-hidden opacity-0'}`} aria-hidden={!entered}><ExperienceNav /><Hero model={model} /><JourneySection model={model} /><PublicPortfolioGallery projects={model.projects} /><CharacterSection model={model} /><section className="relative z-10 px-5 pb-28 pt-10 sm:px-8"><div className="mx-auto grid min-h-[360px] max-w-6xl items-center gap-8 overflow-hidden rounded-[2.4rem] bg-gradient-to-br from-clevio-green via-[#c0e451] to-clevio-cyan p-8 text-[#0e1740] shadow-[0_40px_100px_rgba(0,176,215,.17)] sm:grid-cols-[1.15fr_.85fr] sm:p-14"><div><span className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[.14em]"><Sparkles size={18} /> The journey continues</span><h2 className="mt-4 max-w-3xl text-[clamp(3rem,7vw,5.5rem)] font-black uppercase leading-[.86] tracking-[-.06em]">What will {model.firstName} build next?</h2><p className="max-w-xl text-base font-semibold leading-relaxed text-[#0e1740]/70">Setiap project baru menjadi bab berikutnya—menunjukkan bukan hanya apa yang bisa dibuat, tetapi juga bagaimana coder bertumbuh saat membuatnya.</p><a href="#projects" className="mt-3 inline-flex min-h-12 items-center gap-2 rounded-xl bg-[#0e1740] px-5 font-black text-white">Revisit Projects <FolderKanban size={18} /></a></div><div className="mx-auto grid size-48 place-items-center rounded-full bg-[#0e1740] text-clevio-green shadow-[0_30px_80px_rgba(14,23,64,.24),0_0_0_28px_rgba(255,255,255,.14),0_0_0_62px_rgba(255,255,255,.08)] sm:size-56"><Rocket size={54} /></div></div></section><footer className="relative z-10 px-5 pb-10 sm:px-8"><div className="mx-auto flex min-h-16 max-w-6xl flex-wrap items-center justify-between gap-5 border-t border-white/10 pt-5 text-[10px] font-black uppercase tracking-[.1em] text-white/45"><Brand compact /><span>Clever · Leverage · Human-centric · Greater good</span><span>Portfolio Experience · {new Date().getFullYear()}</span></div></footer></div></div>;
}
