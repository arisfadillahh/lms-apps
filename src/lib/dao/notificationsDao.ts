"use server";

import { getSupabaseAdmin } from '@/lib/supabaseServer';
import { TablesInsert } from '@/types/supabase';

// Define explicit type for notification row since types/supabase.ts might not be fully updated yet
export type NotificationRow = {
    id: string;
    user_id: string;
    title: string;
    message: string;
    is_read: boolean;
    created_at: string;
    type: string;
};

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

export async function createNotification(userId: string, title: string, message: string, type = 'SYSTEM'): Promise<void> {
    const supabase = getSupabaseAdmin();
    const payload = {
        user_id: userId,
        title,
        message,
        type,
        is_read: false
    };

    // Using explicit table name string to avoid TS errors if types aren't regenerated
    const { error } = await supabase.from('notifications' as any).insert(payload);

    if (error) {
        throw new Error(`Failed to create notification: ${error.message}`);
    }
}
