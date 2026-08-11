/**
 * WhatsApp Client Service using @whiskeysockets/baileys
 * 
 * Handles WhatsApp connection, session management, and message sending
 * using a lightweight socket connection (no browser required).
 */

import { getSupabaseAdmin } from '@/lib/supabaseServer';
import {
    getWhatsAppSession,
    getInvoiceSettings,
    getUnpaidInvoicesForMonth
} from '@/lib/dao/invoicesDao';
import {
    hasWhatsappLogWithIdempotencyKey,
    logWhatsappEvent,
    updateWhatsappLogStatus,
} from '@/lib/dao/reportsDao';
import {
    buildInvoiceReminderIdempotencyKey,
} from '@/lib/services/reminderIdempotency';
import { buildInvoicePublicUrl } from '@/lib/services/invoicePublicAccess';
import { getShortInvoiceUrlOrOriginal } from '@/lib/services/shortLinks';
import type { Invoice, SendRemindersResponse, WhatsAppSession, WhatsAppStatus } from '@/lib/types/invoice';
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
const globalForWA = global as unknown as {
    sock: WASocket | null;
    isConnecting: boolean;
};

let sock: WASocket | null = globalForWA.sock || null;
let isConnecting = globalForWA.isConnecting || false;
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
        // Prevent concurrent connection attempts
        if (isConnecting) {
            console.log('[WhatsApp] Connection already in progress');
            return { success: true, qrCode: currentQRCode || undefined };
        }

        // Singleton check: If socket exists AND is actually connected, reuse it
        if (sock && sock.user) {
            console.log('[WhatsApp] Reusing existing connected session');
            isConnected = true;
            connectedPhone = sock.user.id.split(':')[0];
            return { success: true, qrCode: undefined };
        }

        // Set connection lock
        isConnecting = true;
        globalForWA.isConnecting = true;

        // Clean up any existing socket that's not authenticated
        if (sock) {
            console.log('[WhatsApp] Cleaning up unauthenticated socket...');
            try {
                sock.end(undefined);
            } catch (e) {
                // Ignore
            }
            sock = null;
            globalForWA.sock = null;
        }

        // Reset state
        isConnected = false;
        connectedPhone = null;
        currentQRCode = null;

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

                // If we've had too many QR attempts (> 5), credentials might be corrupt
                if (qrRetryCount > 5) {
                    console.log('[WhatsApp] Too many QR attempts, clearing credentials...');
                    clearCredentialsAndReset();
                }
            }

            if (connection === 'close') {
                const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
                const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

                console.log(`[WhatsApp] Connection closed. Status: ${statusCode}, Reconnect: ${shouldReconnect}`);

                isConnected = false;
                connectedPhone = null;
                currentQRCode = null;

                // Release connection lock
                isConnecting = false;
                globalForWA.isConnecting = false;

                // Clear on STRICT auth issues only
                // 401: Unauthorized, 403: Forbidden, DisconnectReason.loggedOut
                // Note: 515 is "Stream Errored" which is common and should NOT clear creds
                const authIssues = [DisconnectReason.loggedOut, 401, 403];
                if (authIssues.includes(statusCode)) {
                    console.log('[WhatsApp] Fatal Auth issue detected, clearing credentials');
                    clearCredentialsAndReset();
                }

                sock = null;
                globalForWA.sock = null;
                await updateSessionStatus(false, null);
            } else if (connection === 'open') {
                console.log('[WhatsApp] Connection opened!');
                isConnected = true;
                isConnecting = false;
                globalForWA.isConnecting = false;
                currentQRCode = null;
                qrRetryCount = 0;

                connectedPhone = sock?.user ? sock.user.id.split(':')[0] : 'Unknown';
                console.log(`[WhatsApp] Connected as ${connectedPhone}`);
                await updateSessionStatus(true, connectedPhone);
            }
        });

        // Credential updates
        sock.ev.on('creds.update', saveCreds);

        // Wait a bit for QR to generate before returning
        await new Promise(resolve => setTimeout(resolve, 2000));

        isConnecting = false;
        globalForWA.isConnecting = false;
        return { success: true, qrCode: currentQRCode || undefined };

    } catch (error) {
        console.error('[WhatsApp] Initialization error:', error);
        isConnecting = false;
        globalForWA.isConnecting = false;
        return {
            success: false,
            error: `Failed to initialize: ${String(error)}`
        };
    }
}

