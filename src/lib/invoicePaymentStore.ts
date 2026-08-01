import 'server-only';

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { InvoiceMidtransPayment, MidtransNotificationPayload } from '@/lib/invoiceMidtransClient';
import type { PublicInvoicePaymentInstruction } from '@/lib/invoicePaymentMethods';

export type StoredInvoicePayment = {
    invoiceId: string;
    invoiceNumber: string;
    orderId: string;
    method: string;
    label: string;
    baseAmount: number;
    adminFee: number;
    total: number;
    transactionId: string | null;
    paymentType: string | null;
    transactionStatus: string | null;
    expiresAt: string | null;
    paymentDetails: InvoiceMidtransPayment['paymentDetails'];
    rawResponse: InvoiceMidtransPayment['rawResponse'];
    notificationPayload?: MidtransNotificationPayload | null;
    paidAt?: string | null;
    updatedAt: string;
    createdAt: string;
};

export async function saveStoredInvoicePayment(input: {
    invoiceId: string;
    invoiceNumber: string;
    payment: InvoiceMidtransPayment;
}) {
    const now = new Date().toISOString();
    const record: StoredInvoicePayment = {
        invoiceId: input.invoiceId,
        invoiceNumber: input.invoiceNumber,
        orderId: input.payment.orderId,
        method: input.payment.paymentDetails.method,
        label: input.payment.paymentDetails.label,
        baseAmount: input.payment.paymentDetails.baseAmount,
        adminFee: input.payment.paymentDetails.adminFee,
        total: input.payment.paymentDetails.total,
        transactionId: input.payment.transactionId,
        paymentType: input.payment.paymentType,
        transactionStatus: input.payment.transactionStatus,
        expiresAt: input.payment.expiresAt,
        paymentDetails: input.payment.paymentDetails,
        rawResponse: input.payment.rawResponse,
        updatedAt: now,
        createdAt: now
    };

    await Promise.all([
        writeJson(invoicePath(input.invoiceId), record),
        writeJson(orderPath(input.payment.orderId), record)
    ]);

    return record;
}

export async function getStoredInvoicePaymentByInvoiceId(invoiceId: string) {
    return readJson<StoredInvoicePayment>(invoicePath(invoiceId));
}

export async function getStoredInvoicePaymentByOrderId(orderId: string) {
    return readJson<StoredInvoicePayment>(orderPath(orderId));
}

export async function updateStoredInvoicePaymentStatus(
    orderId: string,
    payload: MidtransNotificationPayload,
    paidAt?: string | null
) {
    const existing = await getStoredInvoicePaymentByOrderId(orderId);
    if (!existing) return null;

    const updated: StoredInvoicePayment = {
        ...existing,
        transactionId: payload.transaction_id ?? existing.transactionId,
        paymentType: payload.payment_type ?? existing.paymentType,
        transactionStatus: payload.transaction_status ?? existing.transactionStatus,
        notificationPayload: payload,
        paidAt: paidAt ?? existing.paidAt ?? null,
        updatedAt: new Date().toISOString()
    };

    await Promise.all([
        writeJson(invoicePath(existing.invoiceId), updated),
        writeJson(orderPath(orderId), updated)
    ]);

    return updated;
}

export function toPublicStoredInvoicePayment(
    stored: StoredInvoicePayment,
    token: string,
): PublicInvoicePaymentInstruction {
    return {
        method: stored.method,
        label: stored.label,
        baseAmount: stored.baseAmount,
        adminFee: stored.adminFee,
        total: stored.total,
        feeLabel: stored.paymentDetails.feeLabel,
        bank: stored.paymentDetails.bank,
        vaNumber: stored.paymentDetails.vaNumber,
        billerCode: stored.paymentDetails.billerCode,
        billKey: stored.paymentDetails.billKey,
        deeplinkUrl: stored.paymentDetails.deeplinkUrl,
        qrImageUrl: stored.method === 'qris'
            ? `/api/invoices/${encodeURIComponent(stored.invoiceId)}/payment-qr?t=${encodeURIComponent(token)}&order=${encodeURIComponent(stored.orderId)}`
            : null
    };
}

function storeRoot() {
    return process.env.LMS_INVOICE_PAYMENT_STORE_DIR
        || path.join(process.cwd(), '.data', 'invoice-payments');
}

function invoicePath(invoiceId: string) {
    return path.join(storeRoot(), 'invoices', `${safeFileName(invoiceId)}.json`);
}

function orderPath(orderId: string) {
    return path.join(storeRoot(), 'orders', `${safeFileName(orderId)}.json`);
}

async function writeJson(filePath: string, data: unknown) {
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

async function readJson<T>(filePath: string): Promise<T | null> {
    try {
        return JSON.parse(await readFile(filePath, 'utf8')) as T;
    } catch {
        return null;
    }
}

function safeFileName(value: string) {
    return value.replace(/[^a-zA-Z0-9_-]/g, '-');
}
