'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2, Loader2 } from 'lucide-react';

export default function DeleteEkskulPlanButton({ planId, planName }: { planId: string; planName: string }) {
    const router = useRouter();
    const [loading, setLoading] = useState(false);

    const handleDelete = async () => {
        if (!confirm(`Hapus lesson plan "${planName}"? Semua lesson di dalamnya juga akan dihapus.`)) return;
        setLoading(true);
        try {
            const res = await fetch(`/api/admin/ekskul/plans/${planId}`, { method: 'DELETE' });
            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body.error || 'Gagal menghapus');
            }
            router.refresh();
        } catch (error: any) {
            alert(`Terjadi kesalahan: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <button
            type="button"
            onClick={handleDelete}
            disabled={loading}
            title="Hapus Plan"
            style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                padding: '0.4rem 0.75rem', borderRadius: '6px',
                background: '#fef2f2', color: '#dc2626',
                border: '1px solid #fecaca', fontSize: '0.8rem',
                fontWeight: 600, cursor: 'pointer', opacity: loading ? 0.7 : 1,
            }}
        >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
            Hapus
        </button>
    );
}
