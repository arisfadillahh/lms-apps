'use client';

import { useState, useTransition, type CSSProperties } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';

interface Report {
  id: string;
  status: string;
  report_type: string;
  description: string;
  created_at: string;
  coach: { id: string; full_name: string } | null;
  lesson: { id: string; title: string; block_id: string } | null;
  block: { id: string; level_id: string } | null;
}

interface KanbanBoardProps {
  initialReports: Report[];
}

const REPORT_TYPE_LABELS: Record<string, string> = {
  TOO_DIFFICULT: 'Terlalu Sulit',
  UNCLEAR: 'Materi Kurang Jelas',
  BUG: 'Ada Bug/Error',
  OUTDATED: 'Materi Tidak Relevan',
  OTHER: 'Lainnya',
};

const COLUMNS: { key: string; label: string; badgeClass: string; color: string; bg: string }[] = [
  { key: 'PENDING',     label: 'Menunggu',  badgeClass: 'badge-warn',    color: '#d97706', bg: '#fffbeb' },
  { key: 'IN_PROGRESS', label: 'Diproses',  badgeClass: 'badge-info',    color: '#2563eb', bg: '#eff6ff' },
  { key: 'RESOLVED',    label: 'Selesai',   badgeClass: 'badge-success', color: '#16a34a', bg: '#f0fdf4' },
  { key: 'DISMISSED',   label: 'Ditolak',   badgeClass: 'badge-neutral', color: '#64748b', bg: '#f8fafc' },
];

