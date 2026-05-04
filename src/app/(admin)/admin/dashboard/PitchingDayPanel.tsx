'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronRight, Search, X } from 'lucide-react';

type PitchingRow = {
  id: string;
  classId: string;
  className: string;
  coachName: string;
  blockName: string;
  pitchingDayDate: string | null;
  pitchingDayStatus: 'SCHEDULED' | 'ESTIMATED';
  estimatedWeeks: number;
  lessonPosition: number;
  totalLessons: number;
  students: number;
};

type FilterMode = 'THIS_MONTH' | 'SCHEDULED' | 'ESTIMATED' | 'ALL';

function isThisMonth(date: string | null, now: Date): boolean {
  if (!date) return false;
  const value = new Date(date);
  return value.getFullYear() === now.getFullYear() && value.getMonth() === now.getMonth();
}

function weeksRemainingThisMonth(now: Date): number {
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const diffMs = endOfMonth.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diffMs / (7 * 24 * 60 * 60 * 1000)));
}

function formatDate(date: string): string {
  return new Intl.DateTimeFormat('id-ID', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(new Date(date));
}

function formatTarget(row: PitchingRow): string {
  if (row.pitchingDayDate) {
    return formatDate(row.pitchingDayDate);
  }
  return `Estimasi ${row.estimatedWeeks} minggu lagi`;
}

function filterRows(rows: PitchingRow[], filter: FilterMode, now: Date): PitchingRow[] {
  if (filter === 'SCHEDULED') {
    return rows.filter((row) => row.pitchingDayDate);
  }
  if (filter === 'ESTIMATED') {
    return rows.filter((row) => !row.pitchingDayDate);
  }
  if (filter === 'THIS_MONTH') {
    const weeksLeft = weeksRemainingThisMonth(now);
    return rows.filter((row) => (
      row.pitchingDayDate
        ? isThisMonth(row.pitchingDayDate, now)
        : row.estimatedWeeks <= weeksLeft
    ));
  }
  return rows;
}

function PitchingRows({ rows }: { rows: PitchingRow[] }) {
  if (rows.length === 0) {
    return (
      <tr>
        <td colSpan={6} className="empty">
          Belum ada estimasi pitching day pada filter ini.
        </td>
      </tr>
    );
  }

  return rows.map((row, index) => (
    <tr key={`${row.id}-${index}`}>
      <td style={{ fontWeight: 700 }}>{formatTarget(row)}</td>
      <td>{row.className}</td>
      <td className="muted">{row.blockName}</td>
      <td>{row.coachName}</td>
      <td>{row.students}</td>
      <td style={{ textAlign: 'right' }}>
        <span className={`badge ${row.pitchingDayDate ? 'badge-info' : 'badge-warn'}`}>
          {row.pitchingDayDate ? 'Terjadwal' : 'Estimasi'}
        </span>
      </td>
    </tr>
  ));
}

export default function PitchingDayPanel({ rows }: { rows: PitchingRow[] }) {
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState<FilterMode>('THIS_MONTH');
  const now = useMemo(() => new Date(), []);
  const defaultRows = useMemo(() => filterRows(rows, 'THIS_MONTH', now).slice(0, 4), [rows, now]);
  const filteredRows = useMemo(() => filterRows(rows, filter, now), [rows, filter, now]);

  return (
    <div className="card card-p">
      <div className="row between" style={{ marginBottom: 14, gap: 12 }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 15 }}>Estimasi Pitching Day bulan ini</div>
          <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
            Berdasarkan lesson kedua dari belakang di setiap block.
          </div>
        </div>
        <button type="button" className="btn btn-sm" onClick={() => setIsOpen(true)}>
          <Search size={14} />
          Lihat semua
        </button>
      </div>

      <table className="table">
        <thead>
          <tr>
            <th>Target</th>
            <th>Kelas</th>
            <th>Block</th>
            <th>Coach</th>
            <th>Siswa</th>
            <th />
          </tr>
        </thead>
        <tbody>
          <PitchingRows rows={defaultRows} />
        </tbody>
      </table>

      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Semua estimasi pitching day"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 80,
            background: 'rgba(15, 23, 42, 0.42)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
        >
          <div className="card card-p" style={{ width: 'min(960px, 100%)', maxHeight: '86vh', overflow: 'auto' }}>
            <div className="row between" style={{ marginBottom: 14, gap: 12 }}>
              <div>
                <div style={{ fontWeight: 900, fontSize: 18 }}>Semua Estimasi Pitching Day</div>
                <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
                  Tanggal pasti muncul kalau lesson pitching day sudah punya session.
                </div>
              </div>
              <button type="button" className="btn btn-sm" onClick={() => setIsOpen(false)} aria-label="Tutup">
                <X size={16} />
              </button>
            </div>

            <div className="row" style={{ gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
              {[
                ['THIS_MONTH', 'Bulan ini'],
                ['SCHEDULED', 'Terjadwal'],
                ['ESTIMATED', 'Estimasi'],
                ['ALL', 'Semua'],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  className={`btn btn-sm ${filter === value ? 'btn-primary' : ''}`}
                  onClick={() => setFilter(value as FilterMode)}
                >
                  {label}
                </button>
              ))}
            </div>

            <table className="table">
              <thead>
                <tr>
                  <th>Target</th>
                  <th>Kelas</th>
                  <th>Block</th>
                  <th>Coach</th>
                  <th>Siswa</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                <PitchingRows rows={filteredRows} />
              </tbody>
            </table>

            <Link href="/admin/reports" className="btn btn-primary" style={{ width: '100%', marginTop: 14 }}>
              Buka rapor
              <ChevronRight size={14} />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
