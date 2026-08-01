export type InvoicePaymentMethodCode =
    | 'gopay'
    | 'qris'
    | 'mandiri_bill'
    | 'bsi_va'
    | 'bni_va'
    | 'bri_va'
    | 'permata_va'
    | 'cimb_va'
    | 'other_va'
    | 'bca_va';

export interface InvoicePaymentMethodOption {
    code: InvoicePaymentMethodCode;
    label: string;
    description: string;
    feePercent: number;
    feeFixed?: number;
    feeVatPercent?: number;
    feeLabel: string;
    disabled?: boolean;
    badge?: string;
}

export interface InvoicePaymentBreakdown {
    method: InvoicePaymentMethodCode;
    label: string;
    feePercent: number;
    feeFixed?: number;
    feeVatPercent?: number;
    feeLabel: string;
    baseAmount: number;
    adminFee: number;
    total: number;
}

export interface PublicInvoicePaymentOption extends InvoicePaymentMethodOption {
    adminFee: number;
    total: number;
}

export interface PublicInvoicePaymentInstruction {
    method: string;
    label: string;
    baseAmount: number;
    adminFee: number;
    total: number;
    feeLabel: string;
    bank: string | null;
    vaNumber: string | null;
    billerCode: string | null;
    billKey: string | null;
    deeplinkUrl: string | null;
    qrImageUrl: string | null;
}

export function getInvoicePaymentOptions(): InvoicePaymentMethodOption[] {
    const qrGoPayPercent = getPercentEnv(
        'MIDTRANS_QR_GOPAY_ADMIN_FEE_PERCENT',
        getPercentEnv('MIDTRANS_GOPAY_ADMIN_FEE_PERCENT', 2)
    );
    const vaFixedFee = getNumberEnv('MIDTRANS_VA_ADMIN_FEE_FIXED', 4_000);
    const vaVatPercent = getPercentEnv('MIDTRANS_FEE_VAT_PERCENT', 11);
    const vaFeeLabel = vaFixedFee > 0 ? `${formatRupiah(vaFixedFee)} + PPN` : 'Tanpa biaya admin';

    return [
        {
            code: 'gopay',
            label: 'GoPay',
            description: 'Bayar langsung melalui aplikasi GoPay atau halaman pembayaran GoPay.',
            feePercent: qrGoPayPercent,
            feeLabel: qrGoPayPercent > 0 ? `${formatPercent(qrGoPayPercent)} dari total transaksi` : 'Tanpa biaya admin'
        },
        {
            code: 'qris',
            label: 'QR GoPay',
            description: 'Scan QR pembayaran dari invoice.',
            feePercent: qrGoPayPercent,
            feeLabel: qrGoPayPercent > 0 ? `${formatPercent(qrGoPayPercent)} dari total transaksi` : 'Tanpa biaya admin'
        },
        {
            code: 'bsi_va',
            label: 'BSI Virtual Account',
            description: 'Nomor BSI VA langsung tampil di invoice.',
            feePercent: 0,
            feeFixed: vaFixedFee,
            feeVatPercent: vaVatPercent,
            feeLabel: vaFeeLabel
        },
        {
            code: 'bni_va',
            label: 'BNI Virtual Account',
            description: 'Nomor BNI VA langsung tampil di invoice.',
            feePercent: 0,
            feeFixed: vaFixedFee,
            feeVatPercent: vaVatPercent,
            feeLabel: vaFeeLabel
        },
        {
            code: 'bri_va',
            label: 'BRI Virtual Account',
            description: 'Nomor BRI VA langsung tampil di invoice.',
            feePercent: 0,
            feeFixed: vaFixedFee,
            feeVatPercent: vaVatPercent,
            feeLabel: vaFeeLabel
        },
        {
            code: 'permata_va',
            label: 'Permata Virtual Account',
            description: 'Nomor Permata VA langsung tampil di invoice.',
            feePercent: 0,
            feeFixed: vaFixedFee,
            feeVatPercent: vaVatPercent,
            feeLabel: vaFeeLabel
        },
        {
            code: 'cimb_va',
            label: 'CIMB Niaga Virtual Account',
            description: 'Nomor CIMB Niaga VA langsung tampil di invoice.',
            feePercent: 0,
            feeFixed: vaFixedFee,
            feeVatPercent: vaVatPercent,
            feeLabel: vaFeeLabel
        },
        {
            code: 'mandiri_bill',
            label: 'Mandiri Bill',
            description: 'Bayar dengan Biller Code dan Bill Key Mandiri.',
            feePercent: 0,
            feeFixed: vaFixedFee,
            feeVatPercent: vaVatPercent,
            feeLabel: vaFeeLabel
        },
        {
            code: 'other_va',
            label: 'Bank Lain',
            description: 'Virtual Account untuk jaringan bank lain.',
            feePercent: 0,
            feeFixed: vaFixedFee,
            feeVatPercent: vaVatPercent,
            feeLabel: vaFeeLabel
        },
        {
            code: 'bca_va',
            label: 'BCA Virtual Account',
            description: 'BCA VA sedang disiapkan.',
            feePercent: 0,
            feeFixed: vaFixedFee,
            feeVatPercent: vaVatPercent,
            feeLabel: vaFeeLabel,
            disabled: true,
            badge: 'Coming soon'
        }
    ];
}