/**
 * Clear credentials and reset all state for fresh QR
 */
function clearCredentialsAndReset() {
    try {
        if (fs.existsSync(AUTH_FOLDER)) {
            fs.rmSync(AUTH_FOLDER, { recursive: true, force: true });
            console.log('[WhatsApp] Auth folder deleted');
        }
    } catch (e) {
        console.error('[WhatsApp] Failed to delete auth folder:', e);
    }

    if (sock) {
        try {
            sock.end(undefined);
        } catch (e) { }
    }

    sock = null;
    globalForWA.sock = null;
    isConnected = false;
    connectedPhone = null;
    currentQRCode = null;
    qrRetryCount = 0;
}

/**
 * Get current connection status
 * Optionally try to reconnect if disconnected
 */
export async function getWhatsAppStatus(tryReconnect = false): Promise<WhatsAppStatus> {
    // If we're disconnected but a request comes in, check if we should try to restore session
    if (!isConnected && !sock && tryReconnect) {
        console.log('[WhatsApp] Status check triggered reconnection attempt...');
        await initializeWhatsApp();
    }

    let resolvedConnectedPhone = connectedPhone;
    let resolvedIsConnected = isConnected;
    let resolvedLastActivity: string | null = new Date().toISOString();

    if (!resolvedConnectedPhone || !resolvedIsConnected) {
        try {
            const persistedSession = await getWhatsAppSession(CLIENT_ID) as WhatsAppSession | null;
            if (persistedSession) {
                if (!resolvedIsConnected && persistedSession.is_connected) {
                    resolvedIsConnected = true;
                    resolvedConnectedPhone = persistedSession.connected_phone || null;
                } else if (!resolvedConnectedPhone) {
                    resolvedConnectedPhone = persistedSession.connected_phone || null;
                }
                resolvedLastActivity = persistedSession.last_activity_at || resolvedLastActivity;
            }
        } catch (error) {
            console.warn('[WhatsApp] Failed to read persisted session status:', error);
        }
    }

    return {
        isConnected: resolvedIsConnected,
        connectedPhone: resolvedConnectedPhone,
        qrCode: currentQRCode,
        lastActivity: resolvedLastActivity
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
            globalForWA.sock = null;
        }

        isConnected = false;
        connectedPhone = null;
        currentQRCode = null;

        await updateSessionStatus(false, null);
        return true;
    } catch (error) {
        console.error('[WhatsApp] Disconnect error:', error);
        return false;
    }
}

/**
 * Force reset WhatsApp - clears all session data
 * Use when connection is stuck after HP logout
 */
export async function forceResetWhatsApp(): Promise<{ success: boolean; message: string }> {
    try {
        console.log('[WhatsApp] Force resetting - clearing all session data...');

        // 1. Close existing socket
        if (sock) {
            try {
                sock.end(undefined);
            } catch (e) {
                console.log('[WhatsApp] Socket already closed');
            }
            sock = null;
            globalForWA.sock = null;
        }

        // 2. Reset state
        isConnected = false;
        connectedPhone = null;
        currentQRCode = null;
        qrRetryCount = 0;

        // 3. Delete auth folder to clear old credentials
        if (fs.existsSync(AUTH_FOLDER)) {
            console.log('[WhatsApp] Deleting auth folder...');
            fs.rmSync(AUTH_FOLDER, { recursive: true, force: true });
            console.log('[WhatsApp] Auth folder deleted');
        }

        // 4. Update database
        await updateSessionStatus(false, null);

        return {
            success: true,
            message: 'Session reset berhasil. Silakan Connect ulang dan scan QR baru.'
        };

    } catch (error) {
        console.error('[WhatsApp] Force reset error:', error);
        return {
            success: false,
            message: `Reset gagal: ${String(error)}`
        };
    }
}

// ============================================================================
// Message Sending
// ============================================================================

async function waitForWhatsAppConnection(timeoutMs = 15000): Promise<boolean> {
    const startedAt = Date.now();

    while (Date.now() - startedAt < timeoutMs) {
        if (isConnected && sock) {
            return true;
        }

        await new Promise(resolve => setTimeout(resolve, 500));
    }

    return isConnected && !!sock;
}

/**
 * Send a single WhatsApp message
 */
