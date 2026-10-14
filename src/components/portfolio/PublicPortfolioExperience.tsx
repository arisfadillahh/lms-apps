'use client';

import Image from 'next/image';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowDown, ArrowRight, BarChart3, Check, Compass, FolderKanban, Heart, Menu, Rocket, Share2, Sparkles, Trophy, Wrench, X } from 'lucide-react';

import PublicPortfolioGallery from '@/components/portfolio/PublicPortfolioGallery';
import type { PortfolioExperienceModel } from '@/lib/publicPortfolioExperience';
import styles from './PublicPortfolioExperience.module.css';

const classNames = (...names: Array<string | false | null | undefined>) => names.filter(Boolean).join(' ');

function Brand({ surface = 'light' }: { surface?: 'light' | 'dark' }) {
  // Asset names describe the lettering: dark = blue text, light = white text.
  const logo = surface === 'light' ? '/logo/innovator-camp-logo-dark.png' : '/logo/innovator-camp-logo-light.png';
  return <a href="#home" className={styles.brand} aria-label="Clevio portfolio home">
    <Image src={logo} alt="Clevio Innovator Camp" width={146} height={50} priority />
  </a>;
}

function Navigation() {
  const [open, setOpen] = useState(false);
  const [shareStatus, setShareStatus] = useState('');
  const links = [['Karya', '#projects'], ['Perjalanan', '#journey'], ['Keahlian', '#skills'], ['Refleksi', '#reflection']] as const;
  async function sharePortfolio() {
    const url = window.location.href.split('#')[0];
    try {
      if (navigator.share) {
        await navigator.share({ title: document.title, url });
      } else {
        await navigator.clipboard.writeText(url);
        setShareStatus('Link portofolio disalin. Siap dibagikan!');
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return;
      setShareStatus('Belum bisa membagikan. Salin alamat halaman dari browser.');
    }
  }
  return <header className={styles.topbar}>
    <div className={classNames(styles.shell, styles.nav)}>
      <Brand />
      <nav id="portfolio-navigation" className={classNames(styles.navlinks, open && styles.navlinksOpen)} aria-label="Navigasi portofolio" onKeyDown={(event) => { if (event.key === 'Escape') setOpen(false); }}>
        {links.map(([label, href]) => <a key={href} href={href} onClick={() => setOpen(false)}>{label}</a>)}
      </nav>
      <button type="button" className={styles.shareButton} onClick={sharePortfolio}><Share2 size={16} /> Bagikan</button>
      <button type="button" className={styles.mobileMenu} onClick={() => setOpen((value) => !value)} aria-controls="portfolio-navigation" aria-expanded={open} aria-label={open ? 'Tutup menu' : 'Buka menu'}>{open ? <X size={21} /> : <Menu size={21} />}</button>
    </div>
    <p className={styles.shareStatus} role="status">{shareStatus}</p>
  </header>;
}

function PortfolioHero({ model }: { model: PortfolioExperienceModel }) {
  const heroRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const hero = heroRef.current;
    if (!hero) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0;
    let visible = true;
    const update = () => {
      frame = 0;
      if (reduced.matches) { hero.style.setProperty('--depth', '0px'); return; }
      const bounds = hero.getBoundingClientRect();
      const offset = Math.max(-32, Math.min(100, -bounds.top * 0.18));
      hero.style.setProperty('--depth', `${offset}px`);
    };
    const schedule = () => { if (visible && !reduced.matches && !frame) frame = requestAnimationFrame(update); };
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) schedule();
      else { cancelAnimationFrame(frame); frame = 0; }
    });
    observer.observe(hero);
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    reduced.addEventListener('change', update);
    update();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      reduced.removeEventListener('change', update);
    };
  }, []);
  return <section id="home" ref={heroRef} className={styles.hero} aria-label="Semesta karya coder">
    <div className={styles.heroBackdrop} aria-hidden="true">
      <div className={styles.heroNebula} />
      <div className={styles.heroStarfield} />
      <div className={styles.heroConstellation} />
      <div className={styles.heroHorizon} />
    </div>
    <div className={classNames(styles.shell, styles.heroLayout)}>
      <div className={styles.heroCopy}><p className={styles.eyebrow}><Sparkles size={16} /> Semesta karya seorang coder</p><h1>{model.fullName}</h1><div className={styles.profileFacts}>{model.levelName && <span>{model.levelName}</span>}{model.programTypes.map((program) => <span key={program}>{program === 'EKSKUL' ? 'Ekskul' : 'Weekly'}</span>)}{model.schoolVisible && model.schoolName && <span>{model.schoolName}</span>}</div><h2>Ide kecil.<br />Petualangan tanpa batas.</h2><p>Kenali {model.firstName} lewat karya, cerita di balik pembuatannya, dan perjalanan belajarnya.</p><div className={styles.heroActions}><a className={styles.primaryButton} href="#projects">Lihat karya <ArrowRight size={18} /></a><a className={styles.secondaryButton} href="#journey"><Compass size={16} /> Perjalanan belajar</a></div><p className={styles.heroHint}>Pilih karya untuk melihat ceritanya atau mencoba game-nya.</p></div>
      <UniverseStage model={model} />
    </div>
  </section>;
}

