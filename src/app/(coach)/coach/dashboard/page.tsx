import Link from 'next/link';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { getSessionOrThrow } from '@/lib/auth';
import { getCoachClassesWithBlocks, getAllCoachSessions } from '@/lib/services/coach';
import { makeUpTasksDao } from '@/lib/dao';
import CalendarModal from '@/components/coach/CalendarModal';

export default async function CoachDashboardPage() {
    const session = await getSessionOrThrow();
    const [classes, activeSessions, makeUpTasks] = await Promise.all([
        getCoachClassesWithBlocks(session.user.id),
        getAllCoachSessions(session.user.id),
        makeUpTasksDao.listTasksForCoach(session.user.id),
    ]);

    // Calculate stats
    const today = new Date();
    const todaySessions = activeSessions.filter(s =>
        new Date(s.date_time).toDateString() === today.toDateString() &&
        s.status !== 'CANCELLED'
    );

    const upcomingSessions = activeSessions.filter(s =>
        new Date(s.date_time) > today && s.status !== 'CANCELLED'
    );

    // Count pending tasks
    const pendingMakeUpCount = makeUpTasks.filter(t => t.status === 'SUBMITTED').length;
    const pendingUploadCount = makeUpTasks.filter(t => t.status === 'PENDING_UPLOAD').length;

    return (
        <div style={{ fontFamily: 'system-ui, sans-serif', color: '#1e293b', paddingBottom: '40px' }}>

            {/* Quick Stats */}
            <div className="coach-stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                <Link href="/coach/sessions" style={{
                    background: '#eff6ff', padding: '16px 20px', borderRadius: '12px', textDecoration: 'none',
                    border: '1px solid #bfdbfe', display: 'flex', flexDirection: 'column', gap: '4px'
                }}>
                    <span style={{ fontSize: '12px', color: '#3b82f6', fontWeight: 600, textTransform: 'uppercase' }}>Jadwal Hari Ini</span>
                    <span style={{ fontSize: '24px', fontWeight: 700, color: '#1d4ed8' }}>{todaySessions.length}</span>
                    <span style={{ fontSize: '13px', color: '#64748b' }}>sesi</span>
                </Link>

                <Link href="/coach/makeup" style={{
                    background: pendingMakeUpCount > 0 ? '#fef3c7' : '#f8fafc',
                    padding: '16px 20px', borderRadius: '12px', textDecoration: 'none',
                    border: pendingMakeUpCount > 0 ? '1px solid #fbbf24' : '1px solid #e2e8f0',
                    display: 'flex', flexDirection: 'column', gap: '4px'
                }}>
                    <span style={{ fontSize: '12px', color: pendingMakeUpCount > 0 ? '#b45309' : '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Tugas Susulan</span>
                    <span style={{ fontSize: '24px', fontWeight: 700, color: pendingMakeUpCount > 0 ? '#92400e' : '#475569' }}>{pendingMakeUpCount}</span>
                    <span style={{ fontSize: '13px', color: '#64748b' }}>menunggu review</span>
                </Link>

                <div style={{
                    background: '#f8fafc', padding: '16px 20px', borderRadius: '12px',
                    border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '4px'
                }}>
                    <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Kelas Aktif</span>
                    <span style={{ fontSize: '24px', fontWeight: 700, color: '#475569' }}>{classes.length}</span>
                    <span style={{ fontSize: '13px', color: '#64748b' }}>kelas</span>
                </div>
            </div>

            {/* Top Action Bar */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '24px' }}>
                <CalendarModal
                    sessions={activeSessions}
                    triggerClassName=""
                    triggerText={
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: '8px',
                            background: 'white', color: '#1e3a5f', border: '1px solid #e2e8f0',
                            padding: '10px 20px', borderRadius: '12px', fontWeight: '600',
                            cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 2px 4px -1px rgba(0,0,0,0.05)'
                        }} className="hover:bg-slate-50">
                            <span style={{ fontSize: '18px' }}>📅</span>
                            <span>Buka Kalender</span>
                        </div>
                    }
                />
            </div>

            <div className="coach-main-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '32px' }}>

                {/* Left Column: Schedule & Tasks */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>

                    {/* Today's Schedule */}
                    <div>
                        <h2 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            📅 Jadwal Hari Ini
                        </h2>
                        {todaySessions.length > 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                {todaySessions.map(session => (
                                    <div key={session.id} className="coach-session-card" style={{
                                        background: 'white', padding: '20px', borderRadius: '16px',
                                        border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
                                        display: 'flex', gap: '16px', alignItems: 'center'
                                    }}>
                                        <div style={{
                                            background: '#eff6ff', color: '#1e3a5f', padding: '12px', borderRadius: '12px',
                                            textAlign: 'center', minWidth: '70px'
                                        }}>
                                            <div style={{ fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase' }}>
                                                {format(new Date(session.date_time), 'MMM', { locale: id })}
                                            </div>
                                            <div style={{ fontSize: '20px', fontWeight: 'bold' }}>
                                                {format(new Date(session.date_time), 'd')}
                                            </div>
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ color: '#1e3a5f', fontWeight: '600', fontSize: '14px', marginBottom: '4px' }}>
                                                {format(new Date(session.date_time), 'HH:mm')} WIB
                                            </div>
                                            <div style={{ fontWeight: '700', fontSize: '18px', color: '#0f172a', marginBottom: '4px' }}>
                                                {session.class_name}
                                            </div>
                                            <div style={{ fontSize: '14px', color: '#64748b' }}>
                                                {session.lesson ? session.lesson.title : 'Belum ada materi'}
                                            </div>
                                        </div>
                                        <div>
                                            <Link href={`/coach/sessions/${session.id}/attendance`} style={{
                                                background: '#1e3a5f', color: 'white', padding: '10px 20px', borderRadius: '8px',
                                                fontSize: '14px', fontWeight: '600', display: 'inline-block'
                                            }}>
                                                Absensi
                                            </Link>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div style={{
                                padding: '32px', background: '#f8fafc', borderRadius: '16px', border: '2px dashed #cbd5e1',
                                textAlign: 'center', color: '#64748b'
                            }}>
                                <p style={{ fontWeight: '500' }}>Tidak ada jadwal hari ini</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Column: Active Classes List */}
                <div>
                    <h2 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        🏫 Kelas Aktif Anda
                    </h2>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {classes.map(cls => (
                            <div key={cls.classId} style={{ position: 'relative' }}>
                                <div style={{
                                    background: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '20px',
                                    transition: 'all 0.2s', boxShadow: '0 2px 4px rgba(0,0,0,0.02)', position: 'relative'
                                }} className="hover:shadow-lg hover:border-blue-300">
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                                        <span style={{
                                            background: cls.type === 'EKSKUL' ? '#f3e8ff' : '#eff6ff',
                                            color: cls.type === 'EKSKUL' ? '#7e22ce' : '#1d4ed8',
                                            padding: '4px 10px', borderRadius: '99px', fontSize: '11px', fontWeight: '700'
                                        }}>
                                            {cls.type}
                                        </span>
                                        {cls.currentBlock && (
                                            <span style={{ background: '#f1f5f9', color: '#475569', padding: '4px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '600' }}>
                                                Block {cls.currentBlock.name}
                                            </span>
                                        )}
                                    </div>
                                    <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#0f172a', marginBottom: '12px' }}>
                                        <Link href={`/coach/classes/${cls.classId}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                                            <span style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1 }} aria-hidden="true" />
                                            {cls.name}
                                        </Link>
                                    </h3>

                                    {/* Next Session */}
                                    <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '12px' }}>
                                        <div style={{ fontSize: '11px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '6px' }}>
                                            Sesi Berikutnya
                                        </div>
                                        {cls.nextSessionDate ? (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#334155', fontWeight: '500', fontSize: '14px' }}>
                                                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }}></div>
                                                {format(new Date(cls.nextSessionDate), 'EEEE, d MMM, HH:mm', { locale: id })}
                                            </div>
                                        ) : (
                                            <div style={{ color: '#cbd5e1', fontSize: '14px', fontStyle: 'italic' }}>Belum ada jadwal</div>
                                        )}
                                    </div>

                                    {/* Next Lesson */}
                                    {cls.nextLesson && (
                                        <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '12px', marginTop: '12px', position: 'relative', zIndex: 2 }}>
                                            <div style={{ fontSize: '11px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '6px' }}>
                                                📚 Materi Berikutnya
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                                <span style={{ color: '#1e40af', fontWeight: '600', fontSize: '14px' }}>{cls.nextLesson.title}</span>
                                                {cls.nextLesson.lessonTemplateId && (
                                                    <Link
                                                        href={`/coach/lesson/${cls.nextLesson.lessonTemplateId}`}
                                                        style={{ background: '#dbeafe', color: '#1d4ed8', padding: '4px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '600', textDecoration: 'none' }}
                                                    >
                                                        Lihat Detail ↗
                                                    </Link>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {/* Software Info */}
                                    {cls.currentBlock?.software && cls.currentBlock.software.length > 0 && (
                                        <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '12px', marginTop: '12px', position: 'relative', zIndex: 2 }}>
                                            <div style={{ fontSize: '11px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '8px' }}>
                                                📦 Software yang Digunakan
                                            </div>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                                {cls.currentBlock.software.map(sw => (
                                                    <span
                                                        key={sw.id}
                                                        style={{
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            gap: '4px',
                                                            background: '#f0fdf4',
                                                            color: '#15803d',
                                                            padding: '4px 10px',
                                                            borderRadius: '6px',
                                                            fontSize: '12px',
                                                            fontWeight: '600',
                                                        }}
                                                        title={sw.access_info || undefined}
                                                    >
                                                        {sw.name}
                                                        {sw.version && <span style={{ opacity: 0.7, fontSize: '10px' }}>v{sw.version}</span>}
                                                        {sw.installation_url && (
                                                            <a
                                                                href={sw.installation_url}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                style={{ color: '#15803d', marginLeft: '2px' }}
                                                                title="Download"
                                                            >
                                                                ↗
                                                            </a>
                                                        )}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}

                        {classes.length === 0 && (
                            <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8', background: '#f8fafc', borderRadius: '16px' }}>
                                Belum ada kelas aktif.
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Responsive Styles */}
            <style>{`
                @media (max-width: 768px) {
                    .coach-stats-grid {
                        grid-template-columns: 1fr !important;
                    }
                    .coach-main-grid {
                        grid-template-columns: 1fr !important;
                    }
                    .coach-session-card {
                        flex-direction: column !important;
                        align-items: flex-start !important;
                        gap: 1rem !important;
                    }
                    .coach-session-card > div:last-child {
                        width: 100% !important;
                    }
                    .coach-session-card a {
                        width: 100% !important;
                        text-align: center !important;
                    }
                }
            `}</style>
        </div>
    );
}
