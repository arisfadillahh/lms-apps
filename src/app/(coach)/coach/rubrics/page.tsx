import { getSessionOrThrow } from '@/lib/auth';
import { getPendingLessonEvaluationsForCoach, getDraftReportsForCoach } from '@/lib/services/coach';
import RubricPageClient from './RubricPageClient';

export const revalidate = 0;


export default async function CoachRubricsPage() {
  const session = await getSessionOrThrow();
  const coachId = session.user.id;

  const [pendingLessons, draftReports] = await Promise.all([
    getPendingLessonEvaluationsForCoach(coachId),
    getDraftReportsForCoach(coachId)
  ]);

  return (
    <div className="flex-1 font-sans text-slate-900">
      
      <header className="relative bg-gradient-to-r from-[#0f172a] to-[#1e293b] p-8 md:p-12 text-white overflow-hidden rounded-3xl mb-12">
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full -mr-32 -mt-32 blur-3xl"></div>
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="space-y-3">
            <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight">Journey Penilaian</h2>
            <p className="text-slate-300 font-normal text-lg md:text-xl max-w-xl">
              Pantau progres belajar coder hari ini dan lengkapi draf rapor mereka.
            </p>
          </div>
          <div className="flex gap-4">
            <div 
              className="px-6 md:px-8 py-4 md:py-5 rounded-3xl flex flex-col items-center justify-center shadow-[0_10px_30px_rgba(245,158,11,0.2)]"
              style={{ background: 'rgba(245, 158, 11, 0.15)', backdropFilter: 'blur(8px)', border: '1px solid rgba(245, 158, 11, 0.3)' }}
            >
              <span className="text-4xl font-bold text-amber-400">{pendingLessons.length}</span>
              <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-amber-200/90 mt-1">Pending</span>
            </div>
            <div 
              className="px-6 md:px-8 py-4 md:py-5 rounded-3xl flex flex-col items-center justify-center shadow-[0_10px_30px_rgba(59,130,246,0.2)]"
              style={{ background: 'rgba(59, 130, 246, 0.15)', backdropFilter: 'blur(8px)', border: '1px solid rgba(59, 130, 246, 0.3)' }}
            >
              <span className="text-4xl font-bold text-blue-400">{draftReports.length}</span>
              <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-blue-200/90 mt-1">Draf Rapor</span>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 md:px-10 pb-16">
          <RubricPageClient 
            pendingLessons={pendingLessons as any}
            draftReports={draftReports as any}
          />
      </div>
    </div>
  );
}
