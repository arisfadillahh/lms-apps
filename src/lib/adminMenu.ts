
import {
    Home, Users, GraduationCap, BookOpen, CalendarOff, FileText,
    MessageCircle, Package, Image as ImageIcon, Wallet, BookMarked,
    Megaphone, Receipt, Settings, UserCheck
} from 'lucide-react';

// Define the Leaf Menu Items (Source of Truth for Icons & Links)
export const MENU_ITEMS: Record<string, { href: string; label: string; icon: any }> = {
    dashboard: { href: '/admin/dashboard', label: 'Dashboard', icon: Home },
    users: { href: '/admin/users', label: 'Pengguna', icon: Users },
    classes: { href: '/admin/classes', label: 'Kelas', icon: GraduationCap },
    curriculum: { href: '/admin/curriculum', label: 'Kurikulum', icon: BookOpen },
    ekskul: { href: '/admin/ekskul', label: 'Ekskul Plans', icon: BookMarked },
    payments: { href: '/admin/payments', label: 'Paket & Tarif', icon: Wallet },
    invoices: { href: '/admin/payments/invoices', label: 'Invoice', icon: Receipt },
    ccr: { href: '/admin/coders/assign-ccr', label: 'Assign ID Invoice', icon: UserCheck },
    ccrlist: { href: '/admin/coders/list-ccr', label: 'Daftar ID Invoice', icon: FileText },
    software: { href: '/admin/software', label: 'Software', icon: Package },
    banners: { href: '/admin/banners', label: 'Banner', icon: ImageIcon },
    leave: { href: '/admin/leave', label: 'Izin Coach', icon: CalendarOff },
    reports: { href: '/admin/reports', label: 'Laporan', icon: FileText },
    whatsapp: { href: '/admin/whatsapp', label: 'WhatsApp', icon: MessageCircle },
    broadcast: { href: '/admin/broadcast', label: 'Broadcast', icon: Megaphone },
    settings: { href: '/admin/settings', label: 'Settings', icon: Settings },
};

// Define the Structure (Groups vs Single Items)
export type SidebarGroup = {
    type: 'group';
    label: string;
    icon: any;
    children: string[]; // IDs from MENU_ITEMS
};

export type SidebarSingle = {
    type: 'single';
    id: string; // ID from MENU_ITEMS
};

export const SIDEBAR_STRUCTURE: (SidebarGroup | SidebarSingle)[] = [
    { type: 'single', id: 'dashboard' },
    { type: 'single', id: 'users' },
    {
        type: 'group',
        label: 'Akademik',
        icon: GraduationCap,
        children: ['classes', 'curriculum', 'ekskul']
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
        children: ['software', 'banners', 'leave', 'reports', 'settings']
    }
];
