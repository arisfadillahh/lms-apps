'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowRight, ExternalLink, FolderKanban, Gamepad2, Github, Play, Sparkles, X } from 'lucide-react';

import type { PublishedPortfolioSnapshot } from '@/lib/coderPortfolio';
import { lockDocumentScroll } from '@/lib/documentScrollLock';
import styles from './PublicPortfolioExperience.module.css';

export type PublicProject = { id: string; snapshot: PublishedPortfolioSnapshot; publishedAt: string | null };

const ACCENTS = ['#86c5ee', '#8ac278', '#53b9df', '#ffd6ca', '#b8c5d4'];

export default function PublicPortfolioGallery({ projects }: { projects: PublicProject[] }) {
  const [selected, setSelected] = useState<PublicProject | null>(null);
  const [filter, setFilter] = useState('All');
  const tools = ['All', ...Array.from(new Set(projects.flatMap((project) => project.snapshot.tools))).slice(0, 4)];
  const shownProjects = filter === 'All' ? projects : projects.filter((project) => project.snapshot.tools.includes(filter));

  useEffect(() => {
    if (!selected) return;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') setSelected(null); };
    const unlockDocumentScroll = lockDocumentScroll();
    window.addEventListener('keydown', onKeyDown);
    return () => { unlockDocumentScroll(); window.removeEventListener('keydown', onKeyDown); };
  }, [selected]);

  if (projects.length === 0) return <section id="projects" className={styles.emptyProjects}><Sparkles size={38} /><h2>Karya sedang dipersiapkan</h2><p>Project yang disetujui Coach akan tampil di portfolio ini.</p></section>;
  const featured = projects[0];
  return <>
    <section className={styles.gallerySection}>
      <div className={styles.sectionHead}><div className={styles.titleWrap}><span className={styles.sectionIcon}><Sparkles size={19} /></span><h2>Featured Project</h2></div><p>Project terbaru yang sudah disetujui Coach.</p></div>
      <button type="button" className={styles.feature} onClick={() => setSelected(featured)} aria-label={'Lihat project ' + featured.snapshot.title}>
        <div className={styles.featureMedia}>{featured.snapshot.screenshots[0] ? <img src={featured.snapshot.screenshots[0].publicUrl} alt="" /> : <Gamepad2 size={88} />}<span className={styles.featurePlay}><Play size={22} fill="currentColor" /></span></div>
        <div className={styles.featureCopy}><span className={styles.projectTag}>{featured.snapshot.projectType}</span><h3>{featured.snapshot.title}</h3><p>{featured.snapshot.summary}</p><div className={styles.chips}>{featured.snapshot.skills.slice(0, 4).map((skill) => <span className={styles.chip} key={skill}>{skill}</span>)}</div><span className={styles.featureLink}>View Project <ArrowRight size={17} /></span></div>
      </button>
    </section>
    <section id="projects" className={styles.gallerySection}>
      <div className={styles.sectionHead}><div><div className={styles.titleWrap}><span className={styles.sectionIcon}><FolderKanban size={19} /></span><h2>My Projects</h2></div><p>A collection of things I&apos;ve created, experimented, and learned from.</p></div><div className={styles.tabs}>{tools.map((tool) => <button type="button" key={tool} className={filter === tool ? styles.activeTab : styles.tab} onClick={() => setFilter(tool)}>{tool}</button>)}</div></div>
      <div className={styles.projects}>{shownProjects.map((project, index) => <ProjectCard key={project.id} project={project} index={index} onOpen={setSelected} />)}</div>
      {shownProjects.length === 0 && <p className={styles.filteredEmpty}>Belum ada project untuk tool ini.</p>}
    </section>
    {selected && <ProjectModal project={selected} onClose={() => setSelected(null)} />}
  </>;
}

function ProjectCard({ project, index, onOpen }: { project: PublicProject; index: number; onOpen: (project: PublicProject) => void }) {
  const cover = project.snapshot.screenshots[0];
  return <button type="button" className={styles.project} onClick={() => onOpen(project)} aria-label={'Buka project ' + project.snapshot.title}>
    <span className={styles.thumb} style={{ background: 'linear-gradient(150deg,' + ACCENTS[index % ACCENTS.length] + ',#dce8ff)' }}>{cover ? <img src={cover.publicUrl} alt="" loading="lazy" /> : <Gamepad2 size={44} />}<span><ArrowRight size={16} /></span></span>
    <span className={styles.projectBody}><small>{project.snapshot.tools[0] || project.snapshot.projectType}</small><strong>{project.snapshot.title}</strong><em>{project.snapshot.summary}</em></span>
  </button>;
}

function ProjectModal({ project, onClose }: { project: PublicProject; onClose: () => void }) {
  const dialogRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialogRef.current?.querySelector<HTMLElement>('button')?.focus();
    return () => previous?.focus();
  }, []);
  const snapshot = project.snapshot;
  const actionLinks = [
    snapshot.playableUrl && { href: snapshot.playableUrl, label: 'Mainkan Project', icon: <ExternalLink size={17} /> },
    snapshot.repositoryUrl && { href: snapshot.repositoryUrl, label: 'Source Code', icon: <Github size={17} /> },
    snapshot.videoUrl && { href: snapshot.videoUrl, label: 'Video Demo', icon: <Play size={17} /> },
  ].filter(Boolean) as Array<{ href: string; label: string; icon: ReactNode }>;
  const skills = [...snapshot.tools, ...snapshot.skills].join(' · ') || 'Skill akan tercatat setelah project direview.';
  return <div className={styles.modalShellV4} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <article ref={dialogRef} className={styles.projectModalV4} role="dialog" aria-modal="true" aria-labelledby="public-project-title">
      <button type="button" className={styles.closeButtonV4} onClick={onClose} aria-label="Tutup detail project"><X size={20} /></button>
      <div className={styles.modalVisualV4}>
        {snapshot.screenshots[0] ? <img src={snapshot.screenshots[0].publicUrl} alt={'Tampilan project ' + snapshot.title} /> : <Gamepad2 size={82} />}
        <i className={styles.modalVisualShadeV4} />
        <span className={styles.modalBadgeV4}>{snapshot.tools[0] || snapshot.projectType}</span>
        <div className={styles.modalVisualCopyV4}><span>PROJECT STORY</span><strong>{snapshot.title}</strong></div>
      </div>
      <div className={styles.modalContentV4}>
        <div className={styles.modalKickerV4}>My Creation</div>
        <h2 id="public-project-title">{snapshot.title}</h2>
        <p className={styles.modalLeadV4}>{snapshot.summary}</p>
        <div className={styles.storyGridV4}>
          <StoryBlock number="01" title="What I Made" value={snapshot.description} />
          <StoryBlock number="02" title="What I Learned" value={snapshot.learningReflection} />
          <StoryBlock number="03" title="Skills Practiced" value={skills} />
        </div>
        <div className={styles.modalReflectionV4}><Sparkles size={22} /><p>“Kontribusiku: {snapshot.roleContribution} Berikutnya, {snapshot.nextSteps}”</p></div>
        {actionLinks.length > 0 && <div className={styles.modalActionsV4}>{actionLinks.map((link) => <a key={link.label} href={link.href} target="_blank" rel="noreferrer">{link.icon}{link.label}</a>)}</div>}
      </div>
    </article>
  </div>;
}

function StoryBlock({ number, title, value }: { number: string; title: string; value: string }) {
  return <section className={styles.storyBlockV4}><span>{number}</span><div><h3>{title}</h3><p>{value}</p></div></section>;
}
