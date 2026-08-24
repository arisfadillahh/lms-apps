'use client';

import Image from 'next/image';
import { useState, type CSSProperties } from 'react';
import type { PublicInvoice } from '@/lib/publicInvoice';
import type { PublicInvoicePaymentInstruction, PublicInvoicePaymentOption } from '@/lib/invoicePaymentMethods';

interface BankInfo {
    bank_name: string;
    bank_account_number: string;
    bank_account_holder: string;
    admin_whatsapp_number: string;
    weekly_invoice_message_template?: string; // Optional because legacy data might not have it yet
}

interface Props {
    invoice: PublicInvoice;
    publicToken?: string | null;
    paymentOptions: PublicInvoicePaymentOption[];
    initialPayment?: PublicInvoicePaymentInstruction | null;
    bankInfo: BankInfo | null;
}

type PaymentInstruction = PublicInvoicePaymentInstruction;

// Clevio Brand Colors
const COLORS = {
    primaryBlue: '#22367b', // Biru Dongker Clevio (Navy)
    primaryGreen: '#9dc83b', // Hijau Clevio (Vibrant Lime)
    primaryCyan: '#00b0d7',  // Cyan Clevio
    white: '#ffffff',
    lightGray: '#F3F4F6',
    mediumGray: '#9CA3AF',
    darkGray: '#374151',
    borderGray: '#E5E7EB',
    textDark: '#1F2937',
    textGray: '#6B7280',
};