export default function KanbanBoard({ initialReports }: KanbanBoardProps) {
  const [reports, setReports] = useState<Report[]>(initialReports);
  const [dragging, setDragging] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [mobileColumn, setMobileColumn] = useState(COLUMNS[0].key);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [successId, setSuccessId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const getByStatus = (status: string) => reports.filter((r) => r.status === status);

  const moveReport = (reportId: string, newStatus: string) => {
    const oldStatus = reports.find((r) => r.id === reportId)?.status;
    if (!oldStatus || oldStatus === newStatus) return;

    // Optimistic update
    setReports((prev) =>
      prev.map((r) => (r.id === reportId ? { ...r, status: newStatus } : r))
    );
    setSavingId(reportId);
    setSuccessId(null);

    startTransition(async () => {
      try {
        const res = await fetch(`/api/admin/lesson-reports/${reportId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: newStatus }),
        });
        if (!res.ok) {
          // Revert on failure
          setReports((prev) =>
            prev.map((r) => (r.id === reportId ? { ...r, status: oldStatus } : r))
          );
          setSavingId(null);
        } else {
          setSavingId(null);
          setSuccessId(reportId);
          // Clear success indicator after 1.8s
          setTimeout(() => setSuccessId((cur) => (cur === reportId ? null : cur)), 1800);
        }
      } catch {
        setReports((prev) =>
          prev.map((r) => (r.id === reportId ? { ...r, status: oldStatus } : r))
        );
        setSavingId(null);
      }
    });
  };

  return (
    <>
      {/* Board hint */}
      <div className="kanban-board-hint muted" style={{ fontSize: 12.5, marginBottom: 2 }}>
        💡 Drag kartu ke kolom lain untuk mengubah status laporan secara langsung.
      </div>

      <div className="kanban-mobile-tabs" role="tablist" aria-label="Filter status laporan">
        {COLUMNS.map((col) => {
          const active = mobileColumn === col.key;
          return (
            <button
              key={col.key}
              type="button"
              role="tab"
              aria-selected={active}
              className={`kanban-mobile-tab ${active ? 'is-active' : ''}`}
              style={{ '--tab-color': col.color } as CSSProperties}
              onClick={() => setMobileColumn(col.key)}
            >
              <span>{col.label}</span>
              <strong>{getByStatus(col.key).length}</strong>
            </button>
          );
        })}
      </div>

      {/* Kanban grid */}
      <div
        className="kanban-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
          gap: 14,
          alignItems: 'start',
        }}
      >
        {COLUMNS.map((col) => {
          const colReports = getByStatus(col.key);
          const isOver = dragOver === col.key;

          return (
            <div
              key={col.key}
              className={`kanban-column ${mobileColumn === col.key ? 'kanban-column-active' : ''}`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(col.key); }}
              onDragLeave={() => setDragOver(null)}
              onDrop={(e) => {
                e.preventDefault();
                const reportId = e.dataTransfer.getData('reportId');
                if (reportId) moveReport(reportId, col.key);
                setDragOver(null);
              }}
              style={{
                borderRadius: 'var(--radius-lg)',
                background: isOver ? col.bg : 'var(--surface-2)',
                border: `2px dashed ${isOver ? col.color : 'transparent'}`,
                transition: 'background .15s, border-color .15s',
                minHeight: 120,
              }}
            >
              {/* Column header */}
              <div
                style={{
                  padding: '10px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderBottom: `2px solid ${col.color}20`,
                  borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0',
                  background: `${col.color}12`,
                }}
              >
                <span style={{ fontWeight: 800, fontSize: 13, color: col.color }}>
                  {col.label}
                </span>
                <span
                  style={{
                    background: col.color,
                    color: '#fff',
                    borderRadius: 999,
                    fontWeight: 700,
                    fontSize: 11,
                    padding: '1px 8px',
                    minWidth: 22,
                    textAlign: 'center',
                  }}
                >
                  {colReports.length}
                </span>
              </div>

              {/* Cards */}
              <div style={{ padding: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {colReports.length === 0 && (
                  <div
                    className="muted"
                    style={{
                      padding: '24px 12px',
                      textAlign: 'center',
                      fontSize: 12,
                      border: '1px dashed var(--border-strong)',
                      borderRadius: 'var(--radius)',
                    }}
                  >
                    Tidak ada laporan
                  </div>
                )}
                {colReports.map((report) => (
                  <div
                    key={report.id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('reportId', report.id);
                      setDragging(report.id);
                    }}
                    onDragEnd={() => setDragging(null)}
                    className="card kanban-report-card"
                    style={{
                      padding: 12,
                      gap: 8,
                      cursor: dragging === report.id ? 'grabbing' : 'grab',
                      display: 'flex',
                      flexDirection: 'column',
                      opacity: 1,
                      transition: 'transform .12s, box-shadow .12s, outline-color .2s',
                      userSelect: 'none',
                      outline: successId === report.id
                        ? '2px solid #16a34a'
                        : savingId === report.id
                        ? '2px solid var(--accent)'
                        : dragging === report.id
                        ? '2px dashed var(--border-strong)'
                        : '2px solid transparent',
                      background: successId === report.id ? '#f0fdf4' : undefined,
                    }}
                    onMouseEnter={(e) => {
                      if (dragging !== report.id) {
                        (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-1px)';
                        (e.currentTarget as HTMLDivElement).style.boxShadow = 'var(--shadow)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLDivElement).style.transform = '';
                      (e.currentTarget as HTMLDivElement).style.boxShadow = '';
                    }}
                  >
                    {/* Type badge + date */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
                      <span className="badge badge-danger" style={{ fontSize: 10.5 }}>
                        {REPORT_TYPE_LABELS[report.report_type] || report.report_type}
                      </span>
                      <span className="muted" style={{ fontSize: 10.5, whiteSpace: 'nowrap' }}>
                        {format(new Date(report.created_at), 'd MMM', { locale: id })}
                      </span>
                    </div>

                    {/* Lesson title */}
                    <div style={{ fontWeight: 700, fontSize: 13, lineHeight: 1.3 }}>
                      {report.lesson?.title || 'Lesson tidak ditemukan'}
                    </div>

                    {/* Description */}
                    <div
                      className="muted"
                      style={{
                        fontSize: 11.5,
                        lineHeight: 1.4,
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}
                    >
                      {report.description}
                    </div>

                    {/* Saving/success indicator */}
                    {(savingId === report.id || successId === report.id) && (
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: successId === report.id ? '#16a34a' : 'var(--accent)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        {successId === report.id ? '✅ Tersimpan' : '⏳ Menyimpan...'}
                      </div>
                    )}

                    {/* Footer: coach + link */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4, marginTop: 2 }}>
                      <div className="row gap-1">
                        <div
                          className="avatar"
                          style={{ width: 20, height: 20, fontSize: 9, background: 'var(--accent-weak)', color: 'var(--accent)' }}
                        >
                          {(report.coach?.full_name || '?').charAt(0).toUpperCase()}
                        </div>
                        <span className="muted" style={{ fontSize: 11 }}>{report.coach?.full_name || 'Unknown'}</span>
                      </div>
                      {report.block?.level_id && report.lesson?.block_id && (
                        <Link
                          href={`/admin/curriculum/${report.block.level_id}/blocks/${report.lesson.block_id}#lesson-${report.id}`}
                          className="btn btn-ghost"
                          style={{ padding: '2px 8px', fontSize: 11, height: 'auto' }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          Lihat →
                        </Link>
                      )}
                    </div>

                    {/* Quick status change via select (fallback for non-drag) */}
                    <select
                      value={report.status}
                      onChange={(e) => moveReport(report.id, e.target.value)}
                      disabled={savingId === report.id}
                      className="input"
                      style={{ padding: '4px 8px', fontSize: 11, marginTop: 2 }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {COLUMNS.map((c) => (
                        <option key={c.key} value={c.key}>{c.label}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Responsive hint */}
      <style>{`
        @media (max-width: 900px) {
          .kanban-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
        @media (max-width: 600px) {
          .kanban-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </>
  );
}
