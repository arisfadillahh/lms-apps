'use client';

import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Expand,
  Minimize2,
  Play,
  RotateCcw,
  Sparkles,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { REPORT_STORY_OVERRIDES } from './ReportStoryExperience.overrides';
import { REPORT_STORY_CSS } from './ReportStoryExperience.styles';

type StoryCompetency = {
  name: string;
  percentage: number;
  description: string;
};

type StoryReflection = {
  question: string;
  answer: string;
};

type ReportStoryExperienceProps = {
  studentName: string;
  reportTitle: string;
  contextLabel: string;
  coachName: string;
  publishedDate: string;
  score: number;
  grade: string;
  performanceLabel: string;
  performanceSummary: string;
  competencies: StoryCompetency[];
  lessons: string[];
  reflections: StoryReflection[];
};

const SCENES = [
  { id: 'intro', label: 'Pembuka' },
  { id: 'recap', label: 'Rekap' },
  { id: 'stats', label: 'Statistik' },
  { id: 'materials', label: 'Materi' },
  { id: 'coach', label: 'Coach' },
  { id: 'reflection', label: 'Refleksi' },
  { id: 'finish', label: 'Selesai' },
] as const;

const clampPercentage = (value: number) => Math.max(0, Math.min(100, value));

function polygonPoints(cx: number, cy: number, radius: number, sides: number, scale = 1) {
  return Array.from({ length: sides }, (_, index) => {
    const angle = -Math.PI / 2 + index * (Math.PI * 2 / sides);
    return `${cx + Math.cos(angle) * radius * scale},${cy + Math.sin(angle) * radius * scale}`;
  }).join(' ');
}

