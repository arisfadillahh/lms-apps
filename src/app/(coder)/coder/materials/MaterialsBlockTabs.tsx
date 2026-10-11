'use client';

import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { BookOpen, CheckCircle2, ChevronRight, Download, FileText, Lightbulb, Lock, Sparkles, Video } from 'lucide-react';

import { StaggerContainer, StaggerItem } from '../StaggerWrapper';
import { normalizeHttpUrl } from '@/lib/safeUrl';

export type MaterialsLesson = {
  id: string;
  title: string;
  summary: string | null;
  orderIndex: number;
  slideUrl: string | null;
  exampleUrl: string | null;
  sessionDate: string | null;
  isAccessible?: boolean;
};

export type MaterialsBlock = {
  id: string;
  name: string;
  status: 'COMPLETED' | 'CURRENT' | 'UPCOMING';
  startDate: string;
  endDate: string;
  lessons: MaterialsLesson[];
};

export type MaterialsClassEntry = {
  classId: string;
  name: string;
  blocks: MaterialsBlock[];
};

export type AdditionalMaterialEntry = {
  classId: string;
  name: string;
  materials: Array<{
    id: string;
    title: string;
    description: string | null;
    coach_note: string | null;
    file_url: string | null;
  }>;
};

function getBlockAccent(status: MaterialsBlock['status']) {
  if (status === 'CURRENT') {
    return {
      tab: 'text-sky',
      tabBg: 'bg-pastel-blue',
      shell: 'border-sky/15 bg-gradient-to-br from-pastel-blue/60 via-white to-white',
      line: 'border-pastel-blue/60',
      badge: 'bg-sky text-white',
      label: 'Sedang Dipelajari',
    };
  }

  if (status === 'COMPLETED') {
    return {
      tab: 'text-clevio-green',
      tabBg: 'bg-pastel-green',
      shell: 'border-clevio-green/15 bg-gradient-to-br from-pastel-green/50 via-white to-white',
      line: 'border-pastel-green/70',
      badge: 'bg-clevio-green text-white',
      label: 'Sudah Selesai',
    };
  }

  return {
    tab: 'text-slate-500',
    tabBg: 'bg-slate-100',
    shell: 'border-slate-200 bg-gradient-to-br from-slate-50 via-white to-white',
    line: 'border-slate-200',
    badge: 'bg-slate-400 text-white',
    label: 'Belum Dimulai',
  };
}