function UniverseStage({ model }: { model: PortfolioExperienceModel }) {
  return <div className={styles.heroArt} aria-hidden="true">
    <div className={styles.universeStage}>
      <div className={styles.spaceDust} />
      <i className={classNames(styles.glow, styles.glowA)} /><i className={classNames(styles.glow, styles.glowB)} />
      <div className={styles.stars} aria-hidden="true">{Array.from({ length: 11 }, (_, index) => <i key={index} />)}</div>
      <i className={classNames(styles.orbit, styles.orbitOne)} /><i className={classNames(styles.orbit, styles.orbitTwo)} /><i className={classNames(styles.orbit, styles.orbitThree)} />
      <span className={classNames(styles.universeTag, styles.tagExplore)}>Eksplorasi</span><span className={classNames(styles.universeTag, styles.tagCreate)}>Berkarya</span><span className={classNames(styles.universeTag, styles.tagGrow)}>Bertumbuh</span>
      <div className={styles.planetShell}><div className={styles.planetAura} /><div className={styles.planetCore}><i className={styles.planetGrid} /><strong>{model.initials}</strong><span>Young creator</span></div></div>
      <p className={styles.universeCaption}><i /> Semesta karya {model.firstName}</p>
    </div>
  </div>;
}

function Stat({ icon, value, label }: { icon: ReactNode; value: string | number; label: string }) {
  return <div className={styles.stat}><span className={styles.iconBox}>{icon}</span><div><strong>{value}</strong><span>{label}</span></div></div>;
}

function LearningPath({ model }: { model: PortfolioExperienceModel }) {
  const [expanded, setExpanded] = useState(false);
  const blocks = model.learningJourney.flatMap((level) => level.blocks.map((block) => ({ ...block, levelName: level.levelName })));
  const current = blocks.findIndex((block) => block.status === 'IN_PROGRESS');
  const focus = current >= 0 ? current : blocks.findIndex((block) => block.status === 'PENDING');
  const start = Math.max(0, Math.min((focus >= 0 ? focus : blocks.length - 1) - 1, blocks.length - 4));
  const preview = expanded ? blocks : blocks.slice(start, start + 4);
  return <section id="journey" className={styles.section}>
    <div className={styles.sectionHead}><div><div className={styles.titleWrap}><span className={styles.sectionIcon}><BarChart3 size={19} /></span><h2>Perjalanan belajar</h2></div><p>Dari materi yang sudah selesai hingga langkah berikutnya.</p></div>{blocks.length > 4 && <button type="button" className={styles.secondaryButton} aria-expanded={expanded} aria-controls="learning-blocks" onClick={() => setExpanded(!expanded)}>{expanded ? 'Ringkas perjalanan' : `Lihat semua ${blocks.length} block`} <ArrowDown size={16} /></button>}</div>
    {preview.length > 0 ? <div id="learning-blocks" className={styles.learningPath}><i className={styles.learningLine} />
      {preview.map((block) => {
        const state = block.status === 'COMPLETED' ? 'completed' : block.status === 'IN_PROGRESS' ? 'current' : 'next';
        return <article className={classNames(styles.learningStep, styles[state])} key={block.id}><span className={styles.learningNode}>{state === 'completed' ? <Check size={16} /> : state === 'current' ? <i /> : null}</span><div className={styles.learningCard}><b>{state === 'completed' ? 'Selesai' : state === 'current' ? 'Sedang dipelajari' : 'Berikutnya'}</b><small>{block.levelName}</small><h3>{block.blockName}</h3><p>{state === 'completed' ? 'Materi belajar telah diselesaikan.' : state === 'current' ? 'Di sinilah petualangan belajar berlanjut.' : 'Materi yang menanti untuk dieksplorasi.'}</p></div></article>;
      })}
    </div> : <div className={styles.emptyJourney}><Compass size={22} /> Perjalanan belajar akan tampil setelah progress block coder tersedia.</div>}
  </section>;
}

