/**
 * Admin Permissions System
 * 
 * Manages menu access control for admin users.
 * - Superadmin: username=admin OR admin_permissions=null → full access
 * - Limited Admin: admin_permissions.menus contains allowed menu IDs
 */

export type AdminPermissions = {
    menus: string[];
    is_superadmin: boolean;
} | null;

export const ADMIN_MENUS = [
    { id: 'dashboard', label: 'Dashboard', href: '/admin/dashboard' },
    { id: 'users', label: 'Pengguna', href: '/admin/users' },
    { id: 'classes', label: 'Kelas', href: '/admin/classes' },
    { id: 'curriculum', label: 'Kurikulum', href: '/admin/curriculum' },
    { id: 'ekskul', label: 'Ekskul Plans', href: '/admin/ekskul' },
    { id: 'payments', label: 'Paket & Tarif', href: '/admin/payments' },
    { id: 'invoices', label: 'Invoice', href: '/admin/payments/invoices' },
    { id: 'ccr', label: 'Assign CCR', href: '/admin/coders/assign-ccr' },
    { id: 'software', label: 'Software', href: '/admin/software' },
    { id: 'banners', label: 'Banner', href: '/admin/banners' },
    { id: 'leave', label: 'Izin Coach', href: '/admin/leave' },
    { id: 'reports', label: 'Rapor', href: '/admin/reports' },
    { id: 'whatsapp', label: 'WhatsApp', href: '/admin/whatsapp' },
    { id: 'broadcast', label: 'Broadcast', href: '/admin/broadcast' },
    { id: 'settings', label: 'Settings', href: '/admin/settings' },
] as const;

export type AdminMenuId = typeof ADMIN_MENUS[number]['id'];

/**
 * Check if user is superadmin (full access to all menus)
 */
export function isSuperAdmin(username: string, permissions: AdminPermissions): boolean {
    // Username "admin" is always superadmin
    if (username === 'admin') return true;

    // Null permissions = superadmin
    if (permissions === null) return true;

    // Explicit superadmin flag
    if (permissions.is_superadmin) return true;

    return false;
}

/**
 * Check if user can access a specific menu
 */
export function canAccessMenu(
    username: string,
    permissions: AdminPermissions,
    menuId: string
): boolean {
    // Superadmin can access everything
    if (isSuperAdmin(username, permissions)) return true;

    // Check if menu is in allowed list
    if (permissions && permissions.menus) {
        return permissions.menus.includes(menuId);
    }

    return false;
}

/**
 * Get list of allowed menus for user
 */
export function getAllowedMenus(username: string, permissions: AdminPermissions): typeof ADMIN_MENUS[number][] {
    if (isSuperAdmin(username, permissions)) {
        return [...ADMIN_MENUS];
    }

    if (permissions && permissions.menus) {
        return ADMIN_MENUS.filter(menu => permissions.menus.includes(menu.id));
    }

    // Default: only dashboard
    return ADMIN_MENUS.filter(menu => menu.id === 'dashboard');
}
