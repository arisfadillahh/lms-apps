import { BookOpen, Video, ChevronRight, FileText, Download, Lightbulb } from 'lucide-react';

import { getSessionOrThrow } from '@/lib/auth';
import { getAccessibleLessonsForCoder, getVisibleMaterialsForCoder } from '@/lib/services/coder';
import { StaggerContainer, StaggerItem } from '../StaggerWrapper';

export default async function CoderMaterialsPage() {
  const session = await getSessionOrThrow();
  const [lessonPlans, materialsByClass] = await Promise.all([
    getAccessibleLessonsForCoder(session.user.id),
    getVisibleMaterialsForCoder(session.user.id),
  ]);

  return (
    <StaggerContainer className="flex-1 p-8 overflow-y-auto space-y-10">
      {/* Header */}
      <StaggerItem>
        <header className="text-center mb-4">
          <h1 className="text-3xl font-black text-clevio-navy tracking-tight mb-2 flex items-center gap-3 justify-center">
            <BookOpen className="text-sky" size={28} /> Materi Pembelajaran
          </h1>
          <p className="text-slate-400 font-bold text-sm max-w-md mx-auto">
            Akses kembali materi, modul, dan video dari sesi yang telah kamu pelajari.
          </p>
        </header>
      </StaggerItem>

      {/* Lesson Plans */}
      <div className="space-y-12">
        {lessonPlans.map((entry) => {
          const blocksWithLessons = entry.blocks.filter((block) => block.lessons.length > 0);
          if (blocksWithLessons.length === 0) return null;

          return (
            <StaggerItem key={entry.classId}>
              <div>
                {/* Class Header */}
                <div className="flex items-center gap-4 mb-8">
                  <div className="size-12 rounded-2xl bg-clevio-navy flex items-center justify-center text-white shadow-lg">
                    <BookOpen size={24} />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black text-clevio-navy">{entry.name}</h2>
                    <p className="text-sm font-bold text-slate-400">Kelas Reguler</p>
                  </div>
                </div>

                {/* Blocks */}
                <div className="space-y-8">
                  {blocksWithLessons.map((block) => (
                    <div key={block.id}>
                      {/* Block Header */}
                      <div className="inline-block px-5 py-3 bg-pastel-blue rounded-2xl border-2 border-sky/10 mb-6">
                        <p className="text-[10px] font-black text-sky uppercase tracking-widest">Module Block</p>
                        <h3 className="text-lg font-black text-clevio-navy">{block.name}</h3>
                      </div>

                      {/* Timeline */}
                      <div className="relative pl-10 border-l-4 border-dashed border-pastel-blue/50 ml-4 space-y-6">
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
                          const scheme = colors[index % 4];

                          return (
                            <div key={lesson.id} className="relative">
                              {/* Dot */}
                              <div className={`absolute -left-[54px] top-4 size-10 bg-white border-4 ${isPast ? 'border-clevio-green' : scheme.border} rounded-2xl z-10 flex items-center justify-center shadow-md font-black text-sm ${isPast ? 'text-clevio-green' : scheme.text}`}>
                                {isPast ? '✓' : (index + 1)}
                              </div>

                              {/* Card */}
                              <div className="bg-white rounded-3xl border-2 border-slate-50 shadow-sm p-5 hover:shadow-md transition-shadow">
                                <div className="flex gap-5 items-start">
                                  {/* Date Badge */}
                                  <div className={`flex flex-col items-center min-w-[60px] px-3 py-2 ${scheme.bg} rounded-xl border ${scheme.border}/20`}>
                                    {dateObj ? (
                                      <>
                                        <span className={`text-xl font-black ${scheme.text}`}>{dateObj.getDate()}</span>
                                        <span className={`text-[10px] uppercase font-black ${scheme.text}`}>{dateObj.toLocaleDateString('id-ID', { month: 'short' })}</span>
                                      </>
                                    ) : (
                                      <span className="text-2xl text-slate-300">?</span>
                                    )}
                                  </div>

                                  {/* Content */}
                                  <div className="flex-1">
                                    <h4 className="text-lg font-black text-clevio-navy mb-1">{lesson.title}</h4>
                                    {lesson.summary && (
                                      <p className="text-sm font-bold text-slate-400 leading-relaxed mb-2">{lesson.summary}</p>
                                    )}
                                    {isScheduled ? (
                                      <span className={`inline-flex items-center gap-1 text-[10px] font-black ${scheme.text} ${scheme.bg} px-2 py-1 rounded-lg uppercase`}>
                                        <Video size={12} /> {new Date(lesson.sessionDate!).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 text-[10px] font-black text-slate-400 bg-slate-50 px-2 py-1 rounded-lg">Belum dijadwalkan</span>
                                    )}
                                  </div>

                                  {/* Arrow */}
                                  <a href={`/coder/materials/${lesson.id}`} className="size-10 rounded-xl bg-sky text-white flex items-center justify-center shadow-md hover:scale-110 transition-transform self-center">
                                    <ChevronRight size={20} strokeWidth={3} />
                                  </a>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </StaggerItem>
          );
        })}
      </div>

      {/* Divider */}
      <StaggerItem>
        <div className="h-1 bg-pastel-blue/30 rounded-full" />
      </StaggerItem>

      {/* Additional Materials */}
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
                entry.materials.map((material) => (
                  <div key={material.id} className="bg-white rounded-3xl border-2 border-slate-50 shadow-sm p-6 flex flex-col justify-between gap-4 hover:shadow-md transition-shadow">
                    <div>
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-[10px] font-black text-sky uppercase tracking-widest">{entry.name}</span>
                        {material.file_url && <Download size={16} className="text-slate-300" />}
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
                    {material.file_url && (
                      <a href={material.file_url} target="_blank" rel="noreferrer" className="flex items-center justify-center w-full py-3 bg-pastel-blue text-sky font-black text-sm rounded-2xl hover:bg-sky hover:text-white transition-colors no-underline">
                        Buka File
                      </a>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </section>
      </StaggerItem>
    </StaggerContainer >
  );
}
