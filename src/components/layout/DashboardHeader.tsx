'use client';

import { useState } from 'react';
import NotificationDropdown from './NotificationDropdown';

type UserSession = {
    id: string;
    fullName: string;
    role: string;
    avatarPath?: string | null;
};

import { usePathname } from 'next/navigation';
import SignOutButton from '@/components/SignOutButton';
import { motion, AnimatePresence } from 'framer-motion';

export default function DashboardHeader({ user }: { user: UserSession }) {
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const pathname = usePathname();

    // Determine Page Title
    const getPageTitle = (path: string) => {
        if (path.includes('/dashboard')) return 'Dashboard';
        if (path.includes('/users')) return 'Pengguna';
        if (path.includes('/classes')) return 'Kelas';
        if (path.includes('/curriculum')) return 'Kurikulum';
        if (path.includes('/software')) return 'Software';
        if (path.includes('/banners')) return 'Banner';
        if (path.includes('/whatsapp')) return 'WhatsApp';
        if (path.includes('/materials')) return 'Materi';
        if (path.includes('/makeup')) return 'Tugas Susulan';
        if (path.includes('/reports')) return 'Rapor';
        if (path.includes('/rubrics')) return 'Rubrik';
        if (path.includes('/leave')) return 'Pengajuan Izin';
        if (path.includes('/profile')) return 'Profile & Keamanan';
        return 'Dashboard'; // Fallback
    };

    const pageTitle = getPageTitle(pathname);

    return (
        <header
            className="flex justify-between items-center mb-8 pt-2"
            style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '2rem',
                paddingTop: '0.5rem'
            }}
        >

            {/* Left: Page Title */}
            <div className="flex flex-col animate-in fade-in slide-in-from-left-4 duration-500">
                <h1
                    className="text-2xl md:text-3xl font-bold text-slate-800 tracking-tight"
                    style={{ fontSize: '1.8rem', fontWeight: 800, color: '#1e293b', margin: 0 }}
                >
                    {pageTitle}
                </h1>
            </div>

            {/* Right: Actions */}
            <div
                className="flex items-center gap-3 md:gap-6"
                style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}
            >

                {/* Notifications */}
                <NotificationDropdown />

                {/* Profile Dropdown */}
                <div className="relative" style={{ position: 'relative' }}>
                    <button
                        onClick={() => setIsProfileOpen(!isProfileOpen)}
                        className="flex items-center gap-3 pl-1 pr-2 py-1 rounded-full hover:bg-white hover:shadow-md transition-all border border-transparent hover:border-slate-100"
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.75rem',
                            padding: '4px 8px 4px 4px',
                            borderRadius: '9999px',
                            background: isProfileOpen ? 'white' : 'transparent',
                            border: isProfileOpen ? '1px solid #f1f5f9' : '1px solid transparent',
                            cursor: 'pointer'
                        }}
                    >
                        <div
                            className="w-10 h-10 md:w-12 md:h-12 rounded-full overflow-hidden bg-white border-2 border-white shadow-sm ring-1 ring-slate-100"
                            style={{
                                width: '40px', height: '40px',
                                borderRadius: '9999px',
                                overflow: 'hidden',
                                background: 'white',
                                border: '2px solid white',
                                boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}
                        >
                            {user.avatarPath ? (
                                <img src={user.avatarPath} alt={user.fullName} className="w-full h-full object-cover" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                                <div style={{ width: '100%', height: '100%', background: '#dbeafe', color: '#1e3a5f', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '1.25rem' }}>
                                    {user.fullName.charAt(0)}
                                </div>
                            )}
                        </div>
                        <div className="hidden md:flex flex-col items-start pr-2" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', paddingRight: '0.5rem' }}>
                            <span className="text-sm font-bold text-slate-800 leading-none mb-1" style={{ fontSize: '0.875rem', fontWeight: 700, color: '#1e293b', lineHeight: 1, marginBottom: '0.25rem' }}>{user.fullName}</span>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider" style={{ fontSize: '0.625rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{user.role}</span>
                        </div>
                        <div className="hidden md:block text-slate-400" style={{ color: '#94a3b8' }}>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ width: '1rem', height: '1rem' }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                        </div>
                    </button>

                    {/* Profile Menu */}
                    <AnimatePresence>
                        {isProfileOpen && (
                            <>
                                <div className="fixed inset-0 z-10" onClick={() => setIsProfileOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 10 }}></div>
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.95, y: -10 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.95, y: -10 }}
                                    transition={{ duration: 0.15, ease: 'easeOut' }}
                                    className="absolute right-0 mt-2 w-56 z-20 origin-top-right rounded-xl bg-white shadow-xl ring-1 ring-black ring-opacity-5 py-2"
                                    style={{
                                        position: 'absolute',
                                        right: 0,
                                        marginTop: '0.5rem',
                                        width: '14rem',
                                        zIndex: 20,
                                        transformOrigin: 'top right',
                                        background: 'white',
                                        borderRadius: '0.75rem',
                                        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                                        border: '1px solid #e2e8f0',
                                        paddingTop: '0.5rem',
                                        paddingBottom: '0.5rem'
                                    }}
                                >
                                    <div className="px-4 py-3 border-b border-slate-50 md:hidden" style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #f8fafc' }}>
                                        <p className="text-sm font-bold text-slate-800" style={{ fontSize: '0.875rem', fontWeight: 700, color: '#1e293b' }}>{user.fullName}</p>
                                        <p className="text-xs text-slate-500" style={{ fontSize: '0.75rem', color: '#64748b' }}>{user.role}</p>
                                    </div>
                                    <a
                                        href={user.role === 'COACH' ? '/coach/profile' : user.role === 'ADMIN' ? '/admin/profile' : '/coder/profile'}
                                        className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                                        style={{ width: '100%', textAlign: 'left', padding: '0.5rem 1rem', fontSize: '0.875rem', color: '#334155', display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'transparent', border: 'none', cursor: 'pointer', textDecoration: 'none' }}
                                    >
                                        <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ width: '1rem', height: '1rem', color: '#94a3b8' }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                                        Edit Profile
                                    </a>
                                    {/* Logout - Assuming standard next-auth signout or link */}
                                    {/* Logout - Using SignOutButton for modal confirmation */}
                                    <div style={{ width: '100%', padding: '0' }}>
                                        <SignOutButton
                                            label="Logout"
                                            style={{
                                                width: '100%',
                                                textAlign: 'left',
                                                padding: '0.5rem 1rem',
                                                fontSize: '0.875rem',
                                                color: '#dc2626',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '0.5rem',
                                                background: 'transparent',
                                                border: 'none',
                                                cursor: 'pointer'
                                            }}
                                            icon={
                                                <svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ width: '1rem', height: '1rem', color: '#f87171' }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                                            }
                                        />
                                    </div>
                                </motion.div>
                            </>
                        )}
                    </AnimatePresence>
                </div>
            </div>

            {/* ProfileModal removed */}
        </header>
    );
}