export default function InvoiceView({ invoice, publicToken, paymentOptions, initialPayment, bankInfo }: Props) {
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [selectedPayment, setSelectedPayment] = useState<PaymentInstruction | null>(() => {
        return initialPayment ?? buildInitialPaymentInstruction(invoice, publicToken ?? null);
    });
    const [paymentLoadingMethod, setPaymentLoadingMethod] = useState<string | null>(null);
    const [paymentError, setPaymentError] = useState<string | null>(null);
    const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('id-ID').format(amount);
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('id-ID', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });
    };

    const getMonthName = (month: number) => {
        const months = [
            'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
            'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
        ];
        return months[month - 1] || '';
    };

    const formatPeriodRange = (startDate: string, endDate: string) => {
        const start = new Date(startDate);
        const end = new Date(endDate);

        const startMonth = getMonthName(start.getMonth() + 1);
        const startYear = start.getFullYear();

        const endMonth = getMonthName(end.getMonth() + 1);
        const endYear = end.getFullYear();

        // Same month and year: "Januari 2026"
        if (start.getMonth() === end.getMonth() && startYear === endYear) {
            return `${startMonth} ${startYear}`;
        }

        // Same year, different months: "Januari - Maret 2026"
        if (startYear === endYear) {
            return `${startMonth} - ${endMonth} ${startYear}`;
        }

        // Different years: "Desember 2025 - Februari 2026"
        return `${startMonth} ${startYear} - ${endMonth} ${endYear}`;
    };

    const handleContactAdmin = () => {
        if (bankInfo?.admin_whatsapp_number) {
            const phone = bankInfo.admin_whatsapp_number.replace(/\D/g, '');
            const normalizedPhone = phone.startsWith('0') ? '62' + phone.substring(1) : phone;

            window.open(`https://wa.me/${normalizedPhone}`, '_blank');
        }
    };

    const isPaid = invoice.status === 'PAID';

    const handleChoosePaymentMethod = async (method: string) => {
        if (!publicToken) {
            setPaymentError('Link invoice tidak valid. Silakan buka ulang link dari WhatsApp.');
            return;
        }

        setPaymentError(null);
        setCopyFeedback(null);
        setPaymentLoadingMethod(method);

        try {
            const response = await fetch(`/api/invoices/${encodeURIComponent(invoice.id)}/payment-method`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ method, token: publicToken })
            });
            const data = await response.json().catch(() => ({}));

            if (!response.ok || !data.payment) {
                throw new Error(data.error || 'Gagal membuat metode pembayaran.');
            }

            setSelectedPayment(data.payment);
            setIsPaymentModalOpen(false);
        } catch (error) {
            setPaymentError(error instanceof Error ? error.message : 'Gagal membuat metode pembayaran.');
        } finally {
            setPaymentLoadingMethod(null);
        }
    };

    const handleCopy = async (value: string, label: string) => {
        try {
            await navigator.clipboard.writeText(value);
            setCopyFeedback(`${label} disalin`);
        } catch {
            setCopyFeedback(`Gagal menyalin ${label}`);
        }
    };

    return (
        <div style={containerStyle} className="invoice-container">
            <div style={invoiceCardStyle} className="invoice-card">
                {/* Header - Textured Background */}
                <div style={headerStyle}>
                    <div style={headerContentStyle} className="header-content">
                        <div style={companyInfoStyle}>
                            <Image
                                src="/images/clevio-logo.png.png?v=2"
                                alt="Clevio Innovator Camp"
                                width={180}
                                height={60}
                                style={{ objectFit: 'contain' }}
                                unoptimized
                            />
                        </div>

                        {/* Right Side: Invoice Title Only */}
                        <div style={invoiceTitleSectionStyle} className="invoice-title-section">
                            <h1 style={invoiceTitleStyle}>INVOICE</h1>
                            <div style={invoiceNoStyle}>#{invoice.invoice_number}</div>
                            {/* Hide CCR for REG (Registration) invoices */}
                            {invoice.ccr && invoice.invoice_type !== 'REGISTRATION' && (
                                <div style={ccrStyle}>CCR: {invoice.ccr.ccr_code}</div>
                            )}
                        </div>
                    </div>
                    {/* Decorative Circles (Restored) */}
                    <div style={circleDecoration1}></div>
                    <div style={circleDecoration2}></div>
                </div>

                {/* Overlapping Info Cards Area */}
                <div style={infoSectionContainerStyle} className="info-section-container">
                    <div style={infoGridStyle} className="info-grid">
                        {/* Left Card: Invoice To + Dates + Status */}
                        <div style={floatingCardStyle}>
                            <div style={cardHeaderStyle}>
                                <span style={cardTitleDotStyle}></span>
                                INVOICE TO
                            </div>
                            <div style={cardContentStyle}>
                                {/* Parent Info */}
                                <div style={{ marginBottom: '20px' }}>
                                    <div style={recipientNameStyle}>
                                        {invoice.parent_name || invoice.seasonal_student_name}
                                    </div>
                                    <div style={recipientDetailStyle}>
                                        <strong>No. Telp:</strong> {invoice.parent_phone || invoice.seasonal_student_phone}
                                    </div>
                                </div>

                                {/* Dates & Status Section */}
                                <div style={datesContainerStyle}>
                                    <div style={dateItemStyle}>
                                        <span style={dateLabelStyle}>Tanggal:</span>
                                        <span style={dateValueStyle}>{formatDate(invoice.created_at)}</span>
                                    </div>
                                    <div style={dateItemStyle}>
                                        <span style={dateLabelStyle}>Jatuh Tempo:</span>
                                        <span style={dateValueStyle}>{formatDate(invoice.due_date)}</span>
                                    </div>
                                    {/* Only show status badge if NOT paid (to avoid duplicate LUNAS text) */}
                                    {!isPaid && (
                                        <div style={{ marginTop: '8px' }}>
                                            {getStatusBadge(invoice.status)}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Right Card: Payment Info / Status */}
                        <div style={floatingCardStyle}>
                            <div style={cardHeaderStyle}>
                                <span style={{ ...cardTitleDotStyle, backgroundColor: COLORS.primaryGreen }}></span>
                                {isPaid ? 'STATUS PEMBAYARAN' : 'METODE PEMBAYARAN'}
                            </div>
                            <div style={cardContentStyle}>
                                {!isPaid ? (
                                    <PaymentMethodCard
                                        payment={selectedPayment}
                                        onOpenModal={() => setIsPaymentModalOpen(true)}
                                        onContactAdmin={bankInfo ? handleContactAdmin : undefined}
                                        onCopy={handleCopy}
                                        copyFeedback={copyFeedback}
                                        formatCurrency={formatCurrency}
                                    />
                                ) : isPaid ? (
                                    <div style={paidStatusContainerStyle}>
                                        <div style={paidCheckmarkStyle}>✓</div>
                                        <div style={paidTextStyle}>LUNAS</div>
                                        <div style={paidDateStyle}>{formatDate(invoice.paid_at || '')}</div>
                                    </div>
                                ) : (
                                    <div style={emptyStateStyle}>Silakan hubungi admin</div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Content Body */}
                <div style={bodyContentStyle} className="body-content">
                    {/* Items Table - Different display for REG invoices */}
                    <div style={tableContainerStyle} className="table-container">
                        {invoice.invoice_type === 'REGISTRATION' ? (
                            /* REG Invoice: Group items by student with same header as standard */
                            <table style={tableStyle}>
                                <thead>
                                    <tr>
                                        <th style={{ ...thStyle, borderTopLeftRadius: '10px', borderBottomLeftRadius: '10px', paddingLeft: '20px', width: '60px', textAlign: 'center' }}>No.</th>
                                        <th style={{ ...thStyle, textAlign: 'left' }}>Deskripsi Program</th>
                                        <th style={{ ...thStyle, width: '150px', textAlign: 'center' }}>Harga</th>
                                        <th style={{ ...thStyle, width: '120px', textAlign: 'center' }}>Diskon</th>
                                        <th style={{ ...thStyle, borderTopRightRadius: '10px', borderBottomRightRadius: '10px', paddingRight: '20px', width: '150px', textAlign: 'right' }}>Total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(() => {
                                        // Group items by coder_name
                                        const studentGroups: Record<string, typeof invoice.items> = {};
                                        invoice.items?.forEach(item => {
                                            const key = item.coder_name || 'Unknown';
                                            if (!studentGroups[key]) studentGroups[key] = [];
                                            studentGroups[key]!.push(item);
                                        });

                                        return Object.entries(studentGroups).map(([studentName, items], idx) => {
                                            const subtotal = items!.reduce((sum, item) => sum + item.final_price, 0);

                                            return (
                                                <tr key={studentName} style={trStyle}>
                                                    <td style={{ ...tdStyle, borderTopLeftRadius: '10px', borderBottomLeftRadius: '10px', paddingLeft: '20px', textAlign: 'center', color: COLORS.textDark, fontWeight: 700, verticalAlign: 'top', paddingTop: '20px' }}>
                                                        {String(idx + 1).padStart(2, '0')}
                                                    </td>
                                                    {/* Merged Cell for Student Name & Items Breakdown */}
                                                    <td colSpan={4} style={{ padding: 0 }}>
                                                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                                            <tbody>
                                                                {/* Student Name Header Row */}
                                                                <tr>
                                                                    <td colSpan={4} style={{ ...tdStyle, border: 'none', padding: '20px 0 10px 0' }}>
                                                                        <div style={{ ...itemNameStyle, fontSize: '16px' }}>{studentName}</div>
                                                                    </td>
                                                                </tr>
                                                                {/* Detailed Items Rows */}
                                                                {items!.map((item, i) => (
                                                                    <tr key={item.id}>
                                                                        <td style={{ ...tdStyle, border: 'none', padding: '5px 0', width: 'auto' }}>
                                                                            <div style={{ fontSize: '13px', color: COLORS.textGray }}>
                                                                                • {item.class_name} - {item.level_name}
                                                                            </div>
                                                                        </td>
                                                                        <td style={{ ...tdStyle, border: 'none', padding: '5px 0', width: '150px', textAlign: 'center' }}>
                                                                            Rp {formatCurrency(item.base_price)}
                                                                        </td>
                                                                        <td style={{ ...tdStyle, border: 'none', padding: '5px 0', width: '120px', textAlign: 'center' }}>
                                                                            {item.discount_amount > 0 ? (
                                                                                <span style={discountTagStyle}>-Rp {formatCurrency(item.discount_amount)}</span>
                                                                            ) : '-'}
                                                                        </td>
                                                                        <td style={{ ...tdStyle, border: 'none', padding: '5px 20px 5px 0', width: '150px', textAlign: 'right' }}>
                                                                            <span style={{ fontWeight: 'bold' }}>Rp {formatCurrency(item.final_price)}</span>
                                                                        </td>
                                                                    </tr>
                                                                ))}
                                                                {/* Start Date Only (Subtotal removed) */}
                                                                <tr>
                                                                    <td colSpan={4} style={{ ...tdStyle, border: 'none', paddingTop: '15px', paddingBottom: '20px' }}>
                                                                        <div style={{ fontSize: '12px', color: COLORS.primaryCyan }}>
                                                                            Mulai Kelas : {formatDate(invoice.period_start_date)}
                                                                        </div>
                                                                    </td>
                                                                </tr>
                                                            </tbody>
                                                        </table>
                                                    </td>
                                                </tr>
                                            );
                                        });
                                    })()}
                                </tbody>
                            </table>
                        ) : (
                            /* Standard Invoice: Show each item separately */
                            <table style={tableStyle}>
                                <thead>
                                    <tr>
                                        <th style={{ ...thStyle, borderTopLeftRadius: '10px', borderBottomLeftRadius: '10px', paddingLeft: '20px', width: '60px', textAlign: 'center' }}>No.</th>
                                        <th style={{ ...thStyle, textAlign: 'left' }}>Deskripsi Produk</th>
                                        <th style={{ ...thStyle, width: '150px', textAlign: 'center' }}>Harga</th>
                                        <th style={{ ...thStyle, width: '120px', textAlign: 'center' }}>Diskon</th>
                                        <th style={{ ...thStyle, borderTopRightRadius: '10px', borderBottomRightRadius: '10px', paddingRight: '20px', width: '150px', textAlign: 'right' }}>Total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {invoice.items?.map((item, index) => (
                                        <tr key={item.id} style={trStyle}>
                                            <td style={{ ...tdStyle, borderTopLeftRadius: '10px', borderBottomLeftRadius: '10px', paddingLeft: '20px', textAlign: 'center', color: COLORS.textDark, fontWeight: 700 }}>
                                                {String(index + 1).padStart(2, '0')}
                                            </td>
                                            <td style={tdStyle}>
                                                <div style={itemNameStyle}>{item.class_name} - {item.level_name}</div>
                                                <div style={itemSubStyle}>
                                                    Siswa: {invoice.invoice_type === 'SEASONAL'
                                                        ? invoice.seasonal_student_name
                                                        : (item.coder_name || invoice.parent_name)}
                                                </div>
                                                {item.description && (
                                                    <div style={{ ...itemSubStyle, marginTop: '4px', fontStyle: 'italic', fontSize: '12px' }}>
                                                        • {item.description}
                                                    </div>
                                                )}
                                            </td>
                                            <td style={{ ...tdStyle, textAlign: 'center' }}>Rp {formatCurrency(item.base_price)}</td>
                                            <td style={{ ...tdStyle, textAlign: 'center' }}>
                                                {item.discount_amount > 0 ? (
                                                    <span style={discountTagStyle}>-Rp {formatCurrency(item.discount_amount)}</span>
                                                ) : '-'}
                                            </td>
                                            <td style={{ ...tdStyle, borderTopRightRadius: '10px', borderBottomRightRadius: '10px', paddingRight: '20px', textAlign: 'right', fontWeight: 'bold', color: COLORS.primaryBlue }}>
                                                Rp {formatCurrency(item.final_price)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>


                    {/* Total Section with Terms Side by Side */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '30px', marginTop: '30px' }} className="total-section">
                        {/* Left: Terms & Conditions */}
                        <div style={{ flex: 1 }}>
                            <div style={termsHeaderStyle}>Syarat & Ketentuan:</div>
                            <ul style={{ margin: '8px 0 0 0', paddingLeft: '20px', fontSize: '11px', color: COLORS.textGray, lineHeight: 1.6 }}>
                                <li>Pembayaran dilakukan dengan memilih metode pembayaran pada invoice ini.</li>
                                <li>Total bayar dapat berubah sesuai biaya admin metode pembayaran yang dipilih.</li>
                                <li>Status pembayaran diperbarui otomatis setelah pembayaran berhasil diproses.</li>
                                <li>Invoice yang telah melewati tanggal jatuh tempo akan dikenakan status OVERDUE.</li>
                            </ul>
                            {/* Period only for non-REG invoices */}
                            {invoice.invoice_type !== 'REGISTRATION' && (
                                <div style={{ ...periodContainerStyle, marginTop: '15px' }}>
                                    <div style={periodLabelStyle}>Periode:</div>
                                    <div style={periodValueStyle}>{formatPeriodRange(invoice.period_start_date, invoice.period_end_date)}</div>
                                </div>
                            )}
                        </div>
                        {/* Right: Total */}
                        <div style={totalPillStyle}>
                            <div style={totalLabelPillStyle}>Total Tagihan:</div>
                            <div style={totalAmountPillStyle}>Rp {formatCurrency(invoice.total_amount)}</div>
                        </div>
                    </div>

                    {/* Thank You Message - Centered at Bottom */}
                    <div style={{ textAlign: 'center', marginTop: '30px', paddingBottom: '20px' }}>
                        <div style={{ fontSize: '14px', fontWeight: 600, color: COLORS.primaryBlue }}>
                            Clevio Innovator Camp - Let&apos;s Innovate!
                        </div>
                    </div>
                </div>
            </div>

            {isPaymentModalOpen && (
                <PaymentMethodModal
                    options={paymentOptions}
                    loadingMethod={paymentLoadingMethod}
                    error={paymentError}
                    onClose={() => {
                        if (!paymentLoadingMethod) {
                            setIsPaymentModalOpen(false);
                            setPaymentError(null);
                        }
                    }}
                    onChoose={handleChoosePaymentMethod}
                    formatCurrency={formatCurrency}
                />
            )}

            {/* Print Button */}
            <div style={printContainerStyle}>
                <button onClick={() => window.print()} style={printButtonStyle}>
                    🖨️ Cetak / Simpan PDF
                </button>
            </div>

            {/* Print Styles & Desktop-like Mobile */}
            <style jsx global>{`
                /* Print Settings - Full Bleed Invoice */
                @media print {
                    @page {
                        size: A4;
                        margin: 0; /* No margin - edge to edge */
                    }
                    
                    html, body {
                        -webkit-print-color-adjust: exact;
                        print-color-adjust: exact;
                        margin: 0 !important;
                        padding: 0 !important;
                        background: white !important;
                        width: 100% !important;
                        height: 100% !important;
                    }
                    
                    /* Hide non-printable elements */
                    button { display: none !important; }
                    
                    /* Remove gray container completely */
                    .invoice-container {
                        background: transparent !important;
                        padding: 0 !important;
                        margin: 0 !important;
                        min-width: 100% !important;
                        width: 100% !important;
                        min-height: unset !important;
                        overflow: visible !important;
                    }
                    
                    /* Invoice card fills entire page - edge to edge */
                    .invoice-card { 
                        box-shadow: none !important; 
                        margin: 0 !important; 
                        max-width: 100% !important; 
                        width: 100% !important;
                        border-radius: 0 !important;
                        /* No transform - fill full width */
                    }

                    /* Header fills full width */
                    .invoice-card > div:first-child {
                        border-radius: 0 !important;
                    }

                    /* Adjust inner spacing for print */
                    .info-section-container {
                        margin-top: -60px !important;
                        padding: 0 40px !important;
                    }
                    .body-content {
                        padding: 20px 40px !important;
                    }
                    .footer {
                        padding: 20px 40px !important;
                    }
                }
            `}</style>
        </div>
    );

    function getStatusBadge(status: string) {
        const styles: Record<string, CSSProperties> = {
            PENDING: {
                backgroundColor: '#FEF3C7',
                color: '#92400E',
                padding: '4px 12px',
                borderRadius: '12px',
                fontSize: '11px',
                fontWeight: 700,
                border: '1px solid #FCD34D',
                display: 'inline-block'
            },
            PAID: {
                backgroundColor: '#D1FAE5',
                color: '#065F46',
                padding: '4px 12px',
                borderRadius: '12px',
                fontSize: '11px',
                fontWeight: 700,
                border: '1px solid #6EE7B7',
                display: 'inline-block'
            },
            OVERDUE: {
                backgroundColor: '#FEE2E2',
                color: '#991B1B',
                padding: '4px 12px',
                borderRadius: '12px',
                fontSize: '11px',
                fontWeight: 700,
                border: '1px solid #FCA5A5',
                display: 'inline-block'
            }
        };
        const labels: Record<string, string> = {
            PENDING: 'Menunggu Pembayaran',
            PAID: 'Lunas',
            OVERDUE: 'Jatuh Tempo'
        };
        return <span style={styles[status] || styles.PENDING}>{labels[status] || status}</span>;
    }
}

function buildInitialPaymentInstruction(invoice: PublicInvoice, publicToken: string | null): PaymentInstruction | null {
    if (!invoice.payment_method || !invoice.midtrans_order_id || !invoice.midtrans_payment_details) return null;
    if (!publicToken) return null;
    const details = invoice.midtrans_payment_details;
    if (!details || typeof details !== 'object') return null;
    const value = details as Record<string, unknown>;
    const method = readString(value, 'method') || invoice.payment_method;

    return {
        method,
        label: readString(value, 'label') || invoice.payment_method_label || 'Metode pembayaran',
        baseAmount: readNumber(value, 'baseAmount') || invoice.payment_base_amount || invoice.total_amount,
        adminFee: readNumber(value, 'adminFee') ?? invoice.payment_admin_fee ?? 0,
        total: readNumber(value, 'total') || invoice.payment_total_amount || invoice.total_amount,
        feeLabel: readString(value, 'feeLabel') || '',
        bank: readString(value, 'bank'),
        vaNumber: readString(value, 'vaNumber'),
        billerCode: readString(value, 'billerCode'),
        billKey: readString(value, 'billKey'),
        deeplinkUrl: readString(value, 'deeplinkUrl'),
        qrImageUrl: method === 'qris'
            ? `/api/invoices/${encodeURIComponent(invoice.id)}/payment-qr?t=${encodeURIComponent(publicToken)}&order=${encodeURIComponent(invoice.midtrans_order_id)}`
            : null
    };
}

function PaymentMethodCard({
    payment,
    onOpenModal,
    onContactAdmin,
    onCopy,
    copyFeedback,
    formatCurrency
}: {
    payment: PaymentInstruction | null;
    onOpenModal: () => void;
    onContactAdmin?: () => void;
    onCopy: (value: string, label: string) => void;
    copyFeedback: string | null;
    formatCurrency: (amount: number) => string;
}) {
    if (!payment) {
        return (
            <div style={paymentEmptyCardStyle}>
                <div style={paymentEmptyTitleStyle}>Pilih metode pembayaran</div>
                <div style={paymentEmptyTextStyle}>Pilih QR atau Virtual Account. Biaya admin akan ditampilkan sebelum metode dipakai.</div>
                <button onClick={onOpenModal} style={primaryPaymentButtonStyle}>
                    Pilih Metode Pembayaran
                </button>
                {onContactAdmin && (
                    <button onClick={onContactAdmin} style={secondaryPaymentButtonStyle}>
                        Hubungi Admin
                    </button>
                )}
            </div>
        );
    }

    const isQr = payment.method === 'qris';
    const isGoPay = payment.method === 'gopay';
    const isMandiriBill = payment.billerCode || payment.billKey;
    const copyValue = isMandiriBill
        ? [payment.billerCode, payment.billKey].filter(Boolean).join(' / ')
        : payment.vaNumber;

    return (
        <div style={paymentInstructionStyle}>
            <div style={paymentMethodLabelStyle}>{payment.label}</div>
            <div style={paymentBreakdownStyle}>
                <div style={paymentBreakdownRowStyle}>
                    <span>Tagihan</span>
                    <strong>Rp {formatCurrency(payment.baseAmount)}</strong>
                </div>
                <div style={paymentBreakdownRowStyle}>
                    <span>Biaya admin</span>
                    <strong>Rp {formatCurrency(payment.adminFee)}</strong>
                </div>
                <div style={paymentTotalRowStyle}>
                    <span>Total bayar</span>
                    <strong>Rp {formatCurrency(payment.total)}</strong>
                </div>
            </div>

            {isQr && payment.qrImageUrl ? (
                <div style={qrBoxStyle}>
                    <img src={payment.qrImageUrl} alt="QR pembayaran" style={qrImageStyle} />
                    <a href={payment.qrImageUrl} download style={downloadQrButtonStyle}>
                        Unduh QR
                    </a>
                    {payment.deeplinkUrl && (
                        <a href={payment.deeplinkUrl} target="_blank" rel="noreferrer" style={secondaryLinkButtonStyle}>
                            Buka Pembayaran
                        </a>
                    )}
                </div>
            ) : isGoPay ? (
                <div style={goPayBoxStyle}>
                    <div style={goPayIntroStyle}>
                        <span style={goPayIconStyle} aria-hidden="true">
                            <img src="/gopay-wallet.png" alt="" style={goPayIconImageStyle} />
                        </span>
                        <div>
                            <div style={goPayNameStyle}>GoPay</div>
                            <div style={goPayDescriptionStyle}>Tombol di bawah akan membuka aplikasi GoPay untuk melanjutkan pembayaran.</div>
                        </div>
                    </div>
                    {payment.deeplinkUrl ? (
                        <a href={payment.deeplinkUrl} style={goPayDirectButtonStyle} aria-label="Bayar melalui aplikasi GoPay">
                            <img src="/gopay-wallet.png" alt="" aria-hidden="true" style={goPayButtonIconStyle} />
                            Bayar via GoPay
                        </a>
                    ) : (
                        <div style={emptyStateStyle}>Link GoPay belum tersedia.</div>
                    )}
                </div>
            ) : isMandiriBill ? (
                <div style={vaBoxStyle}>
                    <div style={vaBankStyle}>{payment.bank || 'Mandiri'}</div>
                    <div style={vaNumberLabelStyle}>Biller Code</div>
                    <div style={vaNumberStyle}>{payment.billerCode}</div>
                    <div style={vaNumberLabelStyle}>Bill Key</div>
                    <div style={vaNumberStyle}>{payment.billKey}</div>
                    {copyValue && (
                        <button onClick={() => onCopy(copyValue, 'Kode bayar')} style={copyVaButtonStyle}>
                            Copy Kode Bayar
                        </button>
                    )}
                </div>
            ) : payment.vaNumber ? (
                <div style={vaBoxStyle}>
                    <div style={vaBankStyle}>{payment.bank || 'Virtual Account'}</div>
                    <div style={vaNumberLabelStyle}>Nomor Virtual Account</div>
                    <div style={vaNumberStyle}>{payment.vaNumber}</div>
                    <button onClick={() => onCopy(payment.vaNumber!, 'Nomor VA')} style={copyVaButtonStyle}>
                        Copy VA
                    </button>
                </div>
            ) : (
                <div style={emptyStateStyle}>Instruksi pembayaran sedang diproses.</div>
            )}

            {copyFeedback && <div style={copyFeedbackStyle}>{copyFeedback}</div>}
            <button onClick={onOpenModal} style={changeMethodButtonStyle}>
                Ganti Metode
            </button>
        </div>
    );
}

function PaymentMethodModal({
    options,
    loadingMethod,
    error,
    onClose,
    onChoose,
    formatCurrency
}: {
    options: PublicInvoicePaymentOption[];
    loadingMethod: string | null;
    error: string | null;
    onClose: () => void;
    onChoose: (method: string) => void;
    formatCurrency: (amount: number) => string;
}) {
    const activeOptions = options.filter((option) => !option.disabled);
    const [selectedCode, setSelectedCode] = useState(activeOptions[0]?.code ?? '');
    const selectedOption = options.find((option) => option.code === selectedCode && !option.disabled) ?? activeOptions[0] ?? null;
    const canChoose = Boolean(selectedOption) && !loadingMethod;

    return (
        <div style={modalOverlayStyle}>
            <div style={modalCardStyle}>
                <div style={modalHeaderStyle}>
                    <div>
                        <div style={modalEyebrowStyle}>Metode pembayaran</div>
                        <h2 style={modalTitleStyle}>Pilih Metode Pembayaran</h2>
                    </div>
                    <button onClick={onClose} style={modalCloseButtonStyle} disabled={!!loadingMethod}>×</button>
                </div>

                <div style={methodListStyle}>
                    {activeOptions.map((option) => (
                        <button
                            key={option.code}
                            type="button"
                            disabled={option.disabled || !!loadingMethod}
                            onClick={() => setSelectedCode(option.code)}
                            style={{
                                ...methodOptionStyle,
                                ...(selectedCode === option.code ? methodOptionSelectedStyle : {}),
                                ...(option.disabled ? methodOptionDisabledStyle : {})
                            }}
                        >
                            <div style={methodOptionTopStyle}>
                                <div>
                                    <div style={methodOptionTitleStyle}>
                                        {option.label}
                                        {option.badge && <span style={methodBadgeStyle}>{option.badge}</span>}
                                    </div>
                                    <div style={methodOptionDescStyle}>{option.description}</div>
                                </div>
                                <div style={methodOptionTotalStyle}>Rp {formatCurrency(option.total)}</div>
                            </div>
                            <div style={methodFeeStyle}>
                                <span>Biaya admin: {option.feeLabel}</span>
                                <strong>+ Rp {formatCurrency(option.adminFee)}</strong>
                            </div>
                            {selectedCode === option.code && !option.disabled && (
                                <div style={methodSelectedHintStyle}>Dipilih</div>
                            )}
                            {loadingMethod === option.code && <div style={methodLoadingStyle}>Membuat instruksi pembayaran...</div>}
                        </button>
                    ))}
                </div>

                {error && <div style={paymentErrorStyle}>{error}</div>}
                <div style={modalFooterStyle}>
                    <div style={modalNoteStyle}>Setelah klik Pilih, QR atau nomor VA langsung tampil di invoice ini.</div>
                    <button
                        type="button"
                        disabled={!canChoose}
                        onClick={() => selectedOption && onChoose(selectedOption.code)}
                        style={{
                            ...modalChooseButtonStyle,
                            ...(!canChoose ? modalChooseButtonDisabledStyle : {})
                        }}
                    >
                        {loadingMethod ? 'Memproses...' : 'Pilih'}
                    </button>
                </div>
            </div>
        </div>
    );
}

function readString(value: Record<string, unknown>, key: string) {
    const candidate = value[key];
    return typeof candidate === 'string' && candidate.trim() ? candidate.trim() : null;
}

function readNumber(value: Record<string, unknown>, key: string) {
    const candidate = value[key];
    const numberValue = typeof candidate === 'number' ? candidate : Number(candidate);
    return Number.isFinite(numberValue) ? numberValue : null;
}

// STYLES
const containerStyle: CSSProperties = {
    minHeight: '100vh',
    backgroundColor: '#F3F4F6',
    padding: '40px 20px',
    fontFamily: "'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    color: COLORS.textDark,
    width: '100%',
    boxSizing: 'border-box',
    overflowX: 'hidden'
};

const invoiceCardStyle: CSSProperties = {
    maxWidth: '980px',
    width: '100%',
    boxSizing: 'border-box',
    margin: '0 auto',
    backgroundColor: COLORS.white,
    borderRadius: '24px',
    overflow: 'hidden',
    boxShadow: '0 20px 50px rgba(0,0,0,0.1)'
};



const headerStyle: CSSProperties = {
    backgroundColor: COLORS.primaryBlue,
    // Modern Mesh Gradient for premium feel
    background: `
        radial-gradient(circle at 90% 10%, rgba(0, 176, 215, 0.25) 0%, transparent 45%), 
        radial-gradient(circle at 10% 90%, rgba(0, 176, 215, 0.15) 0%, transparent 45%),
        linear-gradient(135deg, #172554 0%, #22367b 50%, #1e40af 100%)
    `,
    padding: '50px 50px 100px 50px',
    color: COLORS.white,
    position: 'relative',
    overflow: 'hidden'
};

// Decorative Circle Elements (if manual placement needed)
const circleDecoration1: CSSProperties = {
    position: 'absolute',
    top: '-50px',
    right: '-50px',
    width: '300px',
    height: '300px',
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0) 70%)',
    zIndex: 0
};

const circleDecoration2: CSSProperties = {
    position: 'absolute',
    bottom: '-20px',
    left: '10%',
    width: '200px',
    height: '200px',
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0) 70%)',
    zIndex: 0
};


const headerContentStyle: CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    position: 'relative',
    zIndex: 1
};

