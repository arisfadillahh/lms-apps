import type { CSSProperties } from 'react';
import { FileText, Download, Calendar, CheckCircle, Clock } from 'lucide-react';

import { getSessionOrThrow } from '@/lib/auth';
import { reportsDao } from '@/lib/dao';

export default async function CoderReportsPage() {
  const session = await getSessionOrThrow();
  const reports = await reportsDao.listReportsByCoder(session.user.id);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', maxWidth: '1000px' }}>
      <header>
        <h1 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '0.5rem', color: '#1e293b', letterSpacing: '-0.02em' }}>
          Laporan Belajar
        </h1>
        <p style={{ color: '#64748b', fontSize: '1.05rem', lineHeight: 1.6 }}>
          Unduh laporan Rapor (Progress Report) kamu setiap akhir term.
        </p>
      </header>

      <section style={sectionStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '1rem' }}>
          <span style={{ width: '4px', height: '24px', background: '#8b5cf6', borderRadius: '2px' }}></span>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#1e293b', margin: 0 }}>Arsip Laporan</h2>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {reports.length === 0 ? (
            <div style={emptyStateStyle}>
              <FileText size={32} color="#cbd5e1" />
              <p>Belum ada laporan yang tersedia.</p>
            </div>
          ) : (
            reports.map((report) => {
              const isSent = report.sent_via_whatsapp;
              return (
                <div key={report.id} style={cardStyle}>
                  <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#f5f3ff', color: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <FileText size={24} />
                    </div>
                    <div>
                      <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: '#1e293b', margin: 0 }}>Progress Report</h3>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.3rem' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.85rem', color: '#64748b' }}>
                          <Calendar size={14} />
                          {new Date(report.generated_at).toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' })}
                        </span>
                        <span style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.3rem',
                          fontSize: '0.8rem',
                          fontWeight: 600,
                          padding: '0.2rem 0.5rem',
                          borderRadius: '6px',
                          background: isSent ? '#dcfce7' : '#f1f5f9',
                          color: isSent ? '#166534' : '#64748b'
                        }}>
                          {isSent ? <CheckCircle size={12} /> : <Clock size={12} />}
                          {isSent ? 'Terkirim' : 'Diproses'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <a
                    href={report.pdf_url}
                    target="_blank"
                    rel="noreferrer"
                    style={downloadButtonStyle}
                  >
                    <Download size={18} /> Unduh PDF
                  </a>
                </div>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}

const sectionStyle: CSSProperties = {
  background: '#ffffff',
  borderRadius: '16px',
  border: '1px solid #e2e8f0',
  boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
  padding: '1.5rem',
};

const cardStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  borderRadius: '12px',
  border: '1px solid #e2e8f0',
  background: '#ffffff',
  padding: '1.25rem',
  boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
  transition: 'transform 0.2s',
};

const emptyStateStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '0.75rem',
  padding: '3rem',
  background: '#f8fafc',
  borderRadius: '12px',
  border: '1px dashed #cbd5e1',
  color: '#94a3b8'
};

const downloadButtonStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.5rem',
  padding: '0.6rem 1.2rem',
  borderRadius: '10px',
  background: '#7c3aed',
  color: '#fff',
  fontWeight: 600,
  fontSize: '0.9rem',
  textDecoration: 'none',
  boxShadow: '0 4px 6px -1px rgba(124, 58, 237, 0.3)',
  transition: 'transform 0.1s'
};
