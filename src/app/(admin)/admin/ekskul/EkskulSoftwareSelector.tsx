'use client';

import { useState, useEffect } from 'react';
import type { CSSProperties } from 'react';
import Link from 'next/link';
import { Check, Plus, Package } from 'lucide-react';

type Software = {
    id: string;
    name: string;
    version: string | null;
};

type EkskulSoftwareSelectorProps = {
    selectedIds: string[];
    onChange: (ids: string[]) => void;
};

export default function EkskulSoftwareSelector({ selectedIds, onChange }: EkskulSoftwareSelectorProps) {
    const [softwareList, setSoftwareList] = useState<Software[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchSoftware() {
            try {
                const response = await fetch('/api/admin/software');
                if (response.ok) {
                    const data = await response.json();
                    setSoftwareList(data);
                }
            } catch (error) {
                console.error('Failed to fetch software', error);
            } finally {
                setLoading(false);
            }
        }
        fetchSoftware();
    }, []);

    const toggleSoftware = (id: string) => {
        if (selectedIds.includes(id)) {
            onChange(selectedIds.filter(sid => sid !== id));
        } else {
            onChange([...selectedIds, id]);
        }
    };

    if (loading) {
        return <div style={{ fontSize: '0.85rem', color: '#64748b' }}>Memuat software...</div>;
    }

    if (softwareList.length === 0) {
        return (
            <div style={emptyStyle}>
                <Package size={20} style={{ color: '#94a3b8' }} />
                <span>Belum ada software.</span>
                <Link href="/admin/software/new" style={linkStyle}>
                    <Plus size={14} />
                    Tambah Software
                </Link>
            </div>
        );
    }

    return (
        <div>
            <div style={gridStyle}>
                {softwareList.map(sw => {
                    const isSelected = selectedIds.includes(sw.id);
                    return (
                        <button
                            key={sw.id}
                            type="button"
                            onClick={() => toggleSoftware(sw.id)}
                            style={{
                                ...chipStyle,
                                background: isSelected ? '#dbeafe' : '#f8fafc',
                                borderColor: isSelected ? '#1e3a5f' : '#e2e8f0',
                                color: isSelected ? '#1d4ed8' : '#475569',
                            }}
                        >
                            {isSelected && <Check size={14} />}
                            <span>{sw.name}</span>
                            {sw.version && <span style={{ fontSize: '0.7rem', opacity: 0.7 }}>v{sw.version}</span>}
                        </button>
                    );
                })}
            </div>
            <Link href="/admin/software/new" target="_blank" style={{ ...linkStyle, marginTop: '8px', display: 'inline-flex' }}>
                <Plus size={14} />
                Tambah Software Baru
            </Link>
        </div>
    );
}

const gridStyle: CSSProperties = {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
};

const chipStyle: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 12px',
    borderRadius: '8px',
    border: '1.5px solid',
    fontSize: '0.85rem',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
};

const emptyStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px 16px',
    background: '#f8fafc',
    borderRadius: '8px',
    fontSize: '0.85rem',
    color: '#64748b',
};

const linkStyle: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    fontSize: '0.8rem',
    color: '#1e3a5f',
    fontWeight: 500,
};
