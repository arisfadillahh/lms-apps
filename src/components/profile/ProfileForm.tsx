'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';

interface UserProfile {
    username: string;
    fullName: string;
    avatarPath: string | null;
    role: string;
}

export default function ProfileForm({ user }: { user: UserProfile }) {
    const router = useRouter();
    const fileInputRef = useRef<HTMLInputElement>(null);

    // State
    const [fullName, setFullName] = useState(user.fullName);
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    // Loading & Error States
    const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
    const [isChangingPassword, setIsChangingPassword] = useState(false);
    const [isUploading, setIsUploading] = useState(false);

    const [profileMessage, setProfileMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    const [passwordMessage, setPasswordMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    // Avatar Upload
    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Reset message
        setProfileMessage(null);

        // Validation (Max 2MB, Image only)
        if (file.size > 2 * 1024 * 1024) {
            setProfileMessage({ type: 'error', text: 'Ukuran file maksimal 2MB' });
            return;
        }
        if (!file.type.startsWith('image/')) {
            setProfileMessage({ type: 'error', text: 'File harus gambar' });
            return;
        }

        setIsUploading(true);
        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await fetch('/api/profile/upload', {
                method: 'POST',
                body: formData,
            });
            const data = await res.json();

            if (!res.ok) throw new Error(data.error || 'Upload gagal');

            await updateLinkAvatar(data.filePath);

            setProfileMessage({ type: 'success', text: 'Foto profil diperbarui' });
            router.refresh();
        } catch (err: any) {
            setProfileMessage({ type: 'error', text: err.message });
        } finally {
            setIsUploading(false);
        }
    };

    const updateLinkAvatar = async (path: string) => {
        const res = await fetch('/api/profile/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ avatarPath: path })
        });
        if (!res.ok) throw new Error('Gagal menyimpan path avatar');
    }

    // Update Name
    const handleUpdateProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        setProfileMessage(null);
        setIsUpdatingProfile(true);

        try {
            const res = await fetch('/api/profile/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fullName }),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Gagal update profil');
            }

            setProfileMessage({ type: 'success', text: 'Profil berhasil disimpan' });
            router.refresh();
        } catch (err: any) {
            setProfileMessage({ type: 'error', text: err.message });
        } finally {
            setIsUpdatingProfile(false);
        }
    };

    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setPasswordMessage(null);

        if (newPassword !== confirmPassword) {
            setPasswordMessage({ type: 'error', text: 'Konfirmasi password tidak cocok' });
            return;
        }
        if (newPassword.length < 6) {
            setPasswordMessage({ type: 'error', text: 'Password baru minimal 6 karakter' });
            return;
        }

        setIsChangingPassword(true);

        try {
            const res = await fetch('/api/profile/change-password', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ currentPassword, newPassword }),
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Gagal ubah password');

            setPasswordMessage({ type: 'success', text: 'Password berhasil diubah' });
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
        } catch (err: any) {
            setPasswordMessage({ type: 'error', text: err.message });
        } finally {
            setIsChangingPassword(false);
        }
    };

    // --- Inline Styles for Robustness ---
    const cardStyle = {
        background: '#ffffff',
        borderRadius: '16px',
        padding: '2rem',
        border: '1px solid #e2e8f0',
        boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        marginBottom: '2rem'
    };

    const sectionTitleStyle = {
        fontSize: '1.25rem',
        fontWeight: 700,
        color: '#1e293b',
        marginBottom: '1.5rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem'
    };

    const inputGroupStyle = {
        marginBottom: '1rem'
    };

    const labelStyle = {
        display: 'block',
        fontSize: '0.875rem',
        fontWeight: 500,
        color: '#334155',
        marginBottom: '0.5rem'
    };

    const inputStyle = {
        width: '100%',
        padding: '0.5rem 1rem',
        borderRadius: '0.75rem',
        border: '1px solid #cbd5e1',
        fontSize: '1rem',
        color: '#1e293b',
        outline: 'none',
        transition: 'all 0.2s',
        background: '#fff'
    };

    const buttonStyle = {
        padding: '0.625rem 1.5rem',
        borderRadius: '0.75rem',
        fontWeight: 600,
        fontSize: '0.875rem',
        cursor: 'pointer',
        transition: 'all 0.2s',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.5rem',
        border: 'none'
    };

    const primaryButtonStyle = {
        ...buttonStyle,
        background: '#2563eb',
        color: '#ffffff',
        boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)'
    };

    const darkButtonStyle = {
        ...buttonStyle,
        background: '#1e293b',
        color: '#ffffff',
        boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)'
    };

    return (
        <div style={{ width: '100%', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '2rem', alignItems: 'start' }}>

            {/* 1. Identity Card */}
            <section style={{ ...cardStyle, height: '100%' }}>
                <h2 style={sectionTitleStyle}>
                    <span>👤</span> Identitas Diri
                </h2>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', alignItems: 'center' }}>

                    {/* Avatar Section - Centered */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                        <div style={{
                            position: 'relative',
                            width: '8rem',
                            height: '8rem',
                            borderRadius: '9999px',
                            overflow: 'hidden',
                            background: '#f1f5f9',
                            border: '4px solid white',
                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
                        }}>
                            {user.avatarPath ? (
                                <img src={user.avatarPath} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#dbeafe', color: '#3b82f6', fontSize: '2.25rem', fontWeight: 'bold' }}>
                                    {user.fullName.charAt(0)}
                                </div>
                            )}

                            {/* Overlay Upload */}
                            <div
                                onClick={() => fileInputRef.current?.click()}
                                style={{
                                    position: 'absolute',
                                    inset: 0,
                                    background: 'rgba(0,0,0,0.4)',
                                    opacity: 0,
                                    transition: 'opacity 0.2s',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: 'white',
                                    fontSize: '0.875rem',
                                    fontWeight: 500
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                                onMouseLeave={(e) => e.currentTarget.style.opacity = '0'}
                            >
                                Ganti Foto
                            </div>
                        </div>
                        <input
                            type="file"
                            ref={fileInputRef}
                            hidden
                            accept="image/*"
                            onChange={handleFileChange}
                        />
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            style={{ fontSize: '0.875rem', fontWeight: 600, color: '#2563eb', background: 'transparent', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
                            disabled={isUploading}
                        >
                            {isUploading ? 'Mengupload...' : 'Upload Foto Baru'}
                        </button>
                    </div>

                    {/* Form Section */}
                    <form onSubmit={handleUpdateProfile} style={{ width: '100%' }}>
                        <div style={inputGroupStyle}>
                            <label style={labelStyle}>Username</label>
                            <input
                                type="text"
                                value={user.username}
                                disabled
                                style={{ ...inputStyle, background: '#f8fafc', color: '#64748b', cursor: 'not-allowed' }}
                                title="Username tidak dapat diubah"
                            />
                        </div>

                        <div style={inputGroupStyle}>
                            <label style={labelStyle}>Nama Lengkap</label>
                            <input
                                type="text"
                                value={fullName}
                                onChange={e => setFullName(e.target.value)}
                                style={inputStyle}
                                placeholder="Masukkan nama lengkap"
                            />
                        </div>

                        {profileMessage && (
                            <div style={{
                                padding: '0.75rem',
                                borderRadius: '0.5rem',
                                fontSize: '0.875rem',
                                fontWeight: 500,
                                marginBottom: '1rem',
                                background: profileMessage.type === 'success' ? '#f0fdf4' : '#fef2f2',
                                color: profileMessage.type === 'success' ? '#15803d' : '#b91c1c'
                            }}>
                                {profileMessage.text}
                            </div>
                        )}

                        <div style={{ paddingTop: '0.5rem' }}>
                            <button
                                type="submit"
                                disabled={isUpdatingProfile}
                                style={{ ...primaryButtonStyle, width: '100%', justifyContent: 'center' }}
                            >
                                {isUpdatingProfile ? 'Menyimpan...' : 'Simpan Perubahan'}
                            </button>
                        </div>
                    </form>
                </div>
            </section>

            {/* 2. Security Card */}
            <section style={{ ...cardStyle, height: '100%' }}>
                <h2 style={sectionTitleStyle}>
                    <span>🔒</span> Keamanan & Password
                </h2>

                <form onSubmit={handleChangePassword} style={{ width: '100%' }}>
                    <div style={inputGroupStyle}>
                        <label style={labelStyle}>Password Saat Ini</label>
                        <input
                            type="password"
                            value={currentPassword}
                            onChange={e => setCurrentPassword(e.target.value)}
                            style={inputStyle}
                            placeholder="Masukkan password lama"
                            required
                        />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                        <div>
                            <label style={labelStyle}>Password Baru</label>
                            <input
                                type="password"
                                value={newPassword}
                                onChange={e => setNewPassword(e.target.value)}
                                style={inputStyle}
                                placeholder="Min 6 karakter"
                                required
                            />
                        </div>
                        <div>
                            <label style={labelStyle}>Konfirmasi Password</label>
                            <input
                                type="password"
                                value={confirmPassword}
                                onChange={e => setConfirmPassword(e.target.value)}
                                style={inputStyle}
                                placeholder="Ulangi password"
                                required
                            />
                        </div>
                    </div>

                    {passwordMessage && (
                        <div style={{
                            padding: '0.75rem',
                            borderRadius: '0.5rem',
                            fontSize: '0.875rem',
                            fontWeight: 500,
                            marginBottom: '1rem',
                            background: passwordMessage.type === 'success' ? '#f0fdf4' : '#fef2f2',
                            color: passwordMessage.type === 'success' ? '#15803d' : '#b91c1c'
                        }}>
                            {passwordMessage.text}
                        </div>
                    )}

                    <div style={{ paddingTop: '0.5rem' }}>
                        <button
                            type="submit"
                            disabled={isChangingPassword}
                            style={{ ...darkButtonStyle, width: '100%', justifyContent: 'center' }}
                        >
                            {isChangingPassword ? 'Memproses...' : 'Update Password'}
                        </button>
                    </div>
                </form>
            </section>

        </div>
    );
}
