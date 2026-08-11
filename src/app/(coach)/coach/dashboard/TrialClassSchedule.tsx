import { format, isToday, isTomorrow } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import type { TrialClassSubmission } from '@/lib/dao/trialClassDao';

type TrialClassScheduleProps = {
  trials: TrialClassSubmission[];
};

function getDateLabel(date: Date) {
  if (isToday(date)) return `Hari ini, ${format(date, 'HH.mm')}`;
  if (isTomorrow(date)) return `Besok, ${format(date, 'HH.mm')}`;
  return format(date, 'EEEE, d MMMM yyyy, HH.mm', { locale: localeId });
}

export default function TrialClassSchedule({ trials }: TrialClassScheduleProps) {
  if (trials.length === 0) return null;

  return (
    <section
      className="mb-8 overflow-hidden rounded-3xl border border-sky-100 bg-white shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07)]"
    >
      <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined flex size-10 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-600">
            person_play
          </span>
          <div>
            <h2 className="font-extrabold text-brand-deep">Trial Class Terjadwal</h2>
            <p className="mt-0.5 text-xs font-medium text-slate-500">Peserta trial yang ditugaskan kepada Anda</p>
          </div>
        </div>
        <span className="w-fit rounded-full bg-sky-50 px-3 py-1 text-xs font-extrabold text-sky-700">
          {trials.length} trial
        </span>
      </div>

      <div className="divide-y divide-slate-100">
        {trials.map((trial) => {
          const scheduledAt = new Date(trial.scheduled_at!);
          const isOnline = trial.trial_mode === 'ONLINE';

          return (
            <article key={trial.id} className="px-5 py-5 sm:px-6">
              <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="break-words text-base font-extrabold text-brand-deep">{trial.student_name}</h3>
                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase ${
                      isOnline ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'
                    }`}>
                      {isOnline ? 'Online' : 'Offline'}
                    </span>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-extrabold uppercase text-slate-600">
                      {trial.student_grade}
                    </span>
                  </div>

                  <div className="mt-3 grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
                    <p className="flex min-w-0 items-start gap-2 font-semibold">
                      <span className="material-symbols-outlined mt-0.5 text-lg text-sky-600">calendar_month</span>
                      <span>{getDateLabel(scheduledAt)} WIB ({trial.duration_minutes} menit)</span>
                    </p>
                    <p className="flex min-w-0 items-start gap-2">
                      <span className="material-symbols-outlined mt-0.5 text-lg text-slate-400">school</span>
                      <span className="break-words">{trial.school_name}</span>
                    </p>
                  </div>

                  {trial.notes ? (
                    <div className="mt-3 flex items-start gap-2 rounded-xl bg-slate-50 px-3 py-2.5 text-xs leading-relaxed text-slate-600">
                      <span className="material-symbols-outlined mt-0.5 text-base text-slate-400">notes</span>
                      <p className="break-words"><span className="font-extrabold text-slate-700">Catatan:</span> {trial.notes}</p>
                    </div>
                  ) : null}
                </div>

                <div className="w-full border-t border-slate-100 pt-4 xl:w-auto xl:border-t-0 xl:pt-0">
                  <a
                    href={`/coach/trials/${trial.id}`}
                    data-testid={`trial-detail-${trial.id}`}
                    className="trial-detail-action"
                    style={{ backgroundColor: '#22367b', color: '#ffffff' }}
                  >
                    <span className="material-symbols-outlined text-xl" aria-hidden="true">assignment</span>
                    <span>Detail Trial</span>
                    <span className="material-symbols-outlined text-lg" aria-hidden="true">arrow_forward</span>
                  </a>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
