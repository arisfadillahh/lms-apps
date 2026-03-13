'use client';

import { useState } from 'react';
import { ChevronDown, LogOut, Settings, Bell } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import SignOutButton from '@/components/SignOutButton';
import NotificationDropdown from '@/components/layout/NotificationDropdown';
import CoachSearch from './CoachSearch';

type CoachDashboardHeaderProps = {
    user: {
        id: string;
        fullName: string;
        role: string;
        avatarPath?: string | null;
    };
};

export default function CoachDashboardHeader({ user }: CoachDashboardHeaderProps) {
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const firstName = user.fullName.split(' ')[0];
    const initial = firstName.charAt(0).toUpperCase();

    return (
        <nav className="sticky top-0 z-40 bg-white border-b border-[#e2e8f0] px-8 py-4 mb-0 -mx-8 flex items-center justify-between shadow-sm">
            <div className="flex items-center">
                <h1 className="text-xl font-bold text-slate-800 hidden lg:block">
                    Selamat datang kembali, Coach {firstName}! 👋
                </h1>
                <h1 className="text-lg font-bold text-slate-800 lg:hidden">
                    Halo, {firstName}! 👋
                </h1>
            </div>

            <div className="flex-1 flex items-center justify-end gap-4 md:gap-6">
                {/* Search Bar */}
                <div className="hidden md:block flex-1 max-w-[600px]">
                    <CoachSearch />
                </div>

                {/* Notifications */}
                <div className="flex items-center">
                    <NotificationDropdown />
                </div>

                <div className="h-8 w-px bg-slate-200 hidden sm:block"></div>

                {/* Profile Dropdown */}
                <div className="relative">
                    <button
                        onClick={() => setIsProfileOpen(!isProfileOpen)}
                        className="flex items-center gap-2 md:gap-3 hover:bg-slate-50 p-1.5 pr-2 md:pr-3 rounded-xl transition-all border border-transparent hover:border-slate-200"
                    >
                        <div className="w-8 h-8 rounded-lg bg-[#6bb3ff] flex items-center justify-center text-[#0a1428] font-bold text-sm overflow-hidden shadow-sm">
                            {user.avatarPath ? (
                                <img src={user.avatarPath} alt={user.fullName} className="w-full h-full object-cover" />
                            ) : (
                                initial
                            )}
                        </div>
                        <div className="hidden sm:flex flex-col items-start leading-tight min-w-[100px] max-w-[180px] md:max-w-[250px] text-left">
                            <span className="text-xs md:text-sm font-bold text-slate-700 truncate w-full block">{user.fullName}</span>
                            <span className="text-[10px] text-slate-400 font-medium lowercase">coach</span>
                        </div>
                        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isProfileOpen ? 'rotate-180' : ''}`} />
                    </button>

                    <AnimatePresence>
                        {isProfileOpen && (
                            <>
                                <div
                                    className="fixed inset-0 z-10"
                                    onClick={() => setIsProfileOpen(false)}
                                />
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.95, y: 10 }}
                                    transition={{ duration: 0.1 }}
                                    className="absolute right-0 top-full mt-2 w-48 bg-white rounded-2xl shadow-xl border border-slate-100 p-2 z-20"
                                >
                                    <Link
                                        href="/coach/profile"
                                        className="flex items-center gap-3 px-3 py-2.5 text-sm text-slate-600 hover:bg-slate-50 rounded-xl transition-colors font-medium"
                                        onClick={() => setIsProfileOpen(false)}
                                    >
                                        <div className="p-1.5 rounded-lg bg-slate-100 text-slate-500">
                                            <Settings className="w-4 h-4" />
                                        </div>
                                        Edit Profile
                                    </Link>

                                    <div className="my-1 border-t border-slate-100" />

                                    <SignOutButton
                                        label="Logout"
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.75rem',
                                            padding: '0.6rem 0.75rem',
                                            borderRadius: '12px',
                                            color: '#ef4444',
                                            fontSize: '0.875rem',
                                            fontWeight: 500,
                                            textDecoration: 'none',
                                            transition: 'background 0.2s',
                                            cursor: 'pointer',
                                            border: 'none',
                                            background: 'transparent',
                                            width: '100%'
                                        }}
                                        icon={
                                            <div className="p-1.5 rounded-lg bg-red-50 text-red-500">
                                                <LogOut className="w-4 h-4" />
                                            </div>
                                        }
                                    />
                                </motion.div>
                            </>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </nav>
    );
}
