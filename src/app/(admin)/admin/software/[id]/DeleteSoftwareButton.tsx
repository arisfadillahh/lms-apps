'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import type { CSSProperties } from 'react';

type DeleteSoftwareButtonProps = {
    softwareId: string;
    softwareName: string;
};

export default function DeleteSoftwareButton({ softwareId, softwareName }: DeleteSoftwareButtonProps) {
    const router = useRouter();
    const [isDeleting, setIsDeleting] = useState(false);

    const handleDelete = async () => {
        const confirmed = window.confirm(`Yakin ingin menghapus software "${softwareName}"? Software yang sudah dihubungkan ke Block akan terputus.`);
        if (!confirmed) return;

        setIsDeleting(true);
        try {
            const response = await fetch(`/api/admin/software/${softwareId}`, {
                method: 'DELETE',
            });

            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                throw new Error(data.error ?? 'Gagal menghapus software');
            }

            router.push('/admin/software');
            router.refresh();
        } catch (error) {
            window.alert(error instanceof Error ? error.message : 'Terjadi kesalahan');
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <button
            onClick={handleDelete}
            disabled={isDeleting}
            style={deleteButtonStyle}
        >
            <Trash2 size={16} />
            <span>{isDeleting ? 'Menghapus...' : 'Hapus'}</span>
        </button>
    );
}

const deleteButtonStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '10px 16px',
    background: '#fef2f2',
    color: '#dc2626',
    borderRadius: '8px',
    fontWeight: '600',
    fontSize: '14px',
    border: 'none',
    cursor: 'pointer',
};
