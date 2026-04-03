import { NextRequest, NextResponse } from 'next/server';
import { sendWhatsAppMessage } from '@/lib/services/whatsappClient';

export async function POST(request: NextRequest) {
    try {
        // Simple authentication using Bearer token or API Key
        // You can use process.env.API_SECRET_KEY in your .env
        const authHeader = request.headers.get('authorization');
        const API_KEY = process.env.API_SECRET_KEY || 'clevio-secret-key-123';
        
        // Remove 'Bearer ' prefix if it exists
        const token = authHeader?.replace(/^Bearer\s+/i, '');

        if (token !== API_KEY) {
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
