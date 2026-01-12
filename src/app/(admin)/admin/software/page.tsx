import Link from 'next/link';
import type { CSSProperties } from 'react';
import { Plus, Package, ExternalLink, Settings } from 'lucide-react';
import { getSessionOrThrow } from '@/lib/auth';
import { listAllSoftware } from '@/lib/dao/softwareDao';

export default async function AdminSoftwarePage() {
    await getSessionOrThrow();
    const software = await listAllSoftware();

    return (
        <div style={{ fontFamily: 'system-ui, sans-serif', color: '#1e293b' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div>
                    <h1 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '4px' }}>Manajemen Software</h1>
                    <p style={{ color: '#64748b', fontSize: '14px' }}>Kelola daftar software yang digunakan dalam pembelajaran</p>
                </div>
                <Link href="/admin/software/new" style={buttonStyle}>
                    <Plus size={18} />
                    <span>Tambah Software</span>
                </Link>
            </div>

            {/* Software Grid */}
            {software.length > 0 ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
                    {software.map((sw) => (
                        <div key={sw.id} style={cardStyle}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '12px' }}>
                                <div style={iconContainerStyle}>
                                    <Package size={24} />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '2px' }}>{sw.name}</h3>
                                    {sw.version && (
                                        <span style={{ fontSize: '12px', color: '#64748b', background: '#f1f5f9', padding: '2px 8px', borderRadius: '4px' }}>
                                            v{sw.version}
                                        </span>
                                    )}
                                </div>
                                <Link href={`/admin/software/${sw.id}`} style={editButtonStyle}>
                                    <Settings size={16} />
                                </Link>
                            </div>

                            {sw.description && (
                                <p style={{ fontSize: '14px', color: '#475569', marginBottom: '12px', lineHeight: '1.5' }}>
                                    {sw.description.length > 100 ? `${sw.description.slice(0, 100)}...` : sw.description}
                                </p>
                            )}

                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                {sw.installation_url && (
                                    <a
                                        href={sw.installation_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        style={linkBadgeStyle}
                                    >
                                        <ExternalLink size={12} />
                                        <span>Download</span>
                                    </a>
                                )}
                                {sw.minimum_specs && (
                                    <span style={badgeStyle}>Specs tersedia</span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div style={emptyStateStyle}>
                    <Package size={48} style={{ color: '#cbd5e1', marginBottom: '16px' }} />
                    <p style={{ fontWeight: '600', marginBottom: '8px' }}>Belum ada software</p>
                    <p style={{ fontSize: '14px', color: '#94a3b8', marginBottom: '16px' }}>
                        Tambahkan software yang akan digunakan dalam Block pembelajaran
                    </p>
                    <Link href="/admin/software/new" style={buttonStyle}>
                        <Plus size={18} />
                        <span>Tambah Software Pertama</span>
                    </Link>
                </div>
            )}
        </div>
    );
}

const buttonStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 20px',
    background: '#2563eb',
    color: 'white',
    borderRadius: '8px',
    fontWeight: '600',
    fontSize: '14px',
    textDecoration: 'none',
};

const cardStyle: CSSProperties = {
    background: 'white',
    borderRadius: '12px',
    border: '1px solid #e2e8f0',
    padding: '20px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
};

const iconContainerStyle: CSSProperties = {
    width: '48px',
    height: '48px',
    borderRadius: '12px',
    background: '#eff6ff',
    color: '#2563eb',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
};

const editButtonStyle: CSSProperties = {
    padding: '8px',
    borderRadius: '8px',
    background: '#f1f5f9',
    color: '#475569',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
};

const linkBadgeStyle: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    fontSize: '12px',
    padding: '4px 10px',
    background: '#dbeafe',
    color: '#1d4ed8',
    borderRadius: '6px',
    textDecoration: 'none',
};

const badgeStyle: CSSProperties = {
    fontSize: '12px',
    padding: '4px 10px',
    background: '#f0fdf4',
    color: '#15803d',
    borderRadius: '6px',
};

const emptyStateStyle: CSSProperties = {
    textAlign: 'center',
    padding: '60px 20px',
    background: '#f8fafc',
    borderRadius: '12px',
    border: '2px dashed #cbd5e1',
};