export default function ReportStoryExperience(props: ReportStoryExperienceProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [animatedScore, setAnimatedScore] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const storyRootRef = useRef<HTMLDivElement | null>(null);
  const touchStartX = useRef<number | null>(null);

  const firstName = props.studentName.trim().split(/\s+/)[0] || 'Coder';
  const initials = props.studentName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'CC';

  const competencies = useMemo(
    () => props.competencies.slice(0, 5).map((item) => ({
      ...item,
      percentage: clampPercentage(item.percentage),
    })),
    [props.competencies],
  );
  const rankedCompetencies = useMemo(
    () => [...competencies].sort((a, b) => b.percentage - a.percentage),
    [competencies],
  );
  const visibleLessons = props.lessons.slice(0, 8);
  const visibleReflections = props.reflections.slice(0, 4);
  const currentScene = SCENES[currentIndex];
  const isFirst = currentIndex === 0;
  const isLast = currentIndex === SCENES.length - 1;

  const closeStory = useCallback(async () => {
    if (document.fullscreenElement) await document.exitFullscreen().catch(() => undefined);
    setIsOpen(false);
  }, []);

  const openStory = useCallback(() => {
    setCurrentIndex(0);
    setIsOpen(true);
  }, []);

  const goNext = useCallback(() => {
    if (isLast) {
      void closeStory();
      return;
    }
    setCurrentIndex((index) => Math.min(index + 1, SCENES.length - 1));
  }, [closeStory, isLast]);

  const goPrevious = useCallback(() => {
    setCurrentIndex((index) => Math.max(index - 1, 0));
  }, []);

  const toggleFullscreen = useCallback(async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await storyRootRef.current?.requestFullscreen();
    } catch {
      // Fullscreen may be blocked by the browser; the story remains fully usable.
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (event: KeyboardEvent) => {
      const isButton = event.target instanceof HTMLButtonElement;
      if (!isButton && (event.key === 'ArrowRight' || event.key === ' ' || event.key === 'PageDown')) goNext();
      if (event.key === 'ArrowLeft' || event.key === 'PageUp') goPrevious();
      if (event.key === 'Home') setCurrentIndex(0);
      if (event.key === 'End') setCurrentIndex(SCENES.length - 1);
      if (event.key === 'Escape') void closeStory();
    };
    const onFullscreenChange = () => setIsFullscreen(Boolean(document.fullscreenElement));

    window.addEventListener('keydown', onKeyDown);
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('fullscreenchange', onFullscreenChange);
    };
  }, [closeStory, goNext, goPrevious, isOpen]);

  useEffect(() => {
    if (!isOpen || (currentScene.id !== 'recap' && currentScene.id !== 'finish')) return;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reducedMotion) {
      const reducedMotionFrame = window.requestAnimationFrame(() => setAnimatedScore(props.score));
      return () => window.cancelAnimationFrame(reducedMotionFrame);
    }

    let frame = 0;
    const start = performance.now();
    const animate = (now: number) => {
      const progress = Math.min(1, (now - start) / 1100);
      setAnimatedScore(Math.round(props.score * (1 - Math.pow(1 - progress, 3))));
      if (progress < 1) frame = window.requestAnimationFrame(animate);
    };
    frame = window.requestAnimationFrame(animate);
    return () => window.cancelAnimationFrame(frame);
  }, [currentScene.id, isOpen, props.score]);

  const handleTouchEnd = (event: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const distance = event.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(distance) < 55) return;
    if (distance < 0) goNext();
    else goPrevious();
  };

  const radar = useMemo(() => {
    const items = competencies.length >= 3 ? competencies : [
      { name: 'Progress', percentage: clampPercentage(props.score), description: '' },
      { name: 'Konsistensi', percentage: clampPercentage(props.score), description: '' },
      { name: 'Kreativitas', percentage: clampPercentage(props.score), description: '' },
    ];
    const cx = 250;
    const cy = 250;
    const radius = 165;
    const shape = items.map((item, index) => {
      const angle = -Math.PI / 2 + index * (Math.PI * 2 / items.length);
      const valueRadius = radius * item.percentage / 100;
      return `${cx + Math.cos(angle) * valueRadius},${cy + Math.sin(angle) * valueRadius}`;
    }).join(' ');
    return { items, cx, cy, radius, shape };
  }, [competencies, props.score]);

  return (
    <>
      <style>{REPORT_STORY_CSS + REPORT_STORY_OVERRIDES}</style>
      <button
        type="button"
        onClick={openStory}
        title="Putar ulang perjalanan rapor"
        className="story-replay-trigger inline-flex h-10 w-10 shrink-0 items-center justify-center gap-2 rounded-lg border border-[#cfdde8] bg-white text-[#22367b] transition hover:border-[#22367b] hover:bg-[#f6f9fd] focus:outline-none focus:ring-4 focus:ring-[#00b0d7]/20 sm:w-auto sm:px-4 print:hidden"
      >
        <Play size={16} fill="currentColor" aria-hidden="true" />
        <span className="hidden text-sm font-extrabold sm:inline">Putar ulang cerita</span>
        <span className="sr-only sm:hidden">Putar ulang cerita rapor</span>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            ref={storyRootRef}
            role="dialog"
            aria-modal="true"
            aria-label={`Perjalanan rapor ${props.studentName}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, y: -18, scale: 0.992 }}
            transition={{ duration: 0.42, ease: [0.2, 0.8, 0.2, 1] }}
            className="clevio-story print:hidden"
            onTouchStart={(event) => { touchStartX.current = event.touches[0].clientX; }}
            onTouchEnd={handleTouchEnd}
          >
            <div className="grid" aria-hidden="true" />
            <div className="glow" aria-hidden="true" />
            <div className="noise" aria-hidden="true" />
            {currentScene.id === 'finish' && (
              <div className="confetti" aria-hidden="true">
                {Array.from({ length: 45 }, (_, index) => (
                  <i
                    key={index}
                    style={{
                      left: `${(index * 37) % 100}%`,
                      background: ['#b9e658', '#58d6ff', '#a793ff', '#ffb457', '#ffffff'][index % 5],
                      animationDelay: `${(index % 8) * 0.08}s`,
                      animationDuration: `${2.2 + (index % 7) * 0.2}s`,
                      transform: `rotate(${index * 29}deg)`,
                      '--drift': `${((index * 53) % 260) - 130}px`,
                    } as React.CSSProperties}
                  />
                ))}
              </div>
            )}

            <main className="app" aria-label="Clevio interactive performance report">
              <header className="topbar">
                <div className="brand" aria-label="Clevio Innovator Camp">
                  <span className="brand-mark" aria-hidden="true" />
                  <span>CLEV.IO</span>
                </div>

                <nav className="progress" aria-label="Tahapan laporan">
                  {SCENES.map((scene, index) => (
                    <button
                      key={scene.id}
                      type="button"
                      className={`progress-segment ${index < currentIndex ? 'done' : ''} ${index === currentIndex ? 'active' : ''}`}
                      onClick={() => setCurrentIndex(index)}
                      aria-label={`Buka bagian ${index + 1}: ${scene.label}`}
                      aria-current={index === currentIndex ? 'step' : undefined}
                    />
                  ))}
                </nav>

                <div className="top-actions">
                  <button type="button" className="story-skip" onClick={() => void closeStory()} aria-label="Lewati cerita dan lihat rapor lengkap">
                    <span>Lewati</span><X aria-hidden="true" />
                  </button>
                  <button type="button" className="icon-btn" onClick={() => void toggleFullscreen()} aria-label={isFullscreen ? 'Keluar dari layar penuh' : 'Buka layar penuh'} title={isFullscreen ? 'Keluar layar penuh' : 'Layar penuh'}>
                    {isFullscreen ? <Minimize2 aria-hidden="true" /> : <Expand aria-hidden="true" />}
                  </button>
                </div>
              </header>

              <section className="stage" aria-live="polite">
                <article className={`slide ${currentScene.id === 'intro' ? 'active' : ''}`} aria-hidden={currentScene.id !== 'intro'}>
                  <div className="slide-inner intro-layout">
                    <div className="intro-copy">
                      <p className="eyebrow">{props.reportTitle} · {props.publishedDate}</p>
                      <h1 className="display">Ini cerita <span className="accent">{firstName}</span> selama satu block.</h1>
                      <p className="lead">Bukan cuma angka. Kita akan melihat kemampuan yang berkembang, tantangan yang berhasil dilewati, dan langkah berikutnya.</p>
                      <div className="intro-actions">
                        <button className="primary-btn" type="button" onClick={goNext}>Mulai perjalanan <ArrowRight aria-hidden="true" /></button>
                        <button className="secondary-btn" type="button" onClick={() => void closeStory()}>Langsung lihat rapor</button>
                      </div>
                    </div>
                    <div className="identity-orbit" aria-hidden="true">
                      <div className="orbit-line" />
                      <div className="orbit-line two" />
                      <div className="identity-core"><div className="monogram">{initials}</div></div>
                      <div className="identity-tag">
                        <strong>{props.studentName}</strong>
                        <span>{props.contextLabel}</span>
                        <span>Coach {props.coachName}</span>
                      </div>
                    </div>
                  </div>
                </article>

                <article className={`slide ${currentScene.id === 'recap' ? 'active' : ''}`} aria-hidden={currentScene.id !== 'recap'}>
                  <div className="slide-inner recap-layout">
                    <div className="score-visual" aria-label={`Skor keseluruhan ${props.score}`}>
                      <div className="score-rings">
                        <div className="score-ring" style={{ '--score': animatedScore } as React.CSSProperties} />
                        <div className="score-ring secondary" />
                        <div className="score-center"><div className="score-number">{animatedScore}</div><div className="score-total">dari 100</div></div>
                        <div className="grade-chip"><span>{props.grade}</span></div>
                        <div className="grade-label">{props.performanceLabel}</div>
                      </div>
                    </div>
                    <div className="recap-copy">
                      <p className="eyebrow">Season Recap</p>
                      <h2 className="display medium">Performa block ini: <span className="accent">{props.performanceLabel}</span></h2>
                      <p className="lead">Skor keseluruhan menunjukkan kemampuan memahami konsep dan menerapkannya ke dalam project secara konsisten.</p>
                      <blockquote>{props.performanceSummary}</blockquote>
                    </div>
                  </div>
                </article>

                <article className={`slide ${currentScene.id === 'stats' ? 'active' : ''}`} aria-hidden={currentScene.id !== 'stats'}>
                  <div className="slide-inner stats-layout">
                    <div className="radar-wrap">
                      <svg id="radarChart" viewBox="0 0 500 500" role="img" aria-label="Grafik kompetensi">
                        {[1, 0.8, 0.6, 0.4, 0.2].map((scale) => <polygon key={scale} className="radar-grid" points={polygonPoints(radar.cx, radar.cy, radar.radius, radar.items.length, scale)} />)}
                        {radar.items.map((item, index) => {
                          const angle = -Math.PI / 2 + index * (Math.PI * 2 / radar.items.length);
                          const valueRadius = radar.radius * item.percentage / 100;
                          const lx = radar.cx + Math.cos(angle) * (radar.radius + 48);
                          const ly = radar.cy + Math.sin(angle) * (radar.radius + 42);
                          const anchor = lx < radar.cx - 25 ? 'end' : lx > radar.cx + 25 ? 'start' : 'middle';
                          return (
                            <g key={item.name}>
                              <line className="radar-axis" x1={radar.cx} y1={radar.cy} x2={radar.cx + Math.cos(angle) * radar.radius} y2={radar.cy + Math.sin(angle) * radar.radius} />
                              <circle className="radar-dot" cx={radar.cx + Math.cos(angle) * valueRadius} cy={radar.cy + Math.sin(angle) * valueRadius} r="7" />
                              <text className="radar-label" x={lx} y={ly} textAnchor={anchor}>{item.name}</text>
                            </g>
                          );
                        })}
                        <polygon className="radar-shape" points={radar.shape} />
                      </svg>
                    </div>
                    <div>
                      <p className="eyebrow">Power Stats</p>
                      <h2 className="display medium">Inilah kemampuan yang paling <span className="accent">bersinar.</span></h2>
                      <p className="lead">Setiap statistik mewakili kemampuan yang terlihat selama proses belajar dan pengerjaan project.</p>
                      <div className="metric-list">
                        {competencies.map((item) => (
                          <div className="metric-row" key={item.name}>
                            <div className="metric-icon"><Sparkles aria-hidden="true" /></div>
                            <div className="metric-copy"><strong>{item.name}</strong><div className="metric-track"><span style={{ '--value': item.percentage } as React.CSSProperties} /></div></div>
                            <div className="metric-score">{item.percentage}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </article>

                <article className={`slide ${currentScene.id === 'materials' ? 'active' : ''}`} aria-hidden={currentScene.id !== 'materials'}>
                  <div className="slide-inner skills-layout">
                    <div>
                      <p className="eyebrow">Skills Unlocked</p>
                      <h2 className="display medium">{props.lessons.length} materi berhasil <span className="accent">dikuasai.</span></h2>
                      <p className="lead">Setiap materi adalah bekal baru untuk membuat karya yang lebih hidup, lebih matang, dan lebih berani.</p>
                      <div className="unlocked">Semua materi block selesai</div>
                    </div>
                    <div className="skill-path">
                      {visibleLessons.map((lesson, index) => (
                        <div className="skill-node" key={`${lesson}-${index}`}>
                          <div><div className="skill-badge" style={{ '--i': index } as React.CSSProperties}><Check aria-hidden="true" /></div><strong>{lesson}</strong></div>
                        </div>
                      ))}
                    </div>
                  </div>
                </article>

                <article className={`slide ${currentScene.id === 'coach' ? 'active' : ''}`} aria-hidden={currentScene.id !== 'coach'}>
                  <div className="slide-inner coach-layout">
                    <div>
                      <p className="eyebrow">Coach&apos;s Scouting Report</p>
                      <h2 className="display medium">Yang sudah kuat, dan yang siap <span className="accent">naik level.</span></h2>
                      <div className="coach-quote">“{rankedCompetencies[0]?.description || props.performanceSummary}”</div>
                      <div className="coach-signature">— Coach {props.coachName}</div>
                    </div>
                    <div className="coach-columns">
                      <section className="coach-card strength"><h3>Kekuatan utama</h3><ul>{rankedCompetencies.slice(0, 3).map((item) => <li key={item.name}>{item.name} · {item.percentage}%</li>)}</ul></section>
                      <section className="coach-card growth"><h3>Upgrade berikutnya</h3><ul>{[...rankedCompetencies].reverse().slice(0, 3).map((item) => <li key={item.name}>Terus kembangkan {item.name.toLowerCase()}.</li>)}</ul></section>
                    </div>
                  </div>
                </article>

                <article className={`slide ${currentScene.id === 'reflection' ? 'active' : ''}`} aria-hidden={currentScene.id !== 'reflection'}>
                  <div className="slide-inner reflection-layout">
                    <div className="project-art" aria-hidden="true"><div className="project-ring" /><div className="project-cube"><span /><span /><span /></div></div>
                    <div>
                      <p className="eyebrow">Project Reflection</p>
                      <h2 className="display medium">Cerita di balik <span className="accent">project-nya.</span></h2>
                      <p className="lead">Refleksi membantu coder memahami prosesnya sendiri, bukan hanya melihat hasil akhirnya.</p>
                      <div className="reflection-list">
                        {(visibleReflections.length ? visibleReflections : [{ question: 'Bagaimana perjalanan block ini?', answer: props.performanceSummary }]).map((item, index) => (
                          <div className="reflection-item" key={`${item.question}-${index}`}><div className="reflection-index">{String(index + 1).padStart(2, '0')}</div><div><h3>{item.question}</h3><p>{item.answer}</p></div></div>
                        ))}
                      </div>
                    </div>
                  </div>
                </article>

                <article className={`slide ${currentScene.id === 'finish' ? 'active' : ''}`} aria-hidden={currentScene.id !== 'finish'}>
                  <div className="slide-inner final-layout">
                    <div className="final-emblem" aria-hidden="true"><Sparkles /></div>
                    <p className="eyebrow">Quest Complete</p>
                    <h2 className="display medium">{firstName} sudah menyelesaikan block ini dengan <span className="accent">luar biasa.</span></h2>
                    <p className="lead">Progress terbaik bukan tentang menjadi sempurna, tetapi tentang terus mencoba, membuat, mengevaluasi, dan berkembang.</p>
                    <div className="mini-summary"><span><strong>{animatedScore}</strong>Overall</span><span><strong>{props.grade}</strong>Grade</span><span><strong>{props.lessons.length}</strong>Materi</span></div>
                    <div className="final-actions">
                      <button className="primary-btn" type="button" onClick={() => void closeStory()}>Lihat laporan lengkap <ArrowRight aria-hidden="true" /></button>
                      <button className="secondary-btn" type="button" onClick={() => setCurrentIndex(0)}>Putar ulang <RotateCcw aria-hidden="true" /></button>
                    </div>
                  </div>
                </article>
              </section>

              <footer className="bottom-nav">
                <button className="nav-btn" type="button" onClick={goPrevious} disabled={isFirst} aria-label="Sebelumnya"><ArrowLeft aria-hidden="true" /></button>
                <div className="nav-hint">{currentIndex + 1} / {SCENES.length} · {currentScene.label}</div>
                <button className="nav-btn" type="button" onClick={goNext} aria-label={isLast ? 'Lihat rapor lengkap' : 'Berikutnya'}><ArrowRight aria-hidden="true" /></button>
              </footer>
            </main>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
