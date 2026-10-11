'use client';

import Image from 'next/image';
import { useEffect, useState, type ReactNode } from 'react';
import { ArrowRight, BarChart3, Check, Compass, FolderKanban, Heart, Menu, Play, Rocket, Share2, Sparkles, Trophy, Wrench, X } from 'lucide-react';

import PublicPortfolioGallery from '@/components/portfolio/PublicPortfolioGallery';
import type { PortfolioExperienceModel } from '@/lib/publicPortfolioExperience';
import styles from './PublicPortfolioExperience.module.css';

const classNames = (...names: Array<string | false | null | undefined>) => names.filter(Boolean).join(' ');

function Brand() {
  return <a href="#home" className={styles.brand} aria-label="Clevio portfolio home">
    <Image src="/images/clevio-logo.png.png" alt="Clevio Innovator Camp" width={146} height={50} priority />
  </a>;
}

function Navigation() {
  const [open, setOpen] = useState(false);
  const links = [['Projects', '#projects'], ['Journey', '#journey'], ['Skills', '#skills'], ['Reflection', '#reflection']] as const;
  return <header className={styles.topbar}>
    <div className={classNames(styles.shell, styles.nav)}>
      <Brand />
      <nav className={classNames(styles.navlinks, open && styles.navlinksOpen)} aria-label="Portfolio navigation">
        {links.map(([label, href]) => <a key={href} href={href} onClick={() => setOpen(false)}>{label}</a>)}
      </nav>
      <a className={styles.shareButton} href="#projects"><Share2 size={16} /> Explore portfolio</a>
      <button type="button" className={styles.mobileMenu} onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-label={open ? 'Tutup menu' : 'Buka menu'}>{open ? <X size={21} /> : <Menu size={21} />}</button>
    </div>
  </header>;
}

function UniverseStage({ model }: { model: PortfolioExperienceModel }) {
  return <div className={styles.heroArt} aria-label={model.firstName + ' learning universe'}>
    <div className={styles.universeStage}>
      <i className={classNames(styles.glow, styles.glowA)} /><i className={classNames(styles.glow, styles.glowB)} />
      <div className={styles.stars} aria-hidden="true">{Array.from({ length: 11 }, (_, index) => <i key={index} />)}</div>
      <i className={classNames(styles.orbit, styles.orbitOne)} /><i className={classNames(styles.orbit, styles.orbitTwo)} /><i className={classNames(styles.orbit, styles.orbitThree)} />
      <span className={classNames(styles.universeTag, styles.tagExplore)}>Explore</span><span className={classNames(styles.universeTag, styles.tagCreate)}>Create</span><span className={classNames(styles.universeTag, styles.tagGrow)}>Grow</span>
      <div className={styles.planetShell}><div className={styles.planetAura} /><div className={styles.planetCore}><i className={styles.planetGrid} /><strong>{model.initials}</strong><span>Young creator</span></div></div>
      <p className={styles.universeCaption}><i /> {model.firstName}&apos;s learning universe</p>
    </div>
  </div>;
}

function Stat({ icon, value, label }: { icon: ReactNode; value: string | number; label: string }) {
  return <div className={styles.stat}><span className={styles.iconBox}>{icon}</span><div><strong>{value}</strong><span>{label}</span></div></div>;
}

