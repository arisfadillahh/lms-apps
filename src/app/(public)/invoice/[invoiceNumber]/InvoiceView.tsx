'use client';

import Image from 'next/image';
import { type CSSProperties } from 'react';
import type { Invoice } from '@/lib/types/invoice';

interface BankInfo {
    bank_name: string;
    bank_account_number: string;
    bank_account_holder: string;
    admin_whatsapp_number: string;
}

interface Props {
    invoice: Invoice;
    bankInfo: BankInfo | null;
}

// Clevio Brand Colors
const COLORS = {
    primaryBlue: '#22367b',
    primaryGreen: '#9dc83b',
    secondaryTeal: '#00b0d7',
    white: '#ffffff',
    lightGray: '#f8f9fa',
    darkGray: '#333333',
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

    const handleContactAdmin = () => {
        if (bankInfo?.admin_whatsapp_number) {
            const phone = bankInfo.admin_whatsapp_number.replace(/\D/g, '');
            const normalizedPhone = phone.startsWith('0') ? '62' + phone.substring(1) : phone;
            const message = encodeURIComponent(
                `Halo Clevio Finance,\n\nSaya ingin konfirmasi pembayaran untuk Invoice: ${invoice.invoice_number}\n\nTerima kasih.`
            );
            window.open(`https://wa.me/${normalizedPhone}?text=${message}`, '_blank');
        }
    };

    const isPaid = invoice.status === 'PAID';

    return (
        <div style={containerStyle}>
            <div style={invoiceCardStyle}>
                {/* Header with Logo and Title */}
                <div style={headerStyle}>
                    {/* Logo Section */}
                    <div style={logoSectionStyle}>
                        <Image
                            src="/images/clevio-logo.png.png?v=2"
                            alt="Clevio Innovator Camp"
                            width={150}
                            height={50}
                            style={{ objectFit: 'contain' }}
                            unoptimized
                        />
                    </div>

                    {/* Title Section */}
                    <div style={titleSectionStyle}>
                        <h1 style={invoiceTitleStyle}>Invoice</h1>
                        <p style={invoiceNoStyle}>Invoice no: {invoice.invoice_number}</p>
                    </div>
                </div>

                {/* Info Row */}
                <div style={infoRowStyle}>
                    <div style={infoLeftStyle}>
                        <p style={infoTextStyle}>Periode: {getMonthName(invoice.period_month)} {invoice.period_year}</p>
                        <p style={infoTextStyle}>Jatuh Tempo: {formatDate(invoice.due_date)}</p>
                    </div>
                    <div style={infoRightStyle}>
                        <p style={infoTextStyle}>Dibuat: {formatDate(invoice.created_at)}</p>
                    </div>
                </div>

                {/* Items Table */}
                <div style={tableContainerStyle}>
                    <table style={tableStyle}>
                        <thead>
                            <tr style={tableHeaderRowStyle}>
                                <th style={thLeftStyle}>DESCRIPTION</th>
                                <th style={thCenterStyle}>PRICE</th>
                                <th style={thCenterStyle}>QTY</th>
                                <th style={thRightStyle}>AMOUNT</th>
                            </tr>
                        </thead>
                        <tbody>
                            {invoice.items?.map((item) => (
                                <tr key={item.id} style={tableRowStyle}>
                                    <td style={tdLeftStyle}>
                                        <strong>
                                            {/* For seasonal, coder_name IS the student name, but check invoice type or fallback */}
                                            {invoice.invoice_type === 'SEASONAL'
                                                ? invoice.seasonal_student_name
                                                : (item.coder_name || invoice.parent_name)
                                            }
                                        </strong>
                                        <br />
                                        <span style={itemDetailStyle}>
                                            • {item.level_name || item.description || 'Program Details'}
                                        </span>
                                        {item.discount_amount > 0 && (
                                            <>
                                                <br />
                                                <span style={discountStyle}>• Diskon: -Rp {formatCurrency(item.discount_amount)}</span>
                                            </>
                                        )}
                                    </td>
                                    <td style={tdCenterStyle}>Rp {formatCurrency(item.base_price)}</td>
                                    <td style={tdCenterStyle}>1</td>
                                    <td style={tdRightStyle}>Rp {formatCurrency(item.final_price)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {/* Grand Total */}
                    <div style={grandTotalContainerStyle}>
                        <div style={grandTotalBoxStyle}>
                            <span style={grandTotalLabelStyle}>GRAND TOTAL</span>
                            <span style={grandTotalValueStyle}>Rp {formatCurrency(invoice.total_amount)}</span>
                        </div>
                    </div>
                </div>

                {/* Terms & Payment Info */}
                <div style={bottomSectionStyle}>
                    <div style={termsColumnStyle}>
                        {/* Status Badge */}
                        <div style={statusBadgeContainerStyle}>
                            <span style={getStatusBadgeStyle(invoice.status)}>
                                {invoice.status === 'PAID' ? '✓ LUNAS' :
                                    invoice.status === 'OVERDUE' ? '⚠ JATUH TEMPO' :
                                        '⏳ MENUNGGU PEMBAYARAN'}
                            </span>
                            {isPaid && invoice.paid_at && (
                                <p style={paidDateStyle}>Dibayar: {formatDate(invoice.paid_at)}</p>
                            )}
                        </div>

                        {/* Bank Info (only if not paid) */}
                        {!isPaid && bankInfo && (
                            <div style={paymentInfoStyle}>
                                <div style={{ marginBottom: '15px' }}>
                                    <p style={paymentTitleStyle}>Transfer ke:</p>
                                    <p style={bankDetailStyle}>
                                        <strong>{bankInfo.bank_name}</strong> - {bankInfo.bank_account_number}
                                    </p>
                                    <p style={bankDetailStyle}>a.n. <strong>{bankInfo.bank_account_holder}</strong></p>
                                </div>
                                <button onClick={handleContactAdmin} style={waButtonStyle}>
                                    Konfirmasi Pembayaran
                                </button>
                            </div>
                        )}
                    </div>

                    <div style={issuedToColumnStyle}>
                        <p style={issuedToLabelStyle}>Issued To:</p>
                        <p style={issuedToNameStyle}>
                            {invoice.invoice_type === 'SEASONAL' ? invoice.seasonal_student_name : invoice.parent_name}
                        </p>
                        {invoice.invoice_type === 'SEASONAL' && <p style={issuedToDetailStyle}>{invoice.parent_name} (Parent)</p>}
                        <p style={issuedToDetailStyle}>INVOICE: {invoice.invoice_number}</p>
                    </div>
                </div>

                {/* Footer */}
                <div style={footerStyle}>
                    <p>Terima kasih atas kepercayaan Anda</p>
                    <p style={footerBrandStyle}>Clevio Innovator Camp</p>
                </div>
            </div>

            {/* Print Button */}
            <div style={printContainerStyle}>
                <button onClick={() => window.print()} style={printButtonStyle}>
                    🖨️ Cetak Invoice
                </button>
            </div>

            {/* Print Styles */}
            <style>{`
                @media print {
                    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                    button { display: none !important; }
                }
            `}</style>
        </div>
    );
}

// Styles
const containerStyle: CSSProperties = {
    minHeight: '100vh',
    backgroundColor: '#f5f5f5',
    padding: '20px',
    fontFamily: 'Arial, sans-serif'
};

const invoiceCardStyle: CSSProperties = {
    maxWidth: '700px',
    margin: '0 auto',
    backgroundColor: '#fff',
    boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
    borderRadius: '12px',
    overflow: 'hidden',
    position: 'relative'
};

const headerStyle: CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '30px',
    borderBottom: `3px solid ${COLORS.primaryGreen}`,
    backgroundColor: COLORS.primaryBlue
};

const logoSectionStyle: CSSProperties = {
    flex: 1
};

const titleSectionStyle: CSSProperties = {
    textAlign: 'right'
};

const invoiceTitleStyle: CSSProperties = {
    fontSize: '36px',
    fontWeight: 'bold',
    color: COLORS.white,
    margin: 0
};

const invoiceNoStyle: CSSProperties = {
    fontSize: '14px',
    color: 'rgba(255,255,255,0.8)',
    margin: '5px 0 0'
};

const infoRowStyle: CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '0 30px 20px',
    fontSize: '13px',
    color: '#666'
};

const infoLeftStyle: CSSProperties = {};
const infoRightStyle: CSSProperties = { textAlign: 'right' };
const infoTextStyle: CSSProperties = { margin: '4px 0' };

const tableContainerStyle: CSSProperties = {
    padding: '0 30px'
};

const tableStyle: CSSProperties = {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '13px'
};

const tableHeaderRowStyle: CSSProperties = {
    backgroundColor: COLORS.primaryGreen,
    color: COLORS.white
};

const thLeftStyle: CSSProperties = {
    padding: '12px 15px',
    textAlign: 'left',
    fontWeight: 600,
    borderRadius: '4px 0 0 4px'
};

const thCenterStyle: CSSProperties = {
    padding: '12px 15px',
    textAlign: 'center',
    fontWeight: 600
};

const thRightStyle: CSSProperties = {
    padding: '12px 15px',
    textAlign: 'right',
    fontWeight: 600,
    borderRadius: '0 4px 4px 0'
};

const tableRowStyle: CSSProperties = {
    borderBottom: `1px solid #eee`
};

const tdLeftStyle: CSSProperties = {
    padding: '15px',
    verticalAlign: 'top'
};

const tdCenterStyle: CSSProperties = {
    padding: '15px',
    textAlign: 'center',
    verticalAlign: 'top'
};

const tdRightStyle: CSSProperties = {
    padding: '15px',
    textAlign: 'right',
    verticalAlign: 'top',
    fontWeight: 500
};

const itemDetailStyle: CSSProperties = {
    color: COLORS.secondaryTeal,
    fontSize: '12px'
};

const discountStyle: CSSProperties = {
    color: '#e74c3c',
    fontSize: '12px'
};

const grandTotalContainerStyle: CSSProperties = {
    display: 'flex',
    justifyContent: 'flex-end',
    marginTop: '20px',
    marginBottom: '30px'
};

const grandTotalBoxStyle: CSSProperties = {
    backgroundColor: COLORS.lightGray,
    padding: '15px 30px',
    borderRadius: '8px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    borderTop: `3px solid ${COLORS.primaryGreen}`
};

const grandTotalLabelStyle: CSSProperties = {
    fontSize: '12px',
    color: '#666',
    fontWeight: 600,
    marginBottom: '5px'
};

const grandTotalValueStyle: CSSProperties = {
    fontSize: '24px',
    fontWeight: 'bold',
    color: COLORS.primaryBlue
};

const bottomSectionStyle: CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '20px 30px',
    backgroundColor: COLORS.lightGray,
    borderTop: `1px solid #eee`
};

const termsColumnStyle: CSSProperties = {
    flex: 1
};

const statusBadgeContainerStyle: CSSProperties = {
    marginBottom: '15px'
};

const getStatusBadgeStyle = (status: string): CSSProperties => {
    const baseStyle: CSSProperties = {
        display: 'inline-block',
        padding: '10px 20px',
        borderRadius: '6px',
        fontWeight: 'bold',
        fontSize: '14px'
    };

    if (status === 'PAID') {
        return { ...baseStyle, backgroundColor: '#e8f5e9', color: '#2e7d32' };
    } else if (status === 'OVERDUE') {
        return { ...baseStyle, backgroundColor: '#ffebee', color: '#c62828' };
    }
    return { ...baseStyle, backgroundColor: '#fff3e0', color: '#ef6c00' };
};

const paidDateStyle: CSSProperties = {
    marginTop: '8px',
    color: '#2e7d32',
    fontSize: '13px'
};

const paymentInfoStyle: CSSProperties = {
    marginTop: '10px'
};

const paymentTitleStyle: CSSProperties = {
    fontSize: '13px',
    color: '#666',
    marginBottom: '5px'
};

const bankDetailStyle: CSSProperties = {
    fontSize: '13px',
    margin: '3px 0'
};

const waButtonStyle: CSSProperties = {
    backgroundColor: '#25d366',
    color: '#fff',
    border: 'none',
    padding: '10px 20px',
    borderRadius: '6px',
    cursor: 'pointer',
    fontWeight: 'bold',
    fontSize: '13px',
    marginTop: '10px'
};

const issuedToColumnStyle: CSSProperties = {
    textAlign: 'right'
};

const issuedToLabelStyle: CSSProperties = {
    fontSize: '12px',
    color: '#666',
    marginBottom: '5px'
};

const issuedToNameStyle: CSSProperties = {
    fontSize: '18px',
    fontWeight: 'bold',
    color: COLORS.primaryBlue,
    marginBottom: '5px'
};

const issuedToDetailStyle: CSSProperties = {
    fontSize: '12px',
    color: '#999'
};

const footerStyle: CSSProperties = {
    padding: '20px 30px',
    textAlign: 'center',
    fontSize: '13px',
    color: '#666',
    borderTop: `1px solid #eee`
};

const footerBrandStyle: CSSProperties = {
    fontWeight: 'bold',
    color: COLORS.primaryBlue
};

const printContainerStyle: CSSProperties = {
    maxWidth: '700px',
    margin: '20px auto',
    textAlign: 'center'
};

const printButtonStyle: CSSProperties = {
    backgroundColor: COLORS.primaryBlue,
    color: '#fff',
    border: 'none',
    padding: '12px 30px',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: 'bold',
    fontSize: '14px'
};
