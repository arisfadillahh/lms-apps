import { NextRequest, NextResponse } from 'next/server';
import { sendWhatsAppDocument, sendWhatsAppMessage } from '@/lib/services/whatsappClient';

export async function POST(request: NextRequest) {
    try {
        // Simple authentication using Bearer token or API Key
        const authHeader = request.headers.get('authorization');
        const apiKey = process.env.API_Whatsapp?.trim();
        const coreApiKey = process.env.LMS_CORE_API_TOKEN?.trim();

        if (!apiKey && !coreApiKey) {
            console.error('[WA API] Missing API_Whatsapp env var');
            return NextResponse.json(
                { error: 'WhatsApp API key is not configured' },
                { status: 503 }
            );
        }

        // Remove 'Bearer ' prefix if it exists
        const token = authHeader?.replace(/^Bearer\s+/i, '').trim();

        if (token !== apiKey && token !== coreApiKey) {
            return NextResponse.json(
                { error: 'Unauthorized. Please provide a valid API key in the Authorization header' },
                { status: 401 }
            );
        }

        const body = await request.json();
        const { phone, to, message, documentBase64, fileName, mimeType, caption } = body;
        const targetPhone = phone || to;

        // Validate payload
        if (!targetPhone || (!message && !documentBase64)) {
            return NextResponse.json(
                { error: 'Payload must include phone/to and message or documentBase64' },
                { status: 400 }
            );
        }

        if (documentBase64) {
            if (!fileName || !mimeType) {
                return NextResponse.json(
                    { error: 'Document payload must include fileName and mimeType' },
                    { status: 400 }
                );
            }

            const document = Buffer.from(String(documentBase64), 'base64');
            if (document.length === 0 || document.length > 10 * 1024 * 1024) {
                return NextResponse.json(
                    { error: 'Document must be non-empty and at most 10MB' },
                    { status: 400 }
                );
            }

            console.log(`[WA API] Sending external document to ${targetPhone}`);

            const result = await sendWhatsAppDocument({
                phoneNumber: targetPhone,
                document,
                fileName,
                mimeType,
                caption: caption || message,
            });

            return NextResponse.json(result);
        }

        console.log(`[WA API] Sending external message to ${targetPhone}`);
        const result = await sendWhatsAppMessage(targetPhone, message);

        return NextResponse.json(result);

    } catch (error) {
        console.error('[WA API] Send error:', error);
        return NextResponse.json(
            { success: false, error: String(error) },
            { status: 500 }
        );
    }
}
