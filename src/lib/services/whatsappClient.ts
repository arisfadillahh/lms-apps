/**
 * WhatsApp Client Service using @whiskeysockets/baileys
 * 
 * Handles WhatsApp connection, session management, and message sending
 * using a lightweight socket connection (no browser required).
 */

import { getSupabaseAdmin } from '@/lib/supabaseServer';
import {
    getInvoiceSettings,
    getPendingInvoicesForMonth
} from '@/lib/dao/invoicesDao';
import type { Invoice, SendRemindersResponse, WhatsAppStatus } from '@/lib/types/invoice';
import makeWASocket, {
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    WASocket,
    ConnectionState
} from '@whiskeysockets/baileys';
import pino from 'pino';
import QRCode from 'qrcode';
import fs from 'fs';

// Constants
const AUTH_FOLDER = 'baileys_auth_info';
const CLIENT_ID = process.env.WHATSAPP_CLIENT_ID || 'clevio-wa-client';

// Global state (Singleton for Next.js HMR)
const globalForWA = global as unknown as { sock: WASocket | null };

let sock: WASocket | null = globalForWA.sock || null;
let isConnected = !!sock?.user;
let connectedPhone: string | null = sock?.user?.id.split(':')[0] || null;
let currentQRCode: string | null = null;
let qrRetryCount = 0;

// ============================================================================
// Connection Management
// ============================================================================

/**
 * Initialize WhatsApp client (Baileys)
 */
