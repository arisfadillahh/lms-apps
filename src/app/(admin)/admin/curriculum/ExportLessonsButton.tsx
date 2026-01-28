'use client';

import { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';

type ExportLessonsButtonProps = {
    blockId: string;
};

export default function ExportLessonsButton({ blockId }: ExportLessonsButtonProps) {
    const [downloading, setDownloading] = useState(false);

    const handleExport = async () => {
        try {
            setDownloading(true);
            const response = await fetch(`/api/admin/curriculum/blocks/${blockId}/export`);

            if (!response.ok) {
                throw new Error('Gagal mengexport lesson');
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `lessons-block-${blockId.slice(0, 8)}.csv`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (error) {
            console.error('Export download error:', error);
            alert('Terjadi kesalahan saat mengunduh file.');
        } finally {
            setDownloading(false);
        }
    };

    return (
        <button
            type="button"
            onClick={handleExport}
            disabled={downloading}
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                backgroundColor: '#fff',
                color: '#334155',
                border: '1px solid #cbd5e1',
                padding: '0.5rem 1rem',
                borderRadius: '0.375rem',
                fontSize: '0.9rem',
                cursor: 'pointer',
                opacity: downloading ? 0.7 : 1,
            }}
        >
            {downloading ? (
                <Loader2 size={16} className="animate-spin" />
            ) : (
                <Download size={16} />
            )}
            <span>{downloading ? 'Mengunduh...' : 'Export ke CSV'}</span>
        </button>
    );
}
