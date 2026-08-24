'use client';

import { useMemo, useRef } from 'react';
import { CalendarDays, CheckCircle2, Flag, Lock, Rocket, Trophy, ChevronLeft, ChevronRight } from 'lucide-react';

type JourneyBlock = {
  blockId: string;
  name: string;
  status: 'UPCOMING' | 'CURRENT' | 'COMPLETED';
  startDate: string;
  endDate: string;
  orderIndex: number | null;
};

export type JourneyCourse = {
  classId: string;
  name: string;
  classType?: 'WEEKLY' | 'EKSKUL';
  levelName?: string | null;
  currentBlockProgress: number;
  completedBlocks: number;
  totalBlocks: number | null;
  journeyBlocks: JourneyBlock[];
};

// ── Layout constants ──────────────────────────────────────────────────────────
const COL_W = 280;   // px per node column
const PAD_X = 80;    // horizontal padding
const HIGH_CY = 95;   // bubble-centre Y for even nodes
const LOW_CY = 230;  // bubble-centre Y for odd nodes
const MAP_H = 410;  // total map height

export default function JourneyMap({ courses }: { courses: JourneyCourse[] }) {
  if (courses.length === 0) return null;
  return (
    <div className="flex flex-col gap-10 py-4 w-full">
      {courses.map((c) => <CourseJourney key={c.classId} course={c} />)}
    </div>
  );
}

