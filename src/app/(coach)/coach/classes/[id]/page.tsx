import { getSessionOrThrow } from '@/lib/auth';
import { classesDao, sessionsDao } from '@/lib/dao';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import UploadMaterialForm from './UploadMaterialForm';
import MarkSessionCompleteButton from './MarkSessionCompleteButton';

export const dynamic = 'force-dynamic';

export default async function ClassDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const session = await getSessionOrThrow();
    const { id: classId } = await params;

    const classRecord = await classesDao.getClassById(classId);

    if (!classRecord) {
        notFound();
    }

    // Verify ownership
    if (classRecord.coach_id !== session.user.id) {
        return (
            <div style={{ padding: '2rem' }}>
                <h1 style={{ color: '#ef4444' }}>Akses Ditolak</h1>
                <p>Anda tidak memiliki akses ke kelas ini.</p>
                <Link href="/coach/dashboard" style={{ color: '#2563eb', textDecoration: 'underline' }}>Kembali ke Dashboard</Link>
            </div>
        );
    }

    const sessions = await sessionsDao.listSessionsByClass(classId);

    // Filter future sessions for default select in upload
    const futureSessions = sessions.filter(s => new Date(s.date_time) > new Date());

    // Format sessions for UploadForm
    const sessionsForUpload = sessions.map(s => ({
        id: s.id,
        date_time: s.date_time
    }));

    return (
        <div style={{ maxWidth: '1000px', margin: '0 auto', paddingBottom: '3rem' }}>
            {/* Header */}
            <div style={{ marginBottom: '2rem' }}>
                <Link href="/coach/dashboard" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', color: '#64748b', textDecoration: 'none', marginBottom: '1rem', fontWeight: 500, fontSize: '0.9rem' }}>
                    ← Kembali ke Dashboard
                </Link>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
                    <div>
                        <h1 style={{ fontSize: '2rem', fontWeight: 800, color: '#1e293b', marginBottom: '0.5rem' }}>{classRecord.name}</h1>
                        <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'center', color: '#64748b' }}>
                            <span style={{ background: '#eff6ff', color: '#1d4ed8', padding: '0.2rem 0.6rem', borderRadius: '6px', fontSize: '0.85rem', fontWeight: 600 }}>{classRecord.type}</span>
                            <span>•</span>
                            <span>{classRecord.schedule_day}, {classRecord.schedule_time}</span>
                        </div>
                    </div>
                    <Link
                        href={`/coach/classes/${classId}/lessons`}
                        style={{
                            background: '#fff', border: '1px solid #e2e8f0', padding: '0.6rem 1rem',
                            borderRadius: '8px', fontWeight: 600, color: '#1e293b', textDecoration: 'none',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', gap: '0.5rem'
                        }}
                    >
                        📚 Lihat Lesson Plan
                    </Link>
                </div>
            </div>

            {/* Main Content Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>

                {/* Left Col: Upload Material */}
                <div style={{ background: '#fff', padding: '1.5rem', borderRadius: '16px', border: '1px solid #e2e8f0', height: 'fit-content' }}>
                    <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '1.5rem', color: '#0f172a' }}>📤 Upload Materi Tambahan</h2>
                    <UploadMaterialForm
                        classId={classId}
                        sessions={sessionsForUpload}
                        defaultSessionId={futureSessions[0]?.id}
                    />
                </div>

                {/* Right Col: Sessions List */}
                <div>
                    <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '1.5rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        📅 Daftar Sesi ({sessions.length})
                    </h2>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {sessions.length === 0 ? (
                            <p style={{ color: '#94a3b8', fontStyle: 'italic' }}>Belum ada sesi yang dijadwalkan.</p>
                        ) : (
                            sessions.map(session => {
                                const isPast = new Date(session.date_time) < new Date();
                                const sessionDate = new Date(session.date_time);

                                return (
                                    <div key={session.id} style={{
                                        background: '#fff', padding: '1.25rem', borderRadius: '12px',
                                        border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between',
                                        alignItems: 'center', gap: '1rem',
                                        opacity: session.status === 'CANCELLED' ? 0.6 : 1
                                    }}>
                                        <div>
                                            <div style={{ fontSize: '0.9rem', color: '#64748b', fontWeight: 600, marginBottom: '0.2rem', textTransform: 'uppercase' }}>
                                                {format(sessionDate, 'EEEE, d MMMM yyyy', { locale: id })}
                                            </div>
                                            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.25rem' }}>
                                                {format(sessionDate, 'HH:mm')} WIB
                                            </div>
                                            <div style={{ fontSize: '0.85rem', color: session.status === 'COMPLETED' ? '#16a34a' : '#475569', fontWeight: 500 }}>
                                                Status: {session.status === 'COMPLETED' ? 'Selesai' : session.status === 'CANCELLED' ? 'Dibatalkan' : 'Dijadwalkan'}
                                            </div>
                                        </div>

                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'flex-end' }}>
                                            {session.status !== 'CANCELLED' && (
                                                <>
                                                    <Link
                                                        href={`/coach/sessions/${session.id}/attendance`}
                                                        style={{
                                                            background: '#1e3a5f', color: '#fff', fontSize: '0.85rem', padding: '0.4rem 0.8rem',
                                                            borderRadius: '6px', fontWeight: 600, textDecoration: 'none', textAlign: 'center', minWidth: '80px'
                                                        }}
                                                    >
                                                        Absensi
                                                    </Link>
                                                    {session.status !== 'COMPLETED' && (
                                                        <MarkSessionCompleteButton sessionId={session.id} />
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
