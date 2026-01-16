import type { CSSProperties } from 'react';
import Link from 'next/link';
import { Package, Plus, Pencil, ExternalLink } from 'lucide-react';

import { softwareDao } from '@/lib/dao';

export default async function SoftwareListPage() {
    const softwareList = await softwareDao.listAllSoftware();

    return (
        <div style={containerStyle}>
            {/* Header */}
            <div style={headerStyle}>
                <div>
                    <h1 style={titleStyle}>Manajemen Software</h1>
                    <p style={subtitleStyle}>Kelola daftar software yang tersedia untuk siswa.</p>
                </div>
                <Link href="/admin/software/new" style={addButtonStyle}>
                    <Plus size={18} />
                    Tambah Software
                </Link>
            </div>

            {/* Software Grid */}
            {softwareList.length === 0 ? (
                <div style={emptyStyle}>
                    <Package size={48} color="#94a3b8" />
                    <p style={{ marginTop: '1rem', color: '#64748b' }}>Belum ada software terdaftar.</p>
                    <Link href="/admin/software/new" style={{ ...addButtonStyle, marginTop: '1rem' }}>
                        <Plus size={18} />
                        Tambah Software Pertama
                    </Link>
                </div>
            ) : (
                <div style={gridStyle}>
                    {softwareList.map((software) => (
                        <div key={software.id} style={cardStyle}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
                                <div style={iconWrapperStyle}>
                                    {software.icon_url ? (
                                        <img src={software.icon_url} alt={software.name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '8px' }} />
                                    ) : (
                                        <Package size={24} color="#3b82f6" />
                                    )}
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <h3 style={softwareNameStyle}>{software.name}</h3>
                                    {software.version && (
                                        <span style={versionBadgeStyle}>v{software.version}</span>
                                    )}
                                    {software.description && (
                                        <p style={descriptionStyle}>{software.description}</p>
                                    )}
                                </div>
                            </div>

                            <div style={actionsStyle}>
                                {software.installation_url && (
                                    <a href={software.installation_url} target="_blank" rel="noopener noreferrer" style={linkButtonStyle}>
                                        <ExternalLink size={14} />
                                        Download
                                    </a>
                                )}
                                <Link href={`/admin/software/${software.id}`} style={editButtonStyle}>
                                    <Pencil size={14} />
                                    Edit
                                </Link>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// Styles
const containerStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.5rem',
};

const headerStyle: CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    gap: '1rem',
};

const titleStyle: CSSProperties = {
    fontSize: '1.5rem',
    fontWeight: 700,
    color: '#1e293b',
    margin: 0,
};

const subtitleStyle: CSSProperties = {
    fontSize: '0.9rem',
    color: '#64748b',
    marginTop: '0.25rem',
};

const addButtonStyle: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.75rem 1.25rem',
    background: '#3b82f6',
    color: '#fff',
    borderRadius: '10px',
    fontWeight: 600,
    fontSize: '0.9rem',
    textDecoration: 'none',
};

const emptyStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '4rem 2rem',
    background: '#fff',
    borderRadius: '16px',
    border: '1px solid #e2e8f0',
    textAlign: 'center',
};

const gridStyle: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
    gap: '1rem',
};

const cardStyle: CSSProperties = {
    background: '#fff',
    borderRadius: '16px',
    padding: '1.25rem',
    border: '1px solid #e2e8f0',
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
};

const iconWrapperStyle: CSSProperties = {
    width: '48px',
    height: '48px',
    borderRadius: '10px',
    background: '#eff6ff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
};

const softwareNameStyle: CSSProperties = {
    fontSize: '1rem',
    fontWeight: 600,
    color: '#1e293b',
    margin: 0,
};

const versionBadgeStyle: CSSProperties = {
    display: 'inline-block',
    padding: '0.15rem 0.5rem',
    background: '#dbeafe',
    color: '#1d4ed8',
    borderRadius: '999px',
    fontSize: '0.7rem',
    fontWeight: 600,
    marginTop: '0.25rem',
};

const descriptionStyle: CSSProperties = {
    fontSize: '0.85rem',
    color: '#64748b',
    margin: '0.5rem 0 0',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
};

const actionsStyle: CSSProperties = {
    display: 'flex',
    gap: '0.5rem',
    marginTop: 'auto',
};

const linkButtonStyle: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.35rem',
    padding: '0.5rem 0.75rem',
    background: '#f1f5f9',
    color: '#475569',
    borderRadius: '8px',
    fontSize: '0.8rem',
    fontWeight: 500,
    textDecoration: 'none',
};

const editButtonStyle: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.35rem',
    padding: '0.5rem 0.75rem',
    background: '#eff6ff',
    color: '#3b82f6',
    borderRadius: '8px',
    fontSize: '0.8rem',
    fontWeight: 500,
    textDecoration: 'none',
};