const companyInfoStyle: CSSProperties = {
    // Logo styling
};

const invoiceTitleSectionStyle: CSSProperties = {
    textAlign: 'right'
};

const invoiceTitleStyle: CSSProperties = {
    fontSize: '56px',
    fontWeight: 800,
    margin: 0,
    letterSpacing: '-1px',
    lineHeight: 1,
    color: COLORS.white,
    textShadow: '0 2px 4px rgba(0,0,0,0.1)'
};

const invoiceNoStyle: CSSProperties = {
    fontSize: '18px',
    marginTop: '6px',
    opacity: 0.9,
    fontWeight: 600,
    color: 'rgba(255, 255, 255, 0.9)'
};

const ccrStyle: CSSProperties = {
    fontSize: '14px',
    opacity: 0.8,
    marginTop: '2px',
    color: 'rgba(255, 255, 255, 0.8)'
};

const infoSectionContainerStyle: CSSProperties = {
    marginTop: '-70px',
    padding: '0 50px',
    position: 'relative',
    zIndex: 10
};

const infoGridStyle: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 0.8fr)',
    gap: '30px'
};

const floatingCardStyle: CSSProperties = {
    backgroundColor: COLORS.white,
    borderRadius: '20px',
    padding: '30px',
    boxShadow: '0 10px 30px rgba(0,0,0,0.06)',
    height: '100%',
    display: 'flex',
    flexDirection: 'column'
};

const cardHeaderStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '13px',
    fontWeight: 700,
    color: COLORS.primaryCyan,
    textTransform: 'uppercase',
    marginBottom: '20px',
    letterSpacing: '0.5px'
};

const cardTitleDotStyle: CSSProperties = {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    backgroundColor: COLORS.primaryBlue
};

const cardContentStyle: CSSProperties = {
    flex: 1
};

const recipientNameStyle: CSSProperties = {
    fontSize: '20px',
    fontWeight: 700,
    marginBottom: '8px',
    color: COLORS.primaryBlue,
    lineHeight: 1.3
};

const recipientDetailStyle: CSSProperties = {
    fontSize: '14px',
    color: COLORS.textDark,
    marginBottom: '4px',
    display: 'flex',
    gap: '8px'
};

const datesContainerStyle: CSSProperties = {
    borderTop: `1px solid ${COLORS.lightGray}`,
    marginTop: '20px',
    paddingTop: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px'
};

const dateItemStyle: CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '14px'
};

const dateLabelStyle: CSSProperties = {
    color: COLORS.textGray,
    fontWeight: 500
};

const dateValueStyle: CSSProperties = {
    fontWeight: 600,
    color: COLORS.textDark
};

const bankNameStyle: CSSProperties = {
    fontSize: '16px',
    fontWeight: 700,
    marginBottom: '4px'
};

