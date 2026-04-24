'use client';

import { useState, type CSSProperties, useCallback, useMemo } from 'react';
import Link from 'next/link';
import type { Invoice } from '@/lib/types/invoice';
import { useReminder } from '@/contexts/ReminderContext';
import AssignClassModal from './AssignClassModal';
import SeasonalInvoiceModal from './SeasonalInvoiceModal';
import WeeklyRegistrationModal from './WeeklyRegistrationModal';

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
    const [statusFilter, setStatusFilter] = useState<string>('ALL');
    const [itemsPerPage, setItemsPerPage] = useState<number | 'all'>(10);
    const [currentPage, setCurrentPage] = useState(1);

    const filteredInvoices = useMemo(() => {
        let list = invoices;
        if (statusFilter && statusFilter !== 'ALL') {
            list = list.filter(i => i.status === statusFilter);
        }
        return list;
    }, [invoices, statusFilter]);

    const displayedInvoices = useMemo(() => {
        if (itemsPerPage === 'all') return filteredInvoices;
        const start = (currentPage - 1) * itemsPerPage;
        return filteredInvoices.slice(start, start + itemsPerPage);
    }, [filteredInvoices, currentPage, itemsPerPage]);

    const totalPages = useMemo(() => {
        if (itemsPerPage === 'all') return 1;
        return Math.ceil(filteredInvoices.length / itemsPerPage) || 1;
    }, [filteredInvoices, itemsPerPage]);
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

    // Reminder Hook (from global context)
    const { startReminder, isProcessing: isProcessingQueue } = useReminder();

    // Assign Class Modal for registration invoices
    const [showAssignClassModal, setShowAssignClassModal] = useState(false);
    const [assignClassCoder, setAssignClassCoder] = useState<{ id: string; name: string } | null>(null);

    // Seasonal Invoice Modal
    const [showSeasonalModal, setShowSeasonalModal] = useState(false);
    // Weekly Registration Modal
    const [showWeeklyModal, setShowWeeklyModal] = useState(false);

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

    const formatPeriodRange = (startDate: string, endDate: string) => {
        const start = new Date(startDate);
        const end = new Date(endDate);

        const startMonth = getMonthName(start.getMonth() + 1);
        const startYear = start.getFullYear();

        const endMonth = getMonthName(end.getMonth() + 1);
        const endYear = end.getFullYear();

        // Same month: "Jan 2026"
        if (start.getMonth() === end.getMonth() && startYear === endYear) {
            return `${startMonth} ${startYear}`;
        }

        // Same year: "Jan - Mar 2026"
        if (startYear === endYear) {
            return `${startMonth} - ${endMonth} ${startYear}`;
        }

        // Different years: "Des 2025 - Feb 2026"
        return `${startMonth} ${startYear} - ${endMonth} ${endYear}`;
    };

    const fetchInvoices = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            params.set('month', month.toString());
            params.set('year', year.toString());
            params.set('limit', '1000'); // Fetch all for local pagination
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
                    text: `Berhasil generate ${genData.generated} invoice. (${genData.skipped} skipped). ${genData.errors.length > 0 ? '\nErrors: ' + genData.errors.join(', ') : ''}`
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
    const handlePrepareReminders = async () => {
        // Filter all unpaid invoices (PENDING + OVERDUE)
        const unpaidInvoices = invoices.filter(inv => inv.status === 'PENDING' || inv.status === 'OVERDUE');

        if (unpaidInvoices.length === 0) {
            setMessage({ type: 'error', text: 'Tidak ada invoice yang belum dibayar untuk dikirim reminder.' });
            return;
        }

        // Fetch latest settings for delay configuration
        let delay = { min: 10, max: 30 };
        try {
            const res = await fetch('/api/invoices/settings');
            const settings = await res.json();
            if (res.ok && settings) {
                delay = {
                    min: settings.class_reminder_delay_min || 5,
                    max: settings.class_reminder_delay_max || 15
                };
            }
        } catch (error) {
            console.error('Failed to fetch settings, using defaults', error);
        }

        // Transform to reminder items and start via context
        const items = unpaidInvoices.map(inv => ({
            id: inv.id,
            invoice_number: inv.invoice_number,
            parent_name: inv.parent_name
        }));

        startReminder(items, delay);
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
                const data = await res.json();

                // Show WA confirmation status to admin
                const waStatus = data.waStatus;
                if (waStatus?.sent) {
                    setMessage({ type: 'success', text: `✅ Invoice marked as paid! WhatsApp konfirmasi berhasil dikirim ke ${showPaidModal.parent_name}.` });
                } else {
                    const reason = waStatus?.error || 'Unknown error';
                    setMessage({ type: 'error', text: `⚠️ Invoice marked as paid, tapi WhatsApp konfirmasi GAGAL dikirim: ${reason}` });
                }

                // Check if this is a REGISTRATION invoice - show assign class modal
                const invoice = showPaidModal as any;
                if (invoice.invoice_type === 'REGISTRATION' && invoice.items?.[0]?.coder_id) {
                    const coderItem = invoice.items.find((item: any) => item.coder_id);
                    if (coderItem) {
                        setAssignClassCoder({
                            id: coderItem.coder_id,
                            name: coderItem.coder_name || 'Coder'
                        });
                        setShowAssignClassModal(true);
                    }
                }

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

    const handleUnmarkPaid = async (invoiceId: string) => {
        if (!confirm('Yakin ingin membatalkan status lunas invoice ini?')) return;

        try {
            const res = await fetch(`/api/invoices/${invoiceId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'unmark_paid' })
            });

            if (res.ok) {
                setMessage({ type: 'success', text: 'Status invoice dikembalikan ke Pending' });
                await fetchInvoices();
            } else {
                setMessage({ type: 'error', text: 'Gagal membatalkan status lunas' });
            }
        } catch (error) {
            setMessage({ type: 'error', text: 'Error: ' + String(error) });
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
            <div className="page-head">
                <div>
                    <h1>Invoice</h1>
                    <p>Tagihan Coder per paket pembayaran.</p>
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <button
                        onClick={handleGenerate}
                        disabled={generating || isProcessingQueue}
                        className="btn"
                    >
                        {generating ? '⏳ Generating...' : '⚙️ Generate Invoice'}
                    </button>
                    <button
                        onClick={() => setShowSeasonalModal(true)}
                        className="btn"
                    >
                        📅 Invoice Seasonal
                    </button>
                    <button
                        onClick={() => setShowWeeklyModal(true)}
                        className="btn"
                    >
                        📝 Registrasi Weekly
                    </button>
                    <button
                        onClick={handlePrepareReminders}
                        disabled={generating || isProcessingQueue}
                        className="btn btn-primary"
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

            {/* Stats */}
            <div className="grid grid-4" style={{ marginBottom: 18 }}>
                <div className="stat">
                    <div className="stat-label">Total Invoice</div>
                    <div className="stat-value">{stats.pending + stats.paid + stats.overdue}</div>
                    <div className="stat-icon">🧾</div>
                </div>
                <div className="stat">
                    <div className="stat-label">Pending</div>
                    <div className="stat-value">{stats.pending}</div>
                    <div className="stat-icon">🕒</div>
                </div>
                <div className="stat">
                    <div className="stat-label">Overdue</div>
                    <div className="stat-value">{stats.overdue}</div>
                    <div className="stat-icon">⚠️</div>
                    <div className="stat-foot" style={{ color: '#c62828' }}>perlu follow-up</div>
                </div>
                <div className="stat">
                    <div className="stat-label">Belum Terbayar</div>
                    <div className="stat-value" style={{ fontSize: '24px' }}>{formatCurrency(stats.totalAmount)}</div>
                    <div className="stat-icon">💳</div>
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
                    {loading ? '...' : '🔍 Load Data'}
                </button>
            </div>

            <div className="tabs">
                {[
                    ['ALL', 'Semua', invoices.length],
                    ['PENDING', 'Pending', invoices.filter(i => i.status === 'PENDING').length],
                    ['OVERDUE', 'Overdue', invoices.filter(i => i.status === 'OVERDUE').length],
                    ['PAID', 'Paid', invoices.filter(i => i.status === 'PAID').length]
                ].map(([k, l, n]) => (
                    <div 
                        key={k as string} 
                        className={`tab ${statusFilter === k ? 'active' : ''}`} 
                        onClick={() => { setStatusFilter(k as string); setCurrentPage(1); }}
                    >
                        {l as string} <span className="chip" style={{ marginLeft: 4, fontSize: 10 }}>{n as number}</span>
                    </div>
                ))}
            </div>

            {/* Table */}
            <div className="card" style={{ padding: 0 }}>
                <table className="table">
                    <thead>
                        <tr>
                            <th>Invoice Number</th>
                            <th>Parent Name</th>
                            <th>Periode</th>
                            <th>Total</th>
                            <th>Status</th>
                            <th>Due Date</th>
                            <th>Paid Date</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {displayedInvoices.length === 0 ? (
                            <tr>
                                <td colSpan={8} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-dim)' }}>Tidak ada invoice</td>
                            </tr>
                        ) : (
                            displayedInvoices.map((inv) => (
                                <tr key={inv.id}>
                                    <td className="mono" style={{ fontWeight: 700, fontSize: 12.5 }}>
                                        <Link href={`/invoice/${inv.invoice_number}`} target="_blank" style={linkStyle}>
                                            {inv.invoice_number}
                                        </Link>
                                    </td>
                                    <td><div style={{ fontWeight: 600 }}>{inv.parent_name}</div></td>
                                    <td>{formatPeriodRange(inv.period_start_date, inv.period_end_date)}</td>
                                    <td style={{ fontWeight: 700 }}>{formatCurrency(inv.total_amount)}</td>
                                    <td>
                                        {inv.status === 'PAID' && <span className="badge badge-success">Paid</span>}
                                        {inv.status === 'PENDING' && <span className="badge badge-warn">Pending</span>}
                                        {inv.status === 'OVERDUE' && <span className="badge badge-danger">Overdue</span>}
                                    </td>
                                    <td className="muted">{formatDate(inv.due_date)}</td>
                                    <td className="muted">{inv.paid_at ? formatDate(inv.paid_at) : '-'}</td>
                                    <td style={{ textAlign: 'right' }}>
                                        <div className="row gap-1" style={{ justifyContent: 'flex-end' }}>
                                            <Link href={`/invoice/${inv.invoice_number}`} target="_blank" className="btn btn-sm btn-ghost">
                                                👁️
                                            </Link>
                                            {inv.status !== 'PAID' && (
                                                <button
                                                    onClick={() => {
                                                        setShowPaidModal(inv);
                                                        setPaidDate(new Date().toISOString().split('T')[0]);
                                                    }}
                                                    className="btn btn-sm btn-ghost"
                                                    title="Tandai Lunas"
                                                >
                                                    ✅
                                                </button>
                                            )}
                                            {inv.status === 'PAID' && (
                                                <button
                                                    onClick={() => handleUnmarkPaid(inv.id)}
                                                    className="btn btn-sm btn-ghost"
                                                    title="Batalkan Lunas"
                                                    style={{ color: '#f59e0b' }}
                                                >
                                                    ↩️
                                                </button>
                                            )}
                                            <button
                                                onClick={() => setShowDeleteModal(inv)}
                                                className="btn btn-sm btn-ghost"
                                                title="Hapus invoice"
                                                style={{ color: '#ef4444' }}
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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', borderTop: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span className="muted" style={{ fontSize: '0.9rem' }}>Tampilkan:</span>
                        <select 
                            value={itemsPerPage} 
                            onChange={(e) => {
                                setItemsPerPage(e.target.value === 'all' ? 'all' : Number(e.target.value));
                                setCurrentPage(1);
                            }}
                            className="input"
                            style={{ padding: '0.3rem', width: 'auto', fontSize: '0.9rem' }}
                        >
                            <option value={10}>10 baris</option>
                            <option value={20}>20 baris</option>
                            <option value={50}>50 baris</option>
                            <option value="all">Semua</option>
                        </select>
                    </div>
                    {itemsPerPage !== 'all' && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <button 
                                className="btn btn-sm btn-ghost" 
                                disabled={currentPage === 1}
                                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                            >
                                Prev
                            </button>
                            <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>
                                {currentPage} / {totalPages}
                            </span>
                            <button 
                                className="btn btn-sm btn-ghost" 
                                disabled={currentPage === totalPages}
                                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                            >
                                Next
                            </button>
                        </div>
                    )}
                </div>
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

            {/* Assign Class Modal for Registration Invoices */}
            <AssignClassModal
                open={showAssignClassModal}
                onClose={() => {
                    setShowAssignClassModal(false);
                    setAssignClassCoder(null);
                }}
                coder={assignClassCoder}
            />

            {/* Seasonal Invoice Modal */}
            <SeasonalInvoiceModal
                isOpen={showSeasonalModal}
                onClose={() => setShowSeasonalModal(false)}
                onSuccess={() => fetchInvoices()}
            />

            {/* Weekly Registration Modal */}
            <WeeklyRegistrationModal
                isOpen={showWeeklyModal}
                onClose={() => setShowWeeklyModal(false)}
                onSuccess={() => fetchInvoices()}
            />
        </div>
    );
}

// Styles
const containerStyle: CSSProperties = { width: '100%', fontFamily: 'var(--font-ui)' };
const headerStyle: CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' };
const titleStyle: CSSProperties = { fontSize: '1.8rem', fontWeight: 800, color: 'var(--text)', margin: 0, letterSpacing: '-0.02em' };
const subtitleStyle: CSSProperties = { color: 'var(--text-muted)', fontSize: '1rem', marginTop: '0.5rem' };

const primaryButtonStyle: CSSProperties = {
    padding: '0.75rem 1.5rem',
    background: 'linear-gradient(135deg, var(--c-navy), var(--c-green))',
    color: 'white',
    border: 'none',
    borderRadius: '12px',
    fontWeight: 600,
    cursor: 'pointer',
    fontSize: '0.95rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    boxShadow: '0 16px 30px -22px rgba(34, 54, 123, 0.75)',
    transition: 'all 0.2s',
};

const secondaryButtonStyle: CSSProperties = {
    padding: '0.75rem 1.5rem',
    background: 'var(--surface)',
    color: 'var(--text)',
    border: '1px solid var(--border)',
    borderRadius: '12px',
    fontWeight: 600,
    cursor: 'pointer',
    fontSize: '0.95rem',
    transition: 'all 0.2s',
};

const statsGridStyle: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '2rem' };
const statCardStyle: CSSProperties = { background: 'var(--surface)', padding: '1.5rem', borderRadius: 'calc(var(--radius-lg) + 2px)', boxShadow: 'var(--shadow-sm)', border: '1px solid var(--border)' };
const statLabelStyle: CSSProperties = { color: 'var(--text-muted)', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' };
const statValueStyle: CSSProperties = { fontSize: '2rem', fontWeight: 700, color: 'var(--text)', margin: 0, lineHeight: 1 };

const filtersStyle: CSSProperties = { display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap', background: 'var(--surface)', padding: '1rem', borderRadius: '16px', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' };
const filterGroupStyle: CSSProperties = { display: 'flex', flexDirection: 'column', gap: '0.25rem' };
const filterLabelStyle: CSSProperties = { fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' };
const selectStyle: CSSProperties = { padding: '0.7rem 0.8rem', borderRadius: '12px', border: '1px solid var(--border)', fontSize: '0.9rem', minWidth: '140px', outline: 'none', background: 'var(--surface-2)', color: 'var(--text)' };
const inputStyle: CSSProperties = { padding: '0.7rem 0.8rem', borderRadius: '12px', border: '1px solid var(--border)', fontSize: '0.9rem', width: '250px', outline: 'none', background: 'var(--surface-2)', color: 'var(--text)' };
const filterButtonStyle: CSSProperties = { padding: '0.6rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '0.9rem', alignSelf: 'flex-end' };


const successMessageStyle: CSSProperties = { padding: '1rem', background: '#dcfce7', color: '#166534', borderRadius: '12px', marginBottom: '1.5rem', border: '1px solid #bbf7d0', fontWeight: 500 };
const errorMessageStyle: CSSProperties = { padding: '1rem', background: '#fff1df', color: '#b45309', borderRadius: '12px', marginBottom: '1.5rem', border: '1px solid #fed7aa', fontWeight: 500 };

const modalOverlayStyle: CSSProperties = {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 1000, backdropFilter: 'blur(4px)'
};

const modalContentStyle: CSSProperties = {
    background: 'var(--surface)', padding: '2rem', borderRadius: '18px', width: '90%', maxWidth: '500px',
    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
};
const modalStyle = modalContentStyle; // Alias for compatibility

const modalActionsStyle: CSSProperties = { display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' };
const labelStyle: CSSProperties = { display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-muted)' };
const textAreaStyle: CSSProperties = { width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', marginBottom: '1rem', minHeight: '80px', fontSize: '0.9rem' };

// Table Styles
const tableContainerStyle: CSSProperties = { background: 'var(--surface)', borderRadius: '18px', border: '1px solid var(--border)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' };
const tableStyle: CSSProperties = { width: '100%', borderCollapse: 'collapse' };
const thStyle: CSSProperties = { textAlign: 'left', padding: '1rem', background: 'var(--surface-2)', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', borderBottom: '1px solid var(--border)', textTransform: 'uppercase', letterSpacing: '0.05em' };
const tdStyle: CSSProperties = { padding: '1rem', borderBottom: '1px solid var(--border)', color: 'var(--text)', fontSize: '0.9rem' };
const trStyle: CSSProperties = { transition: 'background 0.2s' };
const emptyStyle: CSSProperties = { padding: '3rem', textAlign: 'center', color: 'var(--text-dim)' };
const linkStyle: CSSProperties = { color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 };
const actionsStyle: CSSProperties = { display: 'flex', gap: '0.5rem' };
const actionButtonStyle: CSSProperties = { padding: '0.4rem', border: '1px solid var(--border)', borderRadius: '10px', background: 'var(--surface)', cursor: 'pointer', color: 'var(--text-muted)', transition: 'all 0.2s' };
const actionLinkStyle: CSSProperties = { display: 'block' };
const modalTitleStyle: CSSProperties = { fontSize: '18px', fontWeight: 'bold', marginBottom: '4px' };
const modalSubtitleStyle: CSSProperties = { color: 'var(--text-muted)', marginBottom: '20px' };
const formGroupStyle: CSSProperties = { marginBottom: '16px' };
const formLabelStyle: CSSProperties = { display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: 500 };
const textareaStyle: CSSProperties = { ...inputStyle, minHeight: '80px', resize: 'vertical' };
const cancelButtonStyle: CSSProperties = { padding: '10px 20px', backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', cursor: 'pointer', fontWeight: 600, color: 'var(--text)', fontSize: '0.9rem' };
const confirmButtonStyle: CSSProperties = { padding: '10px 16px', backgroundColor: '#15803d', color: '#fff', border: 'none', borderRadius: '12px', cursor: 'pointer' };
