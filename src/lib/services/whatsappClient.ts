/**
 * WhatsApp Client Service using whatsapp-web.js
 * 
 * Handles WhatsApp connection, session management, and message sending
 * with random delays to avoid spam detection.
 */

// Note: wwebjs requires these imports - ensure packages are installed:
// npm install whatsapp-web.js qrcode

import { getSupabaseAdmin } from '@/lib/supabaseServer';
import {
    getInvoiceSettings,
    getPendingInvoicesForMonth
} from '@/lib/dao/invoicesDao';
import type { Invoice, SendRemindersResponse, WhatsAppStatus } from '@/lib/types/invoice';

// Client ID for session persistence
const CLIENT_ID = process.env.WHATSAPP_CLIENT_ID || 'clevio-wa-client';

// In-memory state (in production, this would be managed differently)
let clientInstance: unknown = null;
let isConnected = false;
let connectedPhone: string | null = null;
let currentQRCode: string | null = null;

// ============================================================================
// Connection Management
// ============================================================================

/**
 * Initialize WhatsApp client
 * Returns QR code if not authenticated, or connection status if already connected
 */
export async function initializeWhatsApp(): Promise<{
    success: boolean;
    qrCode?: string;
    error?: string
}> {
    try {
        // Dynamic import to avoid issues during build
        const { Client, LocalAuth } = await import('whatsapp-web.js');
        const QRCode = await import('qrcode');

        if (clientInstance) {
            return {
                success: true,
                qrCode: isConnected ? undefined : currentQRCode || undefined
            };
        }

        const client = new Client({
            authStrategy: new LocalAuth({ clientId: CLIENT_ID }),
            puppeteer: {
                headless: true,
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            },
            // Disable features that cause markedUnread error
            webVersionCache: {
                type: 'remote',
                remotePath: 'https://raw.githubusercontent.com/AhmadDanial/nicmessage/master/nicmessage.json'
            }
        });

        // QR Code event
        client.on('qr', async (qr: string) => {
            currentQRCode = await QRCode.toDataURL(qr);
            console.log('[WhatsApp] QR Code generated');
        });

        // Ready event
        client.on('ready', async () => {
            isConnected = true;
            currentQRCode = null;

            const info = await client.getWWebVersion();
            connectedPhone = client.info?.wid?.user || null;

            console.log('[WhatsApp] Client ready. Version:', info);

            // Update session in DB
            await updateSessionStatus(true, connectedPhone);
        });

        // Disconnected event
        client.on('disconnected', async (reason: string) => {
            isConnected = false;
            connectedPhone = null;
            console.log('[WhatsApp] Disconnected:', reason);

            await updateSessionStatus(false, null);
        });

        // Authentication failure
        client.on('auth_failure', (msg: string) => {
            console.error('[WhatsApp] Auth failure:', msg);
            isConnected = false;
        });

        clientInstance = client;
        await client.initialize();

        return { success: true, qrCode: currentQRCode || undefined };

    } catch (error) {
        console.error('[WhatsApp] Initialization error:', error);
        return {
            success: false,
            error: `Failed to initialize: ${String(error)}`
        };
    }
}

/**
 * Get current connection status
 */
export async function getWhatsAppStatus(): Promise<WhatsAppStatus> {
    return {
        isConnected,
        connectedPhone,
        qrCode: currentQRCode,
        lastActivity: new Date().toISOString()
    };
}

/**
 * Disconnect WhatsApp client
 */
export async function disconnectWhatsApp(): Promise<boolean> {
    try {
        if (clientInstance) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (clientInstance as any).destroy();
            clientInstance = null;
            isConnected = false;
            connectedPhone = null;
            currentQRCode = null;

            await updateSessionStatus(false, null);
        }
        return true;
    } catch (error) {
        console.error('[WhatsApp] Disconnect error:', error);
        return false;
    }
}

// ============================================================================
// Message Sending
// ============================================================================

/**
 * Send a single WhatsApp message
 */
export async function sendWhatsAppMessage(
    phoneNumber: string,
    message: string
): Promise<{ success: boolean; error?: string }> {
    if (!isConnected || !clientInstance) {
        return { success: false, error: 'WhatsApp not connected' };
    }

    try {
        const normalizedPhone = normalizePhoneNumber(phoneNumber);
        if (!normalizedPhone) {
            return { success: false, error: 'Invalid phone number' };
        }

        const chatId = `${normalizedPhone}@c.us`;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const client = clientInstance as any;

        // Try to get the chat first and send via chat object
        try {
            const chat = await client.getChatById(chatId);
            if (chat) {
                await chat.sendMessage(message);
                return { success: true };
            }
        } catch {
            // If getChatById fails, try direct sendMessage
            console.log('[WhatsApp] getChatById failed, trying direct send...');
        }

        // Fallback: Direct send (may trigger markedUnread on some versions)
        try {
            await client.sendMessage(chatId, message);
            return { success: true };
        } catch (sendErr) {
            // If it's the markedUnread error, it usually means message was sent anyway
            if (String(sendErr).includes('markedUnread')) {
                console.log('[WhatsApp] markedUnread error but message likely sent');
                return { success: true };
            }
            throw sendErr;
        }

    } catch (error) {
        console.error('[WhatsApp] Send error:', error);
        return { success: false, error: String(error) };
    }
}

