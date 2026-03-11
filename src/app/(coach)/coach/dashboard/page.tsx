import Link from 'next/link';
import { format, addDays, startOfWeek, isSameDay } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { getSessionOrThrow } from '@/lib/auth';
import { getCoachClassesWithBlocks, getAllCoachSessions } from '@/lib/services/coach';
import { makeUpTasksDao } from '@/lib/dao';
import CalendarModal from '@/components/coach/CalendarModal';
import WeeklyScheduleClient from './WeeklyScheduleClient';
import HeroCountdownClient from './HeroCountdownClient';
import { StaggerContainer, StaggerItem } from '@/components/animations/StaggerContainer';

export const revalidate = 300; // Cache dashboard data for 5 minutes


export default async function CoachDashboardPage() {
    const session = await getSessionOrThrow();
    const [classes, activeSessions, makeUpTasks] = await Promise.all([
        getCoachClassesWithBlocks(session.user.id),
        getAllCoachSessions(session.user.id),
        makeUpTasksDao.listTasksForCoach(session.user.id),
    ]);

    const user = session.user;
    const userName = user.fullName || 'Coach';
    const nameParts = userName.split(' ');
    const firstName = nameParts[0];

    // Calculate stats
    const today = new Date();
    const ninetyMinsAgo = new Date(today.getTime() - 90 * 60 * 1000);
    
    const todaySessions = activeSessions.filter(s =>
        isSameDay(new Date(s.date_time), today) &&
        s.status !== 'CANCELLED'
    );

    const upcomingSessions = activeSessions.filter(s =>
        new Date(s.date_time) >= ninetyMinsAgo && s.status !== 'CANCELLED'
    ).sort((a, b) => new Date(a.date_time).getTime() - new Date(b.date_time).getTime());

    const nextSession = upcomingSessions[0] || null;

    // Count pending tasks
    const pendingMakeUpCount = makeUpTasks.filter(t => t.status === 'SUBMITTED').length;
    const totalStudents = classes.reduce((acc, cls) => acc + (cls.studentsCount || 0), 0);

    // Weekly Schedule Variables
    const startOfCurrentWeek = startOfWeek(today, { weekStartsOn: 1 }); // Monday

    return (
        <>
            <style>{`
                @keyframes float-up {
                    0%   { transform: translateY(0) rotate(0deg);   opacity: 0; }
                    20%  { opacity: 0.15; }
                    80%  { opacity: 0.15; }
                    100% { transform: translateY(-100px) rotate(20deg); opacity: 0; }
                }
                @keyframes float-down {
                    0%   { transform: translateY(0) rotate(0deg);    opacity: 0; }
                    20%  { opacity: 0.1; }
                    80%  { opacity: 0.1; }
                    100% { transform: translateY(100px) rotate(-15deg); opacity: 0; }
                }
                .animate-float-1 { animation: float-up   12s linear infinite; }
                .animate-float-2 { animation: float-down 15s linear infinite; }
                .animate-float-3 { animation: float-up   18s linear infinite; }
                .animate-float-4 { animation: float-down 20s linear infinite; }
            `}</style>

            <StaggerContainer className="mt-8">
                <div className="flex gap-8">
                    <div className="flex-grow max-w-[calc(100%-360px)]">
                        <StaggerItem className="mb-8">
                            <section>
                                <div className="bg-gradient-to-r from-[#0f172a] to-[#1e3a5f] rounded-3xl p-8 text-white shadow-2xl relative overflow-hidden group border border-white/5">
                                    <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-40">
                                        {/* Far layer - tiny, blurry, slow */}
                                        <div className="absolute top-0 left-0 w-full h-[200%] animate-marquee-up-slow">
                                            <div className="absolute top-0 w-full h-1/2">
                                                <span className="material-symbols-outlined absolute text-emerald-400/15 top-[20%] left-[8%] blur-[3px]" style={{ fontSize: '28px' }}>video_call</span>
                                                <span className="material-symbols-outlined absolute text-white/10 top-[55%] right-[12%] blur-[3px]" style={{ fontSize: '32px' }}>data_object</span>
                                            </div>
                                            <div className="absolute top-[50%] w-full h-1/2">
                                                <span className="material-symbols-outlined absolute text-emerald-400/15 top-[20%] left-[8%] blur-[3px]" style={{ fontSize: '28px' }}>video_call</span>
                                                <span className="material-symbols-outlined absolute text-white/10 top-[55%] right-[12%] blur-[3px]" style={{ fontSize: '32px' }}>data_object</span>
                                            </div>
                                        </div>
                                        {/* Mid layer */}
                                        <div className="absolute top-0 left-0 w-full h-[200%] animate-marquee-up-medium">
                                            <div className="absolute top-0 w-full h-1/2">
                                                <span className="material-symbols-outlined absolute text-emerald-400/20 top-[30%] left-[55%] blur-[1px]" style={{ fontSize: '52px' }}>terminal</span>
                                                <span className="material-symbols-outlined absolute text-white/15 top-[65%] right-[8%] blur-[2px]" style={{ fontSize: '44px' }}>hub</span>
                                            </div>
                                            <div className="absolute top-[50%] w-full h-1/2">
                                                <span className="material-symbols-outlined absolute text-emerald-400/20 top-[30%] left-[55%] blur-[1px]" style={{ fontSize: '52px' }}>terminal</span>
                                                <span className="material-symbols-outlined absolute text-white/15 top-[65%] right-[8%] blur-[2px]" style={{ fontSize: '44px' }}>hub</span>
                                            </div>
                                        </div>
                                        {/* Near layer - large, sharp, fast */}
                                        <div className="absolute top-0 left-0 w-full h-[200%] animate-marquee-up-fast">
                                            <div className="absolute top-0 w-full h-1/2">
                                                <span className="material-symbols-outlined absolute text-emerald-500/25 top-[15%] left-[5%]" style={{ fontSize: '75px' }}>terminal</span>
                                                <span className="material-symbols-outlined absolute text-white/20 top-[55%] right-[8%]" style={{ fontSize: '80px' }}>webhook</span>
                                            </div>
                                            <div className="absolute top-[50%] w-full h-1/2">
                                                <span className="material-symbols-outlined absolute text-emerald-500/25 top-[15%] left-[5%]" style={{ fontSize: '75px' }}>terminal</span>
                                                <span className="material-symbols-outlined absolute text-white/20 top-[55%] right-[8%]" style={{ fontSize: '80px' }}>webhook</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl"></div>

                                    <div className="relative z-10 w-full">
                                        {nextSession ? (
                                            <>
                                                {/* Background Particles now strictly handled in the master layers above */}
                                                <HeroCountdownClient session={nextSession} />
                                            </>
                                        ) : (
                                            <div className="text-center w-full py-8">
                                                <h2 className="text-2xl font-bold mb-2">Belum ada sesi mendatang</h2>
                                                <p className="text-slate-400">Anda dapat bersantai atau mengecek tugas susulan.</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </section>
                        </StaggerItem>

                        <StaggerItem className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                            <div className="bg-white p-6 rounded-3xl shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07)] border border-slate-100">
                                <div className="flex justify-between items-start mb-4">
                                    <span className="p-2 bg-blue-50 text-blue-600 rounded-lg material-symbols-outlined">groups</span>
                                    <span className="text-xs font-bold text-emerald-600 flex items-center">+4.2% <span className="material-symbols-outlined text-xs">trending_up</span></span>
                                </div>
                                <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Total Siswa Bimbingan</p>
                                <h3 className="text-2xl font-extrabold text-brand-deep mt-1">{totalStudents}</h3>
                            </div>
                            <div className="bg-white p-6 rounded-3xl shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07)] border border-slate-100">
                                <div className="flex justify-between items-start mb-4">
                                    <span className="p-2 bg-orange-50 text-orange-600 rounded-lg material-symbols-outlined">pending_actions</span>
                                </div>
                                <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Tugas Perlu Review</p>
                                <h3 className="text-2xl font-extrabold text-brand-deep mt-1">{pendingMakeUpCount}</h3>
                            </div>
                            <div className="bg-white p-6 rounded-3xl shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07)] border border-slate-100">
                                <div className="flex justify-between items-start mb-4">
                                    <span className="p-2 bg-emerald-50 text-emerald-600 rounded-lg material-symbols-outlined">class</span>
                                </div>
                                <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Total Kelas Aktif</p>
                                <h3 className="text-2xl font-extrabold text-brand-deep mt-1">{classes.length}</h3>
                            </div>
                        </StaggerItem>

                        <StaggerItem className="bg-white rounded-3xl shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07)] border border-slate-100 overflow-hidden">
                            <div className="p-6">
                                <div className="flex items-center justify-between mb-8">
                                    <h2 className="text-lg font-extrabold text-brand-deep flex items-center gap-2">
                                        <span className="material-symbols-outlined text-emerald-600">school</span>
                                        Manajemen Kelas
                                    </h2>
                                    <button className="text-slate-500 font-bold text-xs flex items-center gap-1 hover:text-brand-deep transition-colors">
                                        Kelola Semua Kelas <span className="material-symbols-outlined text-sm">arrow_forward</span>
                                    </button>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {classes.slice(0, 4).length > 0 ? classes.slice(0, 4).map(cls => (
                                        <Link href={`/coach/classes/${cls.classId}`} key={cls.classId} className="block border border-slate-100 rounded-2xl p-5 hover:border-emerald-500/30 hover:shadow-md transition-all group bg-white">
                                            <div className="flex justify-between items-start mb-4">
                                                <div>
                                                    <h3 className="font-bold text-brand-deep group-hover:text-emerald-600 transition-colors">
                                                        {cls.name}
                                                    </h3>
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">
                                                        {cls.nextSessionDate ? format(new Date(cls.nextSessionDate), 'EEEE, HH:mm', { locale: localeId }) : 'Belum Ada Jadwal'}
                                                    </p>
                                                </div>
                                                <span className="px-2.5 py-1 bg-emerald-50 text-emerald-600 text-[10px] font-bold rounded-full">{cls.type === 'EKSKUL' ? 'Ekskul' : 'Aktif'}</span>
                                            </div>
                                            <div className="grid grid-cols-2 gap-4 border-t border-slate-50 pt-4">
                                                <div>
                                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Block Saat Ini</p>
                                                    <p className="text-xs font-bold text-brand-slate flex items-center gap-1">
                                                        <span className="material-symbols-outlined text-sm text-emerald-600">deployed_code</span>
                                                        {cls.currentBlock ? cls.currentBlock.name : 'Unknown'}
                                                    </p>
                                                </div>
                                                <div>
                                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Jumlah Anak</p>
                                                    <p className="text-xs font-bold text-brand-slate flex items-center gap-1">
                                                        <span className="material-symbols-outlined text-sm text-emerald-600">person</span>
                                                        {cls.studentsCount || 0} Siswa
                                                    </p>
                                                </div>
                                            </div>
                                        </Link>
                                    )) : (
                                        <div className="col-span-1 md:col-span-2 text-center py-6 text-slate-400">
                                            Belum ada kelas yang terdaftar.
                                        </div>
                                    )}
                                </div>
                            </div>
                        </StaggerItem>
                    </div>

                    <StaggerItem className="w-[360px] flex-shrink-0">
                        <aside className="bg-white rounded-3xl border border-slate-100 shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07)] flex flex-col h-full overflow-hidden">
                            <div className="p-6 border-b border-slate-50 flex items-center justify-between">
                                <div>
                                    <h3 className="font-extrabold text-brand-deep">Weekly Schedule</h3>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                                        JANUARI 12-18, 2024
                                    </p>
                                </div>
                                <CalendarModal
                                    sessions={activeSessions}
                                    triggerClassName="bg-brand-surface p-2 rounded-xl text-emerald-600 flex items-center justify-center hover:bg-emerald-50 transition-colors"
                                    triggerText={<span className="material-symbols-outlined text-xl">view_week</span>}
                                />
                            </div>
                            <WeeklyScheduleClient
                                sessions={activeSessions}
                                classes={classes.map(c => ({ classId: c.classId, studentsCount: c.studentsCount }))}
                            />

                            <div className="mt-auto p-6 bg-slate-50 border-t border-slate-100">
                                <CalendarModal
                                    sessions={activeSessions}
                                    triggerClassName="w-full bg-[#0f172a] text-white font-bold py-3.5 rounded-2xl text-sm shadow-xl shadow-[#0f172a]/20 hover:bg-slate-800 transition-all flex items-center justify-center gap-2"
                                    triggerText={
                                        <>
                                            <span className="material-symbols-outlined text-lg">event_repeat</span>
                                            View Monthly Schedule
                                        </>
                                    }
                                />
                            </div>
                        </aside>
                    </StaggerItem>
                </div>
            </StaggerContainer>
        </>
    );
}
