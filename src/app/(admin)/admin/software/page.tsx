import Link from 'next/link';
import type { CSSProperties } from 'react';
import { Plus, Package, ExternalLink, Settings } from 'lucide-react';
import { getSessionOrThrow } from '@/lib/auth';
import { listAllSoftware } from '@/lib/dao/softwareDao';

export default async function AdminSoftwarePage() {
    await getSessionOrThrow();
    const software = await listAllSoftware();

    return (
        <div style={{ fontFamily: 'system-ui, sans-serif', color: '#1e293b', paddingBottom: '2rem' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <div>
                    <h1 style={{ fontSize: '1.8rem', fontWeight: 800, marginBottom: '0.5rem', letterSpacing: '-0.02em', color: '#1e293b' }}>Manajemen Software</h1>
                    <p style={{ color: '#64748b', fontSize: '1rem', maxWidth: '48rem' }}>Kelola daftar software yang digunakan dalam pembelajaran</p>
                </div>
                <Link href="/admin/software/new" style={buttonStyle}>
                    <Plus size={18} />
                    <span>Tambah Software</span>
                </Link>
            </div>

            {/* Software Grid */}
            {software.length > 0 ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>
                    {software.map((sw) => (
                        <div key={sw.id} style={cardStyle} className="hover-card">
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', marginBottom: '1rem' }}>
                                <div style={iconContainerStyle}>
                                    <Package size={24} />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.25rem', color: '#1e293b' }}>{sw.name}</h3>
                                    {sw.version && (
                                        <span style={{ fontSize: '0.75rem', color: '#64748b', background: '#f1f5f9', padding: '0.25rem 0.6rem', borderRadius: '6px', fontWeight: 600, border: '1px solid #e2e8f0' }}>
                                            v{sw.version}
                                        </span>
                                    )}
                                </div>
                                <Link href={`/admin/software/${sw.id}`} style={editButtonStyle}>
                                    <Settings size={18} />
                                </Link>
                            </div>

                            {sw.description && (
                                <p style={{ fontSize: '0.9rem', color: '#64748b', marginBottom: '1.25rem', lineHeight: '1.6' }}>
                                    {sw.description.length > 100 ? `${sw.description.slice(0, 100)}...` : sw.description}
                                </p>
                            )}

                            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: 'auto' }}>
                                {sw.installation_url && (
                                    <a
                                        href={sw.installation_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        style={linkBadgeStyle}
                                    >
                                        <ExternalLink size={14} />
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
                    <div style={{ width: '64px', height: '64px', background: '#f1f5f9', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
                        <Package size={32} style={{ color: '#94a3b8' }} />
                    </div>
                    <p style={{ fontWeight: 700, marginBottom: '0.5rem', fontSize: '1.1rem', color: '#1e293b' }}>Belum ada software</p>
                    <p style={{ fontSize: '0.95rem', color: '#64748b', marginBottom: '1.5rem', maxWidth: '400px', margin: '0 auto 1.5rem' }}>
                        Tambahkan software yang akan digunakan dalam Block pembelajaran agar mudah diakses oleh murid/coach.
                    </p>
                    <Link href="/admin/software/new" style={buttonStyle}>
                        <Plus size={18} />
                        <span>Tambah Software Pertama</span>
                    </Link>
                </div>
            )}
            <style>{`
                .hover-card {
                    transition: transform 0.2s ease, box-shadow 0.2s ease;
                }
                .hover-card:hover {
                    transform: translateY(-4px);
                    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
                }
            `}</style>
        </div>
    );
}

const buttonStyle: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.75rem 1.25rem',
    background: '#3b82f6',
    color: 'white',
    borderRadius: '12px',
    fontWeight: 600,
    fontSize: '0.95rem',
    textDecoration: 'none',
    boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)',
    transition: 'all 0.2s',
};

const cardStyle: CSSProperties = {
    background: 'white',
    borderRadius: '16px',
    border: '1px solid #e2e8f0',
    padding: '1.5rem',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
};

const iconContainerStyle: CSSProperties = {
    width: '48px',
    height: '48px',
    borderRadius: '12px',
    background: '#eff6ff',
    color: '#3b82f6',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0
};

const editButtonStyle: CSSProperties = {
    padding: '0.5rem',
    borderRadius: '10px',
    background: '#f8fafc',
    color: '#64748b',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '1px solid #e2e8f0',
    transition: 'all 0.2s'
};

const linkBadgeStyle: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.4rem',
    fontSize: '0.8rem',
    padding: '0.4rem 0.8rem',
    background: '#eff6ff',
    color: '#3b82f6',
    borderRadius: '8px',
    textDecoration: 'none',
    fontWeight: 600,
};

const badgeStyle: CSSProperties = {
    fontSize: '0.8rem',
    padding: '0.4rem 0.8rem',
    background: '#f0fdf4',
    color: '#15803d',
    borderRadius: '8px',
    fontWeight: 600,
};

const emptyStateStyle: CSSProperties = {
    textAlign: 'center',
    padding: '4rem 1.5rem',
    background: '#ffffff',
    borderRadius: '16px',
    border: '1px solid #e2e8f0',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
};
