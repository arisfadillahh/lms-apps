import type { CSSProperties } from 'react';
import { getSupabaseAdmin } from '@/lib/supabaseServer';
import { getAppBaseUrl } from '@/lib/env';
import { Inbox, History, CheckCircle2, Mail, Eye } from 'lucide-react';
import SendReportButton from './SendReportButton';
import RejectReportButton from './RejectReportButton';

export const revalidate = 0;

/*
- [x] WhatsApp Client: Sistem kini menggunakan Baileys secara eksklusif (tidak lagi butuh `WA_WORKER_URL`).
- [x] Migrasi SQL: `migrations/20260312_report_add_sent_status.sql` (Add SENT & SUBMITTED values to Enum).
- [x] API Update: `POST /api/admin/reports/[id]/send-whatsapp` kini mengubah status ke `PUBLISHED`.
- [x] Filter Coder: `/coder/reports` hanya me-listing status `PUBLISHED`.
- [x] Filter Preview: `/report/[id]` mengecek session untuk status non-PUBLISHED.
*/

export default async function AdminReportsPage() {
  const supabase = getSupabaseAdmin();

  // Fetch all reports that are NOT DRAFT
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
  const submittedReports = allReports.filter(r => r.status === 'SUBMITTED');
  const publishedReports = allReports.filter(r => r.status === 'PUBLISHED');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <header>
        <h1 style={{ fontSize: '1.8rem', fontWeight: 800, color: '#1e293b', marginBottom: '0.5rem', letterSpacing: '-0.02em' }}>Clevio Digital Reports</h1>
        <p style={{ color: '#64748b', maxWidth: '56rem', fontSize: '1rem', lineHeight: '1.6' }}>
          Kelola alur persetujuan rapor. Rapor yang sudah di-publish Coach akan masuk ke <b>Inbox</b>. 
          Pencet tombol "Publish & Kirim" untuk mengirim ke Orang Tua dan memunculkannya di dashboard Coder.
        </p>
      </header>

      {/* INBOX SECTION */}
      <section style={cardStyle}>
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ padding: '0.4rem', borderRadius: '8px', background: '#3b82f6', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Inbox size={20} />
            </div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1e293b', margin: 0 }}>Inbox Rapor (Perlu Review Admin)</h3>
          </div>
          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1d4ed8', background: '#dbeafe', padding: '0.2rem 0.8rem', borderRadius: '20px' }}>
            {submittedReports.length} Menunggu
          </span>
        </div>
        <ReportTable reports={submittedReports} isInbox={true} />
      </section>

      {/* HISTORY SECTION */}
      <section style={{ ...cardStyle, opacity: 0.85 }}>
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ padding: '0.4rem', borderRadius: '8px', background: '#10b981', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <History size={20} />
            </div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1e293b', margin: 0 }}>Riwayat Rapor Terkirim</h3>
          </div>
        </div>
        <ReportTable reports={publishedReports} isInbox={false} />
      </section>
    </div>
  );
}

function ReportTable({ reports, isInbox }: { reports: any[], isInbox: boolean }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead style={{ background: '#f8fafc', textAlign: 'left' }}>
          <tr>
            <th style={thStyle}>Coder</th>
            <th style={thStyle}>Kelas & Block</th>
            <th style={thStyle}>Nilai</th>
            <th style={thStyle}>{isInbox ? 'Dipublish Coach Pada' : 'Dikirim Admin Pada'}</th>
            <th style={thStyle}>Kirim WA</th>
            <th style={thStyle}>Aksi</th>
          </tr>
        </thead>
        <tbody>
          {reports.length === 0 ? (
            <tr>
              <td colSpan={6} style={{ padding: '3rem 2rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.9rem' }}>
                {isInbox ? 'Yah! Belum ada rapor baru dari Coach.' : 'Belum ada riwayat pengiriman.'}
              </td>
            </tr>
          ) : (
            reports.map((report: any) => {
              const reportUrl = `${getAppBaseUrl()}/report/${report.id}`;
              const isPublished = report.status === 'PUBLISHED';

              return (
                <tr key={report.id} style={{ borderBottom: '1px solid #f1f5f9', transition: 'background 0.2s' }}>
                  <td style={tdStyle}>
                    <span style={{ fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <div style={{ width: '28px', height: '28px', background: isPublished ? '#d1fae5' : '#dbeafe', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: isPublished ? '#059669' : '#1d4ed8', fontSize: '0.8rem' }}>
                        {report.coder?.full_name?.charAt(0) || 'C'}
                      </div>
                      {report.coder?.full_name || 'Coder'}
                    </span>
                  </td>
                  <td style={tdStyle}>
                    <span style={{ display: 'block', fontWeight: 600, color: '#334155' }}>{(report.class as any)?.name}</span>
                    <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.2rem', fontWeight: 500 }}>
                      {(report.class as any)?.type === 'EKSKUL' ? 'Ekskul' : 'Reguler'} • {(report.block as any)?.name}
                    </div>
                  </td>
                  <td style={tdStyle}>
                     <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', background: '#f0fdf4', padding: '0.2rem 0.6rem', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
                       <span style={{ fontWeight: 800, color: '#16a34a', fontSize: '1.1rem' }}>{report.grade}</span>
                       <span style={{ fontWeight: 600, color: '#22c55e', fontSize: '0.8rem' }}>({report.average_score})</span>
                     </div>
                  </td>
                  <td style={tdStyle}>
                    <span style={{ color: '#475569', fontWeight: 500, fontSize: '0.85rem' }}>
                      {(isInbox ? report.updated_at : report.sent_at)
                        ? new Date(isInbox ? report.updated_at : report.sent_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                        : '—'}
                    </span>
                  </td>
                  <td style={tdStyle}>
                    {isPublished ? (
                      <span style={{
                        padding: '0.25rem 0.6rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700,
                        background: '#dcfce7', color: '#15803d', display: 'inline-flex', alignItems: 'center', gap: '0.3rem'
                      }}>
                        <CheckCircle2 size={14} /> Published
                      </span>
                    ) : (
                      <span style={{
                        padding: '0.25rem 0.6rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600,
                        background: '#fef3c7', color: '#92400e', display: 'inline-flex', alignItems: 'center', gap: '0.3rem'
                      }}>
                         <Mail size={14} /> Menunggu
                      </span>
                    )}
                  </td>
                  <td style={{ ...tdStyle, minWidth: '220px' }}>
                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                      <a 
                        href={reportUrl} 
                        target="_blank" 
                        rel="noreferrer"
                        style={{
                          display: 'inline-flex', 
                          alignItems: 'center', 
                          gap: '0.4rem', 
                          padding: '0.45rem 0.85rem', 
                          borderRadius: '0.5rem', 
                          background: '#eff6ff', 
                          color: '#2563eb', 
                          fontWeight: 600, 
                          fontSize: '0.85rem', 
                          textDecoration: 'none',
                          border: '1px solid #bfdbfe',
                          transition: 'all 0.2s'
                        }}
                      >
                        <Eye size={16} /> Web Preview
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

const cardStyle: CSSProperties = {
  background: '#ffffff',
  borderRadius: '16px',
  border: '1px solid #e2e8f0',
  overflow: 'hidden',
  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
};

const thStyle: CSSProperties = {
  padding: '1.25rem 1.5rem',
  fontSize: '0.75rem',
  color: '#64748b',
  borderBottom: '1px solid #e2e8f0',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  fontWeight: 700,
};

const tdStyle: CSSProperties = {
  padding: '1.25rem 1.5rem',
  fontSize: '0.9rem',
  color: '#334155',
  verticalAlign: 'middle',
};
