'use client';

import { useState, type CSSProperties, useCallback } from 'react';
import Link from 'next/link';
import type { Invoice } from '@/lib/types/invoice';

interface Stats {
    pending: number;
    paid: number;
    overdue: number;
    totalAmount: number;
}

interface Props {
    initialInvoices: Invoice[];
    initialStats: Stats;
    initialMonth: number;
    initialYear: number;
}

export default function InvoiceManagement({
    initialInvoices,
    initialStats,
    initialMonth,
    initialYear
}: Props) {
    const [invoices, setInvoices] = useState<Invoice[]>(initialInvoices);
    const [stats, setStats] = useState<Stats>(initialStats);
    const [month, setMonth] = useState(initialMonth);
    const [year, setYear] = useState(initialYear);
    const [statusFilter, setStatusFilter] = useState<string>('');
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(false);
    const [sendingReminders, setSendingReminders] = useState(false);
    const [markingPaid, setMarkingPaid] = useState<string | null>(null);
    const [showPaidModal, setShowPaidModal] = useState<Invoice | null>(null);
    const [paidDate, setPaidDate] = useState('');
    const [paidNotes, setPaidNotes] = useState('');
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [showDeleteModal, setShowDeleteModal] = useState<Invoice | null>(null);
    const [deleting, setDeleting] = useState<string | null>(null);

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0
        }).format(amount);
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('id-ID', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        });
    };

    const getMonthName = (m: number) => {
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
        return months[m - 1] || '';
    };

    const fetchInvoices = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            params.set('month', month.toString());
            params.set('year', year.toString());
            if (statusFilter) params.set('status', statusFilter);
            if (search) params.set('search', search);

            const res = await fetch(`/api/invoices?${params.toString()}`);
            const data = await res.json();

            setInvoices(data.invoices || []);
            if (data.stats) {
                setStats(data.stats);
            }
        } catch (error) {
            console.error('Error fetching invoices:', error);
        } finally {
            setLoading(false);
        }
    }, [month, year, statusFilter, search]);

    const handleGenerateAndSend = async () => {
        setSendingReminders(true);
        setMessage(null);

        try {
            // Step 1: Generate invoices
            const genRes = await fetch('/api/invoices/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ month, year })
            });
            const genData = await genRes.json();

            if (!genData.success && genData.errors?.length > 0) {
                setMessage({ type: 'error', text: genData.errors.join(', ') });
                return;
            }

            // Step 2: Send reminders
            const sendRes = await fetch('/api/whatsapp/send-reminders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ month, year })
            });
            const sendData = await sendRes.json();

            setMessage({
                type: sendData.success ? 'success' : 'error',
                text: `Generated: ${genData.generated || 0} invoices. Sent: ${sendData.sent || 0} reminders. Failed: ${sendData.failed || 0}`
            });

            // Refresh list
            await fetchInvoices();

        } catch (error) {
            setMessage({ type: 'error', text: 'Error: ' + String(error) });
        } finally {
            setSendingReminders(false);
        }
    };

    const handleMarkPaid = async () => {
        if (!showPaidModal || !paidDate) return;

        setMarkingPaid(showPaidModal.id);
        try {
            const res = await fetch(`/api/invoices/${showPaidModal.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    paid_at: new Date(paidDate).toISOString(),
                    paid_notes: paidNotes
                })
            });

            if (res.ok) {
                setMessage({ type: 'success', text: 'Invoice marked as paid!' });
                setShowPaidModal(null);
                setPaidDate('');
                setPaidNotes('');
                await fetchInvoices();
            } else {
                setMessage({ type: 'error', text: 'Failed to update invoice' });
            }
        } catch (error) {
            setMessage({ type: 'error', text: 'Error: ' + String(error) });
        } finally {
            setMarkingPaid(null);
        }
    };

    const handleDelete = async () => {
        if (!showDeleteModal) return;

        setDeleting(showDeleteModal.id);
        try {
            const res = await fetch(`/api/invoices/${showDeleteModal.id}`, {
                method: 'DELETE'
            });

            if (res.ok) {
                setMessage({ type: 'success', text: 'Invoice deleted!' });
                setShowDeleteModal(null);
                await fetchInvoices();
            } else {
                setMessage({ type: 'error', text: 'Failed to delete invoice' });
            }
        } catch (error) {
            setMessage({ type: 'error', text: 'Error: ' + String(error) });
        } finally {
            setDeleting(null);
        }
    };

    const getStatusBadge = (status: string) => {
        const styles: Record<string, CSSProperties> = {
            PENDING: { backgroundColor: '#fff3e0', color: '#ef6c00', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 600 },
            PAID: { backgroundColor: '#e8f5e9', color: '#2e7d32', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 600 },
            OVERDUE: { backgroundColor: '#ffebee', color: '#c62828', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 600 }
        };
        const labels: Record<string, string> = { PENDING: 'Pending', PAID: 'Lunas', OVERDUE: 'Jatuh Tempo' };
        return <span style={styles[status] || styles.PENDING}>{labels[status] || status}</span>;
    };

    return (
        <div style={containerStyle}>
            {/* Header */}
            <div style={headerStyle}>
                <div>
                    <h1 style={titleStyle}>Invoice Management</h1>
                    <p style={subtitleStyle}>Kelola invoice dan kirim reminder pembayaran</p>
                </div>
                <button
                    onClick={handleGenerateAndSend}
                    disabled={sendingReminders}
                    style={primaryButtonStyle}
                >
                    {sendingReminders ? '⏳ Processing...' : '📤 Kirim Reminder Bulan Ini'}
                </button>
            </div>

            {/* Message */}
            {message && (
                <div style={message.type === 'success' ? successMessageStyle : errorMessageStyle}>
                    {message.text}
                </div>
            )}

            {/* Stats */}
            <div style={statsGridStyle}>
                <div style={statCardStyle}>
                    <p style={statLabelStyle}>Total Invoice</p>
                    <p style={statValueStyle}>{stats.pending + stats.paid + stats.overdue}</p>
                </div>
                <div style={{ ...statCardStyle, borderLeft: '4px solid #ef6c00' }}>
                    <p style={statLabelStyle}>Pending</p>
                    <p style={{ ...statValueStyle, color: '#ef6c00' }}>{stats.pending}</p>
                </div>
                <div style={{ ...statCardStyle, borderLeft: '4px solid #2e7d32' }}>
                    <p style={statLabelStyle}>Lunas</p>
                    <p style={{ ...statValueStyle, color: '#2e7d32' }}>{stats.paid}</p>
                </div>
                <div style={{ ...statCardStyle, borderLeft: '4px solid #c62828' }}>
                    <p style={statLabelStyle}>Jatuh Tempo</p>
                    <p style={{ ...statValueStyle, color: '#c62828' }}>{stats.overdue}</p>
                </div>
                <div style={{ ...statCardStyle, borderLeft: '4px solid #1976d2' }}>
                    <p style={statLabelStyle}>Total Amount</p>
                    <p style={{ ...statValueStyle, color: '#1976d2', fontSize: '18px' }}>{formatCurrency(stats.totalAmount)}</p>
                </div>
            </div>

            {/* Filters */}
            <div style={filtersStyle}>
                <div style={filterGroupStyle}>
                    <label style={filterLabelStyle}>Bulan</label>
                    <select
                        value={month}
                        onChange={(e) => setMonth(parseInt(e.target.value))}
                        style={selectStyle}
                    >
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => (
                            <option key={m} value={m}>{getMonthName(m)}</option>
                        ))}
                    </select>
                </div>
                <div style={filterGroupStyle}>
                    <label style={filterLabelStyle}>Tahun</label>
                    <select
                        value={year}
                        onChange={(e) => setYear(parseInt(e.target.value))}
                        style={selectStyle}
                    >
                        {[2024, 2025, 2026, 2027].map(y => (
                            <option key={y} value={y}>{y}</option>
                        ))}
                    </select>
                </div>
                <div style={filterGroupStyle}>
                    <label style={filterLabelStyle}>Status</label>
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        style={selectStyle}
                    >
                        <option value="">Semua</option>
                        <option value="PENDING">Pending</option>
                        <option value="PAID">Lunas</option>
                        <option value="OVERDUE">Jatuh Tempo</option>
                    </select>
                </div>
                <div style={{ ...filterGroupStyle, flex: 1 }}>
                    <label style={filterLabelStyle}>Search</label>
                    <input
                        type="text"
                        placeholder="Invoice number atau nama..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        style={inputStyle}
                    />
                </div>
                <button onClick={fetchInvoices} disabled={loading} style={filterButtonStyle}>
                    {loading ? '...' : '🔍 Filter'}
                </button>
            </div>

            {/* Table */}
            <div style={tableContainerStyle}>
                <table style={tableStyle}>
                    <thead>
                        <tr>
                            <th style={thStyle}>Invoice Number</th>
                            <th style={thStyle}>Parent Name</th>
                            <th style={thStyle}>Periode</th>
                            <th style={thStyle}>Total</th>
                            <th style={thStyle}>Status</th>
                            <th style={thStyle}>Due Date</th>
                            <th style={thStyle}>Paid Date</th>
                            <th style={thStyle}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {invoices.length === 0 ? (
                            <tr>
                                <td colSpan={8} style={emptyStyle}>Tidak ada invoice</td>
                            </tr>
                        ) : (
                            invoices.map((inv) => (
                                <tr key={inv.id} style={trStyle}>
                                    <td style={tdStyle}>
                                        <Link href={`/invoice/${inv.invoice_number}`} target="_blank" style={linkStyle}>
                                            {inv.invoice_number}
                                        </Link>
                                    </td>
                                    <td style={tdStyle}>{inv.parent_name}</td>
                                    <td style={tdStyle}>{getMonthName(inv.period_month)} {inv.period_year}</td>
                                    <td style={tdStyle}>{formatCurrency(inv.total_amount)}</td>
                                    <td style={tdStyle}>{getStatusBadge(inv.status)}</td>
                                    <td style={tdStyle}>{formatDate(inv.due_date)}</td>
                                    <td style={tdStyle}>{inv.paid_at ? formatDate(inv.paid_at) : '-'}</td>
                                    <td style={tdStyle}>
                                        <div style={actionsStyle}>
                                            <Link href={`/invoice/${inv.invoice_number}`} target="_blank" style={actionLinkStyle}>
                                                👁️
                                            </Link>
                                            {inv.status !== 'PAID' && (
                                                <button
                                                    onClick={() => {
                                                        setShowPaidModal(inv);
                                                        setPaidDate(new Date().toISOString().split('T')[0]);
                                                    }}
                                                    style={actionButtonStyle}
                                                >
                                                    ✅
                                                </button>
                                            )}
                                            <button
                                                onClick={() => setShowDeleteModal(inv)}
                                                style={{ ...actionButtonStyle, color: '#c62828' }}
                                                title="Hapus invoice"
                                            >
                                                🗑️
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Mark Paid Modal */}
            {showPaidModal && (
                <div style={modalOverlayStyle}>
                    <div style={modalStyle}>
                        <h3 style={modalTitleStyle}>Mark as Paid</h3>
                        <p style={modalSubtitleStyle}>Invoice: {showPaidModal.invoice_number}</p>

                        <div style={formGroupStyle}>
                            <label style={formLabelStyle}>Tanggal Bayar</label>
                            <input
                                type="date"
                                value={paidDate}
                                onChange={(e) => setPaidDate(e.target.value)}
                                style={inputStyle}
                            />
                        </div>

                        <div style={formGroupStyle}>
                            <label style={formLabelStyle}>Notes (optional)</label>
                            <textarea
                                value={paidNotes}
                                onChange={(e) => setPaidNotes(e.target.value)}
                                placeholder="Info dari SS bukti transfer..."
                                style={textareaStyle}
                            />
                        </div>

                        <div style={modalActionsStyle}>
                            <button
                                onClick={() => setShowPaidModal(null)}
                                style={cancelButtonStyle}
                            >
                                Batal
                            </button>
                            <button
                                onClick={handleMarkPaid}
                                disabled={!paidDate || markingPaid === showPaidModal.id}
                                style={confirmButtonStyle}
                            >
                                {markingPaid === showPaidModal.id ? 'Saving...' : 'Confirm Paid'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {showDeleteModal && (
                <div style={modalOverlayStyle}>
                    <div style={modalStyle}>
                        <h3 style={modalTitleStyle}>🗑️ Hapus Invoice</h3>
                        <p style={modalSubtitleStyle}>Invoice: {showDeleteModal.invoice_number}</p>

                        <p style={{ color: '#c62828', marginBottom: '20px' }}>
                            Apakah Anda yakin ingin menghapus invoice ini? Tindakan ini tidak dapat dibatalkan.
                        </p>

                        <div style={modalActionsStyle}>
                            <button
                                onClick={() => setShowDeleteModal(null)}
                                style={cancelButtonStyle}
                            >
                                Batal
                            </button>
                            <button
                                onClick={handleDelete}
                                disabled={deleting === showDeleteModal.id}
                                style={{ ...confirmButtonStyle, backgroundColor: '#c62828' }}
                            >
                                {deleting === showDeleteModal.id ? 'Deleting...' : 'Ya, Hapus'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// Styles
const containerStyle: CSSProperties = { padding: '20px' };
const headerStyle: CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' };
const titleStyle: CSSProperties = { fontSize: '24px', fontWeight: 'bold', color: '#1e293b', margin: 0 };
const subtitleStyle: CSSProperties = { color: '#64748b', marginTop: '4px' };
const primaryButtonStyle: CSSProperties = { backgroundColor: '#00a8e8', color: '#fff', border: 'none', padding: '12px 24px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px' };

const successMessageStyle: CSSProperties = { backgroundColor: '#e8f5e9', color: '#2e7d32', padding: '12px 16px', borderRadius: '8px', marginBottom: '20px' };
const errorMessageStyle: CSSProperties = { backgroundColor: '#ffebee', color: '#c62828', padding: '12px 16px', borderRadius: '8px', marginBottom: '20px' };

const statsGridStyle: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px', marginBottom: '20px' };
const statCardStyle: CSSProperties = { backgroundColor: '#fff', padding: '16px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' };
const statLabelStyle: CSSProperties = { color: '#64748b', fontSize: '12px', marginBottom: '4px' };
const statValueStyle: CSSProperties = { fontSize: '24px', fontWeight: 'bold', color: '#1e293b' };

const filtersStyle: CSSProperties = { display: 'flex', gap: '16px', alignItems: 'flex-end', marginBottom: '20px', flexWrap: 'wrap' };
const filterGroupStyle: CSSProperties = { display: 'flex', flexDirection: 'column', gap: '4px' };
const filterLabelStyle: CSSProperties = { fontSize: '12px', color: '#64748b' };
const selectStyle: CSSProperties = { padding: '8px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '14px', minWidth: '100px' };
const inputStyle: CSSProperties = { padding: '8px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '14px', width: '100%' };
const filterButtonStyle: CSSProperties = { padding: '8px 16px', backgroundColor: '#1e293b', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' };

const tableContainerStyle: CSSProperties = { backgroundColor: '#fff', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' };
const tableStyle: CSSProperties = { width: '100%', borderCollapse: 'collapse' };
const thStyle: CSSProperties = { textAlign: 'left', padding: '12px 16px', backgroundColor: '#f8fafc', color: '#64748b', fontSize: '12px', fontWeight: 600, borderBottom: '1px solid #e2e8f0' };
const tdStyle: CSSProperties = { padding: '12px 16px', borderBottom: '1px solid #f1f5f9', fontSize: '14px' };
const trStyle: CSSProperties = { transition: 'background-color 0.15s' };
const emptyStyle: CSSProperties = { textAlign: 'center', padding: '40px', color: '#94a3b8' };
const linkStyle: CSSProperties = { color: '#00a8e8', textDecoration: 'none', fontWeight: 500 };
const actionsStyle: CSSProperties = { display: 'flex', gap: '8px' };
const actionLinkStyle: CSSProperties = { textDecoration: 'none', fontSize: '16px' };
const actionButtonStyle: CSSProperties = { background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', padding: '4px' };

const modalOverlayStyle: CSSProperties = { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 };
const modalStyle: CSSProperties = { backgroundColor: '#fff', padding: '24px', borderRadius: '12px', width: '400px', maxWidth: '90vw' };
const modalTitleStyle: CSSProperties = { fontSize: '18px', fontWeight: 'bold', marginBottom: '4px' };
const modalSubtitleStyle: CSSProperties = { color: '#64748b', marginBottom: '20px' };
const formGroupStyle: CSSProperties = { marginBottom: '16px' };
const formLabelStyle: CSSProperties = { display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: 500 };
const textareaStyle: CSSProperties = { ...inputStyle, minHeight: '80px', resize: 'vertical' };
const modalActionsStyle: CSSProperties = { display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '20px' };
const cancelButtonStyle: CSSProperties = { padding: '8px 16px', backgroundColor: '#f1f5f9', border: 'none', borderRadius: '6px', cursor: 'pointer' };
const confirmButtonStyle: CSSProperties = { padding: '8px 16px', backgroundColor: '#2e7d32', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' };
