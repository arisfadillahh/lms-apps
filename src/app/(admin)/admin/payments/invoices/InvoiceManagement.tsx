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

    // Modal & Action States
    const [generating, setGenerating] = useState(false);
    const [markingPaid, setMarkingPaid] = useState<string | null>(null);
    const [showPaidModal, setShowPaidModal] = useState<Invoice | null>(null);
    const [paidDate, setPaidDate] = useState('');
    const [paidNotes, setPaidNotes] = useState('');
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [showDeleteModal, setShowDeleteModal] = useState<Invoice | null>(null);
    const [deleting, setDeleting] = useState<string | null>(null);

    // Reminder Queue State
    const [showReminderModal, setShowReminderModal] = useState(false);
    const [reminderQueue, setReminderQueue] = useState<Array<{
        id: string;
        invoice_number: string;
        parent_name: string;
        status: 'pending' | 'sending' | 'success' | 'error';
        error?: string;
    }>>([]);
    const [isProcessingQueue, setIsProcessingQueue] = useState(false);

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

    // Action: Generate Invoices ONLY
    const handleGenerate = async () => {
        setGenerating(true);
        setMessage(null);

        try {
            const genRes = await fetch('/api/invoices/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ month, year })
            });
            const genData = await genRes.json();

            if (genData.success) {
                setMessage({
                    type: 'success',
                    text: `Berhasil generate ${genData.generated} invoice. (${genData.skipped} skipped, ${genData.errors.length} errors)`
                });
                await fetchInvoices();
            } else {
                setMessage({ type: 'error', text: genData.errors?.join(', ') || 'Failed to generate' });
            }

        } catch (error) {
            setMessage({ type: 'error', text: 'Error: ' + String(error) });
        } finally {
            setGenerating(false);
        }
    };

    // Action: Prepare Reminder Queue
    const handlePrepareReminders = () => {
        // Filter pending invoices
        const pendingInvoices = invoices.filter(inv => inv.status === 'PENDING');

        if (pendingInvoices.length === 0) {
            setMessage({ type: 'error', text: 'Tidak ada invoice pending untuk dikirim reminder.' });
            return;
        }

        const queue = pendingInvoices.map(inv => ({
            id: inv.id,
            invoice_number: inv.invoice_number,
            parent_name: inv.parent_name,
            status: 'pending' as const
        }));

        setReminderQueue(queue);
        setShowReminderModal(true);
        setIsProcessingQueue(false); // User must click "Start" in modal
    };

    // Action: Process Queue
    const processQueue = async () => {
        setIsProcessingQueue(true);

        // Iterate through queue using index to update state
        // Note: logical clone of queue for processing
        const currentQueue = [...reminderQueue];

        for (let i = 0; i < currentQueue.length; i++) {
            if (currentQueue[i].status === 'success') continue; // Skip already sent if any

            // Update status to sending
            setReminderQueue(prev => prev.map((item, idx) => idx === i ? { ...item, status: 'sending' } : item));

            try {
                // Send API request
                const res = await fetch('/api/whatsapp/send-single-reminder', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ invoiceId: currentQueue[i].id })
                });
                const data = await res.json();

                if (data.success) {
                    setReminderQueue(prev => prev.map((item, idx) => idx === i ? { ...item, status: 'success' } : item));
                } else {
                    setReminderQueue(prev => prev.map((item, idx) => idx === i ? { ...item, status: 'error', error: data.error } : item));
                }

            } catch (error) {
                setReminderQueue(prev => prev.map((item, idx) => idx === i ? { ...item, status: 'error', error: String(error) } : item));
            }

            // Small delay to prevent rate limit/UI jitter
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        setIsProcessingQueue(false);
        await fetchInvoices(); // Refresh main list
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
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <button
                        onClick={handleGenerate}
                        disabled={generating || isProcessingQueue}
                        style={{ ...secondaryButtonStyle, opacity: generating ? 0.7 : 1 }}
                    >
                        {generating ? '⏳ Generating...' : '⚙️ Generate Invoice'}
                    </button>
                    <button
                        onClick={handlePrepareReminders}
                        disabled={generating || isProcessingQueue}
                        style={{ ...primaryButtonStyle, opacity: isProcessingQueue ? 0.7 : 1 }}
                    >
                        📤 Kirim Reminder
                    </button>
                </div>
            </div>

            {/* Message */}
            {message && (
                <div style={message.type === 'success' ? successMessageStyle : errorMessageStyle}>
                    {message.text}
                </div>
            )}

            {/* Progress Modal */}
            {showReminderModal && (
                <div style={modalOverlayStyle}>
                    <div style={{ ...modalContentStyle, maxWidth: '600px', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
                        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1rem' }}>
                            Kirim Reminder WhatsApp
                        </h2>

                        <div style={{ flex: 1, overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px', marginBottom: '1rem' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                                <thead style={{ background: '#f8fafc', position: 'sticky', top: 0 }}>
                                    <tr>
                                        <th style={{ padding: '0.5rem', textAlign: 'left' }}>Invoice</th>
                                        <th style={{ padding: '0.5rem', textAlign: 'left' }}>Orang Tua</th>
                                        <th style={{ padding: '0.5rem', textAlign: 'center' }}>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {reminderQueue.map((item) => (
                                        <tr key={item.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                            <td style={{ padding: '0.5rem' }}>{item.invoice_number}</td>
                                            <td style={{ padding: '0.5rem' }}>{item.parent_name}</td>
                                            <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                                                {item.status === 'pending' && <span style={{ color: '#64748b' }}>⏳ Waiting</span>}
                                                {item.status === 'sending' && <span style={{ color: '#f59e0b' }}>📤 Sending...</span>}
                                                {item.status === 'success' && <span style={{ color: '#16a34a' }}>✅ Sent</span>}
                                                {item.status === 'error' && <span style={{ color: '#ef4444' }}>❌ Error</span>}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Summary */}
                        <div style={{ marginBottom: '1rem', fontSize: '0.9rem', color: '#64748b' }}>
                            Progress: {reminderQueue.filter(i => i.status === 'success' || i.status === 'error').length} / {reminderQueue.length}
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                            {!isProcessingQueue && (
                                <button
                                    onClick={() => setShowReminderModal(false)}
                                    style={secondaryButtonStyle}
                                >
                                    Tutup
                                </button>
                            )}

                            {!isProcessingQueue && reminderQueue.some(i => i.status === 'pending') && (
                                <button
                                    onClick={processQueue}
                                    style={primaryButtonStyle}
                                >
                                    ▶️ Mulai Kirim ({reminderQueue.filter(i => i.status === 'pending').length})
                                </button>
                            )}

                            {isProcessingQueue && (
                                <button disabled style={{ ...primaryButtonStyle, opacity: 0.7, cursor: 'wait' }}>
                                    Sedang Mengirim...
                                </button>
                            )}
                        </div>
                    </div>
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
const containerStyle: CSSProperties = { padding: '2rem', maxWidth: '1200px', margin: '0 auto', fontFamily: 'Inter, sans-serif' };
const headerStyle: CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' };
const titleStyle: CSSProperties = { fontSize: '1.8rem', fontWeight: 800, color: '#1e293b', margin: 0, letterSpacing: '-0.02em' };
const subtitleStyle: CSSProperties = { color: '#64748b', fontSize: '1rem', marginTop: '0.5rem' };

const primaryButtonStyle: CSSProperties = {
    padding: '0.75rem 1.5rem',
    background: '#3b82f6',
    color: 'white',
    border: 'none',
    borderRadius: '10px',
    fontWeight: 600,
    cursor: 'pointer',
    fontSize: '0.95rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    boxShadow: '0 4px 6px -1px rgba(59, 130, 246, 0.2)',
    transition: 'all 0.2s',
};

const secondaryButtonStyle: CSSProperties = {
    padding: '0.75rem 1.5rem',
    background: '#ffffff',
    color: '#475569',
    border: '1px solid #cbd5e1',
    borderRadius: '10px',
    fontWeight: 600,
    cursor: 'pointer',
    fontSize: '0.95rem',
    transition: 'all 0.2s',
};

const statsGridStyle: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '2rem' };
const statCardStyle: CSSProperties = { background: 'white', padding: '1.5rem', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)', border: '1px solid #e2e8f0' };
const statLabelStyle: CSSProperties = { color: '#64748b', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' };
const statValueStyle: CSSProperties = { fontSize: '2rem', fontWeight: 700, color: '#1e293b', margin: 0, lineHeight: 1 };

const filtersStyle: CSSProperties = { display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap', background: 'white', padding: '1rem', borderRadius: '12px', border: '1px solid #e2e8f0' };
const filterGroupStyle: CSSProperties = { display: 'flex', flexDirection: 'column', gap: '0.25rem' };
const filterLabelStyle: CSSProperties = { fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' };
const selectStyle: CSSProperties = { padding: '0.6rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.9rem', minWidth: '140px', outline: 'none' };
const inputStyle: CSSProperties = { padding: '0.6rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.9rem', width: '250px', outline: 'none' };
const filterButtonStyle: CSSProperties = { padding: '0.6rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '0.9rem', alignSelf: 'flex-end' };


const successMessageStyle: CSSProperties = { padding: '1rem', background: '#dcfce7', color: '#166534', borderRadius: '8px', marginBottom: '1.5rem', border: '1px solid #bbf7d0', fontWeight: 500 };
const errorMessageStyle: CSSProperties = { padding: '1rem', background: '#fee2e2', color: '#991b1b', borderRadius: '8px', marginBottom: '1.5rem', border: '1px solid #fecaca', fontWeight: 500 };

const modalOverlayStyle: CSSProperties = {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 1000, backdropFilter: 'blur(4px)'
};

const modalContentStyle: CSSProperties = {
    background: 'white', padding: '2rem', borderRadius: '16px', width: '90%', maxWidth: '500px',
    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
};
const modalStyle = modalContentStyle; // Alias for compatibility

const modalActionsStyle: CSSProperties = { display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' };
const labelStyle: CSSProperties = { display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: 600, color: '#475569' };
const textAreaStyle: CSSProperties = { width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', marginBottom: '1rem', minHeight: '80px', fontSize: '0.9rem' };

// Table Styles
const tableContainerStyle: CSSProperties = { background: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' };
const tableStyle: CSSProperties = { width: '100%', borderCollapse: 'collapse' };
const thStyle: CSSProperties = { textAlign: 'left', padding: '1rem', background: '#f8fafc', fontSize: '0.75rem', fontWeight: 600, color: '#64748b', borderBottom: '1px solid #e2e8f0', textTransform: 'uppercase', letterSpacing: '0.05em' };
const tdStyle: CSSProperties = { padding: '1rem', borderBottom: '1px solid #f1f5f9', color: '#334155', fontSize: '0.9rem' };
const trStyle: CSSProperties = { transition: 'background 0.2s' };
const emptyStyle: CSSProperties = { padding: '3rem', textAlign: 'center', color: '#94a3b8' };
const linkStyle: CSSProperties = { color: '#3b82f6', textDecoration: 'none', fontWeight: 600 };
const actionsStyle: CSSProperties = { display: 'flex', gap: '0.5rem' };
const actionButtonStyle: CSSProperties = { padding: '0.4rem', border: '1px solid #cbd5e1', borderRadius: '8px', background: 'white', cursor: 'pointer', color: '#64748b', transition: 'all 0.2s' };
const actionLinkStyle: CSSProperties = { display: 'block' };
const modalTitleStyle: CSSProperties = { fontSize: '18px', fontWeight: 'bold', marginBottom: '4px' };
const modalSubtitleStyle: CSSProperties = { color: '#64748b', marginBottom: '20px' };
const formGroupStyle: CSSProperties = { marginBottom: '16px' };
const formLabelStyle: CSSProperties = { display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: 500 };
const textareaStyle: CSSProperties = { ...inputStyle, minHeight: '80px', resize: 'vertical' };
const cancelButtonStyle: CSSProperties = { padding: '8px 16px', backgroundColor: '#f1f5f9', border: 'none', borderRadius: '6px', cursor: 'pointer' };
const confirmButtonStyle: CSSProperties = { padding: '8px 16px', backgroundColor: '#2e7d32', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' };
