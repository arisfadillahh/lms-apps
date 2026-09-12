import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { ArrowLeft, BookOpen, CalendarClock, ExternalLink, FileText, GraduationCap, UserRound } from 'lucide-react';

import { getSessionOrThrow } from '@/lib/auth';
import { assertRole } from '@/lib/roles';
import { getSupabaseAdmin } from '@/lib/supabaseServer';

import LessonReportEditor from './LessonReportEditor';

const EKSKUL_LESSON_TITLE = /^\[Ekskul lesson: ([^\]]+)\]\s*/;

const REPORT_TYPE_LABELS: Record<string, string> = {
  TOO_DIFFICULT: 'Terlalu Sulit',
  UNCLEAR: 'Materi Kurang Jelas',
  BUG: 'Ada Bug/Error',
  OUTDATED: 'Materi Tidak Relevan',
  OTHER: 'Lainnya',
};

type PageProps = { params: Promise<{ id: string }> };

export default async function LessonReportDetailPage({ params }: PageProps) {
  const session = await getSessionOrThrow();
  await assertRole(session, 'ADMIN');

  const { id } = await params;
  const supabase = getSupabaseAdmin();
  const { data: report } = await (supabase as any)
    .from('lesson_reports')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (!report) notFound();

  const embeddedEkskulTitle = report.description?.match(EKSKUL_LESSON_TITLE)?.[1] ?? null;
  const cleanDescription = report.description?.replace(EKSKUL_LESSON_TITLE, '').trim() ?? '';
  const { data: coach } = await supabase
    .from('users')
    .select('id, full_name')
    .eq('id', report.coach_id)
    .maybeSingle();

  let lesson: any = null;
  let contextName = 'Weekly curriculum';
  let editLessonHref: string | null = null;

  if (report.lesson_template_id) {
    const { data: weeklyLesson } = await supabase
      .from('lesson_templates')
      .select('*')
      .eq('id', report.lesson_template_id)
      .maybeSingle();
    lesson = weeklyLesson;

    if (weeklyLesson?.block_id) {
      const { data: block } = await supabase
        .from('blocks')
        .select('id, name, level_id')
        .eq('id', weeklyLesson.block_id)
        .maybeSingle();
      if (block) {
        contextName = block.name;
        editLessonHref = `/admin/curriculum/${block.level_id}/blocks/${block.id}?editLesson=${weeklyLesson.id}#lesson-${weeklyLesson.id}`;
      }
    }
  } else if (embeddedEkskulTitle) {
    const { data: matches } = await supabase
      .from('ekskul_lessons')
      .select('*')
      .eq('title', embeddedEkskulTitle)
      .limit(2);

    if (matches?.length === 1) {
      lesson = matches[0];
      const { data: plan } = await supabase
        .from('ekskul_lesson_plans')
        .select('id, name')
        .eq('id', matches[0].plan_id)
        .maybeSingle();
      contextName = plan?.name ?? 'Lesson Ekskul';
      editLessonHref = `/admin/ekskul/${matches[0].plan_id}?editLesson=${matches[0].id}#lesson-${matches[0].id}`;
    } else {
      lesson = { title: embeddedEkskulTitle };
      contextName = matches?.length ? 'Lesson Ekskul dengan judul serupa' : 'Lesson Ekskul';
    }
  }

  const meetingCount = lesson?.estimated_meeting_count ?? lesson?.estimated_meetings ?? null;
  const reportedAt = new Date(report.created_at).toLocaleString('id-ID', {
    dateStyle: 'long',
    timeStyle: 'short',
  });

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 pb-10">
      <Link href="/admin/curriculum/reports" className="inline-flex w-fit items-center gap-2 text-sm font-bold text-slate-600 hover:text-slate-950">
        <ArrowLeft size={17} /> Kembali ke laporan lesson
      </Link>

      <header className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase text-rose-700">{REPORT_TYPE_LABELS[report.report_type] ?? report.report_type}</p>
            <h1 className="mt-2 text-2xl font-bold text-slate-950 sm:text-3xl">Detail laporan lesson</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Periksa masalah yang dilaporkan Coach, lihat konteks lesson, lalu perbarui tindak lanjutnya.</p>
          </div>
          <span className="w-fit rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700">{report.status}</span>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Meta icon={<UserRound size={17} />} label="Dilaporkan oleh" value={coach?.full_name ?? 'Coach tidak ditemukan'} />
          <Meta icon={<CalendarClock size={17} />} label="Waktu laporan" value={reportedAt} />
          <Meta icon={<GraduationCap size={17} />} label="Sumber lesson" value={report.lesson_template_id ? 'Weekly' : 'Ekskul'} />
        </div>
      </header>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,.9fr)]">
        <LessonReportEditor
          reportId={report.id}
          initialReportType={report.report_type}
          initialDescription={cleanDescription}
          initialStatus={report.status}
        />

        <aside className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase text-emerald-700">Lesson yang dilaporkan</p>
              <h2 className="mt-2 text-xl font-bold text-slate-950">{lesson?.title ?? 'Lesson tidak ditemukan'}</h2>
              <p className="mt-1 text-sm text-slate-600">{contextName}</p>
            </div>
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-emerald-50 text-emerald-700"><BookOpen size={20} /></div>
          </div>

          <dl className="mt-5 grid gap-4 border-y border-slate-100 py-5 text-sm">
            <Detail label="Ringkasan" value={lesson?.summary ?? 'Belum ada ringkasan lesson.'} />
            <Detail label="Jumlah pertemuan" value={meetingCount ? `${meetingCount} sesi` : 'Belum diatur'} />
            <Detail label="Make-up task" value={lesson?.make_up_instructions ?? 'Belum ada instruksi.'} />
          </dl>

          <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            {lesson?.slide_url && <ExternalAction href={lesson.slide_url} label="Buka slide" />}
            {lesson?.example_url && <ExternalAction href={lesson.example_url} label="Buka contoh" />}
          </div>

          {editLessonHref ? (
            <Link href={editLessonHref} className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-[#22367b] bg-white px-4 text-sm font-bold text-[#22367b] hover:bg-blue-50">
              <FileText size={17} /> Buka editor lesson
            </Link>
          ) : (
            <p className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">Editor langsung belum tersedia karena referensi lesson lama tidak unik. Laporan tetap dapat diedit tanpa mengubah lesson yang salah.</p>
          )}
        </aside>
      </div>
    </div>
  );
}

function Meta({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return <div className="flex items-start gap-3 rounded-lg bg-slate-50 p-3 text-slate-700"><span className="mt-0.5 text-slate-500">{icon}</span><div><dt className="text-xs font-semibold text-slate-500">{label}</dt><dd className="mt-0.5 font-bold text-slate-900">{value}</dd></div></div>;
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-xs font-bold uppercase text-slate-500">{label}</dt><dd className="mt-1 whitespace-pre-wrap leading-6 text-slate-800">{value}</dd></div>;
}

function ExternalAction({ href, label }: { href: string; label: string }) {
  return <a href={href} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-bold text-slate-700 hover:bg-slate-50">{label}<ExternalLink size={15} /></a>;
}
