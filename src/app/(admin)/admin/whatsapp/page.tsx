import type { CSSProperties } from 'react';

import { reportsDao } from '@/lib/dao';
import { getStatus } from '@/lib/whatsapp/client';

import RequestConnectionButton from './RequestConnectionButton';

export default async function AdminWhatsappPage() {
  const [statusResult, logs] = await Promise.all([fetchStatusSafely(), reportsDao.listWhatsappLogs(40)]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <header>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 600, marginBottom: '0.75rem' }}>WhatsApp Worker</h1>
        <p style={{ color: '#64748b', maxWidth: '48rem' }}>
          Monitor the waweb.js worker that delivers absence and report notifications. Request a connection to prompt a
          QR code scan when the worker is offline.
        </p>
      </header>

      <section style={{ ...cardStyle, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <p style={{ fontSize: '0.9rem', color: '#6b7280', marginBottom: '0.25rem' }}>Current status</p>
            <strong style={{ fontSize: '1.1rem', color: mapStatusColor(statusResult.status) }}>
              {statusResult.status}
            </strong>
            {statusResult.connectedNumber ? (
              <p style={{ fontSize: '0.85rem', color: '#475569' }}>Connected number: {statusResult.connectedNumber}</p>
            ) : null}
            <p style={{ fontSize: '0.85rem', color: '#475569' }}>Queue length: {statusResult.queued}</p>
          </div>
          <RequestConnectionButton />
        </div>
        {statusResult.error ? (
          <p style={{ color: '#b91c1c', fontSize: '0.9rem' }}>{statusResult.error}</p>
        ) : null}
      </section>

      <section style={cardStyle}>
        <h2 style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: '1rem' }}>Recent Logs</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={{ background: '#f1f5f9', textAlign: 'left' }}>
            <tr>
              <th style={thStyle}>Timestamp</th>
              <th style={thStyle}>Category</th>
              <th style={thStyle}>Status</th>
              <th style={thStyle}>Payload</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ padding: '1rem', textAlign: 'center', color: '#6b7280' }}>
                  No logs recorded yet.
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <td style={tdStyle}>{new Date(log.created_at).toLocaleString()}</td>
                  <td style={tdStyle}>{log.category}</td>
                  <td style={tdStyle}>{log.status}</td>
                  <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: '0.75rem' }}>
                    {JSON.stringify(log.payload)}
                  </td>
                </tr>
              ))
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
};

type StatusInfo = {
  status: 'ONLINE' | 'OFFLINE' | 'INITIALIZING';
  queued: number;
  connectedNumber?: string;
  error?: string;
};

async function fetchStatusSafely(): Promise<StatusInfo> {
  try {
    const data = await getStatus();
    return data;
  } catch (error: any) {
    return {
      status: 'OFFLINE',
      queued: 0,
      error: error.message ?? 'Unable to reach worker',
    };
  }
}

function mapStatusColor(status: StatusInfo['status']): string {
  switch (status) {
    case 'ONLINE':
      return '#16a34a';
    case 'INITIALIZING':
      return '#d97706';
    default:
      return '#b91c1c';
  }
}
