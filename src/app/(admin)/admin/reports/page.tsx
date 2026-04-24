import { getSupabaseAdmin } from '@/lib/supabaseServer';
import { getAppBaseUrl } from '@/lib/env';
import { Eye, Check, X, Mail, Send } from 'lucide-react';
import SendReportButton from './SendReportButton';
import RejectReportButton from './RejectReportButton';
import PageHead from '@/components/admin/PageHead';

export const revalidate = 0;

export default async function AdminReportsPage() {
  const supabase = getSupabaseAdmin();

  const { data: reports, error } = await supabase
    .from('block_reports')
    .select(`
      id,
      average_score,
      grade,
      status,
      sent_via_whatsapp,
      sent_at,
      updated_at,
      class:classes(name, type),
      block:blocks(name),
      coder:users!block_reports_coder_id_fkey(full_name)
    `)
    .neq('status', 'DRAFT')
    .order('updated_at', { ascending: false })
    .limit(200);

  if (error) {
    console.error('[AdminReportsPage] Query Error:', error);
  }

  const allReports = reports || [];
  const submittedReports = allReports.filter((r) => r.status === 'SUBMITTED');
  const publishedReports = allReports.filter((r) => r.status === 'PUBLISHED');

  return (
    <div className="col gap-4">
      <PageHead
        title="Status Rapor"
        desc="Kelola inbox rapor, approval admin, dan distribusi laporan ke orang tua."
      />

      {/* Stat Strip */}
      <div className="grid grid-4">
        <div className="stat">
          <div className="stat-icon"><Mail size={16} /></div>
          <div className="stat-label">Menunggu Review</div>
          <div className="stat-value">{submittedReports.length}</div>
        </div>
        <div className="stat">
          <div className="stat-icon"><Check size={16} /></div>
          <div className="stat-label">Terkirim Bulan Ini</div>
          <div className="stat-value">{publishedReports.length}</div>
        </div>
        <div className="stat">
          <div className="stat-icon"><Send size={16} /></div>
          <div className="stat-label">Via WhatsApp</div>
          <div className="stat-value">{allReports.filter((r) => r.sent_via_whatsapp).length}</div>
        </div>
        <div className="stat">
          <div className="stat-icon"><Eye size={16} /></div>
          <div className="stat-label">Total Rapor</div>
          <div className="stat-value">{allReports.length}</div>
        </div>
      </div>

      {/* Inbox — Perlu Review Admin */}
      <div className="card">
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', background: 'var(--surface-2)' }}>
          <div className="row between">
            <div className="row gap-2">
              <div style={{ width: 28, height: 28, borderRadius: 'var(--radius-sm)', background: 'var(--accent)', color: 'var(--accent-contrast)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Mail size={15} />
              </div>
              <div style={{ fontWeight: 800, fontSize: 14.5 }}>Inbox Rapor — perlu review Admin</div>
            </div>
            <span className="badge badge-info">{submittedReports.length} menunggu</span>
          </div>
        </div>
        <ReportTable reports={submittedReports} isInbox />
      </div>

      {/* History */}
      <div className="card">
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
          <div className="row gap-2">
            <div style={{ width: 28, height: 28, borderRadius: 'var(--radius-sm)', background: '#e9f7ed', color: '#117a3a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Check size={15} />
            </div>
            <div style={{ fontWeight: 800, fontSize: 14.5 }}>Riwayat Rapor Terkirim</div>
          </div>
        </div>
        <ReportTable reports={publishedReports} isInbox={false} />
      </div>
    </div>
  );
}

function ReportTable({ reports, isInbox }: { reports: any[]; isInbox: boolean }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="table">
        <thead>
          <tr>
            <th>Coder</th>
            <th>Kelas & Block</th>
            <th>Nilai</th>
            <th>{isInbox ? 'Dipublish Coach Pada' : 'Dikirim Admin Pada'}</th>
            <th>Status WA</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {reports.length === 0 ? (
            <tr>
              <td colSpan={6} className="empty">
                {isInbox ? 'Belum ada rapor baru dari Coach.' : 'Belum ada riwayat pengiriman.'}
              </td>
            </tr>
          ) : (
            reports.map((report: any) => {
              const reportUrl = `${getAppBaseUrl()}/report/${report.id}`;
              const isPublished = report.status === 'PUBLISHED';

              return (
                <tr key={report.id}>
                  <td>
                    <div className="row gap-2">
                      <div className="avatar">{report.coder?.full_name?.charAt(0) || 'C'}</div>
                      <span style={{ fontWeight: 700 }}>{report.coder?.full_name || 'Coder'}</span>
                    </div>
                  </td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{(report.class as any)?.name}</div>
                    <div className="muted" style={{ fontSize: 11.5, marginTop: 2 }}>
                      {(report.class as any)?.type === 'EKSKUL' ? 'Ekskul' : 'Reguler'} · {(report.block as any)?.name}
                    </div>
                  </td>
                  <td>
                    <div className="row gap-1">
                      <span style={{ fontSize: 18, fontWeight: 900 }}>{report.grade}</span>
                      <span className="muted" style={{ fontSize: 12, fontWeight: 600 }}>({report.average_score})</span>
                    </div>
                  </td>
                  <td className="muted" style={{ fontSize: 12.5 }}>
                    {(isInbox ? report.updated_at : report.sent_at)
                      ? new Date(isInbox ? report.updated_at : report.sent_at).toLocaleDateString('id-ID', {
                          day: 'numeric', month: 'short', year: 'numeric',
                          hour: '2-digit', minute: '2-digit',
                        })
                      : '—'}
                  </td>
                  <td>
                    {isPublished ? (
                      <span className="badge badge-success"><Check size={12} /> Published</span>
                    ) : (
                      <span className="badge badge-warn"><Mail size={12} /> Menunggu</span>
                    )}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div className="row gap-1" style={{ justifyContent: 'flex-end' }}>
                      <a
                        href={reportUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="btn btn-sm"
                      >
                        <Eye size={14} /> Preview
                      </a>
                      <RejectReportButton reportId={report.id} disabled={isPublished} />
                      <SendReportButton reportId={report.id} disabled={isPublished} />
                    </div>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
