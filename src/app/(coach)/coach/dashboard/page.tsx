import Link from 'next/link';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { getSessionOrThrow } from '@/lib/auth';
import { getCoachClassesWithBlocks, getAllCoachSessions } from '@/lib/services/coach';
import CalendarModal from '@/components/coach/CalendarModal';

export default async function CoachDashboardPage() {
    const session = await getSessionOrThrow();
    const classes = await getCoachClassesWithBlocks(session.user.id);
    const activeSessions = await getAllCoachSessions(session.user.id);

    // Calculate stats
    const today = new Date();
    const todaySessions = activeSessions.filter(s =>
        new Date(s.date_time).toDateString() === today.toDateString() &&
        s.status !== 'CANCELLED'
    );

    const upcomingSessions = activeSessions.filter(s =>
        new Date(s.date_time) > today && s.status !== 'CANCELLED'
    );

    return (
        <div style={{ fontFamily: 'system-ui, sans-serif', color: '#1e293b', paddingBottom: '40px' }}>

            {/* Hero Section */}
            <div
                style={{
                    background: 'linear-gradient(135deg, #2563eb 0%, #4f46e5 100%)',
                    borderRadius: '16px',
                    padding: '32px',
                    color: 'white',
                    boxShadow: '0 10px 25px -5px rgba(37, 99, 235, 0.4)',
                    marginBottom: '32px',
                    position: 'relative',
                    overflow: 'hidden'
                }}
            >
                <div style={{ position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '20px' }}>
                        <div>
                            <h1 style={{ fontSize: '28px', fontWeight: '800', marginBottom: '8px', color: 'white' }}>
                                Halo, {session.user.fullName.split(' ')[0]}! 👋
                            </h1>
                            <p style={{ color: 'rgba(255,255,255,0.9)', fontSize: '16px', maxWidth: '600px', lineHeight: '1.5' }}>
                                {todaySessions.length > 0
                                    ? `Ada ${todaySessions.length} kelas yang harus diajar hari ini. Semangat mengajar!`
                                    : 'Hari ini kosong dari jadwal mengajar. Waktu yang tepat untuk evaluasi rubrik.'}
                            </p>
                        </div>

                        {/* Calendar Button Restored */}
                        <div>
                            <CalendarModal
                                sessions={activeSessions}
                                triggerClassName=""
                                triggerText={
                                    <div style={{
                                        display: 'flex', alignItems: 'center', gap: '8px',
                                        background: 'white', color: '#2563eb',
                                        padding: '12px 24px', borderRadius: '12px', fontWeight: '700',
                                        cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'
                                    }}>
                                        <span style={{ fontSize: '20px' }}>📅</span>
                                        <span>Buka Kalender</span>
                                    </div>
                                }
                            />
                        </div>
                    </div>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '32px' }}>

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
                                    <div key={session.id} style={{
                                        background: 'white', padding: '20px', borderRadius: '16px',
                                        border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
                                        display: 'flex', gap: '16px', alignItems: 'center'
                                    }}>
                                        <div style={{
                                            background: '#eff6ff', color: '#2563eb', padding: '12px', borderRadius: '12px',
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
                                            <div style={{ color: '#2563eb', fontWeight: '600', fontSize: '14px', marginBottom: '4px' }}>
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
                                                background: '#2563eb', color: 'white', padding: '10px 20px', borderRadius: '8px',
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
                            <Link key={cls.classId} href={`/coach/classes/${cls.classId}`} style={{ display: 'block' }}>
                                <div style={{
                                    background: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '20px',
                                    transition: 'all 0.2s', boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
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
                                    <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#0f172a', marginBottom: '12px' }}>{cls.name}</h3>

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
                                </div>
                            </Link>
                        ))}

                        {classes.length === 0 && (
                            <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8', background: '#f8fafc', borderRadius: '16px' }}>
                                Belum ada kelas aktif.
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
