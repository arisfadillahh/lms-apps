import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { CSSProperties } from 'react';

import { getSessionOrThrow } from '@/lib/auth';
import { blocksDao, lessonTemplatesDao, levelsDao } from '@/lib/dao';
import { assertRole } from '@/lib/roles';

import UpdateBlockForm from '../../../UpdateBlockForm';
import BlockLessonList from '../../../BlockLessonList';

import { ChevronRight } from 'lucide-react';

export default async function BlockDetailPage({ params }: { params: Promise<{ levelId: string; blockId: string }> }) {
    const session = await getSessionOrThrow();
    await assertRole(session, 'ADMIN');

    const { levelId, blockId } = await params;

    if (!levelId || !blockId) notFound();

    const level = await levelsDao.getLevelById(levelId);
    const block = await blocksDao.getBlockById(blockId);
    if (!level || !block) notFound();

    const lessons = await lessonTemplatesDao.listLessonsByBlock(blockId, { includeArchived: true });
    const activeLessons = lessons.filter((lesson) => !lesson.is_archived);

    const totalMeetings = activeLessons.reduce((sum, l) => sum + (l.estimated_meeting_count || 1), 0);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            {/* Breadcrumb / Header */}
            <header>
                <div style={breadcrumbStyle}>
                    <Link href="/admin/curriculum" style={breadcrumbLinkStyle}>Curriculum</Link>
                    <ChevronRight size={14} color="#94a3b8" />
                    <Link href={`/admin/curriculum/${levelId}/blocks`} style={breadcrumbLinkStyle}>{level.name}</Link>
                    <ChevronRight size={14} color="#94a3b8" />
                    <span style={{ color: '#0f172a', fontWeight: 600 }}>{block.name}</span>
                </div>

                <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                        <h1 style={{ fontSize: '1.8rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.5rem' }}>
                            {block.name}
                        </h1>
                        <p style={{ color: '#64748b', maxWidth: '600px' }}>
                            {block.summary || 'Tidak ada deskripsi.'}
                        </p>
                    </div>
                    <div style={{ flexShrink: 0 }}>
                        {/* We can put the Edit Block button here too if we want */}
                    </div>
                </div>
            </header>

            <div style={statsRowStyle}>
                <div style={statCardStyle}>
                    <span style={statLabelStyle}>Total Lesson</span>
                    <span style={statValueStyle}>{activeLessons.length}</span>
                </div>
                <div style={statCardStyle}>
                    <span style={statLabelStyle}>Total Pertemuan</span>
                    <span style={statValueStyle}>{totalMeetings}</span>
                </div>
                <div style={statCardStyle}>
                    <span style={statLabelStyle}>Status</span>
                    <span style={{ color: block.is_published ? '#16a34a' : '#dc2626', fontWeight: 600 }}>
                        {block.is_published ? 'Aktif' : 'Draft'}
                    </span>
                </div>
            </div>

            <main style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <BlockLessonList blockId={blockId} lessons={lessons} />
            </main>
        </div>
    );
}

const breadcrumbStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    fontSize: '0.85rem',
    color: '#64748b',
};

const breadcrumbLinkStyle: CSSProperties = {
    color: '#64748b',
    textDecoration: 'none',
    transition: 'color 0.2s',
};

const primaryButtonStyle: CSSProperties = {
    textDecoration: 'none',
    transition: 'color 0.2s',
};

const statsRowStyle: CSSProperties = { display: 'flex', gap: '1rem' };
const statCardStyle: CSSProperties = { background: '#fff', padding: '1rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '0.25rem' };
const statLabelStyle: CSSProperties = { fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 };
const statValueStyle: CSSProperties = { fontSize: '1.25rem', fontWeight: 700, color: '#0f172a' };
