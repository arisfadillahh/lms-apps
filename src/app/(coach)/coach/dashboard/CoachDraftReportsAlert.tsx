import Link from 'next/link';
import { getDraftReportsForCoach } from '@/lib/services/coach';

export default async function CoachDraftReportsAlert({ coachId }: { coachId: string }) {
  const draftReports = await getDraftReportsForCoach(coachId);

  if (!draftReports || draftReports.length === 0) return null;

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-3xl p-6 shadow-sm mb-8 flex justify-between items-center bg-[url('/noise.png')]">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
          <span className="material-symbols-outlined text-amber-600">edit_document</span>
        </div>
        <div>
          <h3 className="text-amber-900 font-bold text-lg">Ada {draftReports.length} Draft Rapor Perlu Direview</h3>
          <p className="text-amber-700 text-sm font-medium mt-1">
            AI telah selesai men-generate draf rapor blok. Silakan review dan publish agar bisa dikirim ke orang tua.
          </p>
        </div>
      </div>
      <div>
        <Link 
          href="/coach/reports" 
          className="bg-amber-500 hover:bg-amber-600 text-white font-bold py-2.5 px-6 rounded-xl transition-colors shadow-lg shadow-amber-500/25 flex items-center gap-2"
        >
          Review Sekarang <span className="material-symbols-outlined text-sm">arrow_forward</span>
        </Link>
      </div>
    </div>
  );
}
