import crypto from 'node:crypto';
import type { Invoice } from '@/lib/types/invoice';
import type { InvoicePaymentBreakdown, InvoicePaymentMethodCode } from '@/lib/invoicePaymentMethods';
import { issueSnapInBrowser } from '@/lib/invoiceSnapBrowser';
import { withInvoiceIssuance, getIssuanceByOrder } from '@/lib/invoiceIssuanceJournal';
import { getStoredInvoicePaymentByInvoiceId } from '@/lib/invoicePaymentStore';

type MidtransAction = {
    name?: string;
    method?: string;
    url?: string;
};

export type MidtransChargeResponse = {
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
    bri_va_number?: string;
    cimb_va_number?: string;
    permata_va_number?: string;
    biller_code?: string;
    bill_key?: string;
    qr_code_url?: string;
    qr_string?: string;
    qris_url?: string;
    qris_expiration_raw?: string;
    bsi_expiration_raw?: string;
    currency?: string;
    bank?: string;
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
        qrString?: string | null;
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

    /** Read the provider's authoritative state; a local expiry timer is not proof. */
    async getTransactionStatus(orderId: string): Promise<MidtransNotificationPayload> {
        return this.transactionRequest(orderId, 'status', 'GET');
    }

    async cancelTransaction(orderId: string): Promise<MidtransNotificationPayload> {
        return this.transactionRequest(orderId, 'cancel', 'POST');
    }

    private async transactionRequest(orderId: string, action: 'status' | 'cancel', method: 'GET' | 'POST'): Promise<MidtransNotificationPayload> {
        if (!this.serverKey) throw new Error('Konfigurasi gateway belum tersedia.');
        const issue=await getIssuanceByOrder(orderId);
        const isBsi=issue?.method==='bsi_va';
        const id=isBsi ? issue.payment?.transactionId || await (await import('@/lib/midtransSnapTransaction')).verifiedSnapTransactionId(orderId) : orderId;
        const response = await fetch(`${this.coreBaseUrl}/v2/${encodeURIComponent(id)}/${action}`, {
            method, cache: 'no-store', signal: AbortSignal.timeout(15000),
            headers: { Accept: 'application/json', Authorization: `Basic ${Buffer.from(`${this.serverKey}:`).toString('base64')}`,
                ...(isBsi?{'transaction-source':'SNAP_API'}:{}) },
        });
        const data = await response.json().catch(() => null) as MidtransNotificationPayload | null;
        if (isBsi && action==='cancel' && data && !data.order_id) data.order_id=orderId;
        if (!response.ok || data?.order_id!==orderId || !data.transaction_status) throw new Error('Status pembayaran belum dapat dipastikan. Jangan membuat pembayaran lain dulu.');
        if(isBsi)assertPaymentIdentity(data,orderId,issue.total);
        return data;
    }

    async createPayment(invoice: Invoice, payment: InvoicePaymentBreakdown, orderId: string): Promise<InvoiceMidtransPayment> {
        if (!this.serverKey) throw new Error('Konfigurasi pembayaran belum tersedia.');
        return withInvoiceIssuance(invoice.id, async journal => {
            let state = await journal.read();
            const hadState=!!state;
            const legacy = !state ? await getStoredInvoicePaymentByInvoiceId(invoice.id) : null;
            // Adopt an existing issued order before creating a new one, including pre-upgrade instructions.
            if (!state && legacy) state = { invoiceId: invoice.id, orderId: legacy.orderId, method: legacy.method,
                total: legacy.total, phase: 'READY', payment: { orderId: legacy.orderId, transactionId: legacy.transactionId,
                    paymentType: legacy.paymentType, transactionStatus: legacy.transactionStatus, expiresAt: legacy.expiresAt,
                    paymentDetails: legacy.paymentDetails, rawResponse: legacy.rawResponse } };
            if (!state && invoice.midtrans_order_id) state = { invoiceId:invoice.id, orderId:invoice.midtrans_order_id,
                method:invoice.payment_method ?? '', total:invoice.payment_total_amount ?? invoice.total_amount, phase:'READY' };
            if(!hadState&&state){
                // Older BSI Snap responses used a placeholder ID; recover its real signed-webhook ID.
                if(state.method==='bsi_va'&&state.payment)state.payment.transactionId=null;
                await journal.write(state);
            }
            if (state && state.phase !== 'REJECTED') {
                const same = state.method === payment.method && state.total === payment.total
                    && (payment.method !== 'cimb_va' || state.payment?.paymentDetails.bank?.toLowerCase() === 'cimb');
                if (state.phase === 'CREATING') throw new Error('Pembuatan pembayaran perlu diperiksa admin. Jangan membuat tagihan lain.');
                if (state.phase === 'READY') {
                    let status = await this.getTransactionStatus(state.orderId);
                    assertPaymentIdentity(status, state.orderId, state.total);
                    if (mapMidtransStatus(status) === 'paid') throw new Error('Pembayaran sudah diterima. Muat ulang status invoice.');
                    if (status.transaction_status === 'pending' && same && state.payment) return state.payment;
                    if (status.transaction_status === 'pending') {
                        await this.cancelTransaction(state.orderId);
                        status = await this.getTransactionStatus(state.orderId);
                        assertPaymentIdentity(status, state.orderId, state.total);
                    }
                    if (!['expired', 'cancelled'].includes(mapMidtransStatus(status))) throw new Error('Pembayaran sebelumnya belum selesai dikonfirmasi. Muat ulang status atau hubungi admin.');
                    state = null;
                } else if (!same) throw new Error('Lanjutkan metode pembayaran sebelumnya terlebih dahulu.');
            }
            if (!state || state.phase === 'REJECTED') {
                state = { invoiceId: invoice.id, orderId, method: payment.method, total: payment.total, phase: 'CREATING' };
                // Persist BEFORE the external request. A timeout must never silently issue a second order.
                await journal.write(state);
                const response = await this.createSnap(invoice, payment, state.orderId);
                const snap = await response.json().catch(() => ({})) as MidtransSnapResponse;
                if (!response.ok || !snap.token) {
                    if (response.status >= 400 && response.status < 500 && response.status !== 408 && response.status !== 409) {
                        state.phase = 'REJECTED'; await journal.write(state);
                    }
                    throw new Error('Metode pembayaran belum dapat diterbitkan. Pilih metode lain atau hubungi admin.');
                }
                state = { ...state, phase: 'SNAP_READY', token: snap.token };
                await journal.write(state);
            }
            if (!state.token) throw new Error('Riwayat pembayaran perlu diperiksa admin.');
            let data = await issueSnapInBrowser(state.token, this.isProduction);
            if(payment.method==='bsi_va') data={...data,...await this.getTransactionStatus(state.orderId)};
            const result = normalizeSnapPayment(data, payment, state.orderId);
            state = { ...state, phase: 'READY', payment: result };
            await journal.write(state);
            return result;
        });
    }

    private async createSnap(invoice: Invoice, payment: InvoicePaymentBreakdown, orderId: string) {
        const snapPaymentMethod = getSnapPaymentMethod(payment.method);
        return fetch(`${this.baseUrl}/snap/v1/transactions`, {
            method: 'POST',
            cache: 'no-store', signal: AbortSignal.timeout(15000),
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
    }

    get coreBaseUrl() {
        return this.isProduction ? 'https://api.midtrans.com' : 'https://api.sandbox.midtrans.com';
    }

    get baseUrl() {
        return this.isProduction ? 'https://app.midtrans.com' : 'https://app.sandbox.midtrans.com';
    }
}

export function assertPaymentIdentity(data: MidtransNotificationPayload, orderId: string, total: number) {
    if (data.order_id !== orderId || !/^\d+(\.0{1,2})?$/.test(String(data.gross_amount)) || Number(data.gross_amount) !== total) {
        throw new Error('Rincian pembayaran berbeda. Hubungi admin sebelum mencoba lagi.');
    }
}

export function normalizeSnapPayment(data: MidtransChargeResponse, payment: InvoicePaymentBreakdown, orderId: string): InvoiceMidtransPayment {
    assertPaymentIdentity(data, orderId, payment.total);
    if (data.transaction_status !== 'pending' || !data.transaction_id || (data.currency && data.currency !== 'IDR')) throw new Error('Instruksi pembayaran belum dikonfirmasi.');
    const flat = [ ['bsi',data.bsi_va_number],['bni',data.bni_va_number],['bri',data.bri_va_number],['cimb',data.cimb_va_number],['permata',data.permata_va_number] ].find(([,value]) => value);
    const va = data.va_numbers?.[0] ?? (flat ? {bank:flat[0],va_number:flat[1]} : null);
    const expectedBank = ({ bsi_va:'bsi', bni_va:'bni', bri_va:'bri', permata_va:'permata', cimb_va:'cimb', bca_va:'bca', other_va:'bni' } as Record<string,string>)[payment.method];
    if (payment.method === 'qris') {
        if (!['gopay','qris'].includes(data.payment_type ?? '') || !validQrPayload(data.qr_string, payment.total)) throw new Error('QR pembayaran belum dapat diverifikasi.');
    } else if (payment.method === 'mandiri_bill') {
        if (data.payment_type !== 'echannel' || !/^\d{4,20}$/.test(data.biller_code ?? '') || !/^\d{5,30}$/.test(data.bill_key ?? '')) throw new Error('Kode pembayaran belum dapat diverifikasi.');
    } else if (!expectedBank || va?.bank?.toLowerCase() !== expectedBank || !/^\d{8,30}$/.test(va.va_number ?? '')) {
        throw new Error('Nomor rekening pembayaran belum dapat diverifikasi.');
    }
    return { orderId, transactionId:data.transaction_id, paymentType:data.payment_type ?? null, transactionStatus:'pending', expiresAt:normalizeMidtransExpiry(data.expiry_time),
        paymentDetails:{ ...payment, qrCodeUrl:data.qris_url ?? data.qr_code_url ?? data.actions?.find(a => a.name === 'generate-qr-code')?.url ?? null,
            qrString:payment.method === 'qris' ? data.qr_string : null,
            deeplinkUrl:null, bank:va?.bank ?? getPaymentBankLabel(payment.method), vaNumber:va?.va_number ?? null,
            billerCode:data.biller_code ?? null, billKey:data.bill_key ?? null }, rawResponse:data };
}

export function validQrPayload(value: string | undefined, total: number) {
    if (!value || value.length > 4096 || !/^000201/.test(value) || !/6304[0-9A-F]{4}$/.test(value)) return false;
    let crc = 0xffff;
    for (const byte of Buffer.from(value.slice(0,-4))) { crc ^= byte << 8; for (let i=0;i<8;i++) crc = crc & 0x8000 ? ((crc << 1)^0x1021)&0xffff : (crc << 1)&0xffff; }
    if (crc.toString(16).toUpperCase().padStart(4,'0') !== value.slice(-4)) return false;
    const tags = new Map<string,string>();
    for (let offset=0;offset<value.length;) {
        const tag=value.slice(offset,offset+2), length=Number(value.slice(offset+2,offset+4));
        if (!/^\d{4}$/.test(value.slice(offset,offset+4)) || tags.has(tag) || offset+4+length>value.length) return false;
        tags.set(tag,value.slice(offset+4,offset+4+length)); offset+=4+length;
    }
    return tags.get('53') === '360' && tags.get('58') === 'ID' && /^\d+(\.0{1,2})?$/.test(tags.get('54') ?? '') && Number(tags.get('54')) === total;
}

export function createLmsInvoiceMidtransOrderId(invoice: Pick<Invoice, 'id'>, method: InvoicePaymentMethodCode) {
    const suffix = crypto.randomUUID().replace(/-/g, '').slice(0, 16).toUpperCase();
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
            return 'cimb_va';
        case 'other_va':
            return 'bni_va';
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
    let normalized = value.replace(' ', 'T').replace(/ ([+-]\d{2})(\d{2})$/, '$1:$2');
    if(!/(?:Z|[+-]\d{2}:?\d{2})$/.test(normalized))normalized+='+07:00';
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