const bankAccountStyle: CSSProperties = {
    fontSize: '22px',
    fontWeight: 700,
    color: COLORS.primaryBlue,
    marginBottom: '4px',
    letterSpacing: '0.5px'
};

const bankHolderStyle: CSSProperties = {
    fontSize: '13px',
    color: COLORS.mediumGray,
    textTransform: 'uppercase'
};

const waButtonStyle: CSSProperties = {
    width: '100%',
    padding: '12px',
    backgroundColor: COLORS.primaryGreen,
    color: COLORS.white,
    border: 'none',
    borderRadius: '12px',
    fontWeight: 700,
    cursor: 'pointer',
    fontSize: '13px',
    marginTop: 'auto'
};

const paymentEmptyCardStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    height: '100%'
};

const paymentEmptyTitleStyle: CSSProperties = {
    fontSize: '18px',
    fontWeight: 800,
    color: COLORS.primaryBlue
};

const paymentEmptyTextStyle: CSSProperties = {
    fontSize: '13px',
    color: COLORS.textGray,
    lineHeight: 1.5,
    marginBottom: '8px'
};

const primaryPaymentButtonStyle: CSSProperties = {
    width: '100%',
    padding: '13px 14px',
    backgroundColor: COLORS.primaryGreen,
    color: COLORS.white,
    border: 'none',
    borderRadius: '12px',
    fontWeight: 800,
    cursor: 'pointer',
    fontSize: '13px',
    boxShadow: '0 8px 18px rgba(157, 200, 59, 0.28)'
};

