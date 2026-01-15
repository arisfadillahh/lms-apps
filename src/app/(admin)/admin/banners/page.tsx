'use client';

import { useState, useEffect, useRef } from 'react';
import { GripVertical, Trash2, Eye, EyeOff, Upload, Image, Link, ExternalLink, Check, X } from 'lucide-react';

type Banner = {
    id: string;
    imagePath: string;
    linkUrl: string;
    title: string;
    order: number;
    isActive: boolean;
};

export default function AdminBannersPage() {
    const [banners, setBanners] = useState<Banner[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [title, setTitle] = useState('');
    const [linkUrl, setLinkUrl] = useState('');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
    const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
    const [saving, setSaving] = useState(false);
    const [showUploadForm, setShowUploadForm] = useState(false);

    useEffect(() => {
        fetchBanners();
    }, []);

    async function fetchBanners() {
        try {
            const res = await fetch('/api/admin/banners');
            const data = await res.json();
            setBanners((data.banners || []).sort((a: Banner, b: Banner) => a.order - b.order));
        } catch (error) {
            console.error('Failed to fetch banners:', error);
        } finally {
            setLoading(false);
        }
    }

    function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0] || null;
        setSelectedFile(file);
        if (file) {
            setPreviewUrl(URL.createObjectURL(file));
        } else {
            setPreviewUrl(null);
        }
    }

    async function handleUpload(e: React.FormEvent) {
        e.preventDefault();
        if (!selectedFile) return;

        setUploading(true);
        try {
            const formData = new FormData();
            formData.append('image', selectedFile);
            formData.append('title', title);
            formData.append('linkUrl', linkUrl);

            const res = await fetch('/api/admin/banners', {
                method: 'POST',
                body: formData,
            });

            if (res.ok) {
                setTitle('');
                setLinkUrl('');
                setSelectedFile(null);
                setPreviewUrl(null);
                setShowUploadForm(false);
                fetchBanners();
            } else {
                const data = await res.json();
                alert(data.error || 'Failed to upload');
            }
        } catch (error) {
            console.error('Upload error:', error);
            alert('Failed to upload banner');
        } finally {
            setUploading(false);
        }
    }

    async function toggleActive(banner: Banner) {
        try {
            await fetch('/api/admin/banners', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: banner.id, isActive: !banner.isActive }),
            });
            fetchBanners();
        } catch (error) {
            console.error('Toggle error:', error);
        }
    }

    async function deleteBanner(id: string) {
        if (!confirm('Hapus banner ini?')) return;
        try {
            await fetch(`/api/admin/banners?id=${id}`, { method: 'DELETE' });
            fetchBanners();
        } catch (error) {
            console.error('Delete error:', error);
        }
    }

    // Drag and Drop handlers
    function handleDragStart(index: number) {
        setDraggedIndex(index);
    }

    function handleDragOver(e: React.DragEvent, index: number) {
        e.preventDefault();
        if (draggedIndex !== null && draggedIndex !== index) {
            setDragOverIndex(index);
        }
    }

    function handleDragEnd() {
        if (draggedIndex !== null && dragOverIndex !== null && draggedIndex !== dragOverIndex) {
            const newBanners = [...banners];
            const draggedItem = newBanners[draggedIndex];
            newBanners.splice(draggedIndex, 1);
            newBanners.splice(dragOverIndex, 0, draggedItem);
            setBanners(newBanners);
            saveOrder(newBanners);
        }
        setDraggedIndex(null);
        setDragOverIndex(null);
    }

    async function saveOrder(newBanners: Banner[]) {
        setSaving(true);
        try {
            await fetch('/api/admin/banners', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ orderedIds: newBanners.map(b => b.id) }),
            });
        } catch (error) {
            console.error('Save order error:', error);
        } finally {
            setSaving(false);
        }
    }

    function moveUp(index: number) {
        if (index <= 0) return;
        const newBanners = [...banners];
        [newBanners[index - 1], newBanners[index]] = [newBanners[index], newBanners[index - 1]];
        setBanners(newBanners);
        saveOrder(newBanners);
    }

    function moveDown(index: number) {
        if (index >= banners.length - 1) return;
        const newBanners = [...banners];
        [newBanners[index], newBanners[index + 1]] = [newBanners[index + 1], newBanners[index]];
        setBanners(newBanners);
        saveOrder(newBanners);
    }

    return (
        <div style={containerStyle}>
            {/* Header */}
            <div style={headerStyle}>
                <div>
                    <h1 style={titleStyle}>
                        <span style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                            🖼️ Kelola Banner
                        </span>
                    </h1>
                    <p style={subtitleStyle}>
                        Atur banner yang tampil di dashboard Coder. Drag untuk mengubah urutan.
                    </p>
                </div>
                <button onClick={() => setShowUploadForm(!showUploadForm)} style={addButtonStyle}>
                    {showUploadForm ? <X size={18} /> : <Upload size={18} />}
                    {showUploadForm ? 'Tutup' : 'Tambah Banner'}
                </button>
            </div>

            {/* Upload Form */}
            {showUploadForm && (
                <div style={uploadCardStyle}>
                    <div style={uploadHeaderStyle}>
                        <Image size={24} style={{ color: '#6366f1' }} />
                        <div>
                            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600, color: '#1e293b' }}>Upload Banner Baru</h3>
                            <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: '#64748b' }}>Rekomendasi: 1280 x 320 pixels (4:1)</p>
                        </div>
                    </div>

                    <form onSubmit={handleUpload} style={{ marginTop: '1.5rem' }}>
                        <div style={formGridStyle}>
                            <div style={fieldStyle}>
                                <label style={labelStyle}>
                                    <span style={{ marginRight: '0.5rem' }}>📝</span> Judul Banner
                                </label>
                                <input
                                    type="text"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder="Contoh: Promo Tahun Baru"
                                    style={inputStyle}
                                    required
                                />
                            </div>

                            <div style={fieldStyle}>
                                <label style={labelStyle}>
                                    <Link size={14} style={{ marginRight: '0.5rem' }} /> Link Tujuan
                                </label>
                                <input
                                    type="url"
                                    value={linkUrl}
                                    onChange={(e) => setLinkUrl(e.target.value)}
                                    placeholder="https://example.com"
                                    style={inputStyle}
                                    required
                                />
                            </div>
                        </div>

                        <div style={{ ...fieldStyle, marginTop: '1rem' }}>
                            <label style={labelStyle}>
                                <Image size={14} style={{ marginRight: '0.5rem' }} /> Gambar Banner
                            </label>
                            <div style={dropzoneStyle}>
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={handleFileChange}
                                    style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }}
                                    required
                                />
                                {previewUrl ? (
                                    <img src={previewUrl} alt="Preview" style={{ maxWidth: '100%', maxHeight: '150px', borderRadius: '0.5rem' }} />
                                ) : (
                                    <div style={{ textAlign: 'center', color: '#94a3b8' }}>
                                        <Upload size={32} style={{ marginBottom: '0.5rem' }} />
                                        <p style={{ margin: 0, fontSize: '0.9rem' }}>Klik atau drop gambar di sini</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
                            <button type="button" onClick={() => setShowUploadForm(false)} style={cancelButtonStyle}>
                                Batal
                            </button>
                            <button type="submit" disabled={uploading || !selectedFile} style={submitButtonStyle}>
                                {uploading ? 'Mengupload...' : '✨ Upload Banner'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Saving indicator */}
            {saving && (
                <div style={savingIndicatorStyle}>
                    <div style={spinnerStyle} />
                    Menyimpan urutan...
                </div>
            )}

            {/* Banner List */}
            <div style={listContainerStyle}>
                <div style={listHeaderStyle}>
                    <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>
                        Daftar Banner ({banners.length})
                    </h2>
                    <span style={hintStyle}>💡 Drag & drop untuk mengubah urutan</span>
                </div>

                {loading ? (
                    <div style={emptyStyle}>
                        <div style={spinnerStyle} />
                        Memuat banner...
                    </div>
                ) : banners.length === 0 ? (
                    <div style={emptyStyle}>
                        <Image size={48} style={{ color: '#cbd5e1', marginBottom: '1rem' }} />
                        <p style={{ margin: 0, color: '#64748b' }}>Belum ada banner. Klik tombol "Tambah Banner" untuk mulai.</p>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {banners.map((banner, index) => (
                            <div
                                key={banner.id}
                                draggable
                                onDragStart={() => handleDragStart(index)}
                                onDragOver={(e) => handleDragOver(e, index)}
                                onDragEnd={handleDragEnd}
                                onDragLeave={() => setDragOverIndex(null)}
                                style={{
                                    ...bannerCardStyle,
                                    opacity: draggedIndex === index ? 0.5 : 1,
                                    borderColor: dragOverIndex === index ? '#6366f1' : '#e2e8f0',
                                    transform: dragOverIndex === index ? 'scale(1.02)' : 'scale(1)',
                                }}
                            >
                                {/* Drag Handle */}
                                <div style={dragHandleStyle}>
                                    <GripVertical size={20} style={{ color: '#94a3b8' }} />
                                </div>

                                {/* Order number */}
                                <div style={orderBadgeStyle}>{index + 1}</div>

                                {/* Image Preview */}
                                <div style={imageContainerStyle}>
                                    <img
                                        src={banner.imagePath}
                                        alt={banner.title}
                                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                    />
                                    {!banner.isActive && <div style={inactiveOverlayStyle}>NONAKTIF</div>}
                                </div>

                                {/* Info */}
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: '#1e293b' }}>
                                        {banner.title}
                                    </h3>
                                    <a href={banner.linkUrl} target="_blank" rel="noopener noreferrer" style={linkStyle}>
                                        <ExternalLink size={12} />
                                        {banner.linkUrl.length > 40 ? banner.linkUrl.slice(0, 40) + '...' : banner.linkUrl}
                                    </a>
                                </div>

                                {/* Actions */}
                                <div style={actionsContainerStyle}>
                                    {/* Move buttons for mobile/keyboard */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                        <button
                                            onClick={() => moveUp(index)}
                                            disabled={index === 0}
                                            style={{ ...arrowButtonStyle, opacity: index === 0 ? 0.3 : 1 }}
                                            title="Pindah ke atas"
                                        >
                                            ▲
                                        </button>
                                        <button
                                            onClick={() => moveDown(index)}
                                            disabled={index === banners.length - 1}
                                            style={{ ...arrowButtonStyle, opacity: index === banners.length - 1 ? 0.3 : 1 }}
                                            title="Pindah ke bawah"
                                        >
                                            ▼
                                        </button>
                                    </div>

                                    <button
                                        onClick={() => toggleActive(banner)}
                                        style={{
                                            ...actionButtonStyle,
                                            background: banner.isActive ? '#dcfce7' : '#f1f5f9',
                                            color: banner.isActive ? '#16a34a' : '#64748b',
                                        }}
                                        title={banner.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                                    >
                                        {banner.isActive ? <Eye size={16} /> : <EyeOff size={16} />}
                                    </button>

                                    <button
                                        onClick={() => deleteBanner(banner.id)}
                                        style={{ ...actionButtonStyle, background: '#fee2e2', color: '#dc2626' }}
                                        title="Hapus"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

// Styles
const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.5rem',
    paddingBottom: '2rem',
};

const headerStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    gap: '1rem',
    marginBottom: '2rem',
};

const titleStyle: React.CSSProperties = {
    fontSize: '1.75rem',
    fontWeight: 700,
    margin: 0,
};

const subtitleStyle: React.CSSProperties = {
    fontSize: '0.95rem',
    color: '#64748b',
    marginTop: '0.5rem',
};

const addButtonStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.75rem 1.25rem',
    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
    color: '#fff',
    border: 'none',
    borderRadius: '0.75rem',
    fontSize: '0.95rem',
    fontWeight: 600,
    cursor: 'pointer',
    boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)',
};

const uploadCardStyle: React.CSSProperties = {
    background: 'linear-gradient(135deg, #faf5ff, #f5f3ff)',
    border: '2px dashed #c4b5fd',
    borderRadius: '1rem',
    padding: '1.5rem',
    marginBottom: '2rem',
};

const uploadHeaderStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
};

const formGridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: '1rem',
};

const fieldStyle: React.CSSProperties = {
    marginBottom: '0',
};

const labelStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    fontSize: '0.875rem',
    fontWeight: 600,
    color: '#4b5563',
    marginBottom: '0.5rem',
};

