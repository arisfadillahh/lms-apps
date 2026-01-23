'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { CSSProperties } from 'react';

interface ReportActionsProps {
    reportId: string;
    currentStatus: string;
}

const STATUS_OPTIONS = [
    { value: 'PENDING', label: 'Menunggu' },
    { value: 'IN_PROGRESS', label: 'Sedang Diproses' },
    { value: 'RESOLVED', label: 'Selesai' },
    { value: 'DISMISSED', label: 'Ditolak' },
];

export default function ReportActions({ reportId, currentStatus }: ReportActionsProps) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [status, setStatus] = useState(currentStatus);

    const handleStatusChange = (newStatus: string) => {
        setStatus(newStatus);

        startTransition(async () => {
            try {
                const response = await fetch(`/api/admin/lesson-reports/${reportId}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ status: newStatus }),
                });

                if (!response.ok) {
                    console.error('Failed to update status');
                    setStatus(currentStatus); // Revert
                    return;
                }

                router.refresh();
            } catch (error) {
                console.error('Error updating status:', error);
                setStatus(currentStatus); // Revert
            }
        });
    };

    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.85rem', color: '#64748b' }}>Status:</span>
            <select
                value={status}
                onChange={(e) => handleStatusChange(e.target.value)}
                disabled={isPending}
                style={selectStyle}
            >
                {STATUS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                        {opt.label}
                    </option>
                ))}
            </select>
            {isPending && <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Menyimpan...</span>}
        </div>
    );
}

const selectStyle: CSSProperties = {
    padding: '0.4rem 0.6rem',
    borderRadius: '6px',
    border: '1px solid #e2e8f0',
    fontSize: '0.85rem',
    color: '#1e293b',
    background: '#fff',
    cursor: 'pointer',
};
