import type { CSSProperties } from 'react';

import { reportsDao, rubricsDao } from '@/lib/dao';

import GenerateReportButton from './GenerateReportButton';
import SendReportButton from './SendReportButton';

export default async function AdminReportsPage() {
  const submissions = await rubricsDao.listSubmissionsWithReports(60);
  const recentReports = await reportsDao.listReportSummaries();

  const reportMap = new Map(recentReports.map((item) => [item.report.rubric_submission_id, item]));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <header>
        <h1 style={{ fontSize: '1.8rem', fontWeight: 800, color: '#1e293b', marginBottom: '0.5rem', letterSpacing: '-0.02em' }}>Laporan Pitching Day</h1>
        <p style={{ color: '#64748b', maxWidth: '56rem', fontSize: '1rem', lineHeight: '1.6' }}>
          Generate laporan PDF dari submission rubrik dan kirimkan ke orang tua via WhatsApp.
          Status pengiriman akan tercatat setelah laporan dikirim.
        </p>
      </header>

      <section style={cardStyle}>
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #f1f5f9' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1e293b', margin: 0 }}>Daftar Submission & Laporan</h3>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ background: '#f8fafc', textAlign: 'left' }}>
              <tr>
                <th style={thStyle}>Coder</th>
                <th style={thStyle}>Kelas</th>
                <th style={thStyle}>Submitted</th>
                <th style={thStyle}>PDF Report</th>
                <th style={thStyle}>WhatsApp Status</th>
                <th style={thStyle}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {submissions.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>
                    Belum ada submission rubrik.
                  </td>
                </tr>
              ) : (
                submissions.map((row) => {
                  const summary = reportMap.get(row.submission.id);
                  const report = summary?.report ?? row.report;
                  // eslint-disable-next-line @typescript-eslint/no-unused-vars
                  const pdfGenerated = Boolean(report);
                  // eslint-disable-next-line @typescript-eslint/no-unused-vars
                  const waSent = Boolean(report?.sent_via_whatsapp);

                  // Re-calculate strictly based on report existence to avoid errors
                  const isPdfReady = !!report;
                  const isWaSent = !!report?.sent_via_whatsapp;

                  return (
                    <tr key={row.submission.id} style={{ borderBottom: '1px solid #f1f5f9', transition: 'background 0.2s' }}>
                      <td style={tdStyle}>
                        <span style={{ fontWeight: 600, color: '#1e293b' }}>{row.coder.full_name}</span>
                      </td>
                      <td style={tdStyle}>
                        <span style={{ display: 'block', fontWeight: 500, color: '#334155' }}>{row.class.name}</span>
                        <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.2rem' }}>
                          {row.class.type}
                          {row.blockName ? ` • ${row.blockName}` : ''}
                          {row.submission.semester_tag ? ` • Sem ${row.submission.semester_tag}` : ''}
                        </div>
                      </td>
                      <td style={tdStyle}>
                        {row.submission.submitted_at
                          ? new Date(row.submission.submitted_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
                          : '—'}
                      </td>
                      <td style={tdStyle}>
                        {isPdfReady ? (
                          <a
                            href={report?.pdf_url ?? '#'}
                            target="_blank"
                            rel="noreferrer"
                            style={{
                              display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                              color: '#3b82f6', fontWeight: 500, textDecoration: 'none',
                              background: '#eff6ff', padding: '0.25rem 0.6rem', borderRadius: '6px', fontSize: '0.8rem'
                            }}
                          >
                            📄 Lihat PDF
                          </a>
                        ) : (
                          <span style={{ fontSize: '0.8rem', color: '#94a3b8', fontStyle: 'italic' }}>Belum generate</span>
                        )}
                      </td>
                      <td style={tdStyle}>
                        {isWaSent ? (
                          <div>
                            <span style={{
                              padding: '0.25rem 0.6rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600,
                              background: '#dcfce7', color: '#15803d', display: 'inline-block'
                            }}>
                              Terkirim
                            </span>
                            <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '0.2rem' }}>
                              {report?.sent_to_parent_at ? new Date(report.sent_to_parent_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) : ''}
                            </div>
                          </div>
                        ) : (
                          <span style={{
                            padding: '0.25rem 0.6rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 500,
                            background: '#f1f5f9', color: '#64748b'
                          }}>
                            Pending
                          </span>
                        )}
                      </td>
                      <td style={{ ...tdStyle, minWidth: '180px' }}>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                          <GenerateReportButton submissionId={row.submission.id} disabled={isPdfReady} />
                          {report ? (
                            <SendReportButton reportId={report.id} disabled={isWaSent} />
                          ) : (
                            <button
                              type="button"
                              disabled
                              style={{
                                padding: '0.5rem 0.85rem',
                                borderRadius: '8px',
                                border: '1px solid #e2e8f0',
                                background: '#f8fafc',
                                color: '#cbd5e1',
                                fontSize: '0.85rem',
                                cursor: 'not-allowed',
                                fontWeight: 500
                              }}
                            >
                              Kirim WA
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
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
  padding: '1rem 1.5rem',
  fontSize: '0.75rem',
  color: '#64748b',
  borderBottom: '1px solid #e2e8f0',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  fontWeight: 600,
};

const tdStyle: CSSProperties = {
  padding: '1rem 1.5rem',
  fontSize: '0.9rem',
  color: '#334155',
  verticalAlign: 'middle',
  minWidth: '120px',
};
