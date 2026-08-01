import crypto from 'node:crypto';
import type { Invoice } from '@/lib/types/invoice';
import type { InvoicePaymentBreakdown, InvoicePaymentMethodCode } from '@/lib/invoicePaymentMethods';

type MidtransAction = {
    name?: string;
    method?: string;
    url?: string;
};

type MidtransChargeResponse = {
    status_code?: string;
    status_message?: string;
    transaction_id?: string;
    order_id?: string;
    gross_amount?: string;
    payment_type?: string;
    transaction_status?: string;
    fraud_status?: string;
    va_numbers?: Array<{ bank?: string; va_number?: string }>;
    bsi_va_number?: string;
    bni_va_number?: string;
    permata_va_number?: string;
    biller_code?: string;
    bill_key?: string;
    qr_code_url?: string;
    deeplink_url?: string;
    actions?: MidtransAction[];
    expiry_time?: string;
    error_messages?: string[];
};

type MidtransSnapResponse = {
    token?: string;
    redirect_url?: string;
    error_messages?: string[];
};

type MidtransItemDetail = {
    id: string;
    name: string;
    quantity: number;
    price: number;
};

export type MidtransNotificationPayload = {
    order_id?: string;
    status_code?: string;
    gross_amount?: string;
    signature_key?: string;
    transaction_status?: string;
    fraud_status?: string;
    transaction_id?: string;
    settlement_time?: string;
    transaction_time?: string;
    payment_type?: string;
};

export type InvoiceMidtransPayment = {
    orderId: string;
    transactionId: string | null;
    paymentType: string | null;
    transactionStatus: string | null;
    expiresAt: string | null;
    paymentDetails: {
        method: InvoicePaymentMethodCode;
        label: string;
        baseAmount: number;
        adminFee: number;
        feePercent: number;
        feeFixed?: number;
        feeVatPercent?: number;
        feeLabel: string;
        total: number;
        qrCodeUrl: string | null;
        deeplinkUrl: string | null;
        bank: string | null;
        vaNumber: string | null;
        billerCode: string | null;
        billKey: string | null;
    };
    rawResponse: MidtransChargeResponse;
};

export class InvoiceMidtransClient {
    private readonly serverKey = process.env.MIDTRANS_SERVER_KEY?.trim();
    private readonly isProduction = process.env.MIDTRANS_IS_PRODUCTION === 'true';

