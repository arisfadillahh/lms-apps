'use client';

import Image from 'next/image';
import { type CSSProperties } from 'react';
import type { Invoice } from '@/lib/types/invoice';

interface BankInfo {
    bank_name: string;
    bank_account_number: string;
    bank_account_holder: string;
    admin_whatsapp_number: string;
    weekly_invoice_message_template?: string; // Optional because legacy data might not have it yet
}

interface Props {
    invoice: Invoice;
    bankInfo: BankInfo | null;
}

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

export default function InvoiceView({ invoice, bankInfo }: Props) {
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

            let message = '';

            // Special template for New Registration (REG code)
            if (invoice.ccr && invoice.ccr.ccr_code === 'REG') {
                // NOTE: For 'Contact Admin' button (Parent -> Admin), we use a standard confirmation message,
                // NOT the 'weekly_invoice_message_template' which is for Admin -> Parent reminders.

                const studentName = invoice.items?.[0]?.coder_name || invoice.parent_name || '-';

                const text = `Halo Admin Finance Clevio,\n\nSaya ingin konfirmasi pembayaran untuk Invoice: ${invoice.invoice_number}\nSiswa: ${studentName}\nProgram: Weekly Class\n\nMohon dibantu proses ya. Terima kasih.`;

                message = encodeURIComponent(text);
            } else {
                // Default Invoice Confirmation
                message = encodeURIComponent(
                    `Halo Clevio Finance,\n\nSaya ingin konfirmasi pembayaran untuk Invoice: ${invoice.invoice_number}\n\nTerima kasih.`
                );
            }

            window.open(`https://wa.me/${normalizedPhone}?text=${message}`, '_blank');
        }
    };

    const isPaid = invoice.status === 'PAID';

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
                                {!isPaid && bankInfo ? (
                                    <>
                                        <div style={{ marginBottom: '12px' }}>
                                            <div style={bankNameStyle}>{bankInfo.bank_name}</div>
                                            <div style={bankAccountStyle}>{bankInfo.bank_account_number}</div>
                                            <div style={bankHolderStyle}>a.n {bankInfo.bank_account_holder}</div>
                                        </div>
                                        <button onClick={handleContactAdmin} style={waButtonStyle}>
                                            Konfirmasi Pembayaran
                                        </button>
                                    </>
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
                                <li>Pembayaran dapat dilakukan melalui transfer bank ke rekening yang tertera di atas.</li>
                                <li>Mohon konfirmasi pembayaran melalui WhatsApp ke nomor admin setelah melakukan transfer.</li>
                                <li>Invoice yang telah melewati tanggal jatuh tempo akan dikenakan status OVERDUE.</li>
                                <li>Untuk pertanyaan lebih lanjut, silakan hubungi admin kami.</li>
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
                            Clevio Innovator Camp - Let's Innovate!
                        </div>
                    </div>
                </div>
            </div>

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

// STYLES
const containerStyle: CSSProperties = {
    minHeight: '100vh',
    backgroundColor: '#F3F4F6',
    padding: '40px 20px',
    fontFamily: "'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    color: COLORS.textDark,
    minWidth: '1024px', // Force desktop width even on mobile (triggers scroll/zoom)
    overflowX: 'auto'  // Allow scrolling
};

const invoiceCardStyle: CSSProperties = {
    maxWidth: '980px', // Width increased to fill viewport
    width: '980px',    // Explicit width to prevent squishing
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