export async function sendWhatsAppMessage(
    phoneNumber: string,
    message: string
): Promise<{ success: boolean; error?: string }> {
    if (!isConnected || !sock) {
        // Try one last attempt to reconnect if just starting up
        console.log('[WhatsApp] Not connected, attempting to restore session before sending...');
        const initResult = await initializeWhatsApp();

        if (!initResult.success) {
            return { success: false, error: initResult.error || 'WhatsApp not connected' };
        }

        if (!await waitForWhatsAppConnection()) {
            return { success: false, error: 'WhatsApp not connected' };
        }
    }

    try {
        const activeSock = sock;
        if (!isConnected || !activeSock) {
            return { success: false, error: 'WhatsApp not connected' };
        }

        const target = resolveWhatsAppTarget(phoneNumber);
        if (!target) {
            return { success: false, error: 'Invalid WhatsApp target' };
        }

        console.log(`[WhatsApp] Sending to ${target.jid}`);

        if (target.kind === 'personal') {
            // Baileys check: Verify valid number exists on WA
            const onWhatsAppResult = await activeSock.onWhatsApp(target.jid);

            if (!onWhatsAppResult || !Array.isArray(onWhatsAppResult) || onWhatsAppResult.length === 0 || !onWhatsAppResult[0].exists) {
                return { success: false, error: `Number ${target.normalizedPhone} not on WhatsApp` };
            }
        }

        // Send Message
        await activeSock.sendMessage(target.jid, { text: message });

        return { success: true };

    } catch (error) {
        console.error('[WhatsApp] Send error:', error);
        return { success: false, error: String(error) };
    }
}

export async function sendWhatsAppDocument(params: {
    phoneNumber: string;
    document: Buffer;
    fileName: string;
    mimeType: string;
    caption?: string;
}): Promise<{ success: boolean; error?: string }> {
    if (!isConnected || !sock) {
        console.log('[WhatsApp] Not connected, attempting to restore session before sending document...');
        const initResult = await initializeWhatsApp();

        if (!initResult.success) {
            return { success: false, error: initResult.error || 'WhatsApp not connected' };
        }

        if (!await waitForWhatsAppConnection()) {
            return { success: false, error: 'WhatsApp not connected' };
        }
    }

    try {
        const activeSock = sock;
        if (!isConnected || !activeSock) {
            return { success: false, error: 'WhatsApp not connected' };
        }

        const target = resolveWhatsAppTarget(params.phoneNumber);
        if (!target) {
            return { success: false, error: 'Invalid WhatsApp target' };
        }

        console.log(`[WhatsApp] Sending document to ${target.jid}`);

        if (target.kind === 'personal') {
            const onWhatsAppResult = await activeSock.onWhatsApp(target.jid);

            if (!onWhatsAppResult || !Array.isArray(onWhatsAppResult) || onWhatsAppResult.length === 0 || !onWhatsAppResult[0].exists) {
                return { success: false, error: `Number ${target.normalizedPhone} not on WhatsApp` };
            }
        }

        await activeSock.sendMessage(target.jid, {
            document: params.document,
            fileName: params.fileName,
            mimetype: params.mimeType,
            caption: params.caption,
        });

        return { success: true };
    } catch (error) {
        console.error('[WhatsApp] Send document error:', error);
        return { success: false, error: String(error) };
    }
}

function resolveWhatsAppTarget(target: string): { kind: 'group'; jid: string } | { kind: 'personal'; jid: string; normalizedPhone: string } | null {
    const trimmed = target.trim();
    if (/^\d+@g\.us$/i.test(trimmed)) {
        return { kind: 'group', jid: trimmed };
    }
    if (/^\d+@s\.whatsapp\.net$/i.test(trimmed)) {
        const normalizedPhone = trimmed.replace(/@s\.whatsapp\.net$/i, '');
        return { kind: 'personal', jid: trimmed, normalizedPhone };
    }

    const normalizedPhone = normalizePhoneNumber(trimmed);
    if (!normalizedPhone) return null;
    return { kind: 'personal', jid: `${normalizedPhone}@s.whatsapp.net`, normalizedPhone };
}

/**
 * Send a single invoice reminder by ID
 */
