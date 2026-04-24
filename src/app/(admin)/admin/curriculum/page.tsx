import Link from 'next/link';
import { Users } from 'lucide-react';

import { getSessionOrThrow } from '@/lib/auth';
import { blocksDao, lessonTemplatesDao, levelsDao, classesDao } from '@/lib/dao';
import { assertRole } from '@/lib/roles';
import DeleteLevelButton from './DeleteLevelButton';
import AddLevelButton from './AddLevelButton';
import { format } from 'date-fns';
import PageHead from '@/components/admin/PageHead';

function getLevelTagClass(levelId: string) {
    const lname = levelId.toLowerCase();
    if (lname.includes('explorer')) return 'tag-explorer';
    if (lname.includes('creator')) return 'tag-creator';
    if (lname.includes('innovator')) return 'tag-innovator';
    return 'tag-ekskul';
}

export default async function AdminCurriculumPage() {
    const session = await getSessionOrThrow();
    await assertRole(session, 'ADMIN');

    const [levels, classes] = await Promise.all([
        levelsDao.listLevels(),
        classesDao.listClasses()
    ]);

    const nowStr = format(new Date(), 'yyyy-MM-dd');

    const levelStats = await Promise.all(
        levels.map(async (level) => {
            const blocks = await blocksDao.listBlocksByLevel(level.id);
            const lessonCounts = await Promise.all(
                blocks.map(async (block) => (await lessonTemplatesDao.listLessonsByBlock(block.id)).length),
            );
            const totalLessons = lessonCounts.reduce((sum, count) => sum + count, 0);
            
            const activeClassesCount = classes.filter(c => c.level_id === level.id && c.end_date >= nowStr).length;

            return { level, blockCount: blocks.length, lessonCount: totalLessons, activeClassesCount };
        }),
    );

    return (
        <div>
            <PageHead
                title="Perencanaan Kurikulum"
                desc="Kelola block dan lesson template per level. Struktur ini menjadi dasar kelas Weekly."
                actions={
                    <AddLevelButton />
                }
            />

            <div className="col gap-3">
                {levelStats.map(({ level, blockCount, lessonCount, activeClassesCount }, index) => (
                    <div key={level.id} className="card card-p row between" style={{ flexWrap: 'wrap', gap: 16 }}>
                        <div className="row gap-4">
                            <div style={{
                                width: 54, height: 54, borderRadius: 'var(--radius-lg)', background: 'var(--accent-weak)',
                                color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 20
                            }}>
                                {index + 1}
                            </div>
                            <div>
                                <div className="row gap-2" style={{ marginBottom: 4 }}>
                                    <div style={{ fontSize: 17, fontWeight: 800 }}>{level.name}</div>
                                    <span className={`chip ${getLevelTagClass(level.name)}`}>{level.name.split(' ')[0]}</span>
                                </div>
                                <div className="row gap-4 muted" style={{ fontSize: 13 }}>
                                    <span className="row gap-1">
                                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)' }} /> 
                                        {blockCount} Block
                                    </span>
                                    <span className="row gap-1">
                                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981' }} /> 
                                        {lessonCount} Lesson
                                    </span>
                                    <span className="row gap-1">
                                        <Users size={14} /> {activeClassesCount} Kelas aktif
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="col hide-sm" style={{ flex: 1, minWidth: 220, maxWidth: 400, padding: '0 20px', borderLeft: '1px solid var(--border)' }}>
                            <div className="muted" style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>
                                Deskripsi
                            </div>
                            <div style={{ fontSize: 13, lineHeight: 1.5 }}>
                                {level.description || 'Tahap pembelajaran komprehensif yang dirancang untuk membangun pemahaman dan skill coding siswa.'}
                            </div>
                        </div>

                        <div className="row gap-2">
                            <DeleteLevelButton levelId={level.id} levelName={level.name} />
                            <Link href={`/admin/curriculum/${level.id}/blocks`} className="btn btn-primary">
                                Kelola →
                            </Link>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