const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '0.75rem 1rem',
    border: '2px solid #e2e8f0',
    borderRadius: '0.5rem',
    fontSize: '0.95rem',
    transition: 'border-color 0.2s',
};

const dropzoneStyle: React.CSSProperties = {
    position: 'relative',
    border: '2px dashed #c4b5fd',
    borderRadius: '0.75rem',
    padding: '2rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#faf5ff',
    minHeight: '120px',
};

const cancelButtonStyle: React.CSSProperties = {
    padding: '0.75rem 1.5rem',
    background: '#f1f5f9',
    color: '#475569',
    border: 'none',
    borderRadius: '0.5rem',
    fontSize: '0.95rem',
    fontWeight: 600,
    cursor: 'pointer',
};

const submitButtonStyle: React.CSSProperties = {
    flex: 1,
    padding: '0.75rem 1.5rem',
    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
    color: '#fff',
    border: 'none',
    borderRadius: '0.5rem',
    fontSize: '0.95rem',
    fontWeight: 600,
    cursor: 'pointer',
    boxShadow: '0 4px 12px rgba(99, 102, 241, 0.25)',
};

const listContainerStyle: React.CSSProperties = {
    background: '#ffffff',
    borderRadius: '1rem',
    border: '1px solid #e2e8f0',
    overflow: 'hidden',
};

const listHeaderStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '1rem 1.5rem',
    background: '#f8fafc',
    borderBottom: '1px solid #e2e8f0',
};

const hintStyle: React.CSSProperties = {
    fontSize: '0.8rem',
    color: '#94a3b8',
};

const emptyStyle: React.CSSProperties = {
    padding: '4rem 2rem',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
};

const bannerCardStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    padding: '1rem',
    margin: '0 1rem',
    background: '#ffffff',
    border: '2px solid #e2e8f0',
    borderRadius: '0.75rem',
    transition: 'all 0.2s',
    cursor: 'grab',
};

const dragHandleStyle: React.CSSProperties = {
    cursor: 'grab',
    padding: '0.5rem',
    borderRadius: '0.375rem',
    display: 'flex',
    alignItems: 'center',
};

const orderBadgeStyle: React.CSSProperties = {
    width: '28px',
    height: '28px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.8rem',
    fontWeight: 700,
    flexShrink: 0,
};

const imageContainerStyle: React.CSSProperties = {
    width: '180px',
    height: '60px',
    borderRadius: '0.5rem',
    overflow: 'hidden',
    flexShrink: 0,
    position: 'relative',
};

const inactiveOverlayStyle: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    background: 'rgba(0, 0, 0, 0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
    fontSize: '0.65rem',
    fontWeight: 700,
    letterSpacing: '0.05em',
};

const linkStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.35rem',
    fontSize: '0.8rem',
    color: '#6366f1',
    marginTop: '0.25rem',
    textDecoration: 'none',
};

const actionsContainerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    flexShrink: 0,
};

const arrowButtonStyle: React.CSSProperties = {
    width: '24px',
    height: '20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '1px solid #e2e8f0',
    borderRadius: '4px',
    background: '#f8fafc',
    color: '#64748b',
    fontSize: '0.65rem',
    cursor: 'pointer',
};

const actionButtonStyle: React.CSSProperties = {
    width: '36px',
    height: '36px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: 'none',
    borderRadius: '0.5rem',
    cursor: 'pointer',
};

const savingIndicatorStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.75rem 1rem',
    background: '#fef3c7',
    color: '#92400e',
    borderRadius: '0.5rem',
    fontSize: '0.9rem',
    marginBottom: '1rem',
};

const spinnerStyle: React.CSSProperties = {
    width: '16px',
    height: '16px',
    border: '2px solid currentColor',
    borderTopColor: 'transparent',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
};
