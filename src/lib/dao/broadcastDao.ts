"use server";

import { getSupabaseAdmin } from '@/lib/supabaseServer';
import type { Role } from '@/types/supabase';

type NotificationPayload = {
    user_id: string;
    title: string;
    message: string;
    type: string;
    is_read: boolean;
};

/**
 * Create notifications for multiple users at once (batch insert)
 */
export async function createBulkNotifications(
    userIds: string[],
    title: string,
    message: string,
    type = 'BROADCAST'
): Promise<number> {
    if (userIds.length === 0) return 0;

    const supabase = getSupabaseAdmin();
    const payloads: NotificationPayload[] = userIds.map(userId => ({
        user_id: userId,
        title,
        message,
        type,
        is_read: false
    }));

    const { error, count } = await supabase
        .from('notifications' as any)
        .insert(payloads);

    if (error) {
        throw new Error(`Failed to create bulk notifications: ${error.message}`);
    }

    return userIds.length;
}

/**
 * Get all user IDs by role(s) for active users only
 */
export async function getActiveUserIdsByRoles(roles: Role[]): Promise<string[]> {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
        .from('users')
        .select('id')
        .in('role', roles)
        .eq('is_active', true);

    if (error) {
        throw new Error(`Failed to fetch users by roles: ${error.message}`);
    }

    return (data ?? []).map(u => u.id);
}
