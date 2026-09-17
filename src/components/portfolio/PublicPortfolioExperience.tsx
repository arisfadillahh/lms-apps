'use client';

import Image from 'next/image';
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  ChevronRight,
  Compass,
  FolderKanban,
  Menu,
  Rocket,
  Sparkles,
  X,
} from 'lucide-react';

import PublicPortfolioGallery from '@/components/portfolio/PublicPortfolioGallery';
import type { PortfolioExperienceModel } from '@/lib/publicPortfolioExperience';
import { lockDocumentScroll } from '@/lib/documentScrollLock';
import { createLatestFrame } from '@/lib/latestFrame';
import styles from './PublicPortfolioExperience.module.css';

const STAR_FIELD = [
  [7, 14, 2, 0.2, 5.4], [13, 68, 3, 1.4, 6.8], [18, 34, 2, 2.1, 5.9],
  [24, 84, 2, 0.7, 7.2], [31, 18, 3, 2.8, 6.2], [37, 57, 2, 1.1, 5.1],
  [44, 91, 2, 3.2, 7.6], [51, 29, 3, 0.5, 6.5], [57, 73, 2, 2.5, 5.7],
  [63, 9, 2, 1.8, 7.1], [68, 48, 3, 3.5, 6.1], [73, 87, 2, 0.9, 5.5],
  [79, 22, 2, 2.2, 7.4], [84, 61, 3, 1.2, 6.6], [90, 39, 2, 3.1, 5.8],
  [94, 79, 2, 0.4, 6.9], [4, 46, 2, 2.7, 7.3], [47, 6, 2, 1.6, 5.6],
] as const;

function UniverseBackdrop({ intro = false }: { intro?: boolean }) {
  return (
    <div aria-hidden="true" className={`${styles.universeBackdrop} ${intro ? styles.introUniverse : ''}`}>
      <i className={styles.ambientField} />
      <i className={styles.noiseTexture} />
      <i className={styles.cursorGlow} />
      {STAR_FIELD.map(([x, y, size, delay, duration], index) => (
        <i
          key={`${x}-${y}-${index}`}
          className={styles.star}
          style={{
            '--star-x': `${x}%`,
            '--star-y': `${y}%`,
            '--star-size': `${size}px`,
            '--star-delay': `${delay}s`,
            '--star-duration': `${duration}s`,
          } as CSSProperties}
        />
      ))}
      <i className={`${styles.comet} ${styles.cometOne}`} />
      <i className={`${styles.comet} ${styles.cometTwo}`} />
    </div>
  );
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <a href="#top" aria-label="Clevio portfolio home" className="inline-flex items-center gap-3">
      <Image src="/images/clevio-logo.png.png" alt="Clevio Innovator Camp" width={150} height={52} className={compact ? 'h-7 w-auto' : 'h-auto w-28 sm:w-36'} priority={!compact} />
    </a>
  );
}

