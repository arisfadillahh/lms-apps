import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { CSSProperties } from 'react';

import { getSessionOrThrow } from '@/lib/auth';
import { blocksDao, lessonTemplatesDao, levelsDao } from '@/lib/dao';
import { assertRole } from '@/lib/roles';

import UpdateBlockForm from '../../../UpdateBlockForm';
import LessonTable from '../../../LessonTable';
import CreateLessonButton from '../../../CreateLessonButton';
import ImportLessonsButton from '../../../ImportLessonsButton';
import ExportLessonsButton from '../../../ExportLessonsButton';

import { ChevronRight } from 'lucide-react';

export default async function BlockDetailPage({ params }: { params: Promise<{ levelId: string; blockId: string }> }) {
    const session = await getSessionOrThrow();
    await assertRole(session, 'ADMIN');

    const { levelId, blockId } = await params;

    if (!levelId || !blockId) notFound();

    const level = await levelsDao.getLevelById(levelId);
    const block = await blocksDao.getBlockById(blockId);
    if (!level || !block) notFound();

    const lessons = await lessonTemplatesDao.listLessonsByBlock(blockId);

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
                    {/* We can put the Edit Block button here too if we want */}
                    <div style={{ flexShrink: 0 }}>
                        {/* Reusing UpdateBlockForm might be tricky if it expects to just be a form. 
                    It currently renders the whole form. 
                    Maybe we just leave it for now or wrap it in a modal?
                    The block list page already has the edit button.
                    Let's just focus on Lessons here.
                */}
                    </div>
                </div>
            </header>

            <main style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#334155' }}>Daftar Lesson</h2>
                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                        <ExportLessonsButton blockId={blockId} />
                        <ImportLessonsButton blockId={blockId} currentLessonCount={lessons.length} />
                        <CreateLessonButton blockId={blockId} suggestedOrderIndex={lessons.length} />
                    </div>
                </div>

                <LessonTable lessons={lessons} />
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