function LearningPath({ model }: { model: PortfolioExperienceModel }) {
  const blocks = model.learningJourney.flatMap((level) => level.blocks.map((block) => ({ ...block, levelName: level.levelName })));
  const preview = blocks.slice(0, 4);
  return <section id="journey" className={styles.section}>
    <div className={styles.sectionHead}><div><div className={styles.titleWrap}><span className={styles.sectionIcon}><BarChart3 size={19} /></span><h2>My Learning Journey</h2></div><p>Progress through learning levels and blocks, one step at a time.</p></div><a className={styles.secondaryButton} href="#skills">Explore skills <ArrowRight size={16} /></a></div>
    {preview.length > 0 ? <div className={styles.learningPath}><i className={styles.learningLine} />
      {preview.map((block) => {
        const state = block.status === 'COMPLETED' ? 'completed' : block.status === 'IN_PROGRESS' ? 'current' : 'next';
        return <article className={classNames(styles.learningStep, styles[state])} key={block.id}><span className={styles.learningNode}>{state === 'completed' ? <Check size={16} /> : state === 'current' ? <i /> : null}</span><div className={styles.learningCard}><b>{state === 'completed' ? 'Completed' : state === 'current' ? 'Current' : 'Next'}</b><small>{block.levelName}</small><h3>{block.blockName}</h3><p>{state === 'completed' ? 'Block telah diselesaikan dalam perjalanan belajar.' : state === 'current' ? 'Block yang sedang dipelajari saat ini.' : 'Block berikutnya dalam perjalanan belajar.'}</p></div></article>;
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
  return <div className={styles.root}>
    <Navigation />
    <main className={styles.shell}>
      <section id="home" className={styles.hero}>
        <div className={styles.heroCopy}><p className={styles.eyebrow}>A Young Creator&apos;s Journey</p><h1>{model.fullName}</h1><h2>This isn&apos;t a report.<br />It&apos;s {model.firstName}&apos;s learning universe.</h2><p>Projects, experiments, ideas, and growth shaped by curiosity and a dream for a brighter future.</p><div className={styles.heroActions}><a className={styles.primaryButton} href="#projects">Explore Projects <ArrowRight size={18} /></a><a className={styles.secondaryButton} href="#journey"><Play size={16} /> Watch Journey</a></div></div>
        <UniverseStage model={model} />
      </section>
      <section className={styles.stats} aria-label="Portfolio statistics"><Stat icon={<FolderKanban size={20} />} value={model.stats.projects} label="Projects Created" /><Stat icon={<BarChart3 size={20} />} value={completedBlocks} label="Blocks Completed" /><Stat icon={<Wrench size={20} />} value={tools.length} label="Tools Explored" /><Stat icon={<Compass size={20} />} value={new Date().getFullYear()} label="Learning Journey" /><div className={styles.achievementStat}><span className={styles.iconBox}><Trophy size={20} /></span><div><small>Latest achievement</small><strong>{model.featuredProject?.snapshot.title || 'Learning journey started'}</strong><span>Synced from portfolio data</span></div></div></section>
      <PublicPortfolioGallery projects={model.projects} />
      <LearningPath model={model} />
      <section id="skills" className={styles.bottomGrid}>
        <article className={styles.infoCard}><h2><Wrench size={19} /> Skills I&apos;m Building</h2><p>Tools and skills explored through approved projects.</p><div className={styles.skillIcons}>{tools.length > 0 ? tools.map((tool) => <span className={styles.skill} key={tool}><i>{tool.slice(0, 1).toUpperCase()}</i>{tool}</span>) : <span className={styles.noData}>Belum ada tools pada project yang disetujui.</span>}</div></article>
        <article className={styles.infoCard}><h2><Heart size={19} /> Strengths In My Work</h2><p>Skills visible in published projects, not an invented personality assessment.</p><div className={styles.chips}>{model.journey.length > 0 ? model.journey.map((skill) => <span className={styles.chip} key={skill.label}>{skill.label}</span>) : <span className={styles.noData}>Skill akan muncul setelah ada project yang disetujui.</span>}</div></article>
        <article className={styles.infoCard} id="reflection"><h2><Sparkles size={19} /> My Reflection</h2><p className={styles.reflection}>“{model.latestStory.learningReflection}”</p><p className={styles.attribution}>— {model.firstName}</p></article>
      </section>
      <section className={styles.footerBannerV4} aria-label="Closing">
        <div className={styles.closingCopyV4}>
          <div className={styles.closingEyebrowV4}><Sparkles size={18} /> WHAT&apos;S NEXT</div>
          <h2>KEEP EXPLORING.<br />KEEP CREATING.</h2>
          <p>{model.latestStory.nextSteps}</p>
          <a className={styles.closingCtaV4} href="https://clev.io" target="_blank" rel="noreferrer">Discover Clevio <ArrowRight size={17} /></a>
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
    </main>
  </div>;
}