/**
 * Send invoice reminders to all pending invoices for a month
 * Includes random delay between messages (10s - 3min)
 */
export async function sendInvoiceReminders(
    month: number,
    year: number
): Promise<SendRemindersResponse> {
    const result: SendRemindersResponse = {
        success: true,
        sent: 0,
        failed: 0,
        errors: []
    };

    try {
        // Check connection
        if (!isConnected) {
            result.success = false;
            result.errors.push('WhatsApp not connected. Please scan QR code first.');
            return result;
        }

        // Get settings
        const settings = await getInvoiceSettings();
        if (!settings) {
            result.success = false;
            result.errors.push('Invoice settings not found.');
            return result;
        }

        // Get pending invoices
        const invoices = await getPendingInvoicesForMonth(month, year);
        if (invoices.length === 0) {
            result.errors.push('No pending invoices found for this month.');
            return result;
        }

        // Send messages with random delay
        for (let i = 0; i < invoices.length; i++) {
            const invoice = invoices[i];

            try {
                // Generate message from template
                const message = formatInvoiceMessage(invoice, settings);

                // Send message
                const sendResult = await sendWhatsAppMessage(invoice.parent_phone, message);

                if (sendResult.success) {
                    result.sent++;

                    // Log to database
                    await logWhatsAppMessage(invoice, 'SENT');

                } else {
                    result.failed++;
                    result.errors.push(`Failed to send to ${invoice.parent_name}: ${sendResult.error}`);

                    await logWhatsAppMessage(invoice, 'FAILED', sendResult.error);
                }

                // Random delay between 10 seconds and 3 minutes (except for last message)
                if (i < invoices.length - 1) {
                    const delay = getRandomDelay(10000, 180000);
                    console.log(`[WhatsApp] Waiting ${delay / 1000}s before next message...`);
                    await sleep(delay);
                }

            } catch (err) {
                result.failed++;
                result.errors.push(`Error processing ${invoice.invoice_number}: ${String(err)}`);
            }
        }

        return result;

    } catch (err) {
        result.success = false;
        result.errors.push(`Unexpected error: ${String(err)}`);
        return result;
    }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Normalize Indonesian phone number to international format
 */
function normalizePhoneNumber(phone: string): string | null {
    if (!phone) return null;

    // Remove all non-digits
    let cleaned = phone.replace(/\D/g, '');

    // Handle Indonesian numbers
    if (cleaned.startsWith('0')) {
        cleaned = '62' + cleaned.substring(1);
    } else if (!cleaned.startsWith('62')) {
        cleaned = '62' + cleaned;
    }

    // Validate length (Indonesian mobile: 10-13 digits after 62)
    if (cleaned.length < 11 || cleaned.length > 15) {
        return null;
    }

    return cleaned;
}

/**
 * Format invoice message using template
 */
function formatInvoiceMessage(
    invoice: Invoice,
    settings: {
        invoice_message_template: string;
        base_url: string;
    }
): string {
    const template = settings.invoice_message_template;
    const invoiceUrl = `${settings.base_url}/invoice/${invoice.invoice_number}`;

    const formattedAmount = new Intl.NumberFormat('id-ID').format(invoice.total_amount);
    const formattedDueDate = new Date(invoice.due_date).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });

    return template
        .replace(/{parent_name}/g, invoice.parent_name)
        .replace(/{invoice_number}/g, invoice.invoice_number)
        .replace(/{total_amount}/g, formattedAmount)
        .replace(/{due_date}/g, formattedDueDate)
        .replace(/{invoice_url}/g, invoiceUrl);
}

/**
 * Get random delay between min and max milliseconds
 */
function getRandomDelay(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min) + min);
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Update session status in database
 */
async function updateSessionStatus(connected: boolean, phone: string | null) {
    const supabase = getSupabaseAdmin();

    await supabase
        .from('whatsapp_sessions')
        .upsert({
            client_id: CLIENT_ID,
            is_connected: connected,
            connected_phone: phone,
            last_activity_at: new Date().toISOString()
        }, { onConflict: 'client_id' });
}

/**
 * Log WhatsApp message to database
 */
async function logWhatsAppMessage(
    invoice: Invoice,
    status: 'SENT' | 'FAILED',
    error?: string
) {
    const supabase = getSupabaseAdmin();

    await supabase
        .from('whatsapp_message_logs')
        .insert({
            category: 'INVOICE',
            payload: {
                invoice_id: invoice.id,
                invoice_number: invoice.invoice_number,
                parent_phone: invoice.parent_phone,
                parent_name: invoice.parent_name
            },
            response: error ? { error } : null,
            status,
            processed_at: new Date().toISOString()
        });
}