function CourseJourney({ course }: { course: JourneyCourse }) {
  const blocks = course.journeyBlocks;
  const itemName = course.classType === 'EKSKUL' ? 'Sesi' : 'Blok';
  const total = course.totalBlocks ?? Math.max(blocks.length, 1);
  const journeyPct = Math.min(100, Math.round((course.completedBlocks / total) * 100));
  const blockPct = course.currentBlockProgress || 0;
  const totalWidth = PAD_X * 2 + blocks.length * COL_W;
  const firstOpenIndex = blocks.findIndex((block) => block.status !== 'COMPLETED');
  // Keep every block available on mobile, but lead with the latest active
  // milestone so the current journey state is visible without hunting.
  const mobileBlocks = firstOpenIndex === -1
    ? blocks
    : [...blocks.slice(firstOpenIndex), ...blocks.slice(0, firstOpenIndex)];
  const completedBefore = firstOpenIndex === -1 ? blocks.length : firstOpenIndex;

  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollMap = (offset: number) => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: offset, behavior: 'smooth' });
    }
  };

  // Node centre coordinates
  const nodes = useMemo(() =>
    blocks.map((_, i) => ({
      cx: PAD_X + i * COL_W + COL_W / 2,
      cy: i % 2 === 0 ? HIGH_CY : LOW_CY,
    })), [blocks]);

  // Full dashed background path
  const fullPath = useMemo(() => {
    if (nodes.length < 2) return '';
    let d = `M ${nodes[0].cx},${nodes[0].cy}`;
    for (let i = 1; i < nodes.length; i++) {
      const { cx: x0, cy: y0 } = nodes[i - 1];
      const { cx: x1, cy: y1 } = nodes[i];
      const mx = (x0 + x1) / 2;
      d += ` C ${mx},${y0} ${mx},${y1} ${x1},${y1}`;
    }
    return d;
  }, [nodes]);

  // Solid green path for completed+current nodes
  const donePath = useMemo(() => {
    let last = -1;
    blocks.forEach((b, i) => { if (b.status !== 'UPCOMING') last = i; });
    if (nodes.length < 2 || last < 1) return '';
    let d = `M ${nodes[0].cx},${nodes[0].cy}`;
    for (let i = 1; i <= Math.min(last, nodes.length - 1); i++) {
      const { cx: x0, cy: y0 } = nodes[i - 1];
      const { cx: x1, cy: y1 } = nodes[i];
      const mx = (x0 + x1) / 2;
      d += ` C ${mx},${y0} ${mx},${y1} ${x1},${y1}`;
    }
    return d;
  }, [nodes, blocks]);

  return (
    <div className="w-full relative group">
      {/* Phone layout: show the active step first, followed by the next milestones. */}
      <div className="journey-mobile px-4 pb-8 pt-1 md:hidden">
        <div className="journey-mobile-intro mb-5 rounded-2xl px-4 py-3 text-center">
          <p className="journey-mobile-course-title journey-block-name text-sm font-black text-sky-950">{course.name}</p>
          <p className="journey-mobile-course-description mt-1 text-[11px] font-bold leading-relaxed text-sky-800">
            Setiap langkah kecil hari ini membawamu ke petualangan hebat.
          </p>
        </div>

        <div className="journey-mobile-list relative mx-auto flex max-w-sm flex-col gap-4 pb-3 pl-12">
          <span className="journey-mobile-route absolute bottom-10 left-[21px] top-8 w-[3px] rounded-full" aria-hidden="true" />
          <div className="journey-mobile-start relative mb-1 flex min-h-10 items-center rounded-2xl border border-sky-200 bg-white/70 px-4 py-2.5 shadow-sm">
            <span className="absolute -left-[46px] grid size-10 place-items-center rounded-full border-4 border-white bg-emerald-500 text-white shadow-md">
              <Flag size={17} strokeWidth={2.5} />
            </span>
            <div className="flex w-full items-center justify-between gap-3">
              <span className="journey-mobile-start-status text-[10px] font-black uppercase tracking-wider text-sky-800">
                {completedBefore > 0 ? `${completedBefore} ${itemName.toLowerCase()} selesai` : 'Perjalanan dimulai'}
              </span>
              <span className="journey-mobile-start-progress rounded-full bg-sky-100 px-2.5 py-1 text-[10px] font-black text-sky-700">{journeyPct}%</span>
            </div>
          </div>

          {mobileBlocks.map((block) => {
            const originalIndex = blocks.findIndex((item) => item.blockId === block.blockId);
            const isCompleted = block.status === 'COMPLETED';
            const isCurrent = block.status === 'CURRENT';
            const isUpcoming = block.status === 'UPCOMING';
            const isLast = originalIndex === blocks.length - 1;
            const isTrophy = isLast && isUpcoming;

            return (
              <article key={block.blockId} className="journey-mobile-step relative z-10">
                <div
                  className={`journey-mobile-node absolute -left-[48px] top-6 grid size-11 place-items-center rounded-full border-4 border-white shadow-md ${
                    isCurrent ? 'bg-[#0ea5e9]' : isCompleted ? 'bg-[#5A9832]' : isTrophy ? 'bg-violet-100' : 'bg-slate-100'
                  }`}
                  aria-hidden="true"
                >
                  {isCompleted && <CheckCircle2 className="text-white" size={21} strokeWidth={2.5} />}
                  {isCurrent && <Rocket className="text-white" size={21} strokeWidth={2.2} />}
                  {isUpcoming && (isTrophy
                    ? <Trophy className="text-violet-600" size={19} strokeWidth={2.2} />
                    : <Lock className="text-slate-400" size={17} strokeWidth={2.5} />
                  )}
                </div>

                <div className={`journey-card journey-mobile-card rounded-[1.4rem] border p-4 shadow-sm ${
                  isCurrent
                    ? 'journey-card-current border-2 border-sky-400 bg-white shadow-[0_12px_30px_rgba(14,165,233,0.18)]'
                    : isCompleted
                      ? 'journey-card-completed border-emerald-200 bg-white/85'
                      : isTrophy
                        ? 'journey-card-upcoming journey-card-final border-violet-200 bg-violet-50/80'
                        : 'journey-card-upcoming border-slate-200 bg-white/70'
                }`}>
                  <div className="text-center">
                    <span className={`inline-flex rounded-full px-3 py-1 text-[9px] font-black uppercase tracking-widest ${
                      isCurrent
                        ? 'bg-sky-100 text-sky-700'
                        : isCompleted
                          ? 'bg-emerald-100 text-emerald-700'
                          : isTrophy
                            ? 'bg-violet-100 text-violet-700'
                            : 'bg-slate-100 text-slate-600'
                    }`}>
                      {isTrophy ? 'Final Quest' : `${itemName} ${(block.orderIndex != null ? block.orderIndex : originalIndex) + 1}`}
                    </span>
                    <h4 className="journey-mobile-card-title journey-block-name mt-2 text-base font-black leading-snug text-slate-800">{block.name}</h4>
                  </div>

                  <p className="journey-mobile-card-date mt-2 flex items-center justify-center gap-1.5 text-[10px] font-bold text-slate-500">
                    <CalendarDays size={13} />
                    {new Date(block.startDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                    {' – '}
                    {new Date(block.endDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                  </p>

                  {isCurrent && (
                    <div className="mt-3 border-t border-slate-200 pt-3">
                      <div className="journey-mobile-card-progress-label mb-1.5 flex items-center justify-between text-[9px] font-black uppercase tracking-wider text-slate-500">
                        <span>Progress {itemName}</span>
                        <span className="text-sky-600">{blockPct}%</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                        <div className="h-full rounded-full bg-gradient-to-r from-[#0ea5e9] to-[#5A9832]" style={{ width: `${blockPct}%` }} />
                      </div>
                    </div>
                  )}

                  {isUpcoming && (
                    <div className={`mt-3 flex items-center justify-center gap-1.5 rounded-full py-1.5 text-[9px] font-black ${
                      isTrophy ? 'bg-violet-100 text-violet-700' : 'bg-slate-100 text-slate-500'
                    }`}>
                      <span className="journey-mobile-card-lock-icon">{isTrophy ? <Trophy size={13} /> : <Lock size={12} />}</span>
                      {isTrophy ? 'Petualangan menantimu' : 'Terkunci'}
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
        <div className="journey-mobile-scroll-hint mx-auto mt-3 flex w-fit items-center gap-2 rounded-full px-5 py-2">
          <ChevronLeft size={13} aria-hidden="true" />
          <span>Geser untuk menjelajah</span>
          <ChevronRight size={13} aria-hidden="true" />
        </div>
      </div>

      <div className="hidden md:block">
      {/* Scroll Navigators */}
      <div className="absolute inset-y-0 left-0 flex items-center w-16 z-20 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300">
        <button
          onClick={() => scrollMap(-300)}
          className="pointer-events-auto ml-2 md:ml-4 size-10 bg-white/90 hover:bg-white rounded-full shadow-sm shadow-sky-900/20 flex items-center justify-center text-sky-600 border-none outline-none transition-transform hover:scale-110 active:scale-95"
        >
          <ChevronLeft size={24} />
        </button>
      </div>

      <div className="absolute inset-y-0 right-0 flex items-center justify-end w-16 z-20 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300">
        <button
          onClick={() => scrollMap(300)}
          className="pointer-events-auto mr-2 md:mr-4 size-10 bg-white/90 hover:bg-white rounded-full shadow-sm shadow-sky-900/20 flex items-center justify-center text-sky-600 border-none outline-none transition-transform hover:scale-110 active:scale-95"
        >
          <ChevronRight size={24} />
        </button>
      </div>

      {/* ── Scrollable sky map ──────────────────────────────────────────── */}
      <div
        ref={scrollRef}
        className="overflow-x-auto no-scrollbar px-6 md:px-10"
      >
        <div
          className="relative"
          style={{ width: totalWidth, height: MAP_H }}
        >
          {/* SVG: S-curve paths */}
          <svg
            className="absolute inset-0 pointer-events-none"
            style={{ zIndex: 0 }}
            width={totalWidth}
            height={MAP_H}
          >
            {/* Continuous route background */}
            {fullPath && (
              <path
                className="journey-path-base"
                d={fullPath}
                fill="none"
                stroke="#d7e7f2"
                strokeOpacity="0.9"
                strokeWidth="9"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
            {/* Solid green completed path */}
            {donePath && (
              <path
                className="journey-path-completed"
                d={donePath}
                fill="none"
                stroke="#5A9832"
                strokeOpacity="0.95"
                strokeWidth="10"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
          </svg>

          {/* ── Nodes ──────────────────────────────────────────────────── */}
          {blocks.map((block, i) => {
            const { cx, cy } = nodes[i];
            const isCompleted = block.status === 'COMPLETED';
            const isCurrent = block.status === 'CURRENT';
            const isUpcoming = block.status === 'UPCOMING';
            const isLast = i === blocks.length - 1;
            const isTrophy = isLast && isUpcoming;

            const BUBBLE_R = isCurrent ? 48 : 36;
            const bSize = BUBBLE_R * 2;

            const bubLeft = cx - BUBBLE_R;
            const bubTop = cy - BUBBLE_R;
            const cardTop = cy + BUBBLE_R + (isCurrent ? 26 : 16);

            return (
              <div
                key={block.blockId}
                className="absolute"
                style={{ top: 0, left: 0, width: 0, height: 0, zIndex: 10 }}
              >
                {/* ── Bubble ─────────────────────────────────────────── */}
                <div className="absolute" style={{ left: bubLeft, top: bubTop }}>
                  {/* Pulse ring for current */}
                  {isCurrent && (
                    <span
                      className="absolute rounded-full bg-white/50 animate-ping"
                      style={{ inset: -10, zIndex: -1 }}
                    />
                  )}
                  <div
                    className={`flex items-center justify-center rounded-full border-[6px] border-white shadow-xl transition-transform duration-300 hover:-translate-y-2
                      ${isCurrent
                        ? 'bg-[#0ea5e9] shadow-[0_12px_40px_-8px_rgba(14,165,233,0.5)]'
                        : isCompleted
                          ? 'bg-[#5A9832] shadow-[0_8px_24px_-6px_rgba(90,152,50,0.45)]'
                          : 'bg-white/50 backdrop-blur-md border-white/70 shadow-sm'
                      }`}
                    style={{ width: bSize, height: bSize }}
                  >
                    {isCompleted && <CheckCircle2 className="text-white" size={28} strokeWidth={2.5} />}
                    {isCurrent && <Rocket className="text-white" size={32} strokeWidth={2} />}
                    {isUpcoming && (isTrophy
                      ? <Trophy className="text-amber-400" size={26} strokeWidth={2} />
                      : <Lock className="text-slate-400/70" size={22} strokeWidth={2.5} />
                    )}
                  </div>

                  {/* Completed gem badge */}
                  {isCompleted && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap bg-[#5A9832] text-white text-[8px] font-black px-2 py-0.5 rounded-full border-2 border-white shadow-md uppercase tracking-wide">
                      ✓ Selesai
                    </div>
                  )}
                </div>

                {/* ── Card ───────────────────────────────────────────── */}
                <div
                  className={`journey-card absolute text-center rounded-[1.5rem] border-2 transition-transform duration-300 overflow-hidden
                    ${isCurrent
                      ? 'journey-card-current bg-white border-sky/30 shadow-[0_12px_36px_-6px_rgba(14,165,233,0.25)] scale-[1.05]'
                      : isCompleted
                        ? 'journey-card-completed bg-white/75 backdrop-blur-md border-white/60 shadow-sm'
                        : 'journey-card-upcoming bg-white/35 backdrop-blur-sm border-dashed border-white/40 opacity-70'
                    }`}
                  style={{ left: cx - 110, top: cardTop, width: 220 }}
                >


                  <div className="p-4">
                    {/* On-going badge — clean pill at top of card */}
                    {isCurrent && (
                      <span className="inline-block mb-2 px-3 py-0.5 bg-sky/10 text-[#0ea5e9] text-[9px] font-black uppercase tracking-widest rounded-full border border-sky/20">
                        Dalam Perjalanan 🚀
                      </span>
                    )}
                    {/* Quest label */}
                    <span className={`text-[9px] font-black uppercase tracking-widest block mb-1
                      ${isCurrent ? 'text-[#0ea5e9]' : isCompleted ? 'text-[#5A9832]' : 'text-slate-400'}`}
                    >
                      {isLast && isUpcoming ? 'Final Quest' : `${itemName} ${(block.orderIndex != null ? block.orderIndex : i) + 1}`}
                    </span>

                    {/* Block name */}
                    <h4 className={`journey-block-name font-black text-sm leading-tight
                      ${isCurrent ? 'text-sky-950' : isCompleted ? 'text-slate-700' : 'text-slate-400'}`}
                    >
                      {block.name}
                    </h4>

                    {/* Date range */}
                    <p className="text-[10px] font-bold text-slate-400 mt-1.5">
                      {new Date(block.startDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                      {' – '}
                      {new Date(block.endDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                    </p>

                    {/* Progress bar — only for CURRENT block */}
                    {isCurrent && (
                      <div className="mt-3 pt-3 border-t border-slate-100">
                        <div className="flex justify-between items-center text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1.5">
                          <span>Progress Blok</span>
                          <span className="text-[#0ea5e9]">{blockPct}%</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden shadow-inner">
                          <div
                            className="bg-gradient-to-r from-[#0ea5e9] to-[#5A9832] h-full rounded-full transition-all duration-1000 shadow-sm"
                            style={{ width: `${blockPct}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Locked hint */}
                    {isUpcoming && !isTrophy && (
                      <p className="text-[9px] text-slate-400 mt-2 font-bold">
                        Selesaikan tahap sebelumnya 🔒
                      </p>
                    )}
                    {isTrophy && (
                      <p className="text-[9px] text-amber-500 mt-2 font-bold">
                        Selesaikan projek akhir kamu! 🏆
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Scroll hint ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-center mt-3 pb-6">
        <div className="journey-scroll-hint flex items-center gap-2 bg-white/50 backdrop-blur-sm border border-white/40 px-5 py-2 rounded-full shadow-sm">
          <ChevronLeft size={13} className="text-sky-800" />
          <span className="text-[10px] font-black text-sky-900 uppercase tracking-wider">Geser untuk menjelajah</span>
          <ChevronRight size={13} className="text-sky-800" />
        </div>
      </div>
      </div>
    </div>
  );
}