function IntroGate({ model, onEnter, exiting }: { model: PortfolioExperienceModel; onEnter: () => void; exiting: boolean }) {
  return (
    <section className={`${styles.introGate} ${exiting ? styles.introGateExit : ''} fixed inset-0 z-[1000] grid grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden bg-[radial-gradient(circle_at_70%_40%,rgba(0,176,215,.19),transparent_26%),radial-gradient(circle_at_65%_51%,rgba(157,200,59,.17),transparent_22%),linear-gradient(145deg,#0e1740,#172862_55%,#111d4c)] px-4 py-4 text-white sm:px-8 sm:py-6 lg:px-11 lg:py-8`} aria-label="Masuk portfolio">
      <UniverseBackdrop intro />
      <div className="pointer-events-none absolute inset-0 opacity-60 [background-image:linear-gradient(rgba(255,255,255,.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.04)_1px,transparent_1px)] [background-size:56px_56px] [mask-image:radial-gradient(circle_at_50%_50%,black,transparent_80%)]" />
      <div className="relative z-20 flex items-center justify-between gap-3"><Brand /><span className="max-w-[42%] text-right text-[9px] font-black uppercase tracking-[.14em] text-white/55 sm:text-xs">{model.season}</span></div>
      <div className={`${styles.introContent} relative z-10 mx-auto grid min-h-0 w-full max-w-6xl lg:grid-cols-[1.04fr_.96fr] lg:gap-10`}>
        <div className={`${styles.introCopy} relative z-20 max-w-[48rem] py-4 sm:py-6`}>
          <p className="mb-3 flex items-center gap-2 text-[10px] font-black uppercase tracking-[.16em] text-clevio-green sm:mb-5 sm:text-xs"><Sparkles size={16} /> Portfolio Experience</p>
          <h1 className="max-w-[11ch] text-[clamp(2.5rem,12vw,5.6rem)] font-black uppercase leading-[.88] tracking-[-.052em] sm:max-w-4xl sm:text-[clamp(3.25rem,7.6vw,5.4rem)] lg:text-[clamp(4rem,6.7vw,6.6rem)]">This isn’t a report.<br /><span className="text-transparent [-webkit-text-stroke:1.35px_rgba(255,255,255,.84)]">It’s {model.firstName}’s learning universe.</span></h1>
          <p className="mt-4 max-w-[34rem] text-sm font-semibold leading-relaxed text-white/70 sm:mt-6 sm:text-lg">Masuk ke project, keputusan, eksperimen, dan perkembangan yang terbentuk di balik setiap karya.</p>
        </div>
        <div className={`${styles.introPortal} pointer-events-none absolute -right-[24%] top-[11%] flex aspect-square w-[62vw] items-center justify-center opacity-25 sm:-right-[18%] sm:top-1/2 sm:w-[58vw] sm:-translate-y-1/2 sm:opacity-55 lg:relative lg:right-auto lg:top-auto lg:mx-auto lg:w-full lg:max-w-md lg:translate-y-0 lg:opacity-100`}>
          <div className={`${styles.orbitClockwise} absolute inset-0 rounded-full border border-white/10`} />
          <div className={`${styles.orbitCounterClockwise} absolute inset-[16%] rounded-full border border-dashed border-clevio-green/40`} />
          <div className={`${styles.portalBlob} absolute inset-[25%] rounded-[45%_55%_62%_38%] bg-gradient-to-br from-clevio-green via-[#c8ef58] to-clevio-cyan opacity-90 shadow-[0_0_65px_rgba(0,176,215,.4)]`} />
          <div className="relative z-10 hidden size-28 place-items-center rounded-[2rem] border border-white/15 bg-[#0e1740]/85 text-3xl font-black shadow-2xl backdrop-blur sm:grid sm:size-32">{model.initials}</div>
          <span className="absolute bottom-[20%] z-10 hidden rounded-full border border-clevio-green/35 bg-clevio-green/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[.14em] text-[#dcff84] sm:block">Coder Portfolio</span>
        </div>
      </div>
      <div className={`${styles.introActions} relative z-20 mx-auto flex w-full max-w-6xl items-center justify-between gap-4 border-t border-white/10 pt-4`}>
        <button type="button" onClick={onEnter} disabled={exiting} className={`${styles.sheenButton} ${styles.greenGlow} inline-flex min-h-14 w-full items-center justify-center gap-3 rounded-2xl bg-clevio-green px-6 text-base font-black text-[#0e1740] transition duration-300 hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-clevio-cyan/60 active:translate-y-0 sm:w-auto`}>Lihat Portofolio <ArrowRight size={19} /></button>
        <span className="hidden text-right text-xs font-semibold leading-relaxed text-white/60 sm:block">Karya, eksperimen, dan cerita belajar<br /><span className="text-white/90">{model.fullName}</span></span>
      </div>
    </section>
  );
}