export default function PublicPortfolioExperience({ model }: { model: PortfolioExperienceModel }) {
  useEffect(() => {
    document.body.dataset.portfolioPage = 'true';
    window.dispatchEvent(new Event('portfolio-scroll-mode-change'));
    return () => {
      delete document.body.dataset.portfolioPage;
      window.dispatchEvent(new Event('portfolio-scroll-mode-change'));
    };
  }, []);
  const completedBlocks = model.learningJourney.reduce((total, level) => total + level.completedCount, 0);
  const tools = [...new Set(model.projects.flatMap((project) => project.snapshot.tools))].slice(0, 6);
  return <div className={styles.root} data-public-portfolio>
    <a className={styles.skipLink} href="#projects">Langsung ke karya</a>
    <Navigation />
    <main>
      <PortfolioHero model={model} />
      <div className={styles.shell}>
      <section className={styles.stats} aria-label="Ringkasan portofolio"><Stat icon={<FolderKanban size={20} />} value={model.stats.projects} label="Karya terbit" /><Stat icon={<BarChart3 size={20} />} value={completedBlocks} label="Block selesai" /><Stat icon={<Wrench size={20} />} value={model.stats.skills} label="Keahlian dilatih" /><Stat icon={<Compass size={20} />} value={model.stats.reflections} label="Refleksi karya" /><div className={styles.achievementStat}><span className={styles.iconBox}><Trophy size={20} /></span><div><small>Karya terbaru</small><strong>{model.featuredProject?.snapshot.title || 'Karya sedang dipersiapkan'}</strong><span>{model.featuredProject ? 'Sudah disetujui Coach' : 'Petualangan baru dimulai'}</span></div></div></section>
      <PublicPortfolioGallery projects={model.projects} />
      <LearningPath model={model} />
      <section id="skills" className={styles.bottomGrid}>
        <article className={styles.infoCard}><h2><Wrench size={19} /> Alat berkarya</h2><p>Aplikasi yang digunakan untuk membuat karya-karya ini.</p><div className={styles.skillIcons}>{tools.length > 0 ? tools.map((tool) => <span className={styles.skill} key={tool}><i>{tool.slice(0, 1).toUpperCase()}</i>{tool}</span>) : <span className={styles.noData}>Belum ada alat berkarya yang tercatat.</span>}</div></article>
        <article className={styles.infoCard}><h2><Heart size={19} /> Keahlian yang dilatih</h2><p>Terlihat dari karya yang sudah dipublikasikan.</p><div className={styles.chips}>{model.journey.length > 0 ? model.journey.map((skill) => <span className={styles.chip} key={skill.label}>{skill.label} · {skill.count} karya</span>) : <span className={styles.noData}>Keahlian akan muncul setelah karya disetujui.</span>}</div></article>
        <article className={styles.infoCard} id="reflection"><h2><Sparkles size={19} /> Cerita belajarku</h2>{model.featuredProject?.snapshot.learningReflection ? <><p className={styles.reflection}>“{model.featuredProject.snapshot.learningReflection}”</p><p className={styles.attribution}>— {model.firstName}, dari karya {model.featuredProject.snapshot.title}</p></> : <p>Refleksi akan tampil saat coder membagikan cerita belajarnya.</p>}</article>
      </section>
      <section className={styles.footerBannerV4} aria-label="Closing">
        <div className={styles.closingCopyV4}>
          <div className={styles.closingEyebrowV4}><Sparkles size={18} /> PETUALANGAN BERIKUTNYA</div>
          <h2>Terus penasaran.<br />Terus berkarya.</h2>
          <p>{model.latestStory.nextSteps}</p>
          <a className={styles.closingCtaV4} href="https://clev.io" target="_blank" rel="noreferrer">Kenali Clevio <ArrowRight size={17} /></a>
        </div>
        <div className={styles.closingVisualV4} aria-hidden="true">
          <i className={styles.closingRingOneV4} /><i className={styles.closingRingTwoV4} /><i className={styles.closingRingThreeV4} />
          <span className={styles.closingBlobV4}><Rocket size={72} /></span>
        </div>
      </section>
      <footer className={styles.siteFooterV4}>
        <div className={styles.footerDividerV4} />
        <div className={styles.siteFooterRowV4}>
          <Brand />
          <p>CLEVER · LEVERAGE · HUMAN-CENTRIC · GREATER GOOD</p>
          <span>PORTFOLIO EXPERIENCE · {new Date().getFullYear()}</span>
        </div>
      </footer>
      </div>
    </main>
  </div>;
}
