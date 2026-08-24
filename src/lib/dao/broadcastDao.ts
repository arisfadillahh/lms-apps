"use server";

import { getSupabaseAdmin } from '@/lib/supabaseServer';
import { sendPushToUsers } from '@/lib/pushNotifications';
import type { NotificationDeliveryOptions } from '@/lib/dao/notificationsDao';
import type { Role } from '@/types/supabase';

type NotificationPayload = {
    user_id: string;
    title: string;
    message: string;
    type: string;
    is_read: boolean;
    action_url: string | null;
    category: string;
    priority: string;
    dedupe_key: string | null;
};

/**
 * Create notifications for multiple users at once (batch insert)
 */
export async function createBulkNotifications(
    userIds: string[],
    title: string,
    message: string,
    type = 'BROADCAST',
    delivery: NotificationDeliveryOptions = {},
): Promise<number> {
    if (userIds.length === 0) return 0;

    const supabase = getSupabaseAdmin();
    const payloads: NotificationPayload[] = userIds.map(userId => ({
        user_id: userId,
        title,
        message,
        type,
        is_read: false,
        action_url: delivery.actionUrl || delivery.pushUrl || null,
        category: delivery.category || 'BROADCAST',
        priority: delivery.priority || 'NORMAL',
        dedupe_key: delivery.dedupeKey || null,
    }));

    const { error, count } = await supabase
        .from('notifications' as any)
        .insert(payloads);

    if (error) {
        throw new Error(`Failed to create bulk notifications: ${error.message}`);
    }

    if (delivery.push) {
        try {
            await sendPushToUsers(userIds, {
                title,
                body: delivery.pushBody || message.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim(),
                url: delivery.actionUrl || delivery.pushUrl || '/',
                tag: delivery.pushTag || delivery.dedupeKey || `broadcast-${Date.now()}`,
            });
        } catch (pushError) {
            console.error('[Broadcast] Push delivery failed', pushError);
        }
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
