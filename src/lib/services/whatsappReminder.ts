/**
 * WhatsApp Reminder Service
 * 
 * This module provides stubs for WhatsApp integration using whatsapp-web.js.
 * To enable, install: npm install whatsapp-web.js qrcode-terminal
 * 
 * Note: wwebjs requires a persistent session and running the Node process
 * to maintain the WhatsApp connection. For production, consider:
 * - Running as a separate service/worker
 * - Using a cloud WhatsApp API (Twilio, MessageBird, etc.)
 */

// Placeholder for WhatsApp client
let isConnected = false;

/**
 * Send a WhatsApp message to a phone number
 */
export async function sendWhatsAppMessage(phoneNumber: string, message: string): Promise<{ success: boolean; error?: string }> {
    // Normalize phone number (add country code if needed)
    const normalizedPhone = normalizePhoneNumber(phoneNumber);

    if (!normalizedPhone) {
        return { success: false, error: 'Invalid phone number' };
    }

    // In production, this would use wwebjs client
    // For now, just log the message
    console.log(`[WhatsApp] Would send to ${normalizedPhone}: ${message}`);

    // Simulate success
    return { success: true };
}

/**
 * Send payment reminder via WhatsApp
 */
export async function sendPaymentReminder(phoneNumber: string, coderName: string, daysRemaining: number, amount: number): Promise<{ success: boolean; error?: string }> {
    const formattedAmount = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);

    let message: string;

    if (daysRemaining < 0) {
        message = `🔴 *Pembayaran Expired*

Halo Ayah/Bunda dari ${coderName},

Periode pembayaran sudah berakhir ${Math.abs(daysRemaining)} hari yang lalu.

Total: ${formattedAmount}

Mohon segera melakukan pembayaran agar proses belajar tidak terganggu.

Terima kasih! 🙏`;
    } else if (daysRemaining === 0) {
        message = `🟠 *Pembayaran Hari Ini*

Halo Ayah/Bunda dari ${coderName},

Periode pembayaran berakhir HARI INI.

Total: ${formattedAmount}

Mohon segera melakukan pembayaran.

Terima kasih! 🙏`;
    } else {
        message = `🟡 *Pengingat Pembayaran*

Halo Ayah/Bunda dari ${coderName},

Periode pembayaran akan berakhir dalam ${daysRemaining} hari lagi.

Total: ${formattedAmount}

Mohon persiapkan pembayaran Anda.

Terima kasih! 🙏`;
    }

    return sendWhatsAppMessage(phoneNumber, message);
}

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
 * Check if WhatsApp service is connected
 */
export function isWhatsAppConnected(): boolean {
    return isConnected;
}

/**
 * Initialize WhatsApp client (stub)
 * In production, this would create the wwebjs client and handle QR auth
 */
export async function initWhatsApp(): Promise<void> {
    console.log('[WhatsApp] Service initialized (stub mode)');
    isConnected = true;
}
