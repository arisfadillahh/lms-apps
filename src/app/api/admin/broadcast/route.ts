import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSessionOrThrow } from '@/lib/auth';
import { createBulkNotifications, getActiveUserIdsByRoles } from '@/lib/dao/broadcastDao';
import type { Role } from '@/types/supabase';

const BroadcastSchema = z.object({
    target: z.enum(['ALL', 'COACHES', 'CODERS']),
    title: z.string().min(1, 'Title is required').max(100),
    message: z.string().min(1, 'Message is required').max(10000),
});

export async function POST(request: Request) {
    try {
        const session = await getSessionOrThrow();

        // Only allow ADMIN to broadcast
        if (session.user.role !== 'ADMIN') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        const body = await request.json();
        const parsed = BroadcastSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json(
                { error: 'Invalid input', details: parsed.error.flatten().fieldErrors },
                { status: 400 }
            );
        }

        const { target, title, message } = parsed.data;

        // Determine which roles to target
        let roles: Role[] = [];
        if (target === 'ALL') {
            roles = ['COACH', 'CODER'];
        } else if (target === 'COACHES') {
            roles = ['COACH'];
        } else if (target === 'CODERS') {
            roles = ['CODER'];
        }

        // Get user IDs
        const userIds = await getActiveUserIdsByRoles(roles);

        if (userIds.length === 0) {
            return NextResponse.json({ success: true, sent: 0, message: 'No active users found' });
        }

        // Create notifications
        const sentCount = await createBulkNotifications(userIds, title, message, 'BROADCAST');

        return NextResponse.json({
            success: true,
            sent: sentCount,
            message: `Broadcast sent to ${sentCount} users`
        });

    } catch (error) {
        console.error('Broadcast error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to send broadcast' },
            { status: 500 }
        );
    }
}
