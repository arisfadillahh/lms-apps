'use client';

import { useMemo } from 'react';
import { Rocket, CheckCircle2, PlayCircle, Lock, Trophy, ArrowRight } from 'lucide-react';

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
  completedBlocks: number;
  totalBlocks: number | null;
  journeyBlocks: JourneyBlock[];
};

type JourneyMapProps = {
  courses: JourneyCourse[];
};

export default function JourneyMap({ courses }: JourneyMapProps) {
  if (courses.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-6 sm:gap-12 px-5 py-4 sm:px-8 sm:py-6 w-full max-w-2xl mx-auto">
      {courses.map((course) => (
        <CourseJourney key={course.classId} course={course} />
      ))}
    </div>
  );
}

function CourseJourney({ course }: { course: JourneyCourse }) {
  const blocks = course.journeyBlocks;
  const isEkskul = course.classType === 'EKSKUL';
  const itemName = isEkskul ? 'Sesi' : 'Blok';

  const totalItemCount = course.totalBlocks ?? Math.max(blocks.length, 1);
  const progressPercent = Math.min(100, Math.round((course.completedBlocks / totalItemCount) * 100));

  return (
    <div className="w-full">
      {/* Course Title (Optional if multiple courses, helps distinguish them) */}
      <h3 className="text-lg sm:text-xl font-bold text-slate-800 mb-4 sm:mb-6">{course.name}</h3>

      {/* Progress Summary */}
      <div className="mb-8 sm:mb-10 bg-blue-500/5 rounded-xl sm:rounded-2xl p-4 sm:p-6 border border-blue-500/10">
        <div className="flex justify-between items-end mb-3">
          <div>
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-blue-600">Kemajuan Belajar</span>
            <p className="text-base sm:text-lg font-bold text-slate-900">
              {course.completedBlocks} dari {totalItemCount} {itemName} Selesai
            </p>
          </div>
          <span className="text-blue-600 font-bold bg-blue-500/10 px-2.5 sm:px-3 py-1 rounded-full text-xs sm:text-sm">
            {progressPercent}%
          </span>
        </div>
        <div className="w-full bg-slate-200 h-2 sm:h-3 rounded-full overflow-hidden">
          <div
            className="bg-blue-600 h-full rounded-full transition-all duration-1000 ease-out"
            style={{ width: `${progressPercent}%` }}
          ></div>
        </div>
        <p className="mt-3 sm:mt-4 text-xs sm:text-sm text-slate-600 flex items-center gap-2">
          <Rocket className="w-4 h-4 sm:w-5 sm:h-5 text-blue-500 flex-shrink-0" />
          Keren! {Math.max(0, totalItemCount - course.completedBlocks)} {itemName.toLowerCase()} lagi untuk menyelesaikan program ini!
        </p>
      </div>

      {/* Vertical Journey Path */}
      <div className="relative space-y-0 pl-2">
        {blocks.map((block, index) => {
          const isLast = index === blocks.length - 1;
          const isCompleted = block.status === 'COMPLETED';
          const isCurrent = block.status === 'CURRENT';
          const isUpcoming = block.status === 'UPCOMING';
          const isFinalGoal = isLast && isUpcoming; // Often the last one acts as a trophy/goal if not yet reached

          return (
            <div key={`${course.classId}-${block.blockId}`} className={`relative flex gap-4 sm:gap-6 ${isLast ? '' : 'pb-8 sm:pb-12'} ${isUpcoming && !isFinalGoal ? 'opacity-60' : ''}`}>
              {/* Connector Line */}
              {!isLast && (
                <div
                  className={`absolute left-[19px] sm:left-[23px] top-[40px] sm:top-[48px] bottom-0 w-[3px] sm:w-[4px] ${isCompleted ? 'bg-blue-600' : 'border-l-2 sm:border-l-4 border-dashed border-slate-300'}`}
                  style={isCurrent ? { top: '48px' } : undefined} // Adjust origin if current node is larger
                ></div>
              )}

              {/* Icon Node */}
              {isCompleted && (
                <div className="relative z-10 flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-green-500 text-white flex-shrink-0 shadow-lg shadow-green-200">
                  <CheckCircle2 strokeWidth={3} className="w-5 h-5 sm:w-7 sm:h-7" />
                </div>
              )}

              {isCurrent && (
                <div className="relative z-10 flex-shrink-0">
                  <div className="absolute inset-0 rounded-full bg-blue-500/40 animate-ping"></div>
                  <div className="relative flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-blue-600 text-white shadow-xl shadow-blue-500/40 ring-4 ring-white">
                    <PlayCircle className="w-5 h-5 sm:w-6 sm:h-6" fill="currentColor" stroke="none" />
                  </div>
                </div>
              )}

              {isUpcoming && (
                <div className="relative z-10 flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-slate-200 text-slate-500 flex-shrink-0">
                  {isFinalGoal ? <Trophy className="w-5 h-5 sm:w-6 sm:h-6" /> : <Lock strokeWidth={2.5} className="w-4 h-4 sm:w-5 sm:h-5" />}
                </div>
              )}

              {/* Content Card */}
              <div className={`flex-1 ${isCurrent ? 'p-4 sm:p-5 rounded-xl bg-blue-500/10 border-2 border-blue-500/30 -mt-1 sm:-mt-2' : 'pt-0.5 sm:pt-1'}`}>


                {/* Status Badges */}
                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                  {isCompleted && (
                    <span className="text-[9px] sm:text-[10px] font-bold text-green-700 bg-green-100 px-2 py-0.5 rounded-full uppercase tracking-wide">Selesai</span>
                  )}
                  {isCurrent && (
                    <span className="text-[9px] sm:text-[10px] font-bold text-blue-700 bg-blue-500/20 px-2 py-0.5 rounded-full uppercase tracking-wide">Sedang Dipelajari</span>
                  )}
                  {/* Provide extra context for current node if possible */}
                  {isCurrent && (
                    <span className="text-[10px] sm:text-[11px] font-medium text-slate-500">• Lanjutkan Sesi</span>
                  )}
                </div>

                <h4 className={`font-bold leading-tight ${isCurrent ? 'text-lg sm:text-xl font-extrabold text-slate-900 mb-1' : 'text-base sm:text-lg text-slate-800 mb-0.5'}`}>
                  {itemName} {block.orderIndex != null ? block.orderIndex + 1 : index + 1}: {block.name}
                </h4>

                <p className={`text-xs sm:text-sm ${isCurrent ? 'text-slate-600 mb-3 sm:mb-4' : 'text-slate-500'}`}>
                  {new Date(block.startDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })} – {new Date(block.endDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                  {isUpcoming && !isFinalGoal && " • Selesaikan tahapan sebelumnya untuk membuka"}
                  {isFinalGoal && " • Selesaikan projek akhir kamu!"}
                </p>

                {isCurrent && (
                  <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 sm:px-5 sm:py-2.5 rounded-full font-bold text-xs sm:text-sm flex items-center gap-2 transition-all shadow-lg shadow-blue-500/20 w-max mt-2">
                    Lanjutkan Belajar
                    <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" strokeWidth={3} />
                  </button>
                )}
              </div>

            </div>
          );
        })}
      </div>
    </div>
  );
}
