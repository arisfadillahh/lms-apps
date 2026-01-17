/**
 * Admin Permissions System
 * 
 * Manages menu access control for admin users.
 * - Superadmin: username=admin OR admin_permissions=null → full access
 * - Limited Admin: admin_permissions.menus contains allowed menu IDs
 */

import { MENU_ITEMS } from '@/lib/adminMenu';

export type AdminPermissions = {
    menus: string[];
    is_superadmin: boolean;
} | null;

export const ADMIN_MENUS = Object.entries(MENU_ITEMS).map(([key, value]) => ({
    id: key,
    label: value.label,
    href: value.href
}));

export type AdminMenuId = keyof typeof MENU_ITEMS;

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
