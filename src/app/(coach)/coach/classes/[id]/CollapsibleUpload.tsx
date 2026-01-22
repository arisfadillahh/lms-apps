'use client';

import { useState, type CSSProperties, type ReactNode } from 'react';
import { ChevronDown, ChevronUp, Upload } from 'lucide-react';

interface CollapsibleUploadProps {
    children: ReactNode;
}

export default function CollapsibleUpload({ children }: CollapsibleUploadProps) {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div style={containerStyle}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                style={headerStyle}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Upload size={18} />
                    <span>Upload Dokumentasi & Laporan</span>
                </div>
                {isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </button>

            {isOpen && (
                <div style={contentStyle}>
                    {children}
                </div>
            )}
        </div>
    );
}

const containerStyle: CSSProperties = {
    background: '#fff',
    borderRadius: '12px',
    border: '1px solid #e2e8f0',
    overflow: 'hidden',
};

const headerStyle: CSSProperties = {
    width: '100%',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '1rem 1.25rem',
    background: '#f8fafc',
    border: 'none',
    cursor: 'pointer',
    fontSize: '0.95rem',
    fontWeight: 600,
    color: '#475569',
};

const contentStyle: CSSProperties = {
    padding: '1.25rem',
    borderTop: '1px solid #e2e8f0',
};
