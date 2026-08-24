"use server";

import { getSupabaseAdmin } from '@/lib/supabaseServer';
import { sendPushToUsers } from '@/lib/pushNotifications';

export type NotificationPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';

// Explicit while generated Supabase types catch up with additive notification metadata.
export type NotificationRow = {
    id: string;
    user_id: string;
    title: string;
    message: string;
    is_read: boolean;
    created_at: string;
    type: string;
    action_url: string | null;
    category: string;
    priority: NotificationPriority;
    dedupe_key: string | null;
};

export type NotificationDeliveryOptions = {
    actionUrl?: string;
    category?: string;
    priority?: NotificationPriority;
    dedupeKey?: string;
    push?: boolean;
    pushUrl?: string;
    pushTag?: string;
    pushBody?: string;
};

type AdminNotificationInput = NotificationDeliveryOptions & {
    title: string;
    message: string;
    type?: string;
};

const ROLE_DASHBOARD: Record<string, string> = {
    ADMIN: '/admin/dashboard',
    COACH: '/coach/dashboard',
    CODER: '/coder/dashboard',
};

function normalizeActionUrl(value?: string): string | null {
    if (!value) return null;
    const trimmed = value.trim();
    if (!trimmed.startsWith('/') || trimmed.startsWith('//')) return null;
    return trimmed;
}

function buildStoredDelivery(delivery: NotificationDeliveryOptions) {
    return {
        action_url: normalizeActionUrl(delivery.actionUrl || delivery.pushUrl),
        category: delivery.category || 'SYSTEM',
        priority: delivery.priority || 'NORMAL',
        dedupe_key: delivery.dedupeKey || null,
    };
}

async function sendPushBestEffort(
    userIds: string[],
    input: AdminNotificationInput,
    fallbackUrl: string,
): Promise<void> {
    try {
        const actionUrl = normalizeActionUrl(input.actionUrl || input.pushUrl);
        await sendPushToUsers(userIds, {
            title: input.title,
            body: input.pushBody || input.message,
            url: actionUrl || fallbackUrl,
            tag: input.pushTag || input.dedupeKey || `lms-${input.type || 'system'}`,
        });
    } catch (error) {
        // The website notification is authoritative; a device push may fail independently.
        console.error('[Notifications] Push delivery failed', error);
    }
}

export async function getUserNotifications(userId: string, limit = 20): Promise<NotificationRow[]> {
    const supabase = getSupabaseAdmin();
    // Use manual query as types might be stale
    const { data, error } = await supabase
        .from('notifications' as any)
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

    if (error) {
        throw new Error(`Failed to fetch notifications: ${error.message}`);
    }

    return (data || []) as unknown as NotificationRow[];
}

export async function getUnreadCount(userId: string): Promise<number> {
    const supabase = getSupabaseAdmin();
    const { count, error } = await supabase
        .from('notifications' as any)
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('is_read', false);

    if (error) {
        console.error('Failed to count unread notifications:', error);
        return 0;
    }

    return count || 0;
}

export async function markAsRead(notificationId: string): Promise<void> {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase
        .from('notifications' as any)
        .update({ is_read: true })
        .eq('id', notificationId);

    if (error) {
        throw new Error(`Failed to mark notification as read: ${error.message}`);
    }
}

export async function markAllAsRead(userId: string): Promise<void> {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase
        .from('notifications' as any)
        .update({ is_read: true })
        .eq('user_id', userId)
        .eq('is_read', false);

    if (error) {
        throw new Error(`Failed to mark all notifications as read: ${error.message}`);
    }
}

async function persistNotification(
    userId: string,
    title: string,
    message: string,
    type = 'SYSTEM',
    delivery: NotificationDeliveryOptions = {},
): Promise<boolean> {
    const supabase = getSupabaseAdmin();
    if (delivery.dedupeKey && await hasNotificationByDedupeKey(userId, delivery.dedupeKey)) {
        return false;
    }
    const payload = {
        user_id: userId,
        title,
        message,
        type,
        is_read: false,
        ...buildStoredDelivery(delivery),
    };

    // Using explicit table name string to avoid TS errors if types aren't regenerated
    const { error } = await supabase.from('notifications' as any).insert(payload);

    if (error) {
        if (delivery.dedupeKey && error.code === '23505') {
            return false;
        }
        throw new Error(`Failed to create notification: ${error.message}`);
    }

    return true;
}

