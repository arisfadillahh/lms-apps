'use client';

import { ChevronDown, ExternalLink, Image as ImageIcon, Monitor, UserRound } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import type { Database } from '@/types/supabase';
import { formatIssueReportReference } from '@/lib/issueReports';

import styles from './IssueReportsClient.module.css';

type IssueReport = Database['public']['Tables']['issue_reports']['Row'];
type Status = IssueReport['status'];
type Priority = IssueReport['priority'];

const statusLabels: Record<Status, string> = { OPEN: 'Baru', IN_PROGRESS: 'Ditangani', RESOLVED: 'Selesai', CLOSED: 'Ditutup' };
const priorityLabels: Record<Priority, string> = { LOW: 'Rendah', MEDIUM: 'Sedang', HIGH: 'Tinggi', CRITICAL: 'Kritis' };

export default function IssueReportsClient({ initialReports }: { initialReports: IssueReport[] }) {
  const [reports, setReports] = useState(initialReports);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'ALL' | Status>('ALL');
  const [role, setRole] = useState<'ALL' | 'ADMIN' | 'COACH' | 'CODER'>('ALL');
  const [expandedId, setExpandedId] = useState<string | null>(initialReports[0]?.id || null);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return reports.filter((report) => {
      if (status !== 'ALL' && report.status !== status) return false;
      if (role !== 'ALL' && report.reporter_role !== role) return false;
      if (!normalized) return true;
      return [report.title, report.description, report.reporter_name, formatIssueReportReference(report.id)]
        .some((value) => value.toLowerCase().includes(normalized));
    });
  }, [query, reports, role, status]);

  return (
    <>
      <div className={styles.toolbar}>
        <input className={`input ${styles.search}`} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari judul, pelapor, deskripsi, atau ID report..." />
        <select className={`input ${styles.select}`} value={status} onChange={(event) => setStatus(event.target.value as 'ALL' | Status)}>
          <option value="ALL">Semua status</option>
          {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <select className={`input ${styles.select}`} value={role} onChange={(event) => setRole(event.target.value as typeof role)}>
          <option value="ALL">Semua pelapor</option><option value="ADMIN">Admin</option><option value="COACH">Coach</option><option value="CODER">Coder</option>
        </select>
        <span className={styles.count}>{filtered.length} report</span>
      </div>

      <div className={styles.list}>
        {filtered.map((report) => {
          const expanded = expandedId === report.id;
          return (
            <article className={styles.item} key={report.id}>
              <button type="button" className={styles.summary} onClick={() => setExpandedId(expanded ? null : report.id)} aria-expanded={expanded}>
                <div className={styles.main}>
                  <div className={styles.topline}>
                    <span className={`${styles.badge} ${statusClass(report.status)}`}>{statusLabels[report.status]}</span>
                    <span className={`${styles.badge} ${priorityClass(report.priority)}`}>{priorityLabels[report.priority]}</span>
                    <span className={styles.reference}>{formatIssueReportReference(report.id)}</span>
                  </div>
                  <h2 className={styles.title}>{report.title}</h2>
                  <div className={styles.meta}>
                    <span><UserRound size={13} /> {report.reporter_name} ({report.reporter_role === 'ADMIN' ? 'Admin' : report.reporter_role === 'COACH' ? 'Coach' : 'Coder'})</span>
                    <span>{formatDate(report.created_at)}</span>
                    {report.screenshot_url ? <span><ImageIcon size={13} /> Ada screenshot</span> : null}
                  </div>
                </div>
                <ChevronDown className={`${styles.chevron} ${expanded ? styles.chevronOpen : ''}`} size={20} />
              </button>
              {expanded ? <ReportDetail report={report} onUpdated={(next) => setReports((current) => current.map((item) => item.id === next.id ? next : item))} /> : null}
            </article>
          );
        })}
        {filtered.length === 0 ? <div className={styles.empty}>Tidak ada report yang sesuai dengan filter.</div> : null}
      </div>
    </>
  );
}