export function getPublicInvoicePaymentOptions(baseAmount: number): PublicInvoicePaymentOption[] {
    return getInvoicePaymentOptions().map((option) => {
        const adminFee = calculateInvoicePaymentAdminFee(baseAmount, option);
        return {
            ...option,
            adminFee,
            total: Math.max(0, Math.round(baseAmount)) + adminFee
        };
    });
}

export function getInvoicePaymentOption(requested: string | null | undefined) {
    const options = getInvoicePaymentOptions();
    return options.find((option) => option.code === requested && !option.disabled) ?? null;
}

export function buildInvoicePaymentBreakdown(
    requested: string | null | undefined,
    baseAmount: number
): InvoicePaymentBreakdown | null {
    const option = getInvoicePaymentOption(requested);
    if (!option) return null;

    const normalizedBase = Math.max(0, Math.round(Number(baseAmount) || 0));
    const adminFee = calculateInvoicePaymentAdminFee(normalizedBase, option);

    return {
        method: option.code,
        label: option.label,
        feePercent: option.feePercent,
        feeFixed: option.feeFixed,
        feeVatPercent: option.feeVatPercent,
        feeLabel: option.feeLabel,
        baseAmount: normalizedBase,
        adminFee,
        total: normalizedBase + adminFee
    };
}

export function calculateInvoicePaymentAdminFee(
    amount: number,
    option: Pick<InvoicePaymentMethodOption, 'feePercent' | 'feeFixed' | 'feeVatPercent'>
) {
    if (!Number.isFinite(amount) || amount <= 0) return 0;

    if (option.feePercent > 0) {
        const rate = option.feePercent / 100;
        if (rate >= 1) return 0;
        return Math.ceil(amount / (1 - rate)) - amount;
    }

    const fixedFee = Math.max(0, option.feeFixed ?? 0);
    const feeVat = Math.ceil((fixedFee * Math.max(0, option.feeVatPercent ?? 0)) / 100);
    return fixedFee + feeVat;
}

function getPercentEnv(name: string, fallback: number) {
    const raw = process.env[name];
    if (!raw) return fallback;
    const value = Number(raw.replace(',', '.'));
    return Number.isFinite(value) && value >= 0 ? value : fallback;
}

function getNumberEnv(name: string, fallback: number) {
    const raw = process.env[name];
    if (!raw) return fallback;
    const value = Number(raw.replace(/[^\d.-]/g, ''));
    return Number.isFinite(value) && value >= 0 ? value : fallback;
}

function formatPercent(value: number) {
    return `${value.toLocaleString('id-ID', { maximumFractionDigits: 2 })}%`;
}

function formatRupiah(value: number) {
    return `Rp${Math.round(value).toLocaleString('id-ID')}`;
}
