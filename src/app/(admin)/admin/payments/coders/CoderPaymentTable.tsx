'use client';

import { useState, useMemo, type CSSProperties } from 'react';
import Link from 'next/link';
import AssignPaymentButton from './AssignPaymentButton';
import StopPaymentButton from './StopPaymentButton';
import EditPaymentButton from './EditPaymentButton';

type Period = {
    id: string;
    start_date: string;
    end_date: string;
    total_amount: number;
    status: string;
    payment_plan_id?: string;
    pricing_id?: string;
};

type CoderData = {
    id: string;
    full_name: string;
    username: string;
    className?: string; // Comma separated classes
    activePeriod?: Period;
    // activePeriod is the currently running period
    // If no activePeriod, we might want to show the LAST expired period?
    // For simplicity, let's stick to what we had: activePeriod or null.
};

type Props = {
    coders: CoderData[];
    plans: any[];
    pricing: any[];
};

export default function CoderPaymentTable({ coders, plans, pricing }: Props) {
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'EXPIRED' | 'NONE'>('ALL');
    const [classFilter, setClassFilter] = useState('ALL');

    // Extract unique classes for filter
    const uniqueClasses = useMemo(() => {
        const classes = new Set<string>();
        coders.forEach(c => {
            if (c.className) {
                c.className.split(', ').forEach(cls => classes.add(cls));
            }
        });
        return Array.from(classes).sort();
    }, [coders]);

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
    };

    const getDaysLeft = (endDate: string) => {
        return Math.ceil((new Date(endDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
    };

    const getStatus = (coder: CoderData) => {
        if (coder.activePeriod) {
            const days = getDaysLeft(coder.activePeriod.end_date);
            if (days < 0) return 'EXPIRED'; // Should technically not happen if filtered by 'ACTIVE' status from DB, but good fallback
            return 'ACTIVE';
        }
        return 'NONE';
    };

    // Filter logic
    const filteredCoders = useMemo(() => {
        return coders.filter((coder) => {
            const status = getStatus(coder);
            const matchesSearch = coder.full_name.toLowerCase().includes(search.toLowerCase()) ||
                coder.username.toLowerCase().includes(search.toLowerCase());

            const matchesStatus = statusFilter === 'ALL' ||
                (statusFilter === 'ACTIVE' && status === 'ACTIVE') ||
                (statusFilter === 'NONE' && status === 'NONE') ||
                // For "EXPIRED", distinct from NONE? Current logic says if no active period => NONE.
                // To detect EXPIRED specifically, we'd need to know if they HAD a past period.
                // Since we simplified, let's treat NONE as "No Active Plan".
                // For now, let's stick to basics.
                (statusFilter === 'EXPIRED' && false); // Placeholder if we don't pass history

            const matchesClass = classFilter === 'ALL' ||
                (coder.className && coder.className.includes(classFilter));

            return matchesSearch && matchesStatus && matchesClass;
        });
    }, [coders, search, statusFilter, classFilter]);

    return (
        <div>
            {/* Filters */}
            <div style={{ marginBottom: '1.5rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                <input
                    type="text"
                    placeholder="Cari nama atau username..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    style={searchInputStyle}
                />
                <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as any)}
                    style={selectStyle}
                >
                    <option value="ALL">Semua Status</option>
                    <option value="ACTIVE">Aktif (Berbayar)</option>
                    <option value="NONE">Belum Ada / Expired</option>
                </select>
                <select
                    value={classFilter}
                    onChange={(e) => setClassFilter(e.target.value)}
                    style={selectStyle}
                >
                    <option value="ALL">Semua Kelas</option>
                    {uniqueClasses.map(cls => (
                        <option key={cls} value={cls}>{cls}</option>
                    ))}
                </select>
            </div>

            {/* Table */}
            <div style={tableContainerStyle}>
                <table style={tableStyle}>
                    <thead>
                        <tr>
                            <th style={thStyle}>Nama Siswa</th>
                            <th style={thStyle}>Kelas</th>
                            <th style={thStyle}>Status</th>
                            <th style={thStyle}>Periode Aktif</th>
                            <th style={thStyle}>Sisa Hari</th>
                            <th style={thStyle}>Aksi</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredCoders.length > 0 ? (
                            filteredCoders.map((coder) => {
                                const status = getStatus(coder);
                                const daysLeft = coder.activePeriod ? getDaysLeft(coder.activePeriod.end_date) : 0;

                                return (
                                    <tr key={coder.id}>
                                        <td style={tdStyle}>
                                            <div style={{ fontWeight: 600, color: '#0f172a' }}>{coder.full_name}</div>
                                            <div style={{ fontSize: '0.8rem', color: '#64748b' }}>@{coder.username}</div>
                                        </td>
                                        <td style={tdStyle}>
                                            {coder.className ? (
                                                <span style={{ fontSize: '0.85rem' }}>{coder.className}</span>
                                            ) : (
                                                <span style={{ fontSize: '0.8rem', color: '#94a3b8', fontStyle: 'italic' }}>-</span>
                                            )}
                                        </td>
                                        <td style={tdStyle}>
                                            <span style={statusBadgeStyle(status, daysLeft)}>
                                                {status === 'ACTIVE' ? (daysLeft <= 7 ? 'Jatuh Tempo' : 'Aktif') : 'Tidak Aktif'}
                                            </span>
                                        </td>
                                        <td style={tdStyle}>
                                            {coder.activePeriod ? (
                                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                    <span style={{ fontSize: '0.85rem' }}>{formatDate(coder.activePeriod.start_date)} - {formatDate(coder.activePeriod.end_date)}</span>
                                                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{formatCurrency(coder.activePeriod.total_amount)}</span>
                                                </div>
                                            ) : '-'}
                                        </td>
                                        <td style={tdStyle}>
                                            {coder.activePeriod ? (
                                                <span style={{
                                                    color: daysLeft <= 7 ? '#d97706' : '#16a34a',
                                                    fontWeight: 600
                                                }}>
                                                    {daysLeft} hari
                                                </span>
                                            ) : '-'}
                                        </td>
                                        <td style={tdStyle}>
                                            <div style={{ display: 'flex', alignItems: 'center' }}>
                                                {coder.activePeriod && status === 'ACTIVE' ? (
                                                    <>
                                                        <EditPaymentButton
                                                            period={{
                                                                ...coder.activePeriod,
                                                                payment_plan_id: coder.activePeriod.payment_plan_id,
                                                                pricing_id: coder.activePeriod.pricing_id
                                                            }}
                                                            coderName={coder.full_name}
                                                            plans={plans}
                                                            pricing={pricing}
                                                        />
                                                        <StopPaymentButton periodId={coder.activePeriod.id} />
                                                    </>
                                                ) : (
                                                    <AssignPaymentButton
                                                        coderId={coder.id}
                                                        coderName={coder.full_name}
                                                        plans={plans}
                                                        pricing={pricing}
                                                    />
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })
                        ) : (
                            <tr>
                                <td colSpan={7} style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
                                    Tidak ada data siswa yang sesuai filter.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            <p style={{ marginTop: '1rem', fontSize: '0.85rem', color: '#64748b' }}>
                Total Siswa: {filteredCoders.length} / {coders.length}
            </p>
        </div>
    );
}

// Styles
const searchInputStyle: CSSProperties = {
    padding: '0.6rem 1rem',
    borderRadius: '0.5rem',
    border: '1px solid #cbd5e1',
    width: '250px',
    fontSize: '0.9rem'
};

const selectStyle: CSSProperties = {
    padding: '0.6rem 1rem',
    borderRadius: '0.5rem',
    border: '1px solid #cbd5e1',
    background: 'white',
    fontSize: '0.9rem',
    cursor: 'pointer'
};

const tableContainerStyle: CSSProperties = {
    background: '#fff',
    borderRadius: '0.75rem',
    border: '1px solid #e2e8f0',
    overflowX: 'auto',
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
};

const tableStyle: CSSProperties = {
    width: '100%',
    borderCollapse: 'collapse',
    minWidth: '800px'
};

const thStyle: CSSProperties = {
    textAlign: 'left',
    padding: '0.85rem 1rem',
    background: '#f8fafc',
    fontSize: '0.85rem',
    fontWeight: 600,
    color: '#475569',
    borderBottom: '1px solid #e2e8f0',
    whiteSpace: 'nowrap'
};

const tdStyle: CSSProperties = {
    padding: '0.85rem 1rem',
    borderBottom: '1px solid #f1f5f9',
    color: '#334155',
    verticalAlign: 'middle'
};

const statusBadgeStyle = (status: string, daysLeft: number): CSSProperties => {
    let bg = '#f1f5f9';
    let color = '#64748b';

    if (status === 'ACTIVE') {
        if (daysLeft <= 7) {
            bg = '#fff7ed';
            color = '#c2410c'; // Orange for warning
        } else {
            bg = '#dcfce7';
            color = '#16a34a'; // Green for ok
        }
    } else {
        bg = '#fee2e2'; // Red for expired/none
        color = '#991b1b';
    }

    return {
        display: 'inline-block',
        padding: '0.25rem 0.6rem',
        borderRadius: '9999px',
        fontSize: '0.75rem',
        fontWeight: 600,
        background: bg,
        color: color,
        whiteSpace: 'nowrap'
    };
};
