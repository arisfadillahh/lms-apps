import type { CSSProperties } from 'react';
import { format } from 'date-fns';

const tableStyle: CSSProperties = {
  border: `1px solid var(--color-border)`,
  borderRadius: 'var(--radius-lg)',
  background: 'var(--color-bg-surface)',
  overflowX: 'auto',
  boxShadow: 'var(--shadow-medium)',
};

const headerStyle: CSSProperties = {
  padding: '0.75rem 1rem',
  fontSize: '0.85rem',
  color: 'var(--color-text-secondary)',
  borderBottom: `1px solid var(--color-border)`,
  whiteSpace: 'nowrap',
};

const nameCellStyle: CSSProperties = {
  padding: '0.85rem 1rem',
  fontSize: '0.9rem',
  color: 'var(--color-text-primary)',
  borderBottom: `1px solid var(--color-border)`,
  fontWeight: 600,
  whiteSpace: 'nowrap',
};

const cellStyle: CSSProperties = {
  padding: '0.85rem 1rem',
  fontSize: '0.9rem',
  textAlign: 'center',
  borderBottom: `1px solid var(--color-border)`,
};

type SessionColumn = {
  id: string;
  dateTime: string;
};

type Row = {
  fullName: string;
  statuses: Array<'PRESENT' | 'LATE' | 'EXCUSED' | 'ABSENT' | null>;
};

type AttendanceMonthlyTableProps = {
  sessions: SessionColumn[];
  rows: Row[];
  highlightSessionId?: string;
};

function renderStatus(status: Row['statuses'][number]) {
  if (!status) {
    return <span style={{ color: 'var(--color-text-muted)' }}>—</span>;
  }
  switch (status) {
    case 'PRESENT':
    case 'LATE':
      return <span style={{ color: 'var(--color-success)', fontWeight: 600 }}>✓</span>;
    case 'EXCUSED':
      return <span style={{ color: 'var(--color-warning)', fontWeight: 600 }}>E</span>;
    case 'ABSENT':
      return <span style={{ color: 'var(--color-danger)', fontWeight: 600 }}>A</span>;
    default:
      return <span style={{ color: 'var(--color-text-muted)' }}>—</span>;
  }
}

export default function AttendanceMonthlyTable({ sessions, rows, highlightSessionId }: AttendanceMonthlyTableProps) {
  if (sessions.length === 0 || rows.length === 0) {
    return (
      <section style={tableStyle}>
        <div style={{ padding: '1.25rem 1.5rem' }}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>Rekap Bulanan</h2>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', marginTop: '0.35rem' }}>
            Belum ada sesi terjadwal pada bulan ini.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section style={tableStyle}>
      <div style={{ padding: '1.25rem 1.5rem', borderBottom: `1px solid var(--color-border)` }}>
        <h2 style={{ fontSize: '1.2rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>Rekap Bulanan</h2>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', marginTop: '0.35rem' }}>
          Tanda ✓ untuk hadir/late, E untuk izin, A untuk absen.
        </p>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead style={{ background: 'rgba(15, 23, 42, 0.04)' }}>
          <tr>
            <th style={{ ...headerStyle, textAlign: 'left' }}>Nama</th>
            {sessions.map((session) => {
              const date = new Date(session.dateTime);
              return (
                <th
                  key={session.id}
                  style={{
                    ...headerStyle,
                    backgroundColor:
                      highlightSessionId && session.id === highlightSessionId ? 'rgba(37, 99, 235, 0.12)' : 'transparent',
                  }}
                >
                  <div>{format(date, 'dd MMM')}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{format(date, 'EEE')}</div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.fullName}>
              <td style={nameCellStyle}>{row.fullName}</td>
              {row.statuses.map((status, index) => {
                const session = sessions[index];
                return (
                  <td
                    key={`${row.fullName}-${session?.id ?? index}`}
                    style={{
                      ...cellStyle,
                      backgroundColor:
                        session && highlightSessionId && session.id === highlightSessionId
                          ? 'rgba(37, 99, 235, 0.1)'
                          : 'transparent',
                    }}
                  >
                    {renderStatus(status)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
