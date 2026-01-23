import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getSessionOrThrow } from '@/lib/auth';
import { assertRole } from '@/lib/roles';
import { sendWhatsAppMessage } from '@/lib/services/whatsappClient';

const sendSchema = z.object({
    phoneNumber: z.string().min(10),
    message: z.string().min(1)
});

export async function POST(request: Request) {
    const session = await getSessionOrThrow();
    await assertRole(session, 'ADMIN');

    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const parsed = sendSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({
            error: 'Validasi gagal',
            details: parsed.error.flatten()
        }, { status: 400 });
    }

    const { phoneNumber, message } = parsed.data;

    try {
        const result = await sendWhatsAppMessage(phoneNumber, message);

        if (result.success) {
            return NextResponse.json({ success: true, message: 'Pesan terkirim' });
        } else {
            return NextResponse.json({
                error: 'Gagal mengirim pesan',
                details: result.error
            }, { status: 500 });
        }
    } catch (error) {
        console.error('[WhatsApp API] Send error:', error);
        return NextResponse.json({
            error: 'Terjadi kesalahan internal',
            details: String(error)
        }, { status: 500 });
    }
}
