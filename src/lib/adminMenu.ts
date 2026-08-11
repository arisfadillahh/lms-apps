
import {
    Home, Users, GraduationCap, BookOpen, CalendarOff, FileText,
    MessageCircle, Package, Image as ImageIcon, Wallet, BookMarked,
    Megaphone, Receipt, Settings, UserCheck, ClipboardList, MessageSquare, UserRoundPlus
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

// Define the Leaf Menu Items (Source of Truth for Icons & Links)
export const MENU_ITEMS: Record<string, { href: string; label: string; icon: LucideIcon }> = {
    dashboard: { href: '/admin/dashboard', label: 'Dashboard', icon: Home },
    users: { href: '/admin/users', label: 'Pengguna', icon: Users },
    freeTrials: { href: '/admin/free-trials', label: 'Free Trial', icon: UserRoundPlus },
    trialAssessments: { href: '/admin/trial-assessments', label: 'Review Trial', icon: ClipboardList },
    classes: { href: '/admin/classes', label: 'Kelas', icon: GraduationCap },
    curriculum: { href: '/admin/curriculum', label: 'Kurikulum', icon: BookOpen },
    lessonReports: { href: '/admin/curriculum/reports', label: 'Laporan Lesson', icon: FileText },
    ekskul: { href: '/admin/ekskul', label: 'Ekskul Plans', icon: BookMarked },
    payments: { href: '/admin/payments', label: 'Paket & Tarif', icon: Wallet },
    invoices: { href: '/admin/payments/invoices', label: 'Invoice', icon: Receipt },
    ccr: { href: '/admin/coders/assign-ccr', label: 'Assign ID Invoice', icon: UserCheck },
    ccrlist: { href: '/admin/coders/list-ccr', label: 'Daftar ID Invoice', icon: FileText },
    software: { href: '/admin/software', label: 'Software', icon: Package },
    banners: { href: '/admin/banners', label: 'Banner', icon: ImageIcon },
    leave: { href: '/admin/leave', label: 'Izin Coach', icon: CalendarOff },
    reports: { href: '/admin/reports', label: 'Status Rapor', icon: FileText },
    evaluations: { href: '/admin/evaluations', label: 'Kompetensi Rapor', icon: ClipboardList },
    evaluationQuestions: { href: '/admin/evaluations/questions', label: 'Pertanyaan Refleksi', icon: MessageSquare },
    whatsapp: { href: '/admin/whatsapp', label: 'WhatsApp', icon: MessageCircle },
    broadcast: { href: '/admin/broadcast', label: 'Broadcast', icon: Megaphone },
    settings: { href: '/admin/settings', label: 'Settings', icon: Settings },
};

// Define the Structure (Groups vs Single Items)
export type SidebarGroup = {
    type: 'group';
    label: string;
    icon: LucideIcon;
    children: string[]; // IDs from MENU_ITEMS
};

export type SidebarSingle = {
    type: 'single';
    id: string; // ID from MENU_ITEMS
};

export const SIDEBAR_STRUCTURE: (SidebarGroup | SidebarSingle)[] = [
    { type: 'single', id: 'dashboard' },
    { type: 'single', id: 'users' },
    { type: 'single', id: 'freeTrials' },
    { type: 'single', id: 'trialAssessments' },
    {
        type: 'group',
        label: 'Akademik',
        icon: GraduationCap,
        children: ['classes', 'curriculum', 'lessonReports', 'ekskul', 'evaluations', 'evaluationQuestions', 'reports']
    },
    {
        type: 'group',
        label: 'Keuangan',
        icon: Wallet,
        children: ['payments', 'invoices', 'ccr', 'ccrlist']
    },
    {
        type: 'group',
        label: 'Komunikasi',
        icon: MessageCircle,
        children: ['whatsapp', 'broadcast']
    },
    {
        type: 'group',
        label: 'Lainnya',
        icon: Settings,
        children: ['software', 'banners', 'leave', 'settings']
    }
];
