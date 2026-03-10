'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Bell } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

type Notification = {
    id: string;
    title: string;
    message: string;
    is_read: boolean;
    created_at: string;
    type: string;
};

export default function NotificationDropdown() {
    const [isOpen, setIsOpen] = useState(false);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [selectedNotif, setSelectedNotif] = useState<Notification | null>(null);
    const [mounted, setMounted] = useState(false);
    const [portalContainer, setPortalContainer] = useState<Element | null>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const fetchNotifications = async () => {
        try {
            const res = await fetch('/api/notifications');
            const data = await res.json();
            if (data.success) {
                setNotifications(data.data);
                setUnreadCount(data.unreadCount);
            }
        } catch (e) {
            console.error(e);
        }
    };

    const markRead = async (id: string) => {
        try {
            await fetch('/api/notifications', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ notificationId: id }),
            });
            setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
            setUnreadCount(prev => Math.max(0, prev - 1));
        } catch (e) {
            console.error(e);
        }
    };

    const markAllRead = async () => {
        try {
            await fetch('/api/notifications', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ markAll: true }),
            });
            setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
            setUnreadCount(0);
        } catch (e) {
            console.error(e);
        }
    };

    const handleNotifClick = (notif: Notification) => {
        if (!notif.is_read) {
            markRead(notif.id);
        }
        setSelectedNotif(notif);
        setIsOpen(false);
    };

    useEffect(() => {
        setMounted(true);
        setPortalContainer(document.body);
        fetchNotifications();
        const interval = setInterval(fetchNotifications, 60000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [dropdownRef]);

    return (
        <>
            <div className="relative" ref={dropdownRef} style={{ position: 'relative' }}>
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    style={{
                        position: 'relative',
                        padding: '0.7rem',
                        borderRadius: '14px',
                        cursor: 'pointer',
                        border: 'none',
                        background: '#FFFDE6',
                        color: '#d97706',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: 'none',
                        transition: 'all 0.2s'
                    }}
                >
                    <Bell size={20} color="#d97706" />
                    {unreadCount > 0 && (
                        <span
                            style={{
                                position: 'absolute',
                                top: '6px',
                                right: '6px',
                                height: '9px',
                                width: '9px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                borderRadius: '50%',
                                background: '#22367b',
                                border: '2px solid #FFFDE6'
                            }}
                        />
                    )}
                </button>

                <AnimatePresence>
                    {isOpen && (
                        <motion.div
                            className="notification-dropdown"
                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 10, scale: 0.95 }}
                            transition={{ duration: 0.1 }}
                            style={{
                                position: 'absolute',
                                right: 0,
                                marginTop: '0.5rem',
                                width: '360px',
                                zIndex: 50,
                                background: '#ffffff',
                                borderRadius: '12px',
                                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                                border: '1px solid #e2e8f0',
                                overflow: 'hidden'
                            }}
                        >
                            <div style={{ padding: '1rem', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <h3 style={{ fontWeight: 600, color: '#1e293b', margin: 0 }}>Notifikasi</h3>
                                {unreadCount > 0 && (
                                    <button
                                        onClick={markAllRead}
                                        style={{ fontSize: '0.75rem', color: '#1e3a5f', fontWeight: 500, background: 'none', border: 'none', cursor: 'pointer' }}
                                    >
                                        Tandai semua dibaca
                                    </button>
                                )}
                            </div>
                            <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                                {notifications.length === 0 ? (
                                    <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.875rem' }}>
                                        Tidak ada notifikasi
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                        {notifications.map((notif) => (
                                            <div
                                                key={notif.id}
                                                style={{
                                                    padding: '1rem',
                                                    background: !notif.is_read ? '#eff6ff' : 'white',
                                                    borderBottom: '1px solid #f8fafc',
                                                    cursor: 'pointer',
                                                    transition: 'background 0.15s'
                                                }}
                                                onClick={() => handleNotifClick(notif)}
                                                onMouseEnter={(e) => e.currentTarget.style.background = !notif.is_read ? '#dbeafe' : '#f8fafc'}
                                                onMouseLeave={(e) => e.currentTarget.style.background = !notif.is_read ? '#eff6ff' : 'white'}
                                            >
                                                <div style={{ display: 'flex', gap: '0.75rem' }}>
                                                    <div
                                                        style={{
                                                            marginTop: '0.35rem', height: '0.5rem', width: '0.5rem', flexShrink: 0, borderRadius: '9999px',
                                                            background: !notif.is_read ? '#3b82f6' : 'transparent'
                                                        }}
                                                    />
                                                    <div style={{ flex: 1, minWidth: 0 }}>
                                                        <p style={{ fontSize: '0.875rem', fontWeight: 600, color: '#1e293b', margin: 0 }}>{notif.title}</p>
                                                        <p style={{
                                                            fontSize: '0.8rem',
                                                            color: '#64748b',
                                                            marginTop: '0.25rem',
                                                            lineHeight: '1.4',
                                                            overflow: 'hidden',
                                                            textOverflow: 'ellipsis',
                                                            whiteSpace: 'nowrap'
                                                        }}>
                                                            {notif.message.replace(/<[^>]*>/g, '').slice(0, 60)}...
                                                        </p>
                                                        <p style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '0.35rem' }}>
                                                            {new Date(notif.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Detail Modal Component */}
            <NotificationModal
                notif={selectedNotif}
                onClose={() => setSelectedNotif(null)}
            />

            {/* Add styles for rich content */}
            <style>{`
                .notif-content img {
                    max-width: 100%;
                    height: auto;
                    border-radius: 8px;
                    margin: 1rem 0;
                }
                .notif-content a {
                    color: #1e3a5f;
                    text-decoration: underline;
                }
                .notif-content ul, .notif-content ol {
                    padding-left: 1.5rem;
                    margin: 0.5rem 0;
                }
                .notif-content p {
                    margin-bottom: 1rem;
                }
                
                /* Mobile responsive notification dropdown */
                @media (max-width: 768px) {
                    .notification-dropdown {
                        position: fixed !important;
                        left: 1rem !important;
                        right: 1rem !important;
                        top: 4rem !important;
                        width: auto !important;
                        max-width: calc(100vw - 2rem) !important;
                    }
                }
            `}</style>
        </>
    );
}

function NotificationModal({ notif, onClose }: { notif: Notification | null, onClose: () => void }) {
    const [mounted, setMounted] = useState(false);
    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted || !notif) return null;

    return createPortal(
        <AnimatePresence>
            {notif && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: 'rgba(0, 0, 0, 0.65)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 9999999, // Extremely high
                        padding: '1rem',
                        backdropFilter: 'blur(10px)'
                    }}
                    onClick={onClose}
                >
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 40 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 40 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 350 }}
                        style={{
                            background: '#ffffff',
                            borderRadius: '28px',
                            width: '100%',
                            maxWidth: '850px',
                            maxHeight: '90vh',
                            overflow: 'hidden',
                            boxShadow: '0 30px 60px -12px rgba(0, 0, 0, 0.4)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            display: 'flex',
                            flexDirection: 'column'
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Modal Header */}
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'flex-start',
                            padding: '2.5rem 2.5rem 1.5rem 2.5rem',
                            borderBottom: '1px solid #f1f5f9',
                            background: 'linear-gradient(135deg, #ffffff 0%, #f9fafb 100%)'
                        }}>
                            <div style={{ flex: 1 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                                    <span style={{
                                        fontSize: '0.65rem',
                                        padding: '5px 12px',
                                        background: notif.type === 'BROADCAST' ? '#eff6ff' : '#f0fdf4',
                                        color: notif.type === 'BROADCAST' ? '#1e40af' : '#166534',
                                        borderRadius: '100px',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.08em',
                                        fontWeight: 800,
                                        boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
                                    }}>
                                        {notif.type === 'BROADCAST' ? '📢 Broadcast' : '🔔 Notifikasi'}
                                    </span>
                                </div>
                                <h2 style={{ fontSize: '2rem', fontWeight: 900, color: '#0f172a', margin: 0, lineHeight: 1.1, letterSpacing: '-0.02em' }}>
                                    {notif.title}
                                </h2>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#94a3b8', marginTop: '14px' }}>
                                    <p style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                                        {new Date(notif.created_at).toLocaleDateString('id-ID', {
                                            weekday: 'long',
                                            day: 'numeric',
                                            month: 'long',
                                            year: 'numeric'
                                        })}
                                    </p>
                                    <span>•</span>
                                    <p style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                                        {new Date(notif.created_at).toLocaleTimeString('id-ID', {
                                            hour: '2-digit',
                                            minute: '2-digit'
                                        })}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={onClose}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    width: '44px',
                                    height: '44px',
                                    borderRadius: '14px',
                                    border: 'none',
                                    background: '#f1f5f9',
                                    color: '#64748b',
                                    cursor: 'pointer',
                                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                    marginLeft: '20px',
                                    flexShrink: 0
                                }}
                                onMouseEnter={(e) => { e.currentTarget.style.background = '#0f172a'; e.currentTarget.style.color = '#ffffff'; e.currentTarget.style.transform = 'rotate(90deg)'; }}
                                onMouseLeave={(e) => { e.currentTarget.style.background = '#f1f5f9'; e.currentTarget.style.color = '#64748b'; e.currentTarget.style.transform = 'rotate(0deg)'; }}
                            >
                                <X size={22} />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div style={{
                            padding: '2.5rem',
                            overflowY: 'auto',
                            maxHeight: 'calc(90vh - 200px)',
                            lineHeight: '1.9',
                            fontSize: '1.1rem',
                            color: '#334155',
                            background: '#ffffff'
                        }}>
                            <div
                                dangerouslySetInnerHTML={{ __html: notif.message }}
                                className="notif-content"
                            />
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>,
        document.body
    );
}
