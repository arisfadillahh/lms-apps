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
        <h1 style={{ fontSize: '1.6rem', fontWeight: 600, marginBottom: '0.75rem' }}>Pitching Day Reports</h1>
        <p style={{ color: '#64748b', maxWidth: '56rem' }}>
          Generate PDF reports from rubric submissions and deliver them to parents via WhatsApp. Once a report is sent,
          the status will be recorded along with the delivery timestamp.
        </p>
      </header>

      <section style={cardStyle}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={{ background: '#f1f5f9', textAlign: 'left' }}>
            <tr>
              <th style={thStyle}>Coder</th>
              <th style={thStyle}>Class</th>
              <th style={thStyle}>Submitted</th>
              <th style={thStyle}>PDF</th>
              <th style={thStyle}>WhatsApp</th>
              <th style={thStyle}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {submissions.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: '1rem', textAlign: 'center', color: '#6b7280' }}>
                  No rubric submissions available.
                </td>
              </tr>
            ) : (
              submissions.map((row) => {
                const summary = reportMap.get(row.submission.id);
                const report = summary?.report ?? row.report;
                const pdfGenerated = Boolean(report);
                const waSent = Boolean(report?.sent_via_whatsapp);
                return (
                  <tr key={row.submission.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={tdStyle}>{row.coder.full_name}</td>
                    <td style={tdStyle}>
                      {row.class.name}
                      <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                        {row.class.type}
                        {row.blockName ? ` • ${row.blockName}` : ''}
                        {row.submission.semester_tag ? ` • Semester ${row.submission.semester_tag}` : ''}
                      </div>
                    </td>
                    <td style={tdStyle}>
                      {row.submission.submitted_at
                        ? new Date(row.submission.submitted_at).toLocaleString()
                        : '—'}
                    </td>
                    <td style={tdStyle}>
                      {pdfGenerated ? (
                        <a
                          href={report?.pdf_url ?? '#'}
                          target="_blank"
                          rel="noreferrer"
                          style={{ color: '#1e3a5f', fontWeight: 500 }}
                        >
                          View PDF
                        </a>
                      ) : (
                        <span style={{ color: '#b91c1c' }}>Not generated</span>
                      )}
                    </td>
                    <td style={tdStyle}>
                      {waSent ? (
                        <span style={{ color: '#15803d', fontWeight: 500 }}>
                          Sent {report?.sent_to_parent_at ? new Date(report.sent_to_parent_at).toLocaleString() : ''}
                        </span>
                      ) : (
                        <span style={{ color: '#6b7280' }}>Pending</span>
                      )}
                    </td>
                    <td style={{ ...tdStyle, display: 'flex', gap: '0.5rem' }}>
                      <GenerateReportButton submissionId={row.submission.id} disabled={pdfGenerated} />
                      {report ? (
                        <SendReportButton reportId={report.id} disabled={waSent} />
                      ) : (
                        <button
                          type="button"
                          disabled
                          style={{
                            padding: '0.45rem 0.85rem',
                            borderRadius: '0.5rem',
                            border: '1px solid #cbd5f5',
                            background: '#f8fafc',
                            color: '#94a3b8',
                            fontSize: '0.85rem',
                          }}
                        >
                          Send via WhatsApp
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}

const cardStyle: CSSProperties = {
  background: '#ffffff',
  borderRadius: '0.75rem',
  border: '1px solid #e5e7eb',
  padding: '1.25rem 1.5rem',
  overflowX: 'auto',
};

const thStyle: CSSProperties = {
  padding: '0.75rem 1rem',
  fontSize: '0.85rem',
  color: '#475569',
  borderBottom: '1px solid #e2e8f0',
};

const tdStyle: CSSProperties = {
  padding: '0.85rem 1rem',
  fontSize: '0.9rem',
  color: '#1f2937',
  verticalAlign: 'top',
  minWidth: '160px',
};
