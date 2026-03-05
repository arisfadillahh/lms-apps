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
    clicks?: number;
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
        <div className="flex flex-col gap-6 pb-8 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex justify-between items-start gap-4 mb-2">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 m-0">
                        Manajemen Banner
                    </h1>
                    <p className="text-sm text-slate-500 mt-1">
                        Kelola banner carousel di dashboard Coder untuk pengumuman dan promo.
                    </p>
                </div>
                <button
                    onClick={() => setShowUploadForm(!showUploadForm)}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-500 hover:bg-blue-600 text-white border-none rounded-xl text-sm font-semibold cursor-pointer shadow-sm shadow-blue-500/20 transition-all hover:-translate-y-0.5"
                >
                    {showUploadForm ? <X size={16} /> : <span className="text-lg leading-none">+</span>}
                    {showUploadForm ? 'Tutup' : 'Tambah Banner'}
                </button>
            </div>

            {/* Metrics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-2">
                {/* Card 1: Total Banner */}
                <div className="bg-white rounded-2xl border border-slate-200 p-5 flex items-center gap-4 shadow-sm">
                    <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-blue-500 flex-shrink-0">
                        <Image size={24} strokeWidth={2.5} />
                    </div>
                    <div>
                        <p className="text-[10px] font-bold text-slate-500 tracking-wider mb-0.5 uppercase">Total Banner</p>
                        <p className="text-xl font-bold text-slate-800 leading-none">{banners.length}</p>
                    </div>
                </div>

                {/* Card 2: Banner Aktif */}
                <div className="bg-white rounded-2xl border border-slate-200 p-5 flex items-center gap-4 shadow-sm">
                    <div className="w-12 h-12 rounded-xl bg-green-50 flex items-center justify-center text-green-500 flex-shrink-0">
                        <Check size={24} strokeWidth={2.5} />
                    </div>
                    <div>
                        <p className="text-[10px] font-bold text-slate-500 tracking-wider mb-0.5 uppercase">Banner Aktif</p>
                        <p className="text-xl font-bold text-slate-800 leading-none">{banners.filter(b => b.isActive).length}</p>
                    </div>
                </div>

                {/* Card 3: Total Tayangan (Converted to Total Klik) */}
                <div className="bg-white rounded-2xl border border-slate-200 p-5 flex items-center gap-4 shadow-sm">
                    <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 flex-shrink-0">
                        <Eye size={24} strokeWidth={2.5} />
                    </div>
                    <div>
                        <p className="text-[10px] font-bold text-slate-500 tracking-wider mb-0.5 uppercase">Total Klik</p>
                        <p className="text-xl font-bold text-slate-800 leading-none">
                            {banners.reduce((sum, b) => sum + (b.clicks || 0), 0)}
                        </p>
                    </div>
                </div>
            </div>

            {/* Upload Form */}
            {showUploadForm && (
                <div className="bg-slate-50 border-2 border-dashed border-slate-300 rounded-2xl p-6 mb-4 animate-in fade-in slide-in-from-top-4 duration-300">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600">
                            <Upload size={20} />
                        </div>
                        <div>
                            <h3 className="m-0 text-base font-bold text-slate-800">Upload Banner Baru</h3>
                            <p className="m-0 text-xs text-slate-500 mt-0.5">Rekomendasi ukuran: 1200 x 400 pixels (3:1)</p>
                        </div>
                    </div>

                    <form onSubmit={handleUpload}>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
                            <div>
                                <label className="flex items-center text-sm font-semibold text-slate-700 mb-2">
                                    Judul Banner
                                </label>
                                <input
                                    type="text"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder="Contoh: Promo Libur Sekolah 2024"
                                    className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                                    required
                                />
                            </div>

                            <div>
                                <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
                                    <Link size={14} /> Link Tujuan
                                </label>
                                <input
                                    type="url"
                                    value={linkUrl}
                                    onChange={(e) => setLinkUrl(e.target.value)}
                                    placeholder="https://clevio.co/..."
                                    className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                                    required
                                />
                            </div>
                        </div>

                        <div className="mb-6">
                            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
                                <Image size={14} /> Gambar Banner
                            </label>
                            <div className="relative border-2 border-dashed border-slate-300 rounded-xl p-8 flex items-center justify-center bg-white min-h-[160px] hover:bg-slate-50 transition-colors w-full">
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={handleFileChange}
                                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                                    required
                                />
                                {previewUrl ? (
                                    <img src={previewUrl} alt="Preview" className="max-w-full max-h-[140px] rounded-lg object-contain" />
                                ) : (
                                    <div className="text-center text-slate-400">
                                        <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
                                            <Upload size={20} className="text-slate-500" />
                                        </div>
                                        <p className="m-0 text-sm font-medium text-slate-600">Klik atau drop gambar di sini</p>
                                        <p className="m-0 text-xs text-slate-400 mt-1">PNG, JPG, WEBP hingga 5MB</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
                            <button
                                type="button"
                                onClick={() => setShowUploadForm(false)}
                                className="px-5 py-2.5 bg-white border border-slate-300 text-slate-700 rounded-xl text-sm font-semibold hover:bg-slate-50 transition-colors"
                            >
                                Batal
                            </button>
                            <button
                                type="submit"
                                disabled={uploading || !selectedFile}
                                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white border-none rounded-xl text-sm font-semibold cursor-pointer shadow-sm transition-colors flex items-center gap-2"
                            >
                                {uploading ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        Mengupload...
                                    </>
                                ) : (
                                    'Simpan Banner'
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Saving indicator */}
            {saving && (
                <div className="flex items-center justify-center gap-2 px-4 py-3 bg-amber-50 text-amber-800 border border-amber-200 rounded-xl text-sm font-medium shadow-sm animate-pulse">
                    <div className="w-4 h-4 border-2 border-amber-800/20 border-t-amber-800 rounded-full animate-spin" />
                    Menyimpan urutan banner...
                </div>
            )}

            {/* Banner List Table */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                {/* Table Header Row */}
                <div className="grid grid-cols-[80px_140px_1fr_100px_100px] gap-4 px-6 py-4 bg-slate-50 border-b border-slate-200 items-center">
                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider text-center">Urutan</div>
                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Preview</div>
                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Detail Banner</div>
                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider text-center">Status</div>
                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider text-right pr-2">Aksi</div>
                </div>

                {loading ? (
                    <div className="py-16 text-center text-slate-500 flex flex-col items-center justify-center">
                        <div className="w-8 h-8 border-3 border-slate-200 border-t-blue-500 rounded-full animate-spin mb-4" />
                        <p className="text-sm font-medium">Memuat data banner...</p>
                    </div>
                ) : banners.length === 0 ? (
                    <div className="py-16 text-center flex flex-col items-center justify-center">
                        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 mb-4">
                            <Image size={28} />
                        </div>
                        <p className="text-slate-500 font-medium text-sm">Belum ada banner.</p>
                        <button
                            onClick={() => setShowUploadForm(true)}
                            className="text-blue-500 font-semibold text-sm hover:underline mt-2 bg-transparent border-none cursor-pointer"
                        >
                            Tambah Banner Pertama
                        </button>
                    </div>
                ) : (
                    <div className="flex flex-col">
                        {banners.map((banner, index) => (
                            <div
                                key={banner.id}
                                draggable
                                onDragStart={() => handleDragStart(index)}
                                onDragOver={(e) => handleDragOver(e, index)}
                                onDragEnd={handleDragEnd}
                                onDragLeave={() => setDragOverIndex(null)}
                                className={`grid grid-cols-[80px_140px_1fr_100px_100px] gap-4 px-6 py-5 items-center bg-white border-b border-slate-100 last:border-b-0 transition-all hover:bg-slate-50/50 cursor-grab active:cursor-grabbing ${draggedIndex === index ? 'opacity-50 bg-slate-100' : ''
                                    } ${dragOverIndex === index ? 'relative z-10 scale-[1.01] shadow-md border-y border-blue-200 bg-blue-50/30' : ''
                                    }`}
                            >
                                {/* Column 1: Order with arrows */}
                                <div className="flex flex-col items-center justify-center gap-1 group">
                                    <button
                                        onClick={(e) => { e.stopPropagation(); moveUp(index); }}
                                        disabled={index === 0}
                                        className={`w-5 h-5 flex items-center justify-center rounded text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors border-none bg-transparent cursor-pointer ${index === 0 ? 'opacity-30 cursor-not-allowed hidden' : 'opacity-0 group-hover:opacity-100'}`}
                                    >
                                        <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
                                            <path d="M1 5L5 1L9 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                        </svg>
                                    </button>

                                    <div className="text-sm font-bold text-slate-700 w-6 text-center">
                                        {index + 1}
                                    </div>

                                    <button
                                        onClick={(e) => { e.stopPropagation(); moveDown(index); }}
                                        disabled={index === banners.length - 1}
                                        className={`w-5 h-5 flex items-center justify-center rounded text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors border-none bg-transparent cursor-pointer ${index === banners.length - 1 ? 'opacity-30 cursor-not-allowed hidden' : 'opacity-0 group-hover:opacity-100'}`}
                                    >
                                        <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
                                            <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                        </svg>
                                    </button>
                                </div>

                                {/* Column 2: Image Preview */}
                                <div className="relative w-full aspect-[3/1] rounded-lg overflow-hidden border border-slate-200 shadow-sm bg-slate-100">
                                    <img
                                        src={banner.imagePath}
                                        alt={banner.title}
                                        className={`w-full h-full object-cover transition-opacity ${!banner.isActive ? 'opacity-40 grayscale' : ''}`}
                                    />
                                    {!banner.isActive && (
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <span className="bg-white/90 backdrop-blur-sm text-slate-600 text-[9px] font-bold px-2 py-0.5 rounded shadow-sm">NONAKTIF</span>
                                        </div>
                                    )}
                                </div>

                                {/* Column 3: Banner Detail */}
                                <div className="flex flex-col min-w-0 pr-4">
                                    <h3 className={`m-0 text-sm font-bold truncate mb-1 ${banner.isActive ? 'text-slate-800' : 'text-slate-500'}`}>
                                        {banner.title}
                                    </h3>
                                    <a
                                        href={banner.linkUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-blue-600 transition-colors truncate"
                                        onClick={e => e.stopPropagation()}
                                    >
                                        <Link size={12} className="flex-shrink-0" />
                                        <span className="truncate">{banner.linkUrl.replace(/^https?:\/\//, '')}</span>
                                    </a>
                                </div>

                                {/* Column 4: Status (Toggle Switch) */}
                                <div className="flex items-center justify-center">
                                    <button
                                        onClick={(e) => { e.stopPropagation(); toggleActive(banner); }}
                                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none border-none cursor-pointer ${banner.isActive ? 'bg-blue-500' : 'bg-slate-200'
                                            }`}
                                        role="switch"
                                        aria-checked={banner.isActive}
                                    >
                                        <span
                                            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${banner.isActive ? 'translate-x-6' : 'translate-x-1'
                                                }`}
                                        />
                                    </button>
                                </div>

                                {/* Column 5: Actions */}
                                <div className="flex items-center justify-end gap-2 pr-2">
                                    <button
                                        className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors border-none bg-transparent cursor-pointer"
                                        onClick={(e) => { e.stopPropagation(); /* Optional edit functionality if needed */ }}
                                        title="Edit (Fitur Segera)"
                                    >
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M12 20h9"></path>
                                            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                                        </svg>
                                    </button>

                                    <button
                                        onClick={(e) => { e.stopPropagation(); deleteBanner(banner.id); }}
                                        className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors border-none bg-transparent cursor-pointer"
                                        title="Hapus"
                                    >
                                        <Trash2 size={16} strokeWidth={2.5} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Table Footer */}
                {!loading && banners.length > 0 && (
                    <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex justify-between items-center text-xs text-slate-500 font-medium">
                        <span>Menampilkan {banners.length} dari {banners.length} banner</span>
                        <div className="flex items-center gap-2">
                            <button className="px-3 py-1.5 border border-slate-200 rounded bg-white text-slate-400 cursor-not-allowed">Sebelumnya</button>
                            <button className="px-3 py-1.5 border border-slate-200 rounded bg-white text-slate-400 cursor-not-allowed">Berikutnya</button>
                        </div>
                    </div>
                )}
            </div>

            {/* Info Footer Box */}
            <div className="mt-4 p-5 bg-blue-50 border border-blue-100 rounded-2xl flex gap-3 shadow-sm">
                <div className="w-5 h-5 rounded-full border-2 border-blue-500 text-blue-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs font-bold leading-none">i</span>
                </div>
                <div>
                    <h4 className="m-0 text-sm font-bold text-blue-900 mb-1">Panduan Manajemen Banner</h4>
                    <p className="m-0 text-xs text-blue-800/80 leading-relaxed">
                        Gunakan tombol panah di kolom <strong>Urutan</strong> atau drag & drop (geser) untuk memindahkan posisi banner di carousel dashboard siswa.
                        Perubahan urutan akan langsung disimpan secara otomatis. Pastikan ukuran banner berada pada rasio lanskap tebal (rekomendasi 1200×400 px) untuk hasil terbaik.
                    </p>
                </div>
            </div>
        </div>
    );
}