export async function createNotification(
    userId: string,
    title: string,
    message: string,
    type = 'SYSTEM',
    delivery: NotificationDeliveryOptions = {},
): Promise<void> {
    if (!await persistNotification(userId, title, message, type, delivery)) return;

    try {
        const supabase = getSupabaseAdmin();
        const { data: recipient, error: recipientError } = await supabase
            .from('users')
            .select('id, role')
            .eq('id', userId)
            .eq('is_active', true)
            .maybeSingle();

        if (recipientError) throw recipientError;
        const shouldPush = delivery.push ?? recipient?.role === 'ADMIN';
        if (recipient && shouldPush) {
            const fallbackUrl = ROLE_DASHBOARD[recipient.role] || '/';
            await sendPushBestEffort([userId], { title, message, type, ...delivery }, fallbackUrl);
        }
    } catch (pushLookupError) {
        console.error('[Notifications] Failed to resolve push recipient', pushLookupError);
    }
}

export async function createAdminNotifications(input: AdminNotificationInput): Promise<number> {
    const supabase = getSupabaseAdmin();
    const { data: admins, error: adminLookupError } = await supabase
        .from('users')
        .select('id')
        .eq('role', 'ADMIN')
        .eq('is_active', true);

    if (adminLookupError) {
        throw new Error(`Failed to find active admins: ${adminLookupError.message}`);
    }

    const adminIds = (admins ?? []).map((admin) => admin.id);
    if (adminIds.length === 0) return 0;

    if (input.dedupeKey) {
        const inserted = await Promise.all(adminIds.map(async (adminId) => ({
            adminId,
            created: await persistNotification(
                adminId,
                input.title,
                input.message,
                input.type || 'SYSTEM',
                { ...input, push: false },
            ),
        })));
        const insertedAdminIds = inserted.filter((row) => row.created).map((row) => row.adminId);
        if (input.push !== false && insertedAdminIds.length > 0) {
            await sendPushBestEffort(insertedAdminIds, input, ROLE_DASHBOARD.ADMIN);
        }
        return insertedAdminIds.length;
    }

    const { error: insertError } = await supabase.from('notifications' as any).insert(
        adminIds.map((adminId) => ({
            user_id: adminId,
            title: input.title,
            message: input.message,
            type: input.type || 'SYSTEM',
            is_read: false,
            ...buildStoredDelivery(input),
        })),
    );

    if (insertError) {
        throw new Error(`Failed to create admin notifications: ${insertError.message}`);
    }

    if (input.push !== false) {
        await sendPushBestEffort(adminIds, input, ROLE_DASHBOARD.ADMIN);
    }
    return adminIds.length;
}

export async function hasNotificationByDedupeKey(userId: string, dedupeKey: string): Promise<boolean> {
    const { data, error } = await getSupabaseAdmin()
        .from('notifications' as any)
        .select('id')
        .eq('user_id', userId)
        .eq('dedupe_key', dedupeKey)
        .limit(1);

    if (error) {
        throw new Error(`Failed to check notification dedupe key: ${error.message}`);
    }

    return Boolean(data?.length);
}

export async function hasMatchingNotificationToday(
    userId: string,
    title: string,
    message: string,
    type = 'SYSTEM',
): Promise<boolean> {
    const supabase = getSupabaseAdmin();
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const { data, error } = await supabase
        .from('notifications' as any)
        .select('id')
        .eq('user_id', userId)
        .eq('title', title)
        .eq('message', message)
        .eq('type', type)
        .gte('created_at', startOfDay.toISOString())
        .limit(1);

    if (error) {
        throw new Error(`Failed to check existing notification: ${error.message}`);
    }

    return Boolean(data && data.length > 0);
}
