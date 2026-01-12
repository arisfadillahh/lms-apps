'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';

interface UserProfile {
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

            // Update di DB (via update profile API too or separate? Usually upload just returns path)
            // The instruction said existing API /profile/update takes avatarPath.
            // Let's call update profile with new path
            await updateLinkAvatar(data.path);

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

    return (
        <div className="max-w-4xl w-full mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">

            {/* 1. Identity Card */}
            <section className="bg-white rounded-2xl p-8 border border-slate-200 shadow-sm">
                <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                    👤 Identitas Diri
                </h2>

                <div className="flex flex-col md:flex-row gap-8 items-start">
                    {/* Avatar Section */}
                    <div className="flex-shrink-0 flex flex-col items-center gap-4">
                        <div className="relative group w-32 h-32 rounded-full overflow-hidden bg-slate-100 ring-4 ring-white shadow-md">
                            {user.avatarPath ? (
                                <img src={user.avatarPath} alt="Avatar" className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center bg-blue-100 text-blue-500 text-4xl font-bold">
                                    {user.fullName.charAt(0)}
                                </div>
                            )}

                            {/* Overlay Upload */}
                            <div
                                onClick={() => fileInputRef.current?.click()}
                                className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-white font-medium text-sm backdrop-blur-sm"
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
                            className="text-sm font-semibold text-blue-600 hover:text-blue-700 hover:underline"
                            disabled={isUploading}
                        >
                            {isUploading ? 'Mengupload...' : 'Upload Foto Baru'}
                        </button>
                    </div>

                    {/* Form Section */}
                    <form onSubmit={handleUpdateProfile} className="flex-1 w-full space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Nama Lengkap</label>
                            <input
                                type="text"
                                value={fullName}
                                onChange={e => setFullName(e.target.value)}
                                className="w-full px-4 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-slate-800"
                                placeholder="Masukkan nama lengkap"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Role</label>
                            <input
                                type="text"
                                value={user.role}
                                disabled
                                className="w-full px-4 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-500 cursor-not-allowed font-mono text-sm"
                            />
                        </div>

                        {profileMessage && (
                            <div className={`p-3 rounded-lg text-sm font-medium ${profileMessage.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                                {profileMessage.text}
                            </div>
                        )}

                        <div className="pt-2">
                            <button
                                type="submit"
                                disabled={isUpdatingProfile}
                                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-sm hover:shadow-md transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                                {isUpdatingProfile ? 'Menyimpan...' : 'Simpan Perubahan'}
                            </button>
                        </div>
                    </form>
                </div>
            </section>

            {/* 2. Security Card */}
            <section className="bg-white rounded-2xl p-8 border border-slate-200 shadow-sm">
                <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                    🔒 Keamanan & Password
                </h2>

                <form onSubmit={handleChangePassword} className="max-w-md space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Password Saat Ini</label>
                        <input
                            type="password"
                            value={currentPassword}
                            onChange={e => setCurrentPassword(e.target.value)}
                            className="w-full px-4 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-slate-800"
                            placeholder="Masukkan password lama"
                            required
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Password Baru</label>
                            <input
                                type="password"
                                value={newPassword}
                                onChange={e => setNewPassword(e.target.value)}
                                className="w-full px-4 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-slate-800"
                                placeholder="Minimal 6 karakter"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Konfirmasi Password</label>
                            <input
                                type="password"
                                value={confirmPassword}
                                onChange={e => setConfirmPassword(e.target.value)}
                                className="w-full px-4 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-slate-800"
                                placeholder="Ulangi password baru"
                                required
                            />
                        </div>
                    </div>

                    {passwordMessage && (
                        <div className={`p-3 rounded-lg text-sm font-medium ${passwordMessage.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                            {passwordMessage.text}
                        </div>
                    )}

                    <div className="pt-2">
                        <button
                            type="submit"
                            disabled={isChangingPassword}
                            className="px-6 py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-semibold rounded-xl shadow-sm hover:shadow-md transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                            {isChangingPassword ? 'Memproses...' : 'Update Password'}
                        </button>
                    </div>
                </form>
            </section>

        </div>
    );
}
