'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Image from 'next/image';

const NAV_LINKS = [
    { href: '/coach/dashboard', label: 'Dashboard', icon: 'grid_view' },
    { href: '/coach/rubrics', label: 'Rubrik & Penilaian', icon: 'analytics' },
    { href: '/coach/makeup', label: 'Tugas Susulan', icon: 'history_edu' },
    { href: '/coach/leave', label: 'Pengajuan Izin', icon: 'mail_lock' },
];

export default function CoachSidebar() {
    const pathname = usePathname();

    return (
        <>
            <style>{`
                .sidebar-active-indicator {
                    width: 4px;
                    height: 20px;
                    background-color: #6bb3ff;
                    position: absolute;
                    left: 0;
                    border-radius: 0 4px 4px 0;
                }
                .material-symbols-outlined {
                    font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
                }
                .active-icon {
                    font-variation-settings: 'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24;
                }
            `}</style>
            <aside className="fixed left-0 top-0 h-full w-[260px] bg-[#0a1428] text-white flex flex-col z-50">
                <div className="p-8 pb-4">
                    <h2 className="text-2xl font-extrabold tracking-tight flex items-center gap-3">
                        <Image src="/favicon.ico" alt="Clevio" width={32} height={32} className="rounded-md" />
                        Clevio
                    </h2>
                </div>

                <nav className="flex-grow px-4 space-y-1.5 mt-4">
                    {NAV_LINKS.map((link) => {
                        const isActive = pathname.startsWith(link.href);

                        if (isActive) {
                            return (
                                <Link key={link.href} href={link.href} className="relative flex items-center px-4 py-3 text-white bg-slate-800/30 rounded-lg group">
                                    <div className="sidebar-active-indicator"></div>
                                    <span className="material-symbols-outlined active-icon mr-3 text-[#6bb3ff]">{link.icon}</span>
                                    <span className="font-semibold text-[#6bb3ff]">{link.label}</span>
                                </Link>
                            );
                        }

                        return (
                            <Link key={link.href} href={link.href} className="flex items-center px-4 py-3 text-slate-400 hover:text-white hover:bg-slate-800/40 transition-colors rounded-lg group">
                                <span className="material-symbols-outlined mr-3">{link.icon}</span>
                                <span className="font-medium">{link.label}</span>
                            </Link>
                        );
                    })}
                </nav>
            </aside>
        </>
    );
}
