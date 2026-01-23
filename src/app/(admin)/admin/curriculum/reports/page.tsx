import { getSessionOrThrow } from '@/lib/auth';
import { assertRole } from '@/lib/roles';
import { getSupabaseAdmin } from '@/lib/supabaseServer';
import Link from 'next/link';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import type { CSSProperties } from 'react';
import ReportActions from './ReportActions';

export const dynamic = 'force-dynamic';

const REPORT_TYPE_LABELS: Record<string, string> = {
    TOO_DIFFICULT: 'Terlalu Sulit',
    UNCLEAR: 'Materi Kurang Jelas',
    BUG: 'Ada Bug/Error',
    OUTDATED: 'Materi Tidak Relevan',
    OTHER: 'Lainnya',
};

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
    PENDING: { label: 'Menunggu', color: '#f97316', bg: '#fff7ed' },
    IN_PROGRESS: { label: 'Diproses', color: '#2563eb', bg: '#eff6ff' },
    RESOLVED: { label: 'Selesai', color: '#16a34a', bg: '#f0fdf4' },
    DISMISSED: { label: 'Ditolak', color: '#64748b', bg: '#f1f5f9' },
};

export default async function LessonReportsPage() {
    const session = await getSessionOrThrow();
    await assertRole(session, 'ADMIN');

    const supabase = getSupabaseAdmin();

    // Fetch lesson reports - simple query first
    const { data: reports, error } = await supabase
        .from('lesson_reports')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching lesson reports:', error);
    }

    // Fetch related data separately
    const reportList = reports || [];

    // Get coach and lesson info for each report
    const enrichedReports = await Promise.all(
        reportList.map(async (report: any) => {
            // Get coach name
            const { data: coach } = await supabase
                .from('users')
                .select('id, name')
                .eq('id', report.coach_id)
                .single();

            // Get lesson info with block
            const { data: lesson } = await supabase
                .from('lesson_templates')
                .select('id, title, block_id')
                .eq('id', report.lesson_template_id)
                .single();

            // Get block info for level_id
            let block = null;
            if (lesson?.block_id) {
                const { data: blockData } = await supabase
                    .from('blocks')
                    .select('id, level_id')
                    .eq('id', lesson.block_id)
                    .single();
                block = blockData;
            }

            return {
                ...report,
                coach,
                lesson,
                block,
            };
        })
    );

    return (
        <div style={containerStyle}>
            <header style={headerStyle}>
                <div>
                    <h1 style={titleStyle}>📋 Laporan Masalah Lesson</h1>
                    <p style={subtitleStyle}>
                        Laporan dari coach tentang masalah pada materi lesson
                    </p>
                </div>
                <Link href="/admin/curriculum" style={backLinkStyle}>
                    ← Kembali ke Kurikulum
                </Link>
            </header>

            {/* Stats */}
            <div style={statsRowStyle}>
                <div style={statCardStyle}>
                    <div style={{ fontSize: '2rem', fontWeight: 800, color: '#f97316' }}>
                        {enrichedReports.filter((r: any) => r.status === 'PENDING').length}
                    </div>
                    <div style={{ color: '#64748b', fontSize: '0.85rem' }}>Menunggu</div>
                </div>
                <div style={statCardStyle}>
                    <div style={{ fontSize: '2rem', fontWeight: 800, color: '#2563eb' }}>
                        {enrichedReports.filter((r: any) => r.status === 'IN_PROGRESS').length}
                    </div>
                    <div style={{ color: '#64748b', fontSize: '0.85rem' }}>Diproses</div>
                </div>
                <div style={statCardStyle}>
                    <div style={{ fontSize: '2rem', fontWeight: 800, color: '#16a34a' }}>
                        {enrichedReports.filter((r: any) => r.status === 'RESOLVED').length}
                    </div>
                    <div style={{ color: '#64748b', fontSize: '0.85rem' }}>Selesai</div>
                </div>
            </div>

            {/* Reports List */}
            <div style={listStyle}>
                {enrichedReports.length === 0 ? (
                    <div style={emptyStyle}>
                        <p>Belum ada laporan masalah dari coach.</p>
                    </div>
                ) : (
                    enrichedReports.map((report: any) => {
                        const statusInfo = STATUS_LABELS[report.status] || STATUS_LABELS.PENDING;
                        const typeLabel = REPORT_TYPE_LABELS[report.report_type] || report.report_type;

                        return (
                            <div key={report.id} style={reportCardStyle}>
                                <div style={reportHeaderStyle}>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                                            <span style={{ ...typeBadgeStyle, background: '#fef2f2', color: '#dc2626' }}>
                                                {typeLabel}
                                            </span>
                                            <span style={{ ...statusBadgeStyle, background: statusInfo.bg, color: statusInfo.color }}>
                                                {statusInfo.label}
                                            </span>
                                        </div>
                                        <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#1e293b', margin: '0.25rem 0' }}>
                                            {report.lesson?.title || 'Lesson tidak ditemukan'}
                                        </h3>
                                        <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                                            Dilaporkan oleh <strong>{report.coach?.name || 'Unknown'}</strong> • {format(new Date(report.created_at), 'd MMM yyyy, HH:mm', { locale: id })}
                                        </div>
                                    </div>
                                </div>

                                <div style={descriptionStyle}>
                                    {report.description}
                                </div>

                                <div style={actionsRowStyle}>
                                    <ReportActions reportId={report.id} currentStatus={report.status} />
                                    {report.block?.level_id && report.lesson?.block_id && (
                                        <Link
                                            href={`/admin/curriculum/${report.block.level_id}/blocks/${report.lesson.block_id}#lesson-${report.lesson_template_id}`}
                                            style={viewLessonLinkStyle}
                                        >
                                            Lihat Lesson →
                                        </Link>
                                    )}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}

const containerStyle: CSSProperties = {
    maxWidth: '1000px',
    margin: '0 auto',
    padding: '0 1.5rem 3rem',
};

const headerStyle: CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '1.5rem',
    flexWrap: 'wrap',
    gap: '1rem',
};

const titleStyle: CSSProperties = {
    fontSize: '1.5rem',
    fontWeight: 800,
    color: '#1e293b',
    marginBottom: '0.25rem',
};

const subtitleStyle: CSSProperties = {
    color: '#64748b',
    fontSize: '0.9rem',
};

const backLinkStyle: CSSProperties = {
    color: '#2563eb',
    fontSize: '0.9rem',
    fontWeight: 600,
    textDecoration: 'none',
};

const statsRowStyle: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '1rem',
    marginBottom: '1.5rem',
};

const statCardStyle: CSSProperties = {
    background: '#fff',
    padding: '1rem',
    borderRadius: '12px',
    border: '1px solid #e2e8f0',
    textAlign: 'center',
};

const listStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
};

const emptyStyle: CSSProperties = {
    background: '#f8fafc',
    padding: '3rem',
    borderRadius: '12px',
    textAlign: 'center',
    color: '#64748b',
};

const reportCardStyle: CSSProperties = {
    background: '#fff',
    padding: '1.25rem',
    borderRadius: '12px',
    border: '1px solid #e2e8f0',
};

const reportHeaderStyle: CSSProperties = {
    display: 'flex',
    gap: '1rem',
    marginBottom: '0.75rem',
};

const typeBadgeStyle: CSSProperties = {
    padding: '0.2rem 0.5rem',
    borderRadius: '4px',
    fontSize: '0.75rem',
    fontWeight: 600,
};

const statusBadgeStyle: CSSProperties = {
    padding: '0.2rem 0.5rem',
    borderRadius: '4px',
    fontSize: '0.75rem',
    fontWeight: 600,
};

const descriptionStyle: CSSProperties = {
    background: '#f8fafc',
    padding: '0.75rem',
    borderRadius: '8px',
    fontSize: '0.9rem',
    color: '#475569',
    lineHeight: 1.5,
    marginBottom: '0.75rem',
};

const actionsRowStyle: CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '1rem',
};

const viewLessonLinkStyle: CSSProperties = {
    color: '#2563eb',
    fontSize: '0.85rem',
    fontWeight: 600,
    textDecoration: 'none',
};
