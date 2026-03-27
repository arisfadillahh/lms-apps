'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Copy, Loader2 } from 'lucide-react';

export default function DuplicateEkskulPlanButton({ planId, planName }: { planId: string; planName: string }) {
    const router = useRouter();
    const [loading, setLoading] = useState(false);

    const handleDuplicate = async () => {
        if (!confirm(`Duplikat lesson plan "${planName}"?`)) return;
        setLoading(true);
        try {
            const res = await fetch(`/api/admin/ekskul/plans/${planId}/duplicate`, { method: 'POST' });
            if (!res.ok) throw new Error('Gagal menduplikat');
            router.refresh();
        } catch (error) {
            alert('Terjadi kesalahan saat menduplikat plan');
        } finally {
            setLoading(false);
        }
    };

    return (
        <button
            type="button"
            onClick={handleDuplicate}
            disabled={loading}
            title="Duplikat Plan"
            style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                padding: '0.4rem 0.75rem', borderRadius: '6px',
                background: '#eff6ff', color: '#1e40af',
                border: '1px solid #bfdbfe', fontSize: '0.8rem',
                fontWeight: 600, cursor: 'pointer', opacity: loading ? 0.7 : 1,
            }}
        >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Copy size={14} />}
            Duplikat
        </button>
    );
}
