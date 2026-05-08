import { NextRequest, NextResponse } from 'next/server';
import { sendWhatsAppMessage } from '@/lib/services/whatsappClient';

export async function POST(request: NextRequest) {
    try {
        // Simple authentication using Bearer token or API Key
        const authHeader = request.headers.get('authorization');
        const apiKey = process.env.API_Whatsapp?.trim();

        if (!apiKey) {
            console.error('[WA API] Missing API_Whatsapp env var');
            return NextResponse.json(
                { error: 'WhatsApp API key is not configured' },
                { status: 503 }
            );
        }
        
        // Remove 'Bearer ' prefix if it exists
        const token = authHeader?.replace(/^Bearer\s+/i, '').trim();

        if (token !== apiKey) {
            return NextResponse.json(
                { error: 'Unauthorized. Please provide a valid API key in the Authorization header' },
                { status: 401 }
            );
        }

        const body = await request.json();
        const { phone, message } = body;

        // Validate payload
        if (!phone || !message) {
            return NextResponse.json(
                { error: 'Payload must include phone and message' },
                { status: 400 }
            );
        }

        console.log(`[WA API] Sending external message to ${phone}`);

        const result = await sendWhatsAppMessage(phone, message);

        return NextResponse.json(result);

    } catch (error) {
        console.error('[WA API] Send error:', error);
        return NextResponse.json(
            { success: false, error: String(error) },
            { status: 500 }
        );
    }
}
