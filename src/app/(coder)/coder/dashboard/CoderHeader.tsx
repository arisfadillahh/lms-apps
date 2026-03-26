'use client';

import { useState } from 'react';
import { Calendar, ChevronDown, LogOut, Settings, Hand } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import SignOutButton from '@/components/SignOutButton';
import Link from 'next/link';
import NotificationDropdown from '@/components/layout/NotificationDropdown';
import MobileNav from '@/components/layout/MobileNav';

type CoderHeaderProps = {
    userName: string;
    fullName: string;
    todayDate: string;
    avatarPath?: string | null;
    role: string;
    username?: string;
    adminPermissions?: { menus: string[]; is_superadmin: boolean } | null;
};

export default function CoderHeader({ userName, fullName, todayDate, avatarPath, role, username, adminPermissions }: CoderHeaderProps) {
    const [isProfileOpen, setIsProfileOpen] = useState(false);

    const avatarUrl = avatarPath || `https://ui-avatars.com/api/?name=${userName}&background=FFF0F3&color=1E3A5F`;

    return (
        <header className="flex-shrink-0 sticky top-0 z-[30] bg-white/90 backdrop-blur-md px-4 md:px-8 py-3 md:py-5 flex items-center gap-3 md:gap-4 border-b-4 border-dashed border-pastel-blue/30">
            {/* Mobile Nav */}
            <MobileNav
                role={role as 'ADMIN' | 'COACH' | 'CODER'}
                username={username}
                adminPermissions={adminPermissions}
            />

            {/* Greeting */}
            <div className="flex-1 md:flex-none truncate">
                <h2 className="text-xl md:text-3xl font-black tracking-tight text-clevio-navy flex items-center gap-1.5 md:gap-2 truncate">
                    Halo, <span className="truncate">{userName}!</span> <Hand className="w-5 h-5 md:w-7 md:h-7 text-amber-500 shrink-0 hidden sm:block" />
                </h2>
                <p className="text-[10px] md:text-sm font-bold text-slate-400 mt-0.5 md:mt-1 flex items-center gap-1.5 md:gap-2 truncate">
                    <Calendar className="w-3.5 h-3.5 md:w-4 md:h-4 shrink-0" />
                    {todayDate}
                </p>
            </div>

            {/* Spacer */}
            {/* Spacer (Hidden on Mobile, takes space on Desktop) */}
            <div className="hidden md:block flex-1" />

            {/* Right Actions */}
            <div className="flex items-center gap-5">
                {/* Notification Dropdown */}
                <NotificationDropdown />

                {/* Profile Divider */}
                <div className="w-px h-8 bg-slate-100" />

                {/* Profile Section with Dropdown */}
                <div className="relative">
                    <button
                        onClick={() => setIsProfileOpen(!isProfileOpen)}
                        className="flex items-center gap-3 bg-white p-2 pr-4 rounded-2xl shadow-sm border-2 border-slate-50 hover:border-pastel-pink transition-colors cursor-pointer"
                    >
                        <div
                            className="bg-center bg-no-repeat bg-cover rounded-xl size-10 border-2 border-coral/20"
                            style={{ backgroundImage: `url(${avatarUrl})` }}
                        />
                        <span className="font-black text-sm text-slate-700 hidden sm:inline">{fullName}</span>
                        <ChevronDown
                            size={16}
                            className={`text-slate-400 transition-transform ${isProfileOpen ? 'rotate-180' : ''}`}
                        />
                    </button>

                    <AnimatePresence>
                        {isProfileOpen && (
                            <>
                                <div
                                    onClick={() => setIsProfileOpen(false)}
                                    className="fixed inset-0 z-10"
                                />
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.95, y: 10 }}
                                    transition={{ duration: 0.1 }}
                                    className="absolute right-0 top-full mt-2 w-56 bg-white rounded-2xl shadow-lg border border-slate-100 p-2 z-20"
                                >
                                    <Link
                                        href="/coder/profile"
                                        className="flex items-center gap-3 px-4 py-3 rounded-xl text-slate-600 text-sm font-bold hover:bg-pastel-blue transition-colors no-underline"
                                        onClick={() => setIsProfileOpen(false)}
                                    >
                                        <Settings size={18} />
                                        <span>Edit Profile</span>
                                    </Link>

                                    <div className="h-px bg-slate-100 mx-2 my-1" />

                                    <SignOutButton
                                        label="Logout"
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.75rem',
                                            padding: '0.75rem 1rem',
                                            borderRadius: '12px',
                                            color: '#ef4444',
                                            fontSize: '0.875rem',
                                            fontWeight: 700,
                                            textDecoration: 'none',
                                            cursor: 'pointer',
                                            border: 'none',
                                            background: 'transparent',
                                            width: '100%',
                                            transition: 'background 0.2s',
                                        }}
                                        icon={<LogOut size={18} />}
                                    />
                                </motion.div>
                            </>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </header>
    );
}
