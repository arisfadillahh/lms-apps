import type { CSSProperties } from 'react';

import { getSessionOrThrow } from '@/lib/auth';
import { reportsDao } from '@/lib/dao';

export default async function CoderReportsPage() {
  const session = await getSessionOrThrow();
  const reports = await reportsDao.listReportsByCoder(session.user.id);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <header>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 600, marginBottom: '0.75rem' }}>Reports</h1>
        <p style={{ color: '#64748b' }}>Download your Pitching Day reports once they are ready.</p>
      </header>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {reports.length === 0 ? (
          <p style={{ color: '#6b7280' }}>No reports available yet.</p>
        ) : (
          reports.map((report) => (
            <div key={report.id} style={cardStyle}>
              <div>
                <p style={{ fontWeight: 600, color: '#0f172a' }}>Generated: {new Date(report.generated_at).toLocaleString()}</p>
                <p style={{ fontSize: '0.85rem', color: '#64748b' }}>
                  Status: {report.sent_via_whatsapp ? 'Sent to parent' : 'Not yet sent'}
                </p>
              </div>
              <a href={report.pdf_url} target="_blank" rel="noreferrer" style={{ color: '#1e3a5f', fontWeight: 500 }}>
                View PDF
              </a>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

const cardStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  borderRadius: '0.75rem',
  border: '1px solid #e2e8f0',
  background: '#ffffff',
  padding: '1rem 1.25rem',
};
