import { NextResponse } from 'next/server';
import { sendClassReminder } from '@/lib/services/whatsappClient';

export async function POST(request: Request) {
    try {
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
