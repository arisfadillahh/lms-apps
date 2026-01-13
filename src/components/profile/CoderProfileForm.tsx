'use client';

import type { CSSProperties } from 'react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface CoderProfile {
    fullName: string;
    birthDate: string | null;
    gender: 'MALE' | 'FEMALE' | null;
    schoolName: string | null;
    schoolGrade: string | null;
    parentName: string | null;
    parentEmail: string | null;
    parentContactPhone: string | null;
    address: string | null;
    referralSource: string | null;
}

export default function CoderProfileForm({ profile }: { profile: CoderProfile }) {
    const router = useRouter();
    const [formData, setFormData] = useState<CoderProfile>(profile);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const handleChange = (field: keyof CoderProfile, value: string | null) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setMessage(null);
        setIsSubmitting(true);

        try {
            const res = await fetch('/api/profile/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fullName: formData.fullName,
                    birthDate: formData.birthDate || null,
                    gender: formData.gender || null,
                    schoolName: formData.schoolName || null,
                    schoolGrade: formData.schoolGrade || null,
                    parentName: formData.parentName || null,
                    parentEmail: formData.parentEmail || null,
                    parentContactPhone: formData.parentContactPhone || null,
                    address: formData.address || null,
                    referralSource: formData.referralSource || null,
                }),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Gagal update profil');
            }

            setMessage({ type: 'success', text: 'Profil berhasil disimpan!' });
            router.refresh();
        } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : 'Terjadi kesalahan';
            setMessage({ type: 'error', text: errorMessage });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} style={formStyle}>
            <h3 style={sectionTitleStyle}>📝 Data Pribadi</h3>

            <div style={gridStyle}>
                <div style={fieldStyle}>
                    <label style={labelStyle}>Nama Lengkap *</label>
                    <input
                        type="text"
                        value={formData.fullName}
                        onChange={(e) => handleChange('fullName', e.target.value)}
                        style={inputStyle}
                        required
                    />
                </div>

                <div style={fieldStyle}>
                    <label style={labelStyle}>Tanggal Lahir</label>
                    <input
                        type="date"
                        value={formData.birthDate || ''}
                        onChange={(e) => handleChange('birthDate', e.target.value)}
                        style={inputStyle}
                    />
                </div>

                <div style={fieldStyle}>
                    <label style={labelStyle}>Jenis Kelamin</label>
                    <select
                        value={formData.gender || ''}
                        onChange={(e) => handleChange('gender', e.target.value as 'MALE' | 'FEMALE' | null)}
                        style={inputStyle}
                    >
                        <option value="">-- Pilih --</option>
                        <option value="MALE">Laki-laki</option>
                        <option value="FEMALE">Perempuan</option>
                    </select>
                </div>

                <div style={fieldStyle}>
                    <label style={labelStyle}>Nama Sekolah</label>
                    <input
                        type="text"
                        value={formData.schoolName || ''}
                        onChange={(e) => handleChange('schoolName', e.target.value)}
                        placeholder="SDN 01, SMPN 02, dll"
                        style={inputStyle}
                    />
                </div>

                <div style={fieldStyle}>
                    <label style={labelStyle}>Kelas / Tingkat</label>
                    <input
                        type="text"
                        value={formData.schoolGrade || ''}
                        onChange={(e) => handleChange('schoolGrade', e.target.value)}
                        placeholder="5 SD, 2 SMP, dll"
                        style={inputStyle}
                    />
                </div>
            </div>

            <h3 style={{ ...sectionTitleStyle, marginTop: '1.5rem' }}>👨‍👩‍👧 Data Orang Tua / Wali</h3>

            <div style={gridStyle}>
                <div style={fieldStyle}>
                    <label style={labelStyle}>Nama Orang Tua</label>
                    <input
                        type="text"
                        value={formData.parentName || ''}
                        onChange={(e) => handleChange('parentName', e.target.value)}
                        style={inputStyle}
                    />
                </div>

                <div style={fieldStyle}>
                    <label style={labelStyle}>Email Orang Tua</label>
                    <input
                        type="email"
                        value={formData.parentEmail || ''}
                        onChange={(e) => handleChange('parentEmail', e.target.value)}
                        placeholder="email@contoh.com"
                        style={inputStyle}
                    />
                </div>

                <div style={fieldStyle}>
                    <label style={labelStyle}>No. HP Orang Tua</label>
                    <input
                        type="tel"
                        value={formData.parentContactPhone || ''}
                        onChange={(e) => handleChange('parentContactPhone', e.target.value)}
                        placeholder="08xxxxxxxxxx"
                        style={inputStyle}
                    />
                </div>

                <div style={{ ...fieldStyle, gridColumn: '1 / -1' }}>
                    <label style={labelStyle}>Alamat</label>
                    <textarea
                        value={formData.address || ''}
                        onChange={(e) => handleChange('address', e.target.value)}
                        rows={2}
                        style={{ ...inputStyle, resize: 'vertical' }}
                    />
                </div>

                <div style={fieldStyle}>
                    <label style={labelStyle}>Dari Mana Tahu Clevio?</label>
                    <select
                        value={formData.referralSource || ''}
                        onChange={(e) => handleChange('referralSource', e.target.value)}
                        style={inputStyle}
                    >
                        <option value="">-- Pilih --</option>
                        <option value="INSTAGRAM">Instagram</option>
                        <option value="FACEBOOK">Facebook</option>
                        <option value="TIKTOK">TikTok</option>
                        <option value="YOUTUBE">YouTube</option>
                        <option value="GOOGLE">Google</option>
                        <option value="FRIEND">Teman/Keluarga</option>
                        <option value="SCHOOL">Sekolah</option>
                        <option value="OTHER">Lainnya</option>
                    </select>
                </div>
            </div>

            {message && (
                <div
                    style={{
                        padding: '0.75rem',
                        borderRadius: '0.5rem',
                        marginTop: '1rem',
                        background: message.type === 'success' ? '#f0fdf4' : '#fef2f2',
                        color: message.type === 'success' ? '#15803d' : '#b91c1c',
                        fontWeight: 500,
                    }}
                >
                    {message.text}
                </div>
            )}

            <button type="submit" disabled={isSubmitting} style={buttonStyle}>
                {isSubmitting ? 'Menyimpan...' : 'Simpan Data Profil'}
            </button>
        </form>
    );
}

const formStyle: CSSProperties = {
    background: '#fff',
    borderRadius: '1rem',
    padding: '1.5rem',
    border: '1px solid #e2e8f0',
    boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
};

const sectionTitleStyle: CSSProperties = {
    fontSize: '1rem',
    fontWeight: 600,
    color: '#1e293b',
    marginBottom: '1rem',
};

const gridStyle: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '1rem',
};

const fieldStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem',
};

const labelStyle: CSSProperties = {
    fontSize: '0.85rem',
    fontWeight: 500,
    color: '#475569',
};

const inputStyle: CSSProperties = {
    padding: '0.5rem 0.75rem',
    borderRadius: '0.5rem',
    border: '1px solid #cbd5e1',
    fontSize: '0.9rem',
    color: '#0f172a',
};

const buttonStyle: CSSProperties = {
    marginTop: '1.5rem',
    padding: '0.75rem 1.5rem',
    borderRadius: '0.5rem',
    border: 'none',
    background: '#2563eb',
    color: '#fff',
    fontSize: '0.9rem',
    fontWeight: 600,
    cursor: 'pointer',
    width: '100%',
};
