import Link from 'next/link';
import { getDraftReportsForCoach } from '@/lib/services/coach';

export default async function CoachDraftReportsAlert({ coachId }: { coachId: string }) {
  const draftReports = await getDraftReportsForCoach(coachId);

  if (!draftReports || draftReports.length === 0) return null;

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-3xl p-5 md:p-6 shadow-sm mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-[url('/noise.png')]">
      <div className="flex items-start sm:items-center gap-3 md:gap-4">
        <div className="w-10 h-10 md:w-12 md:h-12 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
          <span className="material-symbols-outlined text-amber-600 text-lg md:text-xl">edit_document</span>
        </div>
        <div>
          <h3 className="text-amber-900 font-bold text-base md:text-lg">Ada {draftReports.length} Draft Rapor Perlu Direview</h3>
          <p className="text-amber-700 text-xs md:text-sm font-medium mt-1">
            AI telah selesai men-generate draf rapor blok. Silakan review dan publish agar bisa dikirim ke orang tua.
          </p>
        </div>
      </div>
      <div className="w-full sm:w-auto mt-2 sm:mt-0">
        <Link 
          href="/coach/reports" 
          className="w-full sm:w-auto justify-center bg-amber-500 hover:bg-amber-600 text-white font-bold py-3 px-6 rounded-xl transition-colors shadow-lg shadow-amber-500/25 flex items-center gap-2 text-sm"
        >
          Review Sekarang <span className="material-symbols-outlined text-sm">arrow_forward</span>
        </Link>
      </div>
    </div>
  );
}
