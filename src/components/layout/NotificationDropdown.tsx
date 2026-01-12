'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

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
    const [isLoading, setIsLoading] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const router = useRouter();

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
            // Optimistic update
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

    // Poll notifications every 60s
    useEffect(() => {
        fetchNotifications();
        const interval = setInterval(fetchNotifications, 60000);
        return () => clearInterval(interval);
    }, []);

    // Close click outside
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
        <div className="relative" ref={dropdownRef} style={{ position: 'relative' }}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="relative p-2 rounded-full hover:bg-slate-100 transition-colors text-slate-600"
                style={{
                    position: 'relative',
                    padding: '8px',
                    borderRadius: '9999px',
                    cursor: 'pointer',
                    border: 'none', // Reset default border
                    background: isOpen ? '#f1f5f9' : 'transparent', // Hover state simulation
                    color: '#475569',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                }}
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
                    <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
                </svg>
                {unreadCount > 0 && (
                    <span
                        className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white ring-2 ring-white"
                        style={{
                            position: 'absolute',
                            top: '4px',
                            right: '4px',
                            height: '16px',
                            width: '16px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: '9999px',
                            background: '#ef4444',
                            color: 'white',
                            fontSize: '10px',
                            fontWeight: 'bold',
                            boxShadow: '0 0 0 2px white'
                        }}
                    >
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            {isOpen && (
                <div
                    className="absolute right-0 mt-2 w-80 z-50 origin-top-right rounded-xl bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none animate-in fade-in zoom-in-95 duration-200"
                    style={{
                        position: 'absolute',
                        right: 0,
                        marginTop: '0.5rem',
                        width: '320px',
                        zIndex: 50,
                        background: '#ffffff',
                        borderRadius: '12px',
                        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                        border: '1px solid #e2e8f0',
                        overflow: 'hidden'
                    }}
                >
                    <div className="p-4 border-b border-slate-100 flex justify-between items-center" style={{ padding: '1rem', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h3 className="font-semibold text-slate-800" style={{ fontWeight: 600, color: '#1e293b', margin: 0 }}>Notifications</h3>
                        {unreadCount > 0 && (
                            <button
                                onClick={markAllRead}
                                className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                                style={{ fontSize: '0.75rem', color: '#2563eb', fontWeight: 500, background: 'none', border: 'none', cursor: 'pointer' }}
                            >
                                Mark all read
                            </button>
                        )}
                    </div>
                    <div className="max-h-[400px] overflow-y-auto" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                        {notifications.length === 0 ? (
                            <div className="p-8 text-center text-slate-400 text-sm" style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.875rem' }}>
                                No notifications
                            </div>
                        ) : (
                            <div className="divide-y divide-slate-50" style={{ display: 'flex', flexDirection: 'column' }}>
                                {notifications.map((notif) => (
                                    <div
                                        key={notif.id}
                                        className={`p-4 hover:bg-slate-50 transition-colors ${!notif.is_read ? 'bg-blue-50/50' : ''}`}
                                        style={{
                                            padding: '1rem',
                                            background: !notif.is_read ? '#eff6ff' : 'white',
                                            borderBottom: '1px solid #f8fafc',
                                            cursor: 'pointer'
                                        }}
                                        onClick={() => !notif.is_read && markRead(notif.id)}
                                    >
                                        <div className="flex gap-3" style={{ display: 'flex', gap: '0.75rem' }}>
                                            <div
                                                className={`mt-1 h-2 w-2 flex-shrink-0 rounded-full ${!notif.is_read ? 'bg-blue-500' : 'bg-transparent'}`}
                                                style={{
                                                    marginTop: '0.25rem', height: '0.5rem', width: '0.5rem', flexShrink: 0, borderRadius: '9999px',
                                                    background: !notif.is_read ? '#3b82f6' : 'transparent'
                                                }}
                                            />
                                            <div>
                                                <p className="text-sm font-medium text-slate-800" style={{ fontSize: '0.875rem', fontWeight: 500, color: '#1e293b', margin: 0 }}>{notif.title}</p>
                                                <p className="text-sm text-slate-600 mt-1 line-clamp-3 leading-relaxed" style={{ fontSize: '0.875rem', color: '#475569', marginTop: '0.25rem', lineHeight: '1.5' }}>{notif.message}</p>
                                                <p className="text-xs text-slate-400 mt-2" style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.5rem' }}>
                                                    {new Date(notif.created_at).toLocaleDateString()}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