const secondaryPaymentButtonStyle: CSSProperties = {
    width: '100%',
    padding: '11px 14px',
    backgroundColor: COLORS.white,
    color: COLORS.primaryBlue,
    border: `1px solid ${COLORS.borderGray}`,
    borderRadius: '12px',
    fontWeight: 700,
    cursor: 'pointer',
    fontSize: '13px'
};

const paymentInstructionStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
};

const paymentMethodLabelStyle: CSSProperties = {
    fontSize: '17px',
    fontWeight: 800,
    color: COLORS.primaryBlue
};

const paymentBreakdownStyle: CSSProperties = {
    border: `1px solid ${COLORS.borderGray}`,
    borderRadius: '14px',
    padding: '12px',
    backgroundColor: '#F8FAFC'
};

const paymentBreakdownRowStyle: CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '12px',
    fontSize: '12px',
    color: COLORS.textGray,
    marginBottom: '7px'
};

const paymentTotalRowStyle: CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '12px',
    fontSize: '14px',
    color: COLORS.primaryBlue,
    fontWeight: 800,
    paddingTop: '9px',
    borderTop: `1px solid ${COLORS.borderGray}`
};

const qrBoxStyle: CSSProperties = {
    textAlign: 'center',
    border: `1px solid ${COLORS.borderGray}`,
    borderRadius: '14px',
    padding: '12px',
    backgroundColor: COLORS.white
};

const qrImageStyle: CSSProperties = {
    width: '150px',
    height: '150px',
    objectFit: 'contain',
    display: 'block',
    margin: '0 auto 10px auto'
};

const downloadQrButtonStyle: CSSProperties = {
    display: 'block',
    width: '100%',
    padding: '10px',
    backgroundColor: COLORS.primaryBlue,
    color: COLORS.white,
    borderRadius: '10px',
    fontSize: '12px',
    fontWeight: 800,
    textDecoration: 'none',
    marginBottom: '8px'
};

const secondaryLinkButtonStyle: CSSProperties = {
    display: 'block',
    width: '100%',
    padding: '10px',
    backgroundColor: '#E0F2FE',
    color: COLORS.primaryBlue,
    borderRadius: '10px',
    fontSize: '12px',
    fontWeight: 800,
    textDecoration: 'none'
};

