'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Camera, Mail, UserCircle, Lock, KeyRound, ShieldCheck } from 'lucide-react';

interface UserProfile {
    username: string;
    fullName: string;
    avatarPath: string | null;
    role: string;
}

export default function CoderAccountForm({ user }: { user: UserProfile }) {
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

        setProfileMessage(null);

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

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* 1. Identity Card */}
            <section className="bg-white rounded-[2.5rem] p-8 border-2 border-slate-50 shadow-sm relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-coral/5 rounded-bl-full -z-10 transition-transform group-hover:scale-110"></div>

                <h2 className="text-xl font-black text-clevio-navy mb-8 flex items-center gap-2">
                    <span className="p-2 bg-pastel-pink rounded-xl text-coral"><UserCircle size={24} /></span>
                    Akun Clevio Kamu
                </h2>

                <div className="flex flex-col gap-8">
                    {/* Avatar Section */}
                    <div className="flex flex-col sm:flex-row items-center gap-6 pb-6 border-b-2 border-dashed border-pastel-pink/50">
                        <div className="relative group/avatar cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                            <div className="size-28 rounded-3xl overflow-hidden bg-slate-100 border-4 border-white shadow-lg relative">
                                {user.avatarPath ? (
                                    <img src={user.avatarPath} alt="Avatar" className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-pastel-blue text-sky text-4xl font-black uppercase">
                                        {user.fullName.charAt(0)}
                                    </div>
                                )}

                                <div className="absolute inset-0 bg-clevio-navy/60 opacity-0 group-hover/avatar:opacity-100 transition-opacity flex flex-col items-center justify-center text-white backdrop-blur-[2px]">
                                    <Camera size={24} className="mb-1" />
                                </div>
                            </div>

                            <div className="absolute -bottom-2 -right-2 bg-white text-coral p-2 rounded-xl shadow-md border-2 border-slate-50 transition-transform hover:scale-110">
                                <Camera size={16} />
                            </div>
                        </div>

                        <div className="text-center sm:text-left">
                            <h3 className="text-lg font-black text-clevio-navy">{user.fullName}</h3>
                            <p className="text-sm font-bold text-slate-400 mb-3">Coder Luar Biasa 🚀</p>

                            <input
                                type="file"
                                ref={fileInputRef}
                                hidden
                                accept="image/*"
                                onChange={handleFileChange}
                            />
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                disabled={isUploading}
                                className="text-sm font-black text-coral py-2 px-4 bg-pastel-pink rounded-xl hover:bg-coral hover:text-white transition-colors"
                            >
                                {isUploading ? 'MENGUPLOAD...' : 'GANTI FOTO PROFIL'}
                            </button>
                        </div>
                    </div>

                    {/* Form Section */}
                    <form onSubmit={handleUpdateProfile} className="space-y-5">
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-slate-500 flex items-center gap-2">Username</label>
                            <div className="relative">
                                <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="text"
                                    value={user.username}
                                    disabled
                                    className="w-full bg-slate-100 border-2 border-slate-200 rounded-2xl pl-12 pr-5 py-3 text-slate-500 font-bold cursor-not-allowed"
                                    title="Username tidak dapat diubah"
                                />
                            </div>
                            <p className="text-xs font-bold text-slate-400 ml-2">Username unik kamu tidak bisa diubah.</p>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-bold text-slate-500 flex items-center gap-2">Nama Panggilan / Lengkap</label>
                            <div className="relative">
                                <UserCircle size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="text"
                                    value={fullName}
                                    onChange={e => setFullName(e.target.value)}
                                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl pl-12 pr-5 py-3 text-clevio-navy font-bold focus:border-sky focus:bg-white focus:outline-none transition-all"
                                    placeholder="Nama keren kamu"
                                />
                            </div>
                        </div>

                        {profileMessage && (
                            <div className={`p-4 rounded-xl flex items-center gap-3 font-bold text-sm border-2 ${profileMessage.type === 'success' ? 'bg-pastel-green text-clevio-green border-clevio-green/20' : 'bg-pastel-pink text-coral border-coral/20'}`}>
                                {profileMessage.text}
                            </div>
                        )}

                        <div className="pt-2">
                            <button
                                type="submit"
                                disabled={isUpdatingProfile}
                                className="w-full flex items-center justify-center gap-2 bg-coral text-white py-4 rounded-2xl font-black text-sm shadow-[0_4px_0_0_#D94833] hover:translate-y-1 hover:shadow-[0_2px_0_0_#D94833] focus:translate-y-1 focus:shadow-[0_2px_0_0_#D94833] active:translate-y-2 active:shadow-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isUpdatingProfile ? 'MENYIMPAN...' : 'SIMPAN NAMA'}
                            </button>
                        </div>
                    </form>
                </div>
            </section>

            {/* 2. Security Card */}
            <section className="bg-white rounded-[2.5rem] p-8 border-2 border-slate-50 shadow-sm relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-amber-50 rounded-bl-[5rem] -z-10 transition-transform group-hover:scale-110"></div>

                <h2 className="text-xl font-black text-clevio-navy mb-8 flex items-center gap-2">
                    <span className="p-2 bg-pastel-yellow rounded-xl text-amber-500"><ShieldCheck size={24} /></span>
                    Keamanan Password
                </h2>

                <form onSubmit={handleChangePassword} className="space-y-5">
                    <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-500 flex items-center gap-2">Password Saat Ini</label>
                        <div className="relative">
                            <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="password"
                                value={currentPassword}
                                onChange={e => setCurrentPassword(e.target.value)}
                                className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl pl-12 pr-5 py-3 text-clevio-navy font-bold focus:border-amber-400 focus:bg-white focus:outline-none transition-all"
                                placeholder="••••••••"
                                required
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-500 flex items-center gap-2">Password Baru</label>
                        <div className="relative">
                            <KeyRound size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="password"
                                value={newPassword}
                                onChange={e => setNewPassword(e.target.value)}
                                className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl pl-12 pr-5 py-3 text-clevio-navy font-bold focus:border-amber-400 focus:bg-white focus:outline-none transition-all"
                                placeholder="Min. 6 karakter rahasia"
                                required
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-500 flex items-center gap-2">Konfirmasi Password</label>
                        <div className="relative">
                            <KeyRound size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="password"
                                value={confirmPassword}
                                onChange={e => setConfirmPassword(e.target.value)}
                                className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl pl-12 pr-5 py-3 text-clevio-navy font-bold focus:border-amber-400 focus:bg-white focus:outline-none transition-all"
                                placeholder="Ketik ulang ya"
                                required
                            />
                        </div>
                    </div>

                    {passwordMessage && (
                        <div className={`p-4 rounded-xl flex items-center gap-3 font-bold text-sm border-2 ${passwordMessage.type === 'success' ? 'bg-pastel-green text-clevio-green border-clevio-green/20' : 'bg-pastel-pink text-coral border-coral/20'}`}>
                            {passwordMessage.text}
                        </div>
                    )}

                    <div className="pt-2">
                        <button
                            type="submit"
                            disabled={isChangingPassword}
                            className="w-full flex items-center justify-center gap-2 bg-amber-500 text-white py-4 rounded-2xl font-black text-sm shadow-[0_4px_0_0_#D97706] hover:translate-y-1 hover:shadow-[0_2px_0_0_#D97706] focus:translate-y-1 focus:shadow-[0_2px_0_0_#D97706] active:translate-y-2 active:shadow-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isChangingPassword ? 'MEMPROSES...' : 'UBAH PASSWORD'}
                        </button>
                    </div>
                </form>
            </section>
        </div>
    );
}
