import { getSessionOrThrow } from '@/lib/auth';
import { assertRole } from '@/lib/roles';
import { getSupabaseAdmin } from '@/lib/supabaseServer';
import Link from 'next/link';
import { AlertCircle, Clock, CheckCircle, Eye } from 'lucide-react';
import PageHead from '@/components/admin/PageHead';
import KanbanBoard from './KanbanBoard';

export const dynamic = 'force-dynamic';

const EKSKUL_LESSON_TITLE = /^\[Ekskul lesson: ([^\]]+)\]\s*/;

function getEmbeddedEkskulLesson(report: { description?: string | null }) {
  const match = report.description?.match(EKSKUL_LESSON_TITLE);
  if (!match) return null;

  return {
    id: '',
    title: match[1],
    block_id: '',
  };
}

export default async function LessonReportsPage() {
  const session = await getSessionOrThrow();
  await assertRole(session, 'ADMIN');

  const supabase = getSupabaseAdmin();

  const { data: reports, error } = await supabase
    .from('lesson_reports')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching lesson reports:', error);
  }

  const reportList = reports || [];

  const enrichedReports = await Promise.all(
    reportList.map(async (report: any) => {
      const { data: coach } = await supabase
        .from('users')
        .select('id, full_name')
        .eq('id', report.coach_id)
        .single();

      const { data: lesson } = await supabase
        .from('lesson_templates')
        .select('id, title, block_id')
        .eq('id', report.lesson_template_id)
        .single();

      let block = null;
      if (lesson?.block_id) {
        const { data: blockData } = await supabase
          .from('blocks')
          .select('id, level_id')
          .eq('id', lesson.block_id)
          .single();
        block = blockData;
      }

      const embeddedEkskulLesson = getEmbeddedEkskulLesson(report);
      return {
        ...report,
        description: report.description?.replace(EKSKUL_LESSON_TITLE, '').trim() ?? '',
        coach,
        lesson: lesson ?? embeddedEkskulLesson,
        block,
      };
    })
  );

  const pendingCount = enrichedReports.filter((r: any) => r.status === 'PENDING').length;
  const inProgressCount = enrichedReports.filter((r: any) => r.status === 'IN_PROGRESS').length;
  const resolvedCount = enrichedReports.filter((r: any) => r.status === 'RESOLVED').length;

  return (
    <div className="col gap-4">
      <PageHead
        title="Laporan Lesson"
        desc="Laporan dari coach tentang masalah pada materi lesson — bug, konten usang, atau kesulitan siswa."
        actions={
          <Link href="/admin/curriculum" className="btn btn-ghost btn-sm">
            ← Kembali ke Kurikulum
          </Link>
        }
      />

      {/* Stat Strip */}
      <div className="grid grid-4">
        <div className="stat">
          <div className="stat-icon"><AlertCircle size={16} /></div>
          <div className="stat-label">Total Laporan</div>
          <div className="stat-value">{enrichedReports.length}</div>
        </div>
        <div className="stat">
          <div className="stat-icon" style={{ background: '#fff7ed', color: '#f97316' }}><Clock size={16} /></div>
          <div className="stat-label">Menunggu</div>
          <div className="stat-value">{pendingCount}</div>
          {pendingCount > 0 && <div className="stat-foot" style={{ color: '#d97706' }}>perlu ditangani</div>}
        </div>
        <div className="stat">
          <div className="stat-icon" style={{ background: '#eff6ff', color: '#2563eb' }}><Eye size={16} /></div>
          <div className="stat-label">Diproses</div>
          <div className="stat-value">{inProgressCount}</div>
        </div>
        <div className="stat">
          <div className="stat-icon" style={{ background: '#f0fdf4', color: '#16a34a' }}><CheckCircle size={16} /></div>
          <div className="stat-label">Selesai</div>
          <div className="stat-value">{resolvedCount}</div>
        </div>
      </div>

      {/* Kanban Board */}
      <KanbanBoard initialReports={enrichedReports} />
    </div>
  );
}
