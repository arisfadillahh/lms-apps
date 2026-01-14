'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Props = {
    periodId: string;
    onSuccess?: () => void;
};

export default function StopPaymentButton({ periodId, onSuccess }: Props) {
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleStop = async () => {
        if (!confirm('Apakah Anda yakin ingin menonaktifkan pembayaran ini? Status akan menjadi EXPIRED dan masa aktif berakhir hari ini.')) {
            return;
        }

        setLoading(true);
        try {
            const res = await fetch('/api/admin/payments/stop', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ periodId }),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Failed to stop payment');
            }

            alert('Pembayaran berhasil dinonaktifkan.');
            router.refresh();
            if (onSuccess) onSuccess();
        } catch (error: any) {
            alert(error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <button
            onClick={handleStop}
            disabled={loading}
            style={{
                background: '#fee2e2',
                color: '#991b1b',
                border: 'none',
                padding: '0.4rem 0.8rem',
                borderRadius: '0.375rem',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
                marginLeft: '0.5rem',
                opacity: loading ? 0.7 : 1
            }}
            title="Nonaktifkan Pembayaran"
        >
            {loading ? '...' : 'Stop'}
        </button>
    );
}
