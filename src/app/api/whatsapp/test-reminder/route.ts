import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { sendClassReminder } from '@/lib/services/whatsappClient';

export async function POST(request: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || session.user.role !== 'ADMIN') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { phone, message, studentName } = body;

        if (!phone || !message || !studentName) {
            return NextResponse.json(
                { success: false, error: 'Phone, message, and studentName are required' },
                { status: 400 }
            );
        }

        // Send immediately
        const result = await sendClassReminder(phone, message, studentName, 'TEST_CLASS_REMINDER');

        return NextResponse.json(result);
    } catch (error) {
        console.error('[API] Test reminder error:', error);
        return NextResponse.json(
            { success: false, error: String(error) },
            { status: 500 }
        );
    }
}
