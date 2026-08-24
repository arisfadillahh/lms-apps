import { NextResponse } from 'next/server';
import { getSessionOrThrow } from '@/lib/auth';
import { notificationsDao } from '@/lib/dao';

export async function GET(request: Request) {
    try {
        const session = await getSessionOrThrow();
        const userId = session.user.id;

        const data = await notificationsDao.getUserNotifications(userId, 20);
        const unreadCount = await notificationsDao.getUnreadCount(userId);

        return NextResponse.json({
            success: true,
            data,
            unreadCount
        });
    } catch (error: any) {
        console.error('Fetch notifications error:', error);
        return NextResponse.json({ error: 'Failed to fetch notifications' }, { status: 500 });
    }
}

export async function PATCH(request: Request) {
    try {
        const session = await getSessionOrThrow();
        const userId = session.user.id;
        const body = await request.json();

        if (body.markAll) {
            await notificationsDao.markAllAsRead(userId);
            return NextResponse.json({ success: true });
        }

        if (body.notificationId) {
            const updated = await notificationsDao.markAsRead(body.notificationId, userId);
            if (!updated) return NextResponse.json({ error: 'Notification not found' }, { status: 404 });
            return NextResponse.json({ success: true });
        }

        return NextResponse.json({ error: 'Invalid request' }, { status: 400 });

    } catch (error: any) {
        console.error('Update notification error:', error);
        return NextResponse.json({ error: 'Failed to update notification' }, { status: 500 });
    }
}