function ReportDetail({ report, onUpdated }: { report: IssueReport; onUpdated: (report: IssueReport) => void }) {
  const router = useRouter();
  const [status, setStatus] = useState(report.status);
  const [priority, setPriority] = useState(report.priority);
  const [adminNotes, setAdminNotes] = useState(report.admin_notes || '');
  const [resolutionSummary, setResolutionSummary] = useState(report.resolution_summary || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const viewport = report.viewport && typeof report.viewport === 'object' && !Array.isArray(report.viewport) ? report.viewport : {};

  const save = async () => {
    setSaving(true); setError(null);
    try {
      const response = await fetch(`/api/admin/issue-reports/${report.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, priority, adminNotes, resolutionSummary }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Perubahan belum berhasil disimpan');
      onUpdated({ ...payload.report, screenshot_url: report.screenshot_url });
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Perubahan belum berhasil disimpan');
    } finally { setSaving(false); }
  };

  return (
    <div className={styles.detail}>
      <div className={styles.content}>
        <h3 className={styles.sectionTitle}>Deskripsi dari pelapor</h3>
        <p className={styles.description}>{report.description}</p>
        {report.screenshot_url ? <a href={report.screenshot_url} target="_blank" rel="noreferrer"><img className={styles.screenshot} src={report.screenshot_url} alt={`Screenshot ${report.title}`} /></a> : null}
        <div className={styles.technical}>
          <div className={styles.technicalRow}><strong>Halaman</strong><span>{report.page_url ? <a href={report.page_url} target="_blank" rel="noreferrer">{report.page_url} <ExternalLink size={10} style={{ display: 'inline' }} /></a> : '-'}</span></div>
          <div className={styles.technicalRow}><strong>Viewport</strong><code>{String(viewport.width || '-')} x {String(viewport.height || '-')}</code></div>
          <div className={styles.technicalRow}><strong>Perangkat</strong><code>{report.user_agent || '-'}</code></div>
          <div className={styles.technicalRow}><strong>WhatsApp</strong><code>{report.whatsapp_status}{report.whatsapp_error ? ` - ${report.whatsapp_error}` : ''}</code></div>
        </div>
      </div>
      <div className={styles.form}>
        <h3 className={styles.sectionTitle} style={{ margin: 0 }}>Tindak lanjut admin</h3>
        <div className={styles.row}>
          <div className={styles.field}><label>Status</label><select className="input" value={status} onChange={(event) => setStatus(event.target.value as Status)}>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
          <div className={styles.field}><label>Prioritas</label><select className="input" value={priority} onChange={(event) => setPriority(event.target.value as Priority)}>{Object.entries(priorityLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
        </div>
        <div className={styles.field}><label>Catatan internal admin</label><textarea className={`input ${styles.textarea}`} value={adminNotes} onChange={(event) => setAdminNotes(event.target.value)} placeholder="Hasil pengecekan awal, langkah reproduksi, atau PIC..." /></div>
        <div className={styles.field}><label>Ringkasan penyelesaian</label><textarea className={`input ${styles.textarea}`} value={resolutionSummary} onChange={(event) => setResolutionSummary(event.target.value)} placeholder="Wajib diisi sebelum status Selesai/Ditutup. Salin ringkasannya ke error-fixing log saat kode sudah diperbaiki." /></div>
        {error ? <p className={styles.error}>{error}</p> : null}
        <button type="button" className={styles.save} onClick={save} disabled={saving}>{saving ? 'Menyimpan...' : 'Simpan tindak lanjut'}</button>
      </div>
    </div>
  );
}

function formatDate(value: string) { return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Jakarta' }).format(new Date(value)); }
function statusClass(value: Status) { return ({ OPEN: styles.statusOpen, IN_PROGRESS: styles.statusProgress, RESOLVED: styles.statusResolved, CLOSED: styles.statusClosed })[value]; }
function priorityClass(value: Priority) { return ({ LOW: styles.priorityLow, MEDIUM: styles.priorityMedium, HIGH: styles.priorityHigh, CRITICAL: styles.priorityCritical })[value]; }