export async function sendSingleInvoiceReminder(invoiceId: string): Promise<{ success: boolean; error?: string; skipped?: boolean }> {
    try {
        // Check connection
        if (!isConnected || !sock) {
            // Try one last attempt to reconnect
            await initializeWhatsApp();
            if (!isConnected || !sock) {
                return { success: false, error: 'WhatsApp not connected' };
            }
        }

        // Get invoice
        // Dynamic import to avoid circular dependency
        const { getInvoiceById, getInvoiceSettings } = await import('@/lib/dao/invoicesDao');

        const invoice = await getInvoiceById(invoiceId);
        if (!invoice) {
            return { success: false, error: 'Invoice not found' };
        }

        const idempotencyKey = buildInvoiceReminderIdempotencyKey(invoice.id);
        if (await hasWhatsappLogWithIdempotencyKey(idempotencyKey)) {
            console.log(`[WhatsApp] Skipping duplicate reminder for ${invoice.invoice_number}`);
            return { success: true, skipped: true };
        }

        // Get settings
        const settings = await getInvoiceSettings();
        if (!settings) {
            return { success: false, error: 'Invoice settings not found' };
        }

        // Generate message
        console.log(`[WhatsApp] Generating reminder for ${invoice.invoice_number}`);
        const message = await formatInvoiceMessage(invoice, settings);

        console.log(`[WhatsApp] Sending message to ${invoice.parent_phone}`);

        const logEntry = await logWhatsappEvent({
            category: 'INVOICE' as any,
            payload: {
                invoice_id: invoice.id,
                invoice_number: invoice.invoice_number,
                parent_phone: invoice.parent_phone,
                parent_name: invoice.parent_name,
                idempotency_key: idempotencyKey,
            },
            status: 'QUEUED',
        });

        // Send
        const result = await sendWhatsAppMessage(invoice.parent_phone, message);

        await updateWhatsappLogStatus(
            logEntry.id,
            result.success ? 'SENT' : 'FAILED',
            result.error ? { error: result.error } : { success: true },
        );

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
 * Send Class Reminder (Generic)
 */
export async function sendClassReminder(
    parentPhone: string,
    message: string,
    studentName: string,
    logType: 'CLASS_REMINDER' | 'TEST_CLASS_REMINDER' = 'CLASS_REMINDER',
    idempotencyKey?: string,
): Promise<{ success: boolean; error?: string; skipped?: boolean }> {
    try {
        // Check connection
        if (!isConnected || !sock) {
            // Try one last attempt to reconnect
            await initializeWhatsApp();
            if (!isConnected || !sock) {
                return { success: false, error: 'WhatsApp not connected' };
            }
        }

        console.log(`[WhatsApp] Sending class reminder to ${parentPhone} for ${studentName} (${logType})`);

        if (idempotencyKey && await hasWhatsappLogWithIdempotencyKey(idempotencyKey)) {
            console.log(`[WhatsApp] Skipping duplicate class reminder for ${parentPhone}`);
            return { success: true, skipped: true };
        }

        const queuedLog = idempotencyKey
            ? await logWhatsappEvent({
                category: 'REMINDER' as any,
                payload: {
                    parent_phone: parentPhone,
                    student_name: studentName,
                    type: logType,
                    idempotency_key: idempotencyKey,
                },
                status: 'QUEUED',
            })
            : null;

        // Send
        const result = await sendWhatsAppMessage(parentPhone, message);

        // Log result
        if (queuedLog) {
            await updateWhatsappLogStatus(
                queuedLog.id,
                result.success ? 'SENT' : 'FAILED',
                result.error ? { error: result.error } : { success: true },
            );
        } else {
            const supabase = getSupabaseAdmin();
            await supabase.from('whatsapp_message_logs').insert({
                category: 'REMINDER' as any, // Use existing REMINDER category
                payload: {
                    parent_phone: parentPhone,
                    student_name: studentName,
                    type: logType // Add type to differentiate
                },
                status: result.success ? 'SENT' : 'FAILED',
                response: result.error ? { error: result.error } : { success: true },
                processed_at: new Date().toISOString()
            });
        }

        return result;

    } catch (error) {
        console.error('[WhatsApp] Class reminder error:', error);
        return { success: false, error: String(error) };
    }
}

/**
 * Send Absent Notification to Parent (via Baileys)
 * Uses template from whatsapp_templates DB table (category: PARENT_ABSENT).
 * Falls back to hardcoded message if no template found.
 */
export async function sendAbsentNotification(params: {
    parentPhone: string;
    coderFullName: string;
    parentName?: string | null;
    className: string;
    sessionDateTime: string;
    makeUpUrl: string;
    status: 'ABSENT' | 'EXCUSED';
    reason?: string | null;
    instructions?: string | null;
    dueDate?: string | null;
    reminderType?: 'H-3' | 'H-1' | 'INITIAL';
}): Promise<{ success: boolean; error?: string }> {
    try {
        // Check connection
        if (!isConnected || !sock) {
            await initializeWhatsApp();
            if (!isConnected || !sock) {
                return { success: false, error: 'WhatsApp not connected' };
            }
        }

        // Format session date
        const sessionDate = new Date(params.sessionDateTime);
        const formattedDate = sessionDate.toLocaleDateString('id-ID', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });
        const formattedTime = sessionDate.toLocaleTimeString('id-ID', {
            hour: '2-digit',
            minute: '2-digit'
        });

        // Format due date
        let formattedDueDate = '-';
        if (params.dueDate) {
            formattedDueDate = new Date(params.dueDate).toLocaleDateString('id-ID', {
                day: 'numeric',
                month: 'long',
                year: 'numeric'
            });
        }

        const statusText = params.status === 'ABSENT' ? 'tidak hadir' : 'izin';
        const reasonText = params.reason ? `Alasan: ${params.reason}\n` : '';
        const parentDisplayName = params.parentName || 'Ayah/Bunda';

        // Try to fetch template from database
        let message: string;
        try {
            const supabase = getSupabaseAdmin();
            const { data: templateData } = await (supabase as any)
                .from('whatsapp_templates')
                .select('template_content')
                .eq('category', 'PARENT_ABSENT')
                .single();

            if (templateData?.template_content) {
                // Use DB template — replace variables
                message = templateData.template_content
                    .replace(/\{nama_orangtua\}/g, parentDisplayName)
                    .replace(/\{nama_siswa\}/g, params.coderFullName)
                    .replace(/\{nama_kelas\}/g, params.className)
                    .replace(/\{tanggal\}/g, formattedDate)
                    .replace(/\{waktu\}/g, formattedTime)
                    .replace(/\{status\}/g, statusText)
                    .replace(/\{alasan\}/g, reasonText)
                    .replace(/\{instruksi\}/g, params.instructions || 'Silakan lihat detail di LMS.')
                    .replace(/\{batas_pengumpulan\}/g, formattedDueDate)
                    .replace(/\{link_tugas\}/g, params.makeUpUrl);

                console.log('[WhatsApp] Using PARENT_ABSENT template from database');
            } else {
                // Fallback to hardcoded message
                message = buildDefaultAbsentMessage(params, parentDisplayName, statusText, formattedDate, formattedTime, formattedDueDate, reasonText);
                console.log('[WhatsApp] No DB template found, using default message');
            }
        } catch (templateError) {
            // Fallback to hardcoded message on any DB error
            console.warn('[WhatsApp] Failed to fetch template, using default:', templateError);
            message = buildDefaultAbsentMessage(params, parentDisplayName, statusText, formattedDate, formattedTime, formattedDueDate, reasonText);
        }

        console.log(`[WhatsApp] Sending absent notification to ${params.parentPhone} for ${params.coderFullName}`);

        // Send message
        const result = await sendWhatsAppMessage(params.parentPhone, message);

        return result;

    } catch (error) {
        console.error('[WhatsApp] Absent notification error:', error);
        return { success: false, error: String(error) };
    }
}

/**
 * Send Report Notification to Parent (via Baileys)
 */
export async function sendReportNotification(params: {
    parentPhone: string;
    coderFullName: string;
    className: string;
    reportUrl: string;
    period?: string;
}): Promise<{ success: boolean; error?: string }> {
    try {
        // Check connection
        if (!isConnected || !sock) {
            await initializeWhatsApp();
            if (!isConnected || !sock) {
                return { success: false, error: 'WhatsApp not connected' };
            }
        }

        // Try to fetch template from database
        let message: string;
        try {
            const supabase = getSupabaseAdmin();
            const { data: templateData } = await (supabase as any)
                .from('whatsapp_templates')
                .select('template_content')
                .eq('category', 'REPORT_SEND')
                .single();

            if (templateData?.template_content) {
                // Use DB template — replace variables
                message = templateData.template_content
                    .replace(/{parent_name}/g, 'Ayah/Bunda')
                    .replace(/{nama_siswa}/g, params.coderFullName)
                    .replace(/{nama_kelas}/g, params.className)
                    .replace(/{periode}/g, params.period || '-')
                    .replace(/{jenis_laporan}/g, 'Laporan hasil belajar')
                    .replace(/{rekomendasi_program}/g, '')
                    .replace(/{link_raport}/g, params.reportUrl);

                // Auto-append link if not present in template
                if (!message.includes(params.reportUrl)) {
                    message += `\n\nLink Raport: ${params.reportUrl}`;
                }

                console.log('[WhatsApp] Using REPORT_SEND template from database');
            } else {
                // Fallback to hardcoded message
                message = `Halo Ayah/Bunda,\n\nLaporan hasil belajar *${params.coderFullName}* untuk kelas *${params.className}* (${params.period || '-'}) sudah tersedia.\n\nSilakan lihat detail laporannya melalui link berikut:\n${params.reportUrl}\n\nTerima kasih! 🙏`;
                console.log('[WhatsApp] No DB template found for REPORT_SEND, using default message');
            }
        } catch (templateError) {
            console.warn('[WhatsApp] Failed to fetch REPORT_SEND template, using default:', templateError);
            message = `Halo Ayah/Bunda,\n\nLaporan hasil belajar *${params.coderFullName}* untuk kelas *${params.className}* sudah tersedia.\n\nSilakan lihat detail laporannya melalui link berikut:\n${params.reportUrl}\n\nTerima kasih! 🙏`;
        }

        console.log(`[WhatsApp] Sending report notification to ${params.parentPhone} for ${params.coderFullName}`);

        // Send message
        const result = await sendWhatsAppMessage(params.parentPhone, message);

        return result;

    } catch (error) {
        console.error('[WhatsApp] Report notification error:', error);
        return { success: false, error: String(error) };
    }
}

/**
 * Build default absent notification message (hardcoded fallback)
 */
function buildDefaultAbsentMessage(
    params: { coderFullName: string; className: string; makeUpUrl: string; reason?: string | null; instructions?: string | null },
    parentDisplayName: string,
    statusText: string,
    formattedDate: string,
    formattedTime: string,
    formattedDueDate: string,
    reasonText: string,
): string {
    return `Halo ${parentDisplayName},

Kami informasikan bahwa *${params.coderFullName}* ${statusText} pada sesi kelas *${params.className}* tanggal ${formattedDate} pukul ${formattedTime} WIB.

${reasonText}*Tugas Susulan:*
${params.instructions || 'Silakan lihat detail di LMS.'}

Batas pengumpulan: ${formattedDueDate}
Link tugas: ${params.makeUpUrl}

Mohon pastikan tugas susulan dikerjakan tepat waktu.
Terima kasih 🙏`;
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

        // Get unpaid invoices (PENDING + OVERDUE)
        const invoices = await getUnpaidInvoicesForMonth(month, year);
        if (invoices.length === 0) {
            result.errors.push('No unpaid invoices found for this month.');
            return result;
        }

        // Send messages with random delay
        for (let i = 0; i < invoices.length; i++) {
            const invoice = invoices[i];

            try {
                const idempotencyKey = buildInvoiceReminderIdempotencyKey(invoice.id);
                if (await hasWhatsappLogWithIdempotencyKey(idempotencyKey)) {
                    console.log(`[WhatsApp] Skipping duplicate reminder for ${invoice.invoice_number}`);
                    continue;
                }

                // Generate message from template
                const message = await formatInvoiceMessage(invoice, settings);

                const logEntry = await logWhatsappEvent({
                    category: 'INVOICE' as any,
                    payload: {
                        invoice_id: invoice.id,
                        invoice_number: invoice.invoice_number,
                        parent_phone: invoice.parent_phone,
                        parent_name: invoice.parent_name,
                        idempotency_key: idempotencyKey,
                    },
                    status: 'QUEUED',
                });

                // Send message
                const sendResult = await sendWhatsAppMessage(invoice.parent_phone, message);

                if (sendResult.success) {
                    result.sent++;
                    await updateWhatsappLogStatus(logEntry.id, 'SENT', { success: true });
                } else {
                    result.failed++;
                    result.errors.push(`Failed to send to ${invoice.parent_name}: ${sendResult.error}`);
                    await updateWhatsappLogStatus(logEntry.id, 'FAILED', { error: sendResult.error ?? 'Unknown error' });
                }

                // Random delay using class_reminder_delay settings
                if (i < invoices.length - 1) {
                    const minDelay = (settings.class_reminder_delay_min || 5) * 1000;
                    const maxDelay = (settings.class_reminder_delay_max || 15) * 1000;
                    const delay = getRandomDelay(minDelay, maxDelay);
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
async function formatInvoiceMessage(
    invoice: Invoice,
    settings: {
        invoice_message_template: string;
        weekly_invoice_message_template?: string;
        base_url: string;
    }
): Promise<string> {
    // Check for Weekly Registration (REG) - Check by invoice number prefix OR ccr code
    const isWeeklyReg = invoice.invoice_number.startsWith('REG-') || (invoice.ccr && invoice.ccr.ccr_code === 'REG');
    const longInvoiceUrl = buildInvoicePublicUrl(settings.base_url, invoice);
    const invoiceUrl = await getShortInvoiceUrlOrOriginal(longInvoiceUrl, invoice, settings.base_url);

    // Helper to get student names - Handle multiple students!
    const studentNames = Array.from(new Set(
        invoice.items?.map(item => item.coder_name).filter(Boolean) || []
    ));
    const studentName = studentNames.length > 0
        ? studentNames.join(', ')
        : (invoice.parent_name || '-');

    // Format Due Date
    const formattedDueDate = invoice.due_date
        ? new Date(invoice.due_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
        : '-';

    if (isWeeklyReg) {

        // Use setting or Default Fallback
        const template = settings.weekly_invoice_message_template ||
            `Halo Ayah/Bunda {parent_name},

Terima kasih telah mendaftar di Program Weekly Clevio Innovator Camp.

Berikut detail tagihan pendaftaran:
- No. Invoice: {invoice_number}
- Siswa: {student_name}
- Jatuh Tempo: {due_date}

Silakan cek detail dan lakukan pembayaran melalui link invoice berikut:
{invoice_url}

Mohon selesaikan pembayaran untuk mengamankan slot jadwal.
Terima kasih!`;

        return template
            // Regex to support both {{var}} and {var}
            .replace(/\{\{invoice_number\}\}|\{invoice_number\}/g, invoice.invoice_number)
            .replace(/\{\{student_name\}\}|\{student_name\}/g, studentName)
            .replace(/\{\{parent_name\}\}|\{parent_name\}/g, invoice.parent_name)
            .replace(/\{\{invoice_url\}\}|\{invoice_url\}/g, invoiceUrl)
            .replace(/\{\{due_date\}\}|\{due_date\}/g, formattedDueDate);
    }

    const template = settings.invoice_message_template;

    const formattedAmount = new Intl.NumberFormat('id-ID').format(invoice.total_amount);
    // formattedDueDate is already calculated above

    // Format period as date range
    const getMonthName = (month: number) => {
        const months = [
            'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
            'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
        ];
        return months[month - 1] || '';
    };

    let periodMonthYear = '';
    if (invoice.period_start_date && invoice.period_end_date) {
        const start = new Date(invoice.period_start_date);
        const end = new Date(invoice.period_end_date);

        const startMonth = getMonthName(start.getMonth() + 1);
        const startYear = start.getFullYear();

        const endMonth = getMonthName(end.getMonth() + 1);
        const endYear = end.getFullYear();

        // Same month: "Januari 2026"
        if (start.getMonth() === end.getMonth() && startYear === endYear) {
            periodMonthYear = `${startMonth} ${startYear}`;
        }
        // Same year: "Januari - Maret 2026"
        else if (startYear === endYear) {
            periodMonthYear = `${startMonth} - ${endMonth} ${startYear}`;
        }
        // Different years: "Desember 2025 - Februari 2026"
        else {
            periodMonthYear = `${startMonth} ${startYear} - ${endMonth} ${endYear}`;
        }
    } else {
        // Fallback to old format if period dates not available
        const periodDate = new Date(invoice.period_year, invoice.period_month - 1);
        periodMonthYear = periodDate.toLocaleDateString('id-ID', {
            month: 'long',
            year: 'numeric'
        });
    }

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