function ExperienceNav() {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  return (
    <nav className="fixed inset-x-0 top-3 z-50 px-3 md:top-4 md:px-5" aria-label="Portfolio navigation">
      <div className="mx-auto flex min-h-16 max-w-6xl items-center justify-between rounded-2xl border border-white/10 bg-[#0e1740]/65 px-4 shadow-[0_14px_45px_rgba(3,11,40,.22)] backdrop-blur-xl md:px-5">
        <Brand compact />
        <div className={`${open ? 'absolute inset-x-3 top-[4.5rem] grid rounded-2xl border border-white/10 bg-[#0e1740]/95 p-2 shadow-2xl backdrop-blur-xl' : 'hidden'} md:static md:flex md:items-center md:gap-1 md:border-0 md:bg-transparent md:p-0 md:shadow-none`}>
          <a href="#journey" onClick={close} className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-bold text-white/65 hover:bg-white/10 hover:text-white"><Compass size={16} /> Perjalanan Belajar</a>
          <a href="#projects" onClick={close} className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-bold text-white/65 hover:bg-white/10 hover:text-white"><FolderKanban size={16} /> Karya</a>
          <a href="#next" onClick={close} className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-bold text-white/65 hover:bg-white/10 hover:text-white"><Rocket size={16} /> Target Berikutnya</a>
          <a href="#projects" onClick={close} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-clevio-green px-4 text-sm font-black text-[#0e1740]">Lihat Karya <ArrowUpRight size={16} /></a>
        </div>
        <button type="button" className="grid size-11 place-items-center rounded-xl border border-white/10 bg-white/5 md:hidden" onClick={() => setOpen((value) => !value)} aria-label={open ? 'Tutup menu' : 'Buka menu'} aria-expanded={open}>{open ? <X size={20} /> : <Menu size={20} />}</button>
      </div>
    </nav>
  );
}

function Portal({ model }: { model: PortfolioExperienceModel }) {
  const programLabel = model.programTypes.length > 0
    ? model.programTypes.map((program) => program === 'WEEKLY' ? 'Weekly' : 'Ekskul').join(' · ')
    : 'Coder portfolio';

  return (
    <div className={`${styles.portalParallax} relative grid min-h-[420px] place-items-center [perspective:1000px] sm:min-h-[560px]`}>
      <div className={`${styles.orbitClockwise} absolute size-[min(560px,calc(100vw-2rem))] rounded-full border border-white/10`} />
      <div className={`${styles.orbitCounterClockwise} absolute size-[min(470px,calc(84vw-2rem))] rounded-full border border-dashed border-clevio-green/35`} />
      <div className="absolute size-[min(640px,calc(100vw-1.5rem))] rounded-full border border-white/10 opacity-30" />
      <div className="relative flex aspect-square w-[min(480px,calc(78vw-1rem))] items-center justify-center rounded-full">
        <div className={`${styles.portalBlob} absolute size-[56%] rotate-[-7deg] rounded-[42%_58%_64%_36%] bg-gradient-to-br from-clevio-green via-[#caf05d] to-clevio-cyan shadow-[0_0_50px_rgba(0,176,215,.34)]`} />
        <div className="relative z-10 grid w-[90%] grid-cols-[auto_minmax(0,1fr)] items-center gap-3 rounded-3xl border border-white/15 bg-[#0e1740]/75 p-4 shadow-2xl backdrop-blur-xl">
          <div className="grid size-14 place-items-center rounded-2xl bg-gradient-to-br from-clevio-cyan to-clevio-green text-xl font-black text-[#0e1740]">{model.initials}</div>
          <div className="min-w-0"><span className="block text-[9px] font-black uppercase tracking-[.14em] text-clevio-green">{programLabel}</span><strong className="block break-words text-base leading-snug sm:text-lg">{model.fullName}</strong><p className="m-0 break-words text-xs text-white/60">{model.levelName || 'Coder'}{model.schoolVisible && model.schoolName ? ` · ${model.schoolName}` : ''}</p></div>

        </div>
      </div>
    </div>
  );
}

function Hero({ model }: { model: PortfolioExperienceModel }) {
  return (
    <header id="top" data-portfolio-reveal className="relative grid min-h-[100dvh] items-center px-5 pb-20 pt-28 sm:px-8">
      <div className="mx-auto grid w-full max-w-6xl items-center gap-8 lg:grid-cols-[.98fr_1.02fr]">
        <div>
          <h1 className="m-0 max-w-full text-[clamp(2.6rem,13vw,5.8rem)] font-black uppercase leading-[.84] tracking-[-.052em] sm:text-[clamp(3rem,6vw,4.5rem)] lg:text-[clamp(3.5rem,6vw,5.25rem)]">MY CODE,<br /><span className="text-transparent [-webkit-text-stroke:1.5px_rgba(255,255,255,.82)]">MY WORLD.</span></h1>
          <p className="mt-7 max-w-xl text-base font-semibold leading-relaxed text-white/65 sm:text-lg">Portfolio hidup berisi project, ide, eksperimen, dan perkembangan yang dibangun melalui teknologi, kreativitas, kolaborasi, dan keberanian.</p>
          <div className="mt-7 flex flex-wrap gap-3"><a href="#projects" className={`${styles.sheenButton} ${styles.greenGlow} inline-flex min-h-12 items-center gap-2 rounded-2xl bg-clevio-green px-5 font-black text-[#0e1740] hover:-translate-y-1`}>Lihat Karya <ArrowUpRight size={18} /></a><a href="#journey" className="inline-flex min-h-12 items-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-5 font-black text-white backdrop-blur hover:bg-white/10">Lihat Perjalanan Belajar <ChevronRight size={17} /></a></div>
          <div className="mt-10 flex flex-wrap gap-8"><Metric label="Karya" value={model.stats.projects} /><Metric label="Skill dipraktikkan" value={model.stats.skills} /><Metric label="Refleksi" value={model.stats.reflections} /></div>
        </div>
        <Portal model={model} />
      </div>
      <a href="#journey" className="absolute bottom-5 left-1/2 inline-flex -translate-x-1/2 items-center gap-2 text-[10px] font-black uppercase tracking-[.16em] text-white/45"><ArrowDown className={styles.scrollCueIcon} size={16} /> Jelajahi karya</a>
    </header>
  );
}

function Metric({ label, value }: { label: string; value: number }) { return <div className="grid gap-1"><span className="text-[10px] font-black uppercase tracking-[.15em] text-white/50">{label}</span><strong className="text-xl">{value}</strong></div>; }

function SectionHeader({ number, title, description }: { number: string; title: string; description: string }) {
  return <div className="mb-10 grid gap-4 sm:grid-cols-[90px_1fr] sm:gap-5"><div className="pt-2 text-xs font-black tracking-[.18em] text-clevio-green">{number}</div><div><h2 className="m-0 text-[clamp(2.35rem,11vw,4.4rem)] font-black uppercase leading-[.9] tracking-[-.052em] sm:text-[clamp(2.6rem,5.4vw,4.4rem)] lg:text-[clamp(3rem,6.6vw,5.1rem)]">{title}</h2><p className="mt-5 max-w-2xl text-base font-semibold leading-relaxed text-white/65">{description}</p></div></div>;
}

function JourneySection({ model }: { model: PortfolioExperienceModel }) {
  return <section id="journey" data-portfolio-reveal className="relative z-10 scroll-mt-24 px-5 py-16 sm:px-8 sm:py-20">
    <div className="mx-auto max-w-6xl">
      <span id="character" className="scroll-mt-24" />
      <SectionHeader number="02" title="Perjalanan Belajarku" description={`Karya dan refleksi ${model.firstName}, diurutkan berdasarkan tanggal publikasi. Program mengikuti asal masing-masing karya.`} />
      <div className="grid items-start gap-8 lg:grid-cols-[1.4fr_1fr]">
        <ol className="space-y-6 border-l border-white/20 pl-5 sm:pl-8">
          {model.timeline.map((item) => <li key={item.id} className="relative break-words">
            <span className="absolute -left-[1.6rem] top-1.5 size-3 rounded-full bg-clevio-green sm:-left-[2.4rem]" />
            <p className="text-xs font-bold text-clevio-green">{item.publishedAt ? <time dateTime={item.publishedAt}>Dipublikasikan {new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta' }).format(new Date(item.publishedAt))}</time> : 'Tanggal publikasi belum tercatat'} · {item.program}</p>
            <h3 className="mt-2 text-xl font-black sm:text-2xl">{item.title}</h3>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-white/75">{item.reflection || 'Refleksi belum tercatat untuk karya ini.'}</p>
          </li>)}
          {model.timeline.length === 0 && <li className="text-white/65">Perjalanan akan muncul setelah karya pertama disetujui Coach.</li>}
        </ol>
        <aside className="rounded-3xl border border-white/10 bg-white/5 p-5 sm:p-6">
          <h3 className="text-lg font-black">Skill yang dipraktikkan</h3>
          <p className="mt-2 text-sm leading-relaxed text-white/60">Frekuensi penggunaan dalam karya, bukan nilai penguasaan skill.</p>
          <ul className="mt-5 space-y-4">{model.journey.map((item) => <li key={item.label} className="break-words border-t border-white/10 pt-4"><strong>{item.label}</strong><p className="mt-1 text-sm text-white/65">{item.detail}</p></li>)}</ul>
          {model.journey.length === 0 && <p className="mt-4 text-sm text-white/60">Belum ada skill tercatat.</p>}
        </aside>
      </div>
    </div>
  </section>;
}

export default function PublicPortfolioExperience({ model }: { model: PortfolioExperienceModel }) {
  const [entered, setEntered] = useState(false);
  const [gateVisible, setGateVisible] = useState(true);
  const rootRef = useRef<HTMLDivElement>(null);
  const pointerFrame = useRef<ReturnType<typeof createLatestFrame<{ x: number; y: number }>> | null>(null);

  useEffect(() => {
    const frame = createLatestFrame<{ x: number; y: number }>(({ x, y }) => {
      const root = rootRef.current;
      if (!root) return;
      root.style.setProperty('--portfolio-pointer-x', `${x}px`);
      root.style.setProperty('--portfolio-pointer-y', `${y}px`);
      root.style.setProperty('--portfolio-rotate-x', `${(0.5 - y / Math.max(window.innerHeight, 1)) * 3.4}deg`);
      root.style.setProperty('--portfolio-rotate-y', `${(x / Math.max(window.innerWidth, 1) - 0.5) * 5.2}deg`);
    });
    pointerFrame.current = frame;
    return () => { frame.cancel(); pointerFrame.current = null; };
  }, []);

  useLayoutEffect(() => {
    document.body.dataset.portfolioPage = 'true';
    window.dispatchEvent(new Event('portfolio-scroll-mode-change'));
    return () => {
      delete document.body.dataset.portfolioPage;
      window.dispatchEvent(new Event('portfolio-scroll-mode-change'));
    };
  }, []);

  useEffect(() => { document.documentElement.style.scrollBehavior = 'smooth'; return () => { document.documentElement.style.scrollBehavior = ''; }; }, []);

  useEffect(() => {
    if (!gateVisible) return;
    const html = document.documentElement;
    const body = document.body;
    const unlockDocumentScroll = lockDocumentScroll();
    html.classList.add(styles.introLocked);
    body.classList.add(styles.introLocked);
    return () => {
      html.classList.remove(styles.introLocked);
      body.classList.remove(styles.introLocked);
      unlockDocumentScroll();
    };
  }, [gateVisible]);

  useEffect(() => {
    if (!entered || !gateVisible) return;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const timeout = window.setTimeout(() => setGateVisible(false), reducedMotion ? 0 : 620);
    return () => window.clearTimeout(timeout);
  }, [entered, gateVisible]);

  useEffect(() => {
    if (!gateVisible) rootRef.current?.querySelector<HTMLAnchorElement>('#top a[href="#projects"]')?.focus({ preventScroll: true });
  }, [gateVisible]);

  useEffect(() => {
    if (!entered || gateVisible) return;
    const root = rootRef.current;
    if (!root) return;
    const elements = Array.from(root.querySelectorAll<HTMLElement>('[data-portfolio-reveal]'));
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reducedMotion || !('IntersectionObserver' in window)) {
      elements.forEach((element) => element.classList.add(styles.revealVisible));
      return;
    }

    root.classList.add(styles.motionReady);
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add(styles.revealVisible);
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0, rootMargin: '0px 0px -4% 0px' });
    elements.forEach((element) => observer.observe(element));
    return () => {
      observer.disconnect();
      root.classList.remove(styles.motionReady);
    };
  }, [entered, gateVisible]);

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'touch' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    pointerFrame.current?.schedule({ x: event.clientX, y: event.clientY });
  };

  const resetPointer = () => {
    pointerFrame.current?.cancel();
    const root = rootRef.current;
    if (!root) return;
    root.style.setProperty('--portfolio-pointer-x', '50vw');
    root.style.setProperty('--portfolio-pointer-y', '50vh');
    root.style.setProperty('--portfolio-rotate-x', '0deg');
    root.style.setProperty('--portfolio-rotate-y', '0deg');
  };

  return <div ref={rootRef} onPointerMove={handlePointerMove} onPointerLeave={resetPointer} className={`${styles.root} relative min-h-[100dvh] w-full max-w-full overflow-x-clip bg-[radial-gradient(circle_at_13%_10%,rgba(0,176,215,.22),transparent_27%),radial-gradient(circle_at_88%_18%,rgba(157,200,59,.18),transparent_25%),linear-gradient(180deg,#172761_0%,#111d4d_42%,#0e1740_100%)] text-white`}>{entered && <UniverseBackdrop />}<div className="pointer-events-none fixed inset-0 z-0 opacity-50 [background-image:linear-gradient(rgba(255,255,255,.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.035)_1px,transparent_1px)] [background-size:48px_48px] [mask-image:linear-gradient(to_bottom,rgba(0,0,0,.9),transparent_82%)]" />{gateVisible && <IntroGate model={model} onEnter={() => setEntered(true)} exiting={entered} />}{entered && <div className={`relative z-10 transition duration-700 ${entered ? styles.experienceEntered : `${styles.experienceHidden} pointer-events-none h-[100dvh] overflow-hidden`}`} aria-hidden={!entered}><ExperienceNav /><Hero model={model} /><PublicPortfolioGallery projects={model.projects} /><JourneySection model={model} /><section id="next" data-portfolio-reveal className="relative z-10 px-5 pb-28 pt-10 sm:px-8"><div className="mx-auto grid min-h-[360px] max-w-6xl items-center gap-8 overflow-hidden rounded-[2rem] bg-gradient-to-br from-clevio-green via-[#c0e451] to-clevio-cyan p-6 text-[#0e1740] shadow-[0_40px_100px_rgba(0,176,215,.17)] sm:grid-cols-[1.15fr_.85fr] sm:p-14"><div><span className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[.14em]"><Sparkles size={18} /> Target berikutnya</span><h2 className="mt-4 max-w-3xl text-[clamp(2rem,9vw,3.5rem)] font-black uppercase leading-[.88] tracking-[-.052em] sm:text-[clamp(2.5rem,4.5vw,3.5rem)]">Langkah berikutnya untuk {model.firstName}</h2><p className="max-w-xl text-base font-semibold leading-relaxed text-[#0e1740]/70">{model.latestStory.nextSteps}</p><a href="#projects" className={`${styles.sheenButton} mt-3 inline-flex min-h-12 items-center gap-2 rounded-xl bg-[#0e1740] px-5 font-black text-white transition duration-300 hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/70 active:translate-y-0`}>Lihat Karya Lagi <FolderKanban size={18} /></a></div><div className={`${styles.ctaPlanet} mx-auto grid size-40 place-items-center rounded-full bg-[#0e1740] text-clevio-green shadow-[0_30px_80px_rgba(14,23,64,.24),0_0_0_20px_rgba(255,255,255,.14),0_0_0_42px_rgba(255,255,255,.08)] sm:size-56 sm:shadow-[0_30px_80px_rgba(14,23,64,.24),0_0_0_28px_rgba(255,255,255,.14),0_0_0_62px_rgba(255,255,255,.08)]`}><Rocket size={54} /></div></div></section><footer data-portfolio-reveal className="relative z-10 px-5 pb-10 sm:px-8"><div className="mx-auto flex min-h-16 max-w-6xl flex-wrap items-center justify-between gap-5 border-t border-white/10 pt-5 text-[10px] font-black uppercase tracking-[.1em] text-white/45"><Brand compact /><span>Clever · Leverage · Human-centric · Greater good</span><span>Portfolio Experience · {new Date().getFullYear()}</span></div></footer></div>}</div>;
}
