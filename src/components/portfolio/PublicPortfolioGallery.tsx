'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ArrowRight, ExternalLink, FolderKanban, Gamepad2, Github, Play, Sparkles, X } from 'lucide-react';

import type { PublishedPortfolioSnapshot } from '@/lib/coderPortfolio';
import { lockDocumentScroll } from '@/lib/documentScrollLock';
import styles from './PublicPortfolioExperience.module.css';
import modalStyles from './PublicPortfolioModalLandscape.module.css';

export type PublicProject = { id: string; snapshot: PublishedPortfolioSnapshot; publishedAt: string | null };

const ACCENTS = ['#86c5ee', '#8ac278', '#53b9df', '#ffd6ca', '#b8c5d4'];

export default function PublicPortfolioGallery({ projects }: { projects: PublicProject[] }) {
  const [selected, setSelected] = useState<PublicProject | null>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const openProject = (project: PublicProject, trigger: HTMLButtonElement) => {
    returnFocusRef.current = trigger;
    setSelected(project);
  };
  const [filter, setFilter] = useState('All');
  const tools = ['All', ...Array.from(new Set(projects.flatMap((project) => project.snapshot.tools)))];
  const shownProjects = filter === 'All' ? projects : projects.filter((project) => project.snapshot.tools.includes(filter));

  useEffect(() => {
    if (!selected) return;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') setSelected(null); };
    const unlockDocumentScroll = lockDocumentScroll();
    const page = document.querySelector<HTMLElement>('[data-public-portfolio]');
    const previousInert = page?.inert ?? false;
    if (page) page.inert = true;
    window.addEventListener('keydown', onKeyDown);
    return () => {
      if (page) page.inert = previousInert;
      unlockDocumentScroll();
      window.removeEventListener('keydown', onKeyDown);
      requestAnimationFrame(() => { if (returnFocusRef.current?.isConnected) returnFocusRef.current.focus(); });
    };
  }, [selected]);

  if (projects.length === 0) return <section id="projects" className={styles.emptyProjects}><Sparkles size={38} /><h2>Karya sedang dipersiapkan</h2><p>Project yang disetujui Coach akan tampil di portfolio ini.</p></section>;
  const featured = projects[0];
  return <>
    <section className={styles.gallerySection}>
      <div className={styles.sectionHead}><div className={styles.titleWrap}><span className={styles.sectionIcon}><Sparkles size={19} /></span><h2>Sorotan karya terbaru</h2></div><p>Sudah disetujui Coach, siap dieksplorasi.</p></div>
      <button type="button" className={styles.feature} onClick={(event) => openProject(featured, event.currentTarget)} aria-label={'Lihat project ' + featured.snapshot.title}>
        <div className={styles.featureMedia}>{featured.snapshot.screenshots[0] ? <img src={featured.snapshot.screenshots[0].publicUrl} alt="" loading="lazy" /> : <Gamepad2 size={88} />}<span className={styles.featurePlay}><ArrowRight size={22} /></span></div>
        <div className={styles.featureCopy}><span className={styles.projectTag}>{featured.snapshot.projectType}</span><h3>{featured.snapshot.title}</h3><p>{featured.snapshot.summary}</p><div className={styles.chips}>{featured.snapshot.skills.slice(0, 4).map((skill) => <span className={styles.chip} key={skill}>{skill}</span>)}</div><span className={styles.featureLink}>Lihat detail karya <ArrowRight size={17} /></span></div>
      </button>
    </section>
    <section id="projects" className={styles.gallerySection}>
      <div className={styles.sectionHead}><div><div className={styles.titleWrap}><span className={styles.sectionIcon}><FolderKanban size={19} /></span><h2>Jelajahi karya</h2></div><p>Pilih kartu untuk membaca cerita, melihat gambar, atau mencoba karya.</p></div><div className={styles.tabs} role="group" aria-label="Filter karya berdasarkan aplikasi">{tools.map((tool) => <button type="button" key={tool} className={filter === tool ? styles.activeTab : styles.tab} aria-pressed={filter === tool} onClick={() => setFilter(tool)}>{tool === 'All' ? `Semua (${projects.length})` : tool}</button>)}</div></div>
      <p className={styles.projectCount} role="status">{shownProjects.length} karya{filter !== 'All' ? ` dibuat dengan ${filter}` : ' untuk dijelajahi'}</p>
      <div className={styles.projects}>{shownProjects.map((project, index) => <ProjectCard key={project.id} project={project} index={index} onOpen={openProject} />)}</div>
      {shownProjects.length === 0 && <p className={styles.filteredEmpty}>Belum ada project untuk tool ini.</p>}
    </section>
    {selected && createPortal(<ProjectModal project={selected} onClose={() => setSelected(null)} />, document.body)}
  </>;
}

function ProjectCard({ project, index, onOpen }: { project: PublicProject; index: number; onOpen: (project: PublicProject, trigger: HTMLButtonElement) => void }) {
  const cover = project.snapshot.screenshots[0];
  return <button type="button" className={styles.project} onClick={(event) => onOpen(project, event.currentTarget)} aria-label={'Buka project ' + project.snapshot.title}>
    <span className={styles.thumb} style={{ background: 'linear-gradient(150deg,' + ACCENTS[index % ACCENTS.length] + ',#dce8ff)' }}>{cover ? <img src={cover.publicUrl} alt="" loading="lazy" /> : <Gamepad2 size={44} />}<span><ArrowRight size={16} /></span></span>
    <span className={styles.projectBody}><small>{project.snapshot.tools[0] || project.snapshot.projectType} · {project.snapshot.programType === 'EKSKUL' ? 'Ekskul' : 'Weekly'}</small><strong>{project.snapshot.title}</strong><em>{project.snapshot.summary}</em><span className={styles.cardAction}>Lihat karya <ArrowRight size={15} /></span></span>
  </button>;
}