const goPayBoxStyle: CSSProperties = {
    border: `1px solid ${COLORS.borderGray}`,
    borderRadius: '16px',
    padding: '14px',
    backgroundColor: '#F7FCEB',
    display: 'grid',
    gap: '14px'
};

const goPayIntroStyle: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: '52px minmax(0, 1fr)',
    alignItems: 'start',
    gap: '12px'
};

const goPayIconStyle: CSSProperties = {
    display: 'inline-flex',
    width: '52px',
    height: '52px',
    alignItems: 'center',
    justifyContent: 'center',
    border: `1px solid ${COLORS.borderGray}`,
    borderRadius: '16px',
    backgroundColor: COLORS.white,
    boxShadow: '0 6px 16px rgba(31, 41, 55, 0.06)'
};

const goPayIconImageStyle: CSSProperties = {
    width: '34px',
    height: '34px',
    objectFit: 'contain'
};

const goPayNameStyle: CSSProperties = {
    color: '#07152f',
    fontSize: '22px',
    fontWeight: 900,
    lineHeight: 1.1
};

const goPayDescriptionStyle: CSSProperties = {
    color: COLORS.textGray,
    fontSize: '12px',
    lineHeight: 1.45,
    marginTop: '6px'
};

const goPayDirectButtonStyle: CSSProperties = {
    display: 'inline-flex',
    width: '100%',
    minHeight: '54px',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    borderRadius: '16px',
    background: 'linear-gradient(135deg, #8dd11e 0%, #5eb511 100%)',
    color: COLORS.white,
    fontSize: '15px',
    fontWeight: 900,
    textDecoration: 'none',
    boxShadow: '0 12px 26px rgba(94, 181, 17, 0.28)'
};

const goPayButtonIconStyle: CSSProperties = {
    width: '26px',
    height: '26px',
    objectFit: 'contain',
    filter: 'brightness(0) invert(1)'
};

const vaBoxStyle: CSSProperties = {
    border: `1px solid ${COLORS.borderGray}`,
    borderRadius: '14px',
    padding: '14px',
    backgroundColor: '#F8FAFC'
};

const vaBankStyle: CSSProperties = {
    fontSize: '13px',
    fontWeight: 800,
    color: COLORS.primaryCyan,
    textTransform: 'uppercase',
    marginBottom: '8px'
};

const vaNumberLabelStyle: CSSProperties = {
    fontSize: '11px',
    color: COLORS.textGray,
    fontWeight: 700,
    textTransform: 'uppercase',
    marginTop: '8px'
};

const vaNumberStyle: CSSProperties = {
    fontSize: '22px',
    color: COLORS.primaryBlue,
    fontWeight: 900,
    letterSpacing: '0.8px',
    wordBreak: 'break-all',
    marginTop: '2px'
};

const copyVaButtonStyle: CSSProperties = {
    width: '100%',
    padding: '10px',
    marginTop: '12px',
    backgroundColor: COLORS.primaryBlue,
    color: COLORS.white,
    border: 'none',
    borderRadius: '10px',
    fontSize: '12px',
    fontWeight: 800,
    cursor: 'pointer'
};

const copyFeedbackStyle: CSSProperties = {
    fontSize: '12px',
    color: '#047857',
    backgroundColor: '#ECFDF5',
    border: '1px solid #A7F3D0',
    padding: '8px 10px',
    borderRadius: '10px'
};

const changeMethodButtonStyle: CSSProperties = {
    width: '100%',
    padding: '10px',
    backgroundColor: COLORS.white,
    color: COLORS.primaryBlue,
    border: `1px solid ${COLORS.borderGray}`,
    borderRadius: '10px',
    fontSize: '12px',
    fontWeight: 800,
    cursor: 'pointer'
};

const modalOverlayStyle: CSSProperties = {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.58)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    padding: '24px'
};

const modalCardStyle: CSSProperties = {
    width: 'min(720px, 100%)',
    maxHeight: '90vh',
    overflowY: 'auto',
    backgroundColor: COLORS.white,
    borderRadius: '22px',
    padding: '26px',
    boxShadow: '0 30px 80px rgba(15, 23, 42, 0.34)'
};

const modalHeaderStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '16px',
    marginBottom: '18px'
};

const modalEyebrowStyle: CSSProperties = {
    fontSize: '12px',
    color: COLORS.primaryCyan,
    textTransform: 'uppercase',
    fontWeight: 900,
    letterSpacing: '0.5px',
    marginBottom: '4px'
};

const modalTitleStyle: CSSProperties = {
    margin: 0,
    fontSize: '26px',
    color: COLORS.primaryBlue,
    lineHeight: 1.15
};

const modalCloseButtonStyle: CSSProperties = {
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    border: `1px solid ${COLORS.borderGray}`,
    backgroundColor: COLORS.white,
    color: COLORS.textDark,
    cursor: 'pointer',
    fontSize: '24px',
    lineHeight: 1
};

const methodListStyle: CSSProperties = {
    display: 'grid',
    gap: '12px'
};

const methodOptionStyle: CSSProperties = {
    width: '100%',
    textAlign: 'left',
    border: `1px solid ${COLORS.borderGray}`,
    borderRadius: '16px',
    backgroundColor: COLORS.white,
    padding: '16px',
    cursor: 'pointer',
    transition: 'border-color .15s ease, box-shadow .15s ease'
};

const methodOptionSelectedStyle: CSSProperties = {
    borderColor: COLORS.primaryCyan,
    boxShadow: '0 0 0 3px rgba(0, 176, 215, 0.12)'
};

const methodOptionDisabledStyle: CSSProperties = {
    opacity: 0.5,
    cursor: 'not-allowed',
    backgroundColor: '#F9FAFB'
};

const methodOptionTopStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '16px'
};

const methodOptionTitleStyle: CSSProperties = {
    fontSize: '15px',
    fontWeight: 900,
    color: COLORS.primaryBlue,
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
    flexWrap: 'wrap'
};

const methodOptionDescStyle: CSSProperties = {
    fontSize: '12px',
    color: COLORS.textGray,
    marginTop: '4px'
};

const methodOptionTotalStyle: CSSProperties = {
    fontSize: '15px',
    fontWeight: 900,
    color: COLORS.primaryGreen,
    whiteSpace: 'nowrap'
};

const methodBadgeStyle: CSSProperties = {
    fontSize: '10px',
    color: '#92400E',
    backgroundColor: '#FEF3C7',
    border: '1px solid #FCD34D',
    borderRadius: '999px',
    padding: '2px 8px'
};

