'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import { CalendarClock, ClipboardCheck, History, Images, LayoutDashboard, Receipt } from 'lucide-react';
import IssueReportButton from '@/components/issue-reports/IssueReportButton';

const NAV_LINKS = [
    { href: '/coach/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/coach/rubrics', label: 'Rubrik & Penilaian', icon: ClipboardCheck },
    { href: '/coach/makeup', label: 'Tugas Susulan', icon: History },
    { href: '/coach/leave', label: 'Pengajuan Izin', icon: CalendarClock },
    { href: '/coach/payroll', label: 'Absensi & Slip Gaji', icon: Receipt },
    { href: '/coach/portfolios', label: 'Review Portofolio', icon: Images },
];

export default function CoachSidebar() {
    const pathname = usePathname();

    return (
        <aside className="fixed left-0 top-0 h-full w-[260px] bg-[#0a1428] text-white flex flex-col z-50">
            <div className="p-8 pb-4">
                <h2 className="text-2xl font-extrabold tracking-tight flex items-center gap-3">
                    <Image src="/favicon.ico" alt="Clevio" width={32} height={32} className="rounded-md" />
                    Clevio
                </h2>
            </div>

            <nav aria-label="Navigasi Coach" className="flex-grow overflow-y-auto px-4 space-y-1.5 mt-4">
                {NAV_LINKS.map(({ href, label, icon: Icon }) => {
                    const active = pathname.startsWith(href);
                    return (
                        <Link key={href} href={href} aria-current={active ? 'page' : undefined}
                            className={`relative flex items-center gap-3 rounded-lg px-4 py-3 transition-colors ${active
                                ? 'bg-slate-800/30 font-semibold text-[#6bb3ff]'
                                : 'font-medium text-slate-400 hover:bg-slate-800/40 hover:text-white'}`}>
                            {active && <span aria-hidden="true" className="absolute left-0 h-5 w-1 rounded-r bg-[#6bb3ff]" />}
                            <Icon aria-hidden="true" size={22} className="shrink-0" />
                            <span>{label}</span>
                        </Link>
                    );
                })}
            </nav>

            <div className="coach-sidebar-report border-t border-slate-800 px-4 py-4">
                <IssueReportButton role="COACH" placement="sidebar" />
            </div>
        </aside>
    );
}