function BlockTimeline({ block }: { block: MaterialsBlock }) {
  const accent = getBlockAccent(block.status);

  return (
    <div className={`rounded-[1.9rem] border p-4 md:p-5 ${accent.shell}`}>
      <div className="relative ml-2 space-y-5">
        <div className={`absolute left-[13px] top-3 bottom-3 border-l-4 border-dashed ${accent.line}`} />
        {block.lessons.map((lesson, index) => {
          const isScheduled = !!lesson.sessionDate;
          const dateObj = lesson.sessionDate ? new Date(lesson.sessionDate) : null;
          const isPast = dateObj ? dateObj < new Date() : false;

          const colors = [
            { border: 'border-sky', bg: 'bg-pastel-blue', text: 'text-sky' },
            { border: 'border-amber-400', bg: 'bg-pastel-yellow', text: 'text-amber-600' },
            { border: 'border-coral', bg: 'bg-pastel-pink', text: 'text-coral' },
            { border: 'border-clevio-green', bg: 'bg-pastel-green', text: 'text-clevio-green' },
          ];
          const scheme = isPast ? { border: 'border-clevio-green', bg: 'bg-pastel-green', text: 'text-clevio-green' } : colors[index % 4];

          return (
            <motion.div
              key={lesson.id}
              className="relative pl-9 md:pl-11"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.14, delay: index * 0.025, ease: 'easeOut' }}
            >
              <div className={`absolute left-[13px] top-5 z-10 flex size-8 -translate-x-1/2 items-center justify-center rounded-2xl border-4 bg-white shadow-md font-black text-xs md:size-10 md:text-sm ${scheme.border} ${scheme.text}`}>
                {isPast ? '✓' : index + 1}
              </div>

              <div className="bg-white rounded-[1.6rem] border border-slate-100 p-4 md:p-5 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex gap-4 items-start">
                  <div className={`flex flex-col items-center min-w-[56px] px-2.5 py-2 rounded-xl border ${scheme.bg} ${scheme.border}/20`}>
                    {dateObj ? (
                      <>
                        <span className={`text-lg font-black ${scheme.text}`}>{dateObj.getDate()}</span>
                        <span className={`text-[10px] uppercase font-black ${scheme.text}`}>{dateObj.toLocaleDateString('id-ID', { month: 'short' })}</span>
                      </>
                    ) : (
                      <span className="text-xl text-slate-300">?</span>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <h4 className="text-base md:text-lg font-black text-clevio-navy leading-snug mb-1">{lesson.title}</h4>
                    {lesson.summary && (
                      <p className="text-xs md:text-sm font-bold text-slate-400 leading-relaxed mb-3">{lesson.summary}</p>
                    )}
                    {isScheduled ? (
                      <span className={`inline-flex items-center gap-1 text-[10px] font-black ${scheme.text} ${scheme.bg} px-2.5 py-1 rounded-lg uppercase`}>
                        <Video size={12} /> {new Date(lesson.sessionDate!).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-black text-slate-400 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-100">
                        Belum dijadwalkan
                      </span>
                    )}
                  </div>

                  {lesson.isAccessible ? (
                    <a href={`/coder/materials/${lesson.id}`} className="size-10 rounded-xl bg-sky text-white flex items-center justify-center shadow-md hover:scale-110 transition-transform self-center shrink-0">
                      <ChevronRight size={20} strokeWidth={3} />
                    </a>
                  ) : (
                    <div className="size-10 rounded-xl bg-slate-100 text-slate-300 flex items-center justify-center self-center shrink-0">
                      <Lock size={16} strokeWidth={2.5} />
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

function ClassTabs({ entry }: { entry: MaterialsClassEntry }) {
  const blocksWithLessons = entry.blocks.filter((block) => block.lessons.length > 0);

  const defaultBlockId = useMemo(
    () =>
      blocksWithLessons.find((block) => block.status === 'CURRENT')?.id ??
      blocksWithLessons.find((block) => block.status === 'UPCOMING')?.id ??
      blocksWithLessons[0]?.id ??
      '',
    [blocksWithLessons],
  );

  const [activeBlockId, setActiveBlockId] = useState(defaultBlockId);
  const activeBlock = blocksWithLessons.find((block) => block.id === activeBlockId) ?? blocksWithLessons[0] ?? null;

  if (!activeBlock) {
    return null;
  }

  return (
    <section>
      <div className="relative overflow-x-auto pb-1">
        <div className="flex min-w-max items-end gap-2 border-b border-slate-200 px-1">
          {blocksWithLessons.map((block) => {
            const isActive = block.id === activeBlockId;
            const accent = getBlockAccent(block.status);

            return (
              <button
                key={block.id}
                type="button"
                onClick={() => setActiveBlockId(block.id)}
                className={`relative rounded-t-[1.35rem] px-4 py-3 text-left transition-all ${isActive ? 'bg-white border border-b-0 border-slate-200 shadow-sm -mb-px' : 'bg-slate-100/70 hover:bg-white/80'} `}
              >
                {isActive && (
                  <motion.div
                    layoutId={`materials-tab-${entry.classId}`}
                    className="absolute inset-0 rounded-t-[1.35rem] border border-slate-200 border-b-0 bg-white shadow-sm"
                  />
                )}
                <div className="relative z-10 min-w-[150px] max-w-[190px]">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`inline-flex size-7 items-center justify-center rounded-xl ${accent.tabBg} ${accent.tab}`}>
                      {block.status === 'COMPLETED' ? <CheckCircle2 size={16} /> : <Sparkles size={15} />}
                    </span>
                    <span className={`text-[10px] font-black uppercase tracking-[0.22em] ${accent.tab}`}>
                      {accent.label}
                    </span>
                  </div>
                  <p className={`text-sm font-black leading-snug ${isActive ? 'text-clevio-navy' : 'text-slate-500'}`}>
                    {block.name}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-4">
        <AnimatePresence mode="wait">
          <BlockTimeline key={activeBlock.id} block={activeBlock} />
        </AnimatePresence>
      </div>
    </section>
  );
}

export default function MaterialsBlockTabs({
  lessonPlans,
  materialsByClass,
}: {
  lessonPlans: MaterialsClassEntry[];
  materialsByClass: AdditionalMaterialEntry[];
}) {
  return (
    <StaggerContainer className="flex-1 p-4 md:p-8 overflow-y-auto space-y-10">
      <StaggerItem>
        <header className="text-center mb-4">
          <h1 className="text-3xl font-black text-clevio-navy tracking-tight mb-2 flex items-center gap-3 justify-center">
            <BookOpen className="text-sky" size={28} /> Materi Pembelajaran
          </h1>
          <p className="text-slate-400 font-bold text-sm max-w-xl mx-auto">
            Pilih block yang tersedia untuk melihat daftar materi belajarmu.
          </p>
        </header>
      </StaggerItem>

      <div className="space-y-12">
        {lessonPlans.map((entry) => (
          <StaggerItem key={entry.classId}>
            <ClassTabs entry={entry} />
          </StaggerItem>
        ))}
      </div>

      <StaggerItem>
        <section>
          <div className="flex items-center gap-4 mb-8">
            <div className="p-3 bg-pastel-pink rounded-2xl text-coral">
              <FileText size={22} />
            </div>
            <h2 className="text-2xl font-black text-clevio-navy">Materi Tambahan</h2>
          </div>

          {materialsByClass.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 bg-white rounded-[3rem] border-4 border-dashed border-pastel-blue/30 text-center">
              <div className="size-16 bg-pastel-blue rounded-full flex items-center justify-center mb-4">
                <FileText size={32} className="text-sky" />
              </div>
              <p className="font-black text-slate-600">Belum ada materi tambahan</p>
              <p className="text-sm font-bold text-slate-400">Materi ekstra dari coach akan muncul di sini.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {materialsByClass.map((entry) =>
                entry.materials.map((material) => {
                  const safeFileUrl = material.file_url ? normalizeHttpUrl(material.file_url) : null;
                  return (
                  <div key={material.id} className="bg-white rounded-3xl border-2 border-slate-50 shadow-sm p-6 flex flex-col justify-between gap-4 hover:shadow-md transition-shadow">
                    <div>
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-[10px] font-black text-sky uppercase tracking-widest">{entry.name}</span>
                        {safeFileUrl && <Download size={16} className="text-slate-300" />}
                      </div>
                      <h3 className="text-lg font-black text-clevio-navy mb-1">{material.title}</h3>
                      {material.description && <p className="text-sm font-bold text-slate-400">{material.description}</p>}
                      {material.coach_note && (
                        <div className="mt-3 p-3 bg-pastel-yellow rounded-xl border border-sunshine/20 text-sm font-bold text-amber-700 flex gap-2">
                          <Lightbulb size={16} className="flex-shrink-0 mt-0.5" />
                          <div>{material.coach_note}</div>
                        </div>
                      )}
                    </div>
                    {safeFileUrl && (
                      <a href={safeFileUrl} target="_blank" rel="noreferrer" className="flex items-center justify-center w-full py-3 bg-pastel-blue text-sky font-black text-sm rounded-2xl hover:bg-sky hover:text-white transition-colors no-underline">
                        Buka File
                      </a>
                    )}
                  </div>
                  );
                })
              )}
            </div>
          )}
        </section>
      </StaggerItem>
    </StaggerContainer>
  );
}