const methodFeeStyle: CSSProperties = {
    marginTop: '12px',
    paddingTop: '10px',
    borderTop: `1px solid ${COLORS.lightGray}`,
    display: 'flex',
    justifyContent: 'space-between',
    gap: '14px',
    fontSize: '12px',
    color: COLORS.textGray
};

const methodSelectedHintStyle: CSSProperties = {
    marginTop: '10px',
    display: 'inline-flex',
    width: 'fit-content',
    borderRadius: '999px',
    backgroundColor: '#E0F2FE',
    color: COLORS.primaryBlue,
    padding: '4px 10px',
    fontSize: '11px',
    fontWeight: 900
};

const methodLoadingStyle: CSSProperties = {
    marginTop: '10px',
    fontSize: '12px',
    color: COLORS.primaryCyan,
    fontWeight: 800
};

const paymentErrorStyle: CSSProperties = {
    marginTop: '14px',
    padding: '10px 12px',
    borderRadius: '12px',
    backgroundColor: '#FEF2F2',
    color: '#991B1B',
    border: '1px solid #FECACA',
    fontSize: '13px',
    fontWeight: 700
};

const modalFooterStyle: CSSProperties = {
    position: 'sticky',
    bottom: '-26px',
    margin: '18px -26px -26px',
    padding: '14px 26px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '16px',
    borderTop: `1px solid ${COLORS.borderGray}`,
    backgroundColor: COLORS.white
};

const modalNoteStyle: CSSProperties = {
    fontSize: '12px',
    color: COLORS.textGray,
    lineHeight: 1.5
};

const modalChooseButtonStyle: CSSProperties = {
    minWidth: '132px',
    minHeight: '44px',
    border: 'none',
    borderRadius: '12px',
    backgroundColor: COLORS.primaryGreen,
    color: COLORS.white,
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 900,
    boxShadow: '0 10px 22px rgba(157, 200, 59, 0.25)'
};

const modalChooseButtonDisabledStyle: CSSProperties = {
    opacity: 0.55,
    cursor: 'not-allowed',
    boxShadow: 'none'
};

const paidStatusContainerStyle: CSSProperties = {
    textAlign: 'center',
    padding: '10px',
    backgroundColor: '#ECFDF5',
    borderRadius: '8px',
    border: '1px solid #6EE7B7'
};

const paidCheckmarkStyle: CSSProperties = {
    fontSize: '24px',
    color: '#059669',
    marginBottom: '4px'
};

const paidTextStyle: CSSProperties = {
    fontSize: '18px',
    fontWeight: 800,
    color: '#059669'
};

const paidDateStyle: CSSProperties = {
    fontSize: '12px',
    color: '#047857'
};

const emptyStateStyle: CSSProperties = {
    fontStyle: 'italic',
    color: COLORS.mediumGray,
    opacity: 0.7
};

const bodyContentStyle: CSSProperties = {
    padding: '40px 50px'
};

const tableContainerStyle: CSSProperties = {
    marginBottom: '30px'
};

const tableStyle: CSSProperties = {
    width: '100%',
    borderCollapse: 'separate',
    borderSpacing: '0 10px',
    fontSize: '14px'
};

const thStyle: CSSProperties = {
    backgroundColor: COLORS.primaryBlue,
    color: COLORS.white,
    padding: '16px',
    fontWeight: 600,
    textTransform: 'uppercase',
    fontSize: '12px',
    letterSpacing: '0.5px',
    border: 'none'
};

const trStyle: CSSProperties = {

};

const tdStyle: CSSProperties = {
    backgroundColor: '#F9FAFB',
    padding: '20px 16px',
    verticalAlign: 'middle',
    border: 'none',
    borderTop: '1px solid #F3F4F6',
    borderBottom: '1px solid #F3F4F6'
};

const itemNameStyle: CSSProperties = {
    fontWeight: 700,
    marginBottom: '4px',
    color: COLORS.textDark,
    fontSize: '15px'
};

const itemSubStyle: CSSProperties = {
    fontSize: '13px',
    color: COLORS.mediumGray
};

const discountTagStyle: CSSProperties = {
    color: '#DC2626',
    fontWeight: 600,
    backgroundColor: '#FEE2E2',
    padding: '2px 8px',
    borderRadius: '4px',
    fontSize: '12px',
    whiteSpace: 'nowrap'
};

const totalSectionWrapperStyle: CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: '20px'
};

const periodContainerStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    fontSize: '13px',
    color: COLORS.mediumGray
};

const periodLabelStyle: CSSProperties = {
    fontWeight: 600,
    textTransform: 'uppercase'
};

const periodValueStyle: CSSProperties = {
    fontWeight: 800,
    color: COLORS.primaryBlue,
    fontSize: '20px',
    marginTop: '2px'
};

const totalPillStyle: CSSProperties = {
    backgroundColor: COLORS.primaryGreen,
    borderRadius: '50px',
    padding: '12px 30px',
    display: 'flex',
    alignItems: 'center',
    gap: '20px',
    color: COLORS.white,
    boxShadow: '0 4px 15px rgba(16, 185, 129, 0.3)'
};

const totalLabelPillStyle: CSSProperties = {
    fontSize: '14px',
    fontWeight: 600,
    opacity: 0.9,
    textTransform: 'uppercase'
};

const totalAmountPillStyle: CSSProperties = {
    fontSize: '24px',
    fontWeight: 800
};

const footerStyle: CSSProperties = {
    marginTop: '60px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    borderTop: `1px solid ${COLORS.lightGray}`,
    paddingTop: '30px'
};

const termsStyle: CSSProperties = {
    flex: 1,
    paddingRight: '40px',
    fontSize: '13px',
    color: COLORS.mediumGray
};

const termsHeaderStyle: CSSProperties = {
    fontWeight: 700,
    marginBottom: '10px',
    color: COLORS.primaryBlue
};

const signatureStyle: CSSProperties = {
    textAlign: 'center',
    width: '200px'
};

const signatureNameStyle: CSSProperties = {
    fontWeight: 700,
    borderTop: `1px solid ${COLORS.borderGray}`,
    paddingTop: '8px',
    fontSize: '14px',
    color: COLORS.textDark
};

const printContainerStyle: CSSProperties = {
    textAlign: 'center',
    marginTop: '30px'
};

const printButtonStyle: CSSProperties = {
    backgroundColor: COLORS.primaryBlue,
    color: COLORS.white,
    border: 'none',
    padding: '14px 28px',
    borderRadius: '12px',
    cursor: 'pointer',
    fontWeight: 600,
    fontSize: '15px',
    boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
};
