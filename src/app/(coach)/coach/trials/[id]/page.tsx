import { notFound, redirect } from 'next/navigation';

import { getSessionOrThrow } from '@/lib/auth';
import { getTrialClassSubmission } from '@/lib/dao/trialClassDao';
import { getOrCreateDraftAssessment } from '@/lib/dao/trialAssessmentsDao';
import { assertRole } from '@/lib/roles';
import { getSupabaseAdmin } from '@/lib/supabaseServer';

import TrialAssessmentForm, { type LevelOption } from './TrialAssessmentForm';

export const dynamic = 'force-dynamic';

export default async function CoachTrialAssessmentPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionOrThrow();
  await assertRole(session, 'COACH');

  const { id } = await params;
  const trial = await getTrialClassSubmission(id);
  if (!trial || trial.coach_id !== session.user.id) {
    notFound();
  }

  if (trial.status !== 'SCHEDULED') {
    redirect('/coach/dashboard');
  }

  const supabase = getSupabaseAdmin();
  const assessmentPromise = getOrCreateDraftAssessment({ trialId: trial.id, coachId: session.user.id });
  const levelsPromise = supabase
    .from('levels')
    .select('id, name, order_index')
    .order('order_index', { ascending: true });
  const [assessment, levelsResult] = await Promise.all([
    assessmentPromise,
    levelsPromise,
  ]);

  if (levelsResult.error) {
    throw new Error(`Gagal mengambil level: ${levelsResult.error.message}`);
  }
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-10">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <div className="rounded-3xl border border-sky-100 bg-white p-6 shadow-sm">
          <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-sky-600">Trial Assessment</p>
          <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="lg:mr-auto">
              <h1 className="text-2xl font-black tracking-tight text-brand-deep sm:text-3xl">{trial.student_name}</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                Isi observasi singkat setelah trial selesai. Angka rubrik hanya untuk internal Clevio, report parent
                akan tampil dalam bahasa naratif.
              </p>
            </div>
            <div className="rounded-2xl bg-sky-50 px-4 py-3 text-sm font-bold text-sky-800">
              {trial.trial_mode === 'ONLINE' ? 'Online' : 'Offline'} · {trial.student_grade}
            </div>
            {trial.trial_mode === 'ONLINE' && trial.google_meet_url ? (
              <a
                href={trial.google_meet_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-extrabold text-white transition-colors hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
              >
                <span className="material-symbols-outlined text-xl">video_call</span>
                Masuk Google Meet
              </a>
            ) : null}
          </div>
        </div>

        <TrialAssessmentForm
          trial={trial}
          assessment={assessment}
          levels={(levelsResult.data ?? []) as LevelOption[]}
        />
      </div>
    </main>
  );
}