    async createPayment(invoice: Invoice, payment: InvoicePaymentBreakdown, orderId: string): Promise<InvoiceMidtransPayment> {
        if (!this.serverKey) {
            throw new Error('MIDTRANS_SERVER_KEY belum dikonfigurasi di LMS.');
        }

        const snapPaymentMethod = getSnapPaymentMethod(payment.method);
        const snapResponse = await fetch(`${this.baseUrl}/snap/v1/transactions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
                Authorization: `Basic ${Buffer.from(`${this.serverKey}:`).toString('base64')}`,
                'X-Override-Notification': getMidtransConfigUrls().paymentNotificationUrl
            },
            body: JSON.stringify({
                transaction_details: {
                    order_id: orderId,
                    gross_amount: payment.total
                },
                customer_details: {
                    first_name: invoice.parent_name || invoice.seasonal_student_name || 'Customer Clevio',
                    phone: normalizePhone(invoice.parent_phone || invoice.seasonal_student_phone || '')
                },
                item_details: buildMidtransItemDetails(invoice, payment),
                enabled_payments: [snapPaymentMethod],
                callbacks: {
                    finish: getMidtransConfigUrls().finishRedirectUrl
                },
                custom_field1: invoice.id,
                custom_field2: invoice.invoice_number,
                custom_field3: payment.method
            })
        });

        const snap = (await snapResponse.json().catch(() => ({}))) as MidtransSnapResponse;
        if (!snapResponse.ok || !snap.token) {
            const message = snap.error_messages?.join(', ') || `Midtrans Snap error ${snapResponse.status}`;
            throw new Error(message);
        }

        const chargeResponse = await fetch(`${this.baseUrl}/snap/v2/transactions/${encodeURIComponent(snap.token)}/charge`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
                'X-Source': 'snap',
                'X-Source-App-Type': 'redirection',
                'X-Source-Version': '2.3.0'
            },
            body: JSON.stringify({
                payment_type: snapPaymentMethod
            })
        });

        const data = (await chargeResponse.json().catch(() => ({}))) as MidtransChargeResponse;
        if (!chargeResponse.ok || !isPendingCharge(data)) {
            const message = data.error_messages?.join(', ') || data.status_message || `Midtrans payment charge error ${chargeResponse.status}`;
            throw new Error(message);
        }

        const va = data.va_numbers?.[0];
        return {
            orderId,
            transactionId: data.transaction_id ?? null,
            paymentType: data.payment_type ?? snapPaymentMethod,
            transactionStatus: data.transaction_status ?? null,
            expiresAt: normalizeMidtransExpiry(data.expiry_time),
            paymentDetails: {
                method: payment.method,
                label: payment.label,
                baseAmount: payment.baseAmount,
                adminFee: payment.adminFee,
                feePercent: payment.feePercent,
                feeFixed: payment.feeFixed,
                feeVatPercent: payment.feeVatPercent,
                feeLabel: payment.feeLabel,
                total: payment.total,
                qrCodeUrl: data.qr_code_url ?? data.actions?.find((action) => action.name === 'generate-qr-code')?.url ?? null,
                deeplinkUrl: data.deeplink_url
                    ?? data.actions?.find((action) => action.name === 'deeplink-redirect')?.url
                    ?? getSnapRedirectFallback(payment.method, snap.redirect_url),
                bank: va?.bank ?? getPaymentBankLabel(payment.method),
                vaNumber: va?.va_number ?? data.bsi_va_number ?? data.bni_va_number ?? data.permata_va_number ?? null,
                billerCode: data.biller_code ?? null,
                billKey: data.bill_key ?? null
            },
            rawResponse: data
        };
    }

    get coreBaseUrl() {
        return this.isProduction ? 'https://api.midtrans.com' : 'https://api.sandbox.midtrans.com';
    }

    get baseUrl() {
        return this.isProduction ? 'https://app.midtrans.com' : 'https://app.sandbox.midtrans.com';
    }
}

export function createLmsInvoiceMidtransOrderId(invoice: Pick<Invoice, 'id'>, method: InvoicePaymentMethodCode) {
    const suffix = Date.now().toString(36).toUpperCase();
    return `LMS-${invoice.id.slice(0, 8)}-${method}-${suffix}`.replace(/[^a-zA-Z0-9_-]/g, '-');
}

export function getMidtransConfigUrls() {
    const baseUrl = getPublicBaseUrl();
    return {
        paymentNotificationUrl: `${baseUrl}/api/midtrans/notification`,
        recurringNotificationUrl: `${baseUrl}/api/midtrans/notification`,
        payAccountNotificationUrl: `${baseUrl}/api/midtrans/notification`,
        finishRedirectUrl: baseUrl,
        unfinishRedirectUrl: baseUrl,
        errorRedirectUrl: baseUrl
    };
}

export function verifyMidtransSignature(payload: MidtransNotificationPayload) {
    const serverKey = process.env.MIDTRANS_SERVER_KEY?.trim();
    if (!serverKey) return false;

    const source = `${payload.order_id ?? ''}${payload.status_code ?? ''}${payload.gross_amount ?? ''}${serverKey}`;
    const expected = crypto.createHash('sha512').update(source).digest('hex');
    return safeEqual(expected, String(payload.signature_key ?? ''));
}

export function mapMidtransStatus(payload: MidtransNotificationPayload) {
    const status = String(payload.transaction_status ?? '').toLowerCase();
    const fraudStatus = String(payload.fraud_status ?? '').toLowerCase();
    const successfulStatusCode = String(payload.status_code ?? '') === '200';

    if (successfulStatusCode && status === 'settlement') return 'paid';
    if (successfulStatusCode && status === 'capture' && fraudStatus === 'accept') return 'paid';
    if (status === 'expire') return 'expired';
    if (['cancel', 'deny', 'failure'].includes(status)) return 'cancelled';
    return 'waiting_payment';
}

export function getMidtransPaidAt(payload: MidtransNotificationPayload) {
    return payload.settlement_time || payload.transaction_time || new Date().toISOString();
}

function getPublicBaseUrl() {
    return (
        process.env.NEXTAUTH_URL
        || process.env.NEXT_PUBLIC_APP_URL
        || process.env.NEXT_PUBLIC_BASE_URL
        || 'https://lms.clev.io'
    ).replace(/\/+$/, '');
}

function getSnapRedirectFallback(method: InvoicePaymentMethodCode, redirectUrl?: string | null) {
    if (!redirectUrl) return null;
    if (method === 'gopay') return appendQueryParam(redirectUrl, 'gopayMode', 'deeplink');
    if (method === 'qris') return redirectUrl;
    return null;
}

function appendQueryParam(url: string, key: string, value: string) {
    try {
        const parsed = new URL(url);
        parsed.searchParams.set(key, value);
        return parsed.toString();
    } catch {
        const separator = url.includes('?') ? '&' : '?';
        return `${url}${separator}${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
    }
}

function getDirectPaymentRequest(method: InvoicePaymentMethodCode, invoice: Invoice) {
    if (method === 'gopay' || method === 'qris') {
        return {
            paymentType: 'gopay',
            parameters: {
                gopay: {
                    enable_callback: true,
                    callback_url: getPublicBaseUrl()
                }
            }
        };
    }

    if (method === 'mandiri_bill') {
        return {
            paymentType: 'echannel',
            parameters: {
                echannel: {
                    bill_info1: 'Pembayaran untuk:',
                    bill_info2: normalizeMidtransItemName(invoice.invoice_number)
                }
            }
        };
    }

    return {
        paymentType: 'bank_transfer',
        parameters: {
            bank_transfer: {
                bank: getCoreBank(method)
            }
        }
    };
}

function getSnapPaymentMethod(method: InvoicePaymentMethodCode) {
    switch (method) {
        case 'gopay':
        case 'qris':
            return 'gopay';
        case 'mandiri_bill':
            return 'echannel';
        case 'bsi_va':
            return 'bsi_va';
        case 'bri_va':
            return 'bri_va';
        case 'permata_va':
            return 'permata_va';
        case 'cimb_va':
        case 'other_va':
            return 'other_va';
        case 'bca_va':
            return 'bca_va';
        case 'bni_va':
        default:
            return 'bni_va';
    }
}

function getCoreBank(method: InvoicePaymentMethodCode) {
    switch (method) {
        case 'bri_va':
            return 'bri';
        case 'bsi_va':
            return 'bsi';
        case 'permata_va':
            return 'permata';
        case 'cimb_va':
            return 'cimb';
        case 'bca_va':
            return 'bca';
        case 'other_va':
            return (process.env.MIDTRANS_VA_BANK || 'bni').trim().toLowerCase();
        case 'bni_va':
        default:
            return 'bni';
    }
}

function getPaymentBankLabel(method: InvoicePaymentMethodCode) {
    switch (method) {
        case 'mandiri_bill':
            return 'Mandiri';
        case 'bsi_va':
            return 'BSI';
        case 'bri_va':
            return 'BRI';
        case 'permata_va':
            return 'Permata';
        case 'cimb_va':
            return 'CIMB Niaga';
        case 'other_va':
            return 'Bank Lain';
        case 'bca_va':
            return 'BCA';
        case 'bni_va':
            return 'BNI';
        default:
            return null;
    }
}

function buildMidtransItemDetails(invoice: Invoice, payment: InvoicePaymentBreakdown): MidtransItemDetail[] {
    const invoiceItems = invoice.items
        ?.filter((item) => Number.isFinite(item.final_price) && item.final_price > 0)
        .map((item, index) => ({
            id: `INV-${index + 1}`,
            name: normalizeMidtransItemName(`${item.coder_name || invoice.parent_name} - ${item.class_name}`),
            quantity: 1,
            price: Math.round(item.final_price)
        })) ?? [];

    const itemBaseTotal = invoiceItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const baseItems = invoiceItems.length > 0 && itemBaseTotal === payment.baseAmount
        ? invoiceItems
        : [{
            id: 'INV-BASE',
            name: normalizeMidtransItemName(`Invoice ${invoice.invoice_number}`),
            quantity: 1,
            price: payment.baseAmount
        }];

    if (payment.adminFee > 0) {
        baseItems.push({
            id: 'ADMIN-FEE',
            name: 'Biaya admin pembayaran',
            quantity: 1,
            price: payment.adminFee
        });
    }

    const total = baseItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
    if (total !== payment.total) {
        throw new Error(`Total item Midtrans (${total}) tidak sama dengan total pembayaran (${payment.total}).`);
    }

    return baseItems;
}

function normalizePhone(value: string) {
    const digits = value.replace(/\D/g, '');
    if (!digits) return undefined;
    if (digits.startsWith('0')) return `62${digits.slice(1)}`;
    if (digits.startsWith('62')) return digits;
    return digits;
}

function normalizeMidtransItemName(value: string) {
    const normalized = value.trim() || 'Invoice Clevio';
    return Array.from(normalized).slice(0, 50).join('');
}

function normalizeMidtransExpiry(value: string | undefined) {
    if (!value) return null;
    const normalized = value.includes('T') ? value : `${value.replace(' ', 'T')}+07:00`;
    const timestamp = new Date(normalized);
    return Number.isNaN(timestamp.getTime()) ? null : timestamp.toISOString();
}

function isPendingCharge(data: MidtransChargeResponse) {
    const status = String(data.transaction_status ?? '').toLowerCase();
    return data.status_code === '201' || status === 'pending';
}

function safeEqual(left: string, right: string) {
    const a = Buffer.from(left);
    const b = Buffer.from(right);
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
}
