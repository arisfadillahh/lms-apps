import crypto from 'node:crypto';
import type { Invoice } from '@/lib/types/invoice';

type EventManagerInvoiceStatus = 'paid' | 'expired' | 'cancelled';

type EventManagerWebhookResult = {
    sent: boolean;
    reason?: string;
    status?: number;
    error?: string;
};

export async function notifyEventManagerInvoiceStatus(
    invoice: Invoice,
    status: EventManagerInvoiceStatus
): Promise<EventManagerWebhookResult> {
    const externalReference = resolveExternalReference(invoice);
    if (!externalReference) {
        return { sent: false, reason: 'not_external_event_invoice' };
    }

    const webhookUrl = resolveWebhookUrl();
    if (!webhookUrl) {
        return { sent: false, reason: 'event_manager_webhook_url_missing' };
    }

    const payload = {
        invoice_id: invoice.id,
        external_reference: externalReference,
        status,
        paid_at: status === 'paid' ? invoice.paid_at : undefined,
        amount: invoice.total_amount
    };
    const rawBody = JSON.stringify(payload);
    const headers: Record<string, string> = {
        'content-type': 'application/json'
    };

    const secret = process.env.LMS_WEBHOOK_SECRET?.trim();
    if (secret) {
        headers['x-lms-signature'] = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
    }

    try {
        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers,
            body: rawBody
        });

        if (!response.ok) {
            const responseText = await response.text().catch(() => '');
            console.error('[EventManagerWebhook] Webhook failed', {
                invoiceId: invoice.id,
                externalReference,
                status,
                responseStatus: response.status,
                responseText
            });
            return { sent: false, status: response.status, error: responseText || response.statusText };
        }

        return { sent: true, status: response.status };
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error('[EventManagerWebhook] Webhook error', {
            invoiceId: invoice.id,
            externalReference,
            status,
            error: message
        });
        return { sent: false, error: message };
    }
}

export function resolveExternalReference(invoice: Invoice) {
    const fromItem = invoice.items?.map((item) => item.description?.trim()).find((description) => description?.startsWith('REG-'));
    if (fromItem) return fromItem;

    if (invoice.invoice_number.startsWith('INV/REG-')) {
        return invoice.invoice_number.slice('INV/'.length);
    }

    return null;
}

function resolveWebhookUrl() {
    const direct = process.env.EVENT_MANAGER_INVOICE_WEBHOOK_URL?.trim();
    if (direct) return direct;

    const base = (process.env.EVENT_MANAGER_INTERNAL_URL || process.env.EVENT_MANAGER_PUBLIC_URL)?.trim();
    if (!base) return null;

    return `${base.replace(/\/+$/, '')}/webhooks/lms/invoice`;
}
