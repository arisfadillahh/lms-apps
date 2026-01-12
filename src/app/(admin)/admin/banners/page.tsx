'use client';

import { useState, useEffect } from 'react';

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

    useEffect(() => {
        fetchBanners();
    }, []);

    async function fetchBanners() {
        try {
            const res = await fetch('/api/admin/banners');
            const data = await res.json();
            setBanners(data.banners || []);
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

    return (
        <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '2rem' }}>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '1.5rem', color: '#0f172a' }}>
                Kelola Banner
            </h1>

            {/* Upload Form */}
            <form onSubmit={handleUpload} style={formStyle}>
                <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '1rem' }}>Upload Banner Baru</h2>
                <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '1rem' }}>
                    Ukuran rekomendasi: 1280 x 320 pixels
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div>
                        <label style={labelStyle}>Judul Banner</label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="Contoh: Promo Tahun Baru"
                            style={inputStyle}
                            required
                        />
                    </div>

                    <div>
                        <label style={labelStyle}>Link Tujuan</label>
                        <input
                            type="url"
                            value={linkUrl}
                            onChange={(e) => setLinkUrl(e.target.value)}
                            placeholder="https://example.com"
                            style={inputStyle}
                            required
                        />
                    </div>

                    <div>
                        <label style={labelStyle}>Gambar Banner</label>
                        <input
                            type="file"
                            accept="image/*"
                            onChange={handleFileChange}
                            style={{ ...inputStyle, padding: '0.5rem' }}
                            required
                        />
                    </div>

                    {previewUrl && (
                        <div style={{ marginTop: '0.5rem' }}>
                            <img
                                src={previewUrl}
                                alt="Preview"
                                style={{ maxWidth: '100%', maxHeight: '160px', borderRadius: '0.5rem', border: '1px solid #e2e8f0' }}
                            />
                        </div>
                    )}

                    <button type="submit" disabled={uploading || !selectedFile} style={buttonStyle}>
                        {uploading ? 'Mengupload...' : '📤 Upload Banner'}
                    </button>
                </div>
            </form>

            {/* Banner List */}
            <section style={{ marginTop: '2rem' }}>
                <h2 style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: '1rem' }}>Daftar Banner</h2>

                {loading ? (
                    <p style={{ color: '#64748b' }}>Loading...</p>
                ) : banners.length === 0 ? (
                    <p style={{ color: '#64748b' }}>Belum ada banner.</p>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {banners.sort((a, b) => a.order - b.order).map((banner) => (
                            <div key={banner.id} style={bannerCardStyle}>
                                <img
                                    src={banner.imagePath}
                                    alt={banner.title}
                                    style={{ width: '200px', height: '50px', objectFit: 'cover', borderRadius: '0.5rem' }}
                                />
                                <div style={{ flex: 1 }}>
                                    <strong style={{ color: '#0f172a' }}>{banner.title}</strong>
                                    <p style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.25rem' }}>
                                        {banner.linkUrl}
                                    </p>
                                </div>
                                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                    <button
                                        onClick={() => toggleActive(banner)}
                                        style={{
                                            ...smallButtonStyle,
                                            background: banner.isActive ? '#22c55e' : '#94a3b8',
                                        }}
                                    >
                                        {banner.isActive ? 'Aktif' : 'Nonaktif'}
                                    </button>
                                    <button
                                        onClick={() => deleteBanner(banner.id)}
                                        style={{ ...smallButtonStyle, background: '#ef4444' }}
                                    >
                                        Hapus
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
}

const formStyle: React.CSSProperties = {
    background: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: '1rem',
    padding: '1.5rem',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)',
};

const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '0.875rem',
    fontWeight: 600,
    color: '#374151',
    marginBottom: '0.5rem',
};

const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '0.75rem 1rem',
    border: '1px solid #d1d5db',
    borderRadius: '0.5rem',
    fontSize: '0.95rem',
};

const buttonStyle: React.CSSProperties = {
    background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
    color: '#ffffff',
    border: 'none',
    borderRadius: '0.5rem',
    padding: '0.75rem 1.5rem',
    fontSize: '1rem',
    fontWeight: 600,
    cursor: 'pointer',
    marginTop: '0.5rem',
};

const bannerCardStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    background: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: '0.75rem',
    padding: '1rem',
};

const smallButtonStyle: React.CSSProperties = {
    color: '#ffffff',
    border: 'none',
    borderRadius: '0.375rem',
    padding: '0.4rem 0.75rem',
    fontSize: '0.8rem',
    fontWeight: 600,
    cursor: 'pointer',
};
