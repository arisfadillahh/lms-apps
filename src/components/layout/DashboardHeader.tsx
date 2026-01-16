'use client';

import { useState } from 'react';
import { Mail, ChevronDown, LogOut, Settings } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import SignOutButton from '@/components/SignOutButton';
import Link from 'next/link';
import NotificationDropdown from './NotificationDropdown';
import MobileNav from './MobileNav';

type UserSession = {
    id: string;
    fullName: string;
    role: string;
    avatarPath?: string | null;
};

export default function DashboardHeader({ user }: { user: UserSession }) {
    const [isProfileOpen, setIsProfileOpen] = useState(false);

    // Get First Name for simplified display
    const firstName = user.fullName.split(' ')[0];

    return (
        <>
            {/* Responsive CSS for mobile header */}
            <style>{`
                @media (max-width: 768px) {
                    .dashboard-header {
                        flex-wrap: wrap !important;
                        gap: 0.75rem !important;
                        margin-bottom: 1rem !important;
                        padding: 0.5rem 0 !important;
                    }
                    .header-actions {
                        flex: 1 !important;
                        justify-content: flex-end !important;
                    }
                    .profile-text {
                        display: none !important;
                    }
                    .profile-avatar {
                        width: 36px !important;
                        height: 36px !important;
                    }
                    .profile-arrow {
                        width: 28px !important;
                        height: 28px !important;
                    }
                }
            `}</style>

            <header
                className="dashboard-header"
                style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '2rem',
                    paddingTop: '0.5rem',
                    gap: '2rem'
                }}
            >
                {/* Mobile Navigation - Hamburger Menu */}
                <MobileNav role={user.role as 'ADMIN' | 'COACH' | 'CODER'} />

                {/* Spacer for right alignment */}
                <div style={{ flex: 1 }}></div>

                {/* Right Actions */}
                <div className="header-actions" style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>

                    {/* Icons */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <button style={iconButtonStyle}>
                            <Mail size={20} color="#1e293b" />
                            <div style={badgeStyle} />
                        </button>
                        <NotificationDropdown />
                    </div>

                    {/* Profile Divider */}
                    <div style={{ width: '1px', height: '32px', background: '#e2e8f0' }} />

                    {/* Profile Section */}
                    <div style={{ position: 'relative' }}>
                        <button
                            onClick={() => setIsProfileOpen(!isProfileOpen)}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '1rem',
                                background: 'transparent',
                                border: 'none',
                                cursor: 'pointer',
                                outline: 'none',
                                padding: '0'
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                {/* Avatar */}
                                <div className="profile-avatar" style={{
                                    width: '48px',
                                    height: '48px',
                                    borderRadius: '50%',
                                    overflow: 'hidden',
                                    border: '2px solid #fff',
                                    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                                }}>
                                    {user.avatarPath ? (
                                        <img src={user.avatarPath} alt={user.fullName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    ) : (
                                        <div style={{ width: '100%', height: '100%', background: '#dbeafe', color: '#1e3a5f', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '1.1rem' }}>
                                            {firstName.charAt(0)}
                                        </div>
                                    )}
                                </div>

                                {/* Text - hidden on mobile */}
                                <div className="profile-text" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', textAlign: 'left' }}>
                                    <span style={{ fontSize: '1rem', fontWeight: 600, color: '#1e293b', lineHeight: 1.2 }}>
                                        {user.fullName}
                                    </span>
                                    <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 500 }}>
                                        {user.role === 'CODER' ? 'Student' : user.role === 'COACH' ? 'Instructor' : 'Admin'}
                                    </span>
                                </div>
                            </div>

                            {/* Blue Arrow Button */}
                            <div className="profile-arrow" style={{
                                width: '32px',
                                height: '32px',
                                borderRadius: '50%',
                                background: '#3b82f6',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#fff',
                                marginLeft: '0.5rem',
                                boxShadow: '0 2px 5px rgba(59, 130, 246, 0.3)'
                            }}>
                                <ChevronDown size={18} strokeWidth={3} />
                            </div>
                        </button>

                        {/* Dropdown User Menu */}
                        <AnimatePresence>
                            {isProfileOpen && (
                                <>
                                    <div
                                        onClick={() => setIsProfileOpen(false)}
                                        style={{ position: 'fixed', inset: 0, zIndex: 10 }}
                                    />
                                    <motion.div
                                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                                        animate={{ opacity: 1, scale: 1, y: 0 }}
                                        exit={{ opacity: 0, scale: 0.95, y: 10 }}
                                        transition={{ duration: 0.1 }}
                                        style={{
                                            position: 'absolute',
                                            right: 0,
                                            top: '120%',
                                            width: '220px',
                                            background: '#fff',
                                            borderRadius: '16px',
                                            boxShadow: '0 10px 40px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.05)',
                                            border: '1px solid #f1f5f9',
                                            padding: '0.5rem',
                                            zIndex: 20
                                        }}
                                    >
                                        <Link
                                            href={user.role === 'COACH' ? '/coach/profile' : user.role === 'ADMIN' ? '/admin/profile' : '/coder/profile'}
                                            style={menuItemStyle}
                                            onClick={() => setIsProfileOpen(false)}
                                        >
                                            <Settings size={18} />
                                            <span>Edit Profile</span>
                                        </Link>

                                        <div style={{ height: '1px', background: '#f1f5f9', margin: '0.25rem 0' }} />

                                        <SignOutButton
                                            label="Logout"
                                            style={{ ...menuItemStyle, color: '#ef4444', width: '100%' }}
                                            icon={<LogOut size={18} />}
                                        />
                                    </motion.div>
                                </>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </header>
        </>
    );
}

const iconButtonStyle = {
    background: '#fff',
    border: 'none',
    cursor: 'pointer',
    position: 'relative' as const,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0.6rem',
    borderRadius: '10px',
    transition: 'all 0.2s',
    boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
};

const badgeStyle = {
    position: 'absolute' as const,
    top: '6px',
    right: '6px',
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    background: '#3b82f6',
    border: '1px solid #fff',
};

const menuItemStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '0.6rem 0.75rem',
    borderRadius: '8px',
    color: '#475569',
    fontSize: '0.875rem',
    fontWeight: 500,
    textDecoration: 'none',
    transition: 'background 0.2s',
    cursor: 'pointer',
    border: 'none',
    background: 'transparent',
};