export async function initializeWhatsApp(): Promise<{
    success: boolean;
    qrCode?: string;
    error?: string
}> {
    try {
        // Singleton check: If socket exists and is open, reuse it
        if (sock) {
            console.log('[WhatsApp] Reusing existing connection');

            // Ensure state vars are synced
            isConnected = true;
            const user = sock?.user;
            if (user) connectedPhone = user.id.split(':')[0];

            return {
                success: true,
                qrCode: undefined
            };
        }

        const { state, saveCreds } = await useMultiFileAuthState(AUTH_FOLDER);
        const { version, isLatest } = await fetchLatestBaileysVersion();

        console.log(`[WhatsApp] Using Baileys v${version.join('.')}, isLatest: ${isLatest}`);

        sock = makeWASocket({
            version,
            logger: pino({ level: 'silent' }) as any,
            printQRInTerminal: false, // We handle QR manually for UI
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' }) as any),
            },
            browser: ['Clevio Helper', 'Chrome', '1.0.0'],
            generateHighQualityLinkPreview: true,
            // Optimization: slightly increased timeouts
            connectTimeoutMs: 60000,
            keepAliveIntervalMs: 10000,
        });

        // Save to global to prevent duplicate connections on hot reload
        globalForWA.sock = sock;

        // Connection updates (QR, connection status)
        sock.ev.on('connection.update', async (update: any) => {
            const { connection, lastDisconnect, qr } = update;

            if (qr) {
                // Generate QR as Data URL for UI
                currentQRCode = await QRCode.toDataURL(qr);
                qrRetryCount++;
                console.log(`[WhatsApp] QR Code generated (Attempt ${qrRetryCount})`);
            }

            if (connection === 'close') {
                const shouldReconnect = (lastDisconnect?.error as any)?.output?.statusCode !== DisconnectReason.loggedOut;

                console.log('[WhatsApp] Connection closed due to ', lastDisconnect?.error, ', reconnecting ', shouldReconnect);

                isConnected = false;
                connectedPhone = null;
                currentQRCode = null;

                if (shouldReconnect) {
                    // Reconnect automatically
                    sock = null;
                    initializeWhatsApp();
                } else {
                    console.log('[WhatsApp] Logged out. Delete auth folder to restart.');
                    // Optional: Delete credentials here if desired
                    // await fs.promises.rm(AUTH_FOLDER, { recursive: true, force: true });
                    sock = null;
                }

                await updateSessionStatus(false, null);
            } else if (connection === 'open') {
                console.log('[WhatsApp] Connection opened!');
                isConnected = true;
                currentQRCode = null;
                qrRetryCount = 0;

                const user = sock?.user;
                connectedPhone = user ? user.id.split(':')[0] : 'Unknown';

                console.log(`[WhatsApp] Connected as ${connectedPhone}`);
                await updateSessionStatus(true, connectedPhone);
            }
        });

        // Credential updates
        sock.ev.on('creds.update', saveCreds);

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
        if (sock) {
            sock.end(undefined);
            sock = null;
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
    if (!isConnected || !sock) {
        return { success: false, error: 'WhatsApp not connected' };
    }

    try {
        const normalizedPhone = normalizePhoneNumber(phoneNumber);
        if (!normalizedPhone) {
            return { success: false, error: 'Invalid phone number' };
        }

        const jid = `${normalizedPhone}@s.whatsapp.net`;

        console.log(`[WhatsApp] Sending to ${jid}`);

        // Baileys check: Verify valid number exists on WA
        const onWhatsAppResult = await sock.onWhatsApp(jid);

        if (!onWhatsAppResult || !Array.isArray(onWhatsAppResult) || onWhatsAppResult.length === 0 || !onWhatsAppResult[0].exists) {
            return { success: false, error: `Number ${normalizedPhone} not on WhatsApp` };
        }

        // Send Message
        await sock.sendMessage(jid, { text: message });

        return { success: true };

    } catch (error) {
        console.error('[WhatsApp] Send error:', error);
        return { success: false, error: String(error) };
    }
}

/**
 * Send a single invoice reminder by ID
 */
export async function sendSingleInvoiceReminder(invoiceId: string): Promise<{ success: boolean; error?: string }> {
    try {
        // Check connection
        if (!isConnected || !sock) {
            return { success: false, error: 'WhatsApp not connected' };
        }

        // Get invoice
        // Dynamic import to avoid circular dependency
        const { getInvoiceById, getInvoiceSettings } = await import('@/lib/dao/invoicesDao');

        const invoice = await getInvoiceById(invoiceId);
        if (!invoice) {
            return { success: false, error: 'Invoice not found' };
        }

        // Get settings
        const settings = await getInvoiceSettings();
        if (!settings) {
            return { success: false, error: 'Invoice settings not found' };
        }

        // Generate message
        console.log(`[WhatsApp] Generating reminder for ${invoice.invoice_number}`);
        const message = formatInvoiceMessage(invoice, settings);

        console.log(`[WhatsApp] Sending message to ${invoice.parent_phone}`);

        // Send
        const result = await sendWhatsAppMessage(invoice.parent_phone, message);

        // Log result
        await logWhatsAppMessage(invoice, result.success ? 'SENT' : 'FAILED', result.error);

        return result;

    } catch (error) {
        console.error('[WhatsApp] Single reminder error:', error);
        // Log stack trace if available
        if (error instanceof Error) {
            console.error(error.stack);
        }
        return { success: false, error: String(error) };
    }
}

/**
 * Send invoice reminders to all pending invoices for a month
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
                    await logWhatsAppMessage(invoice, 'SENT');
                } else {
                    result.failed++;
                    result.errors.push(`Failed to send to ${invoice.parent_name}: ${sendResult.error}`);
                    await logWhatsAppMessage(invoice, 'FAILED', sendResult.error);
                }

                // Random delay between 5 seconds and 1 minute
                if (i < invoices.length - 1) {
                    const delay = getRandomDelay(5000, 60000);
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

    // Format new variables
    const periodDate = new Date(invoice.period_year, invoice.period_month - 1);
    const periodMonthYear = periodDate.toLocaleDateString('id-ID', {
        month: 'long',
        year: 'numeric'
    });

    // Generate student list
    let studentList = '';
    if (invoice.items && invoice.items.length > 0) {
        studentList = invoice.items.map(item =>
            `- ${item.coder_name} (${item.class_name})`
        ).join('\n');
    } else {
        studentList = '- (Detail tidak tersedia)';
    }

    return template
        .replace(/{parent_name}/g, invoice.parent_name)
        .replace(/{invoice_number}/g, invoice.invoice_number)
        .replace(/{total_amount}/g, formattedAmount)
        .replace(/{due_date}/g, formattedDueDate)
        .replace(/{invoice_url}/g, invoiceUrl)
        .replace(/{period_month_year}/g, periodMonthYear)
        .replace(/{student_list}/g, studentList);
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
        .from('whatsapp_sessions' as any)
        .upsert({
            client_id: CLIENT_ID,
            is_connected: connected,
            connected_phone: phone,
            last_activity_at: new Date().toISOString()
        }, { onConflict: 'client_id' } as any);
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
            category: 'INVOICE' as any,
            payload: {
                invoice_id: invoice.id,
                invoice_number: invoice.invoice_number,
                parent_phone: invoice.parent_phone,
                parent_name: invoice.parent_name
            },
            status: status,
            response: error ? { error } : { success: true },
            processed_at: new Date().toISOString()
        });
}

// Ensure clean shutdown
if (process.env.NODE_ENV !== 'production') {
    const cleanup = () => {
        if (sock) {
            console.log('[WhatsApp] Closing connection due to process exit');
            sock.end(undefined);
            sock = null;
        }
    };
    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
}