function ProjectModal({ project, onClose }: { project: PublicProject; onClose: () => void }) {
  const dialogRef = useRef<HTMLElement>(null);
  const [shotIndex, setShotIndex] = useState(0);
  useEffect(() => {
    dialogRef.current?.querySelector<HTMLElement>('button')?.focus();
  }, []);
  const snapshot = project.snapshot;
  const actionLinks = [
    snapshot.playableUrl && { href: snapshot.playableUrl, label: 'Mainkan Project', icon: <ExternalLink size={17} /> },
    snapshot.repositoryUrl && { href: snapshot.repositoryUrl, label: 'Source Code', icon: <Github size={17} /> },
    snapshot.videoUrl && { href: snapshot.videoUrl, label: 'Video Demo', icon: <Play size={17} /> },
  ].filter(Boolean) as Array<{ href: string; label: string; icon: ReactNode }>;
  const skills = [...snapshot.tools, ...snapshot.skills].join(' · ') || 'Skill akan tercatat setelah project direview.';
  const projectFacts = [...new Set([snapshot.projectType, ...snapshot.tools, ...snapshot.skills])].filter(Boolean).slice(0, 6);
  const publishedLabel = project.publishedAt && Number.isFinite(Date.parse(project.publishedAt))
    ? new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(project.publishedAt))
    : null;
  return <div className={styles.modalShellV4} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <article ref={dialogRef} className={`${styles.projectModalV4} ${modalStyles.projectModal}`} role="dialog" aria-modal="true" aria-labelledby="public-project-title" onKeyDown={(event) => {
      if (event.key !== 'Tab') return;
      const targets = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), a[href]') ?? []);
      const first = targets[0];
      const last = targets.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }}>
      <button type="button" className={styles.closeButtonV4} onClick={onClose} aria-label="Tutup detail project"><X size={20} /></button>
      <div className={modalStyles.mediaPane}>
        <div className={`${styles.modalVisualV4} ${modalStyles.visual}`}>
          {snapshot.screenshots[shotIndex] ? <img src={snapshot.screenshots[shotIndex].publicUrl} alt={`Tampilan ${shotIndex + 1} dari ${snapshot.title}`} /> : <Gamepad2 size={82} />}
          <i className={styles.modalVisualShadeV4} />
          <span className={styles.modalBadgeV4}>{snapshot.tools[0] || snapshot.projectType}</span>
        </div>
        {snapshot.screenshots.length > 1 && <div className={styles.screenshotPicker} role="group" aria-label="Pilih gambar karya">{snapshot.screenshots.map((shot, index) => <button type="button" key={index} aria-label={`Lihat gambar ${index + 1}`} aria-pressed={shotIndex === index} onClick={() => setShotIndex(index)}><img src={shot.publicUrl} alt="" loading="lazy" /></button>)}</div>}
        <div className={modalStyles.mediaMeta}>
          <span>{snapshot.programType === 'EKSKUL' ? 'KARYA EKSKUL' : 'KARYA WEEKLY'}</span>
          <div>{projectFacts.map((fact) => <b key={fact}>{fact}</b>)}</div>
          {publishedLabel && <small>Dipublikasikan {publishedLabel}</small>}
        </div>
      </div>
      <div className={`${styles.modalContentV4} ${modalStyles.content}`}>
        <div className={styles.modalKickerV4}>Cerita di balik karya</div>
        <h2 id="public-project-title">{snapshot.title}</h2>
        <p className={styles.modalLeadV4}>{snapshot.summary}</p>
        {actionLinks.length > 0 ? <><div className={styles.modalActionsV4}>{actionLinks.map((link) => <a key={link.label} href={link.href} target="_blank" rel="noreferrer">{link.icon}{link.label}</a>)}</div><p className={styles.externalHint}>Link dibuka di tab baru.</p></> : <p className={styles.externalHint}>Karya ini ditampilkan lewat gambar dan cerita. Link untuk mencoba belum tersedia.</p>}
        <div className={styles.storyGridV4}>
          {snapshot.howToPlay && <StoryBlock number="▶" title="Cara mencoba karya" value={snapshot.howToPlay} />}
          <StoryBlock number="01" title="Tentang karyaku" value={snapshot.description} />
          <StoryBlock number="02" title="Yang aku pelajari" value={snapshot.learningReflection} />
          <StoryBlock number="03" title="Keahlian yang dilatih" value={skills} />
        </div>
        <div className={styles.modalReflectionV4}><Sparkles size={22} /><p>“Kontribusiku: {snapshot.roleContribution} Berikutnya, {snapshot.nextSteps}”</p></div>
      </div>
    </article>
  </div>;
}

function StoryBlock({ number, title, value }: { number: string; title: string; value: string }) {
  return <section className={styles.storyBlockV4}><span>{number}</span><div><h3>{title}</h3><p>{value}</p></div></section>;
}
