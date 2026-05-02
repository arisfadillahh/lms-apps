import Link from 'next/link';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';

import { getSessionOrThrow } from '@/lib/auth';
import { getCoachClassesWithBlocks } from '@/lib/services/coach';

export const revalidate = 300;

function formatSchedule(date: string | null | undefined) {
  if (!date) return 'Belum ada jadwal';
  return format(new Date(date), 'EEEE, dd MMM yyyy HH:mm', { locale: localeId });
}

export default async function CoachClassesPage() {
  const session = await getSessionOrThrow();
  const classes = await getCoachClassesWithBlocks(session.user.id);

  return (
    <div className="w-full px-4 md:px-8 py-8 space-y-8">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <Link href="/coach/dashboard" className="text-sm font-bold text-emerald-600 hover:text-emerald-700 inline-flex items-center gap-1 mb-4">
            <span className="material-symbols-outlined text-base">arrow_back</span>
            Dashboard
          </Link>
          <h1 className="text-3xl font-black text-brand-deep tracking-tight">Manajemen Kelas</h1>
          <p className="text-sm text-slate-500 font-medium mt-2">
            Semua kelas utama dan kelas substitute yang sedang terhubung ke akun Coach.
          </p>
        </div>
        <div className="rounded-2xl bg-emerald-50 border border-emerald-100 px-5 py-3">
          <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Total Kelas</p>
          <p className="text-2xl font-black text-brand-deep">{classes.length}</p>
        </div>
      </div>

      {classes.length === 0 ? (
        <div className="bg-white border border-slate-100 rounded-3xl p-10 text-center shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07)]">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-slate-50 flex items-center justify-center mb-4">
            <span className="material-symbols-outlined text-slate-400">school</span>
          </div>
          <h2 className="text-lg font-black text-brand-deep">Belum ada kelas</h2>
          <p className="text-sm text-slate-500 mt-2">Kelas akan muncul setelah Admin menghubungkan Coach ke kelas.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-5">
          {classes.map((cls) => (
            <Link
              key={cls.classId}
              href={`/coach/classes/${cls.classId}`}
              className="group block bg-white border border-slate-100 rounded-3xl p-6 shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07)] hover:border-emerald-500/30 hover:shadow-lg transition-all"
            >
              <div className="flex items-start justify-between gap-4 mb-5">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-lg text-[10px] font-black uppercase tracking-wider">
                      {cls.type}
                    </span>
                    {cls.isSubstitute && (
                      <span className="px-2.5 py-1 bg-amber-50 text-amber-700 rounded-lg text-[10px] font-black uppercase tracking-wider">
                        Substitute
                      </span>
                    )}
                  </div>
                  <h2 className="text-xl font-black text-brand-deep group-hover:text-emerald-700 transition-colors">
                    {cls.name}
                  </h2>
                  <p className="text-xs font-bold text-slate-400 mt-1">{formatSchedule(cls.nextSessionDate)}</p>
                </div>
                <span className="material-symbols-outlined text-slate-300 group-hover:text-emerald-500 transition-colors">arrow_forward</span>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-5">
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">Siswa</p>
                  <p className="text-lg font-black text-brand-deep">{cls.studentsCount || 0}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">Sesi Berikutnya</p>
                  <p className="text-sm font-black text-brand-deep">{cls.nextSessionDate ? format(new Date(cls.nextSessionDate), 'HH:mm', { locale: localeId }) : '-'}</p>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Materi Berikutnya</p>
                  <p className="text-sm font-bold text-slate-700">{cls.nextLesson?.title ?? 'Belum ada materi terjadwal'}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Block Aktif</p>
                  <p className="text-sm font-bold text-slate-700">{cls.currentBlock?.name ?? 'Belum ada block aktif'}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
