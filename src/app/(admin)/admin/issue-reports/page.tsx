import { AlertTriangle, CheckCircle2, CircleDot, Clock3 } from 'lucide-react';

import PageHead from '@/components/admin/PageHead';
import { getSessionOrThrow } from '@/lib/auth';
import { assertRole } from '@/lib/roles';
import { getSupabaseAdmin } from '@/lib/supabaseServer';
import { createIssueScreenshotViewUrl } from '@/lib/storage';

import IssueReportsClient from './IssueReportsClient';

export const dynamic = 'force-dynamic';

export default async function AdminIssueReportsPage() {
  const session = await getSessionOrThrow();
  await assertRole(session, 'ADMIN');

  const { data, error } = await getSupabaseAdmin()
    .from('issue_reports')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(500);

  if (error) throw new Error(`Gagal memuat laporan masalah: ${error.message}`);
  const reports = await Promise.all((data || []).map(async (report) => ({
    ...report,
    screenshot_url: report.screenshot_storage_path
      ? (await createIssueScreenshotViewUrl(report.screenshot_storage_path)) || report.screenshot_url
      : report.screenshot_url,
  })));
  const open = reports.filter((item) => item.status === 'OPEN').length;
  const inProgress = reports.filter((item) => item.status === 'IN_PROGRESS').length;
  const critical = reports.filter((item) => item.priority === 'CRITICAL' && item.status !== 'CLOSED').length;
  const resolved = reports.filter((item) => item.status === 'RESOLVED' || item.status === 'CLOSED').length;

  return (
    <div className="admin-page-stack">
      <PageHead
        title="Laporan Masalah LMS"
        desc="Inbox kendala yang dikirim Coach dan Coder, lengkap dengan screenshot dan konteks perangkat."
      />

      <div className="grid grid-4" style={{ marginBottom: 18 }}>
        <Stat label="Report baru" value={open} icon={<CircleDot size={18} />} color="#dc2626" />
        <Stat label="Sedang ditangani" value={inProgress} icon={<Clock3 size={18} />} color="#d97706" />
        <Stat label="Prioritas kritis" value={critical} icon={<AlertTriangle size={18} />} color="#b91c1c" />
        <Stat label="Selesai" value={resolved} icon={<CheckCircle2 size={18} />} color="#15803d" />
      </div>

      <IssueReportsClient initialReports={reports} />
    </div>
  );
}

function Stat({ label, value, icon, color }: { label: string; value: number; icon: React.ReactNode; color: string }) {
  return (
    <div className="stat">
      <span className="stat-label">{label}</span>
      <strong className="stat-value">{value}</strong>
      <span className="stat-icon" style={{ color }}>{icon}</span>
    </div>
  );
}
