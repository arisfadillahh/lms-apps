'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { formatIndonesianPhoneInput, normalizeIndonesianPhone } from '@/lib/phoneNumbers';

interface UserProfile {
    username: string;
    fullName: string;
    avatarPath: string | null;
    role: string;
    parentContactPhone?: string | null;
    // Coach-specific
    coachBio?: string;
    coachSkills?: string[];
    // Notifications
    notifNewClass?: boolean;
    notifLeaveUpdate?: boolean;
    notifSessionReminder?: boolean;
}

function getErrorMessage(error: unknown) {
    return error instanceof Error ? error.message : 'Terjadi kesalahan. Silakan coba lagi.';
}

export default function ProfileForm({ user }: { user: UserProfile }) {
    const router = useRouter();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [fullName, setFullName] = useState(user.fullName);
    const [showPassword, setShowPassword] = useState(false);
    const [password, setPassword] = useState('');
    const [currentPassword, setCurrentPassword] = useState('');
    const [whatsapp, setWhatsapp] = useState(() => formatIndonesianPhoneInput(user.parentContactPhone));

    // Coach-specific state initialized from DB
    const [bio, setBio] = useState(user.coachBio || '');
    const [skills, setSkills] = useState<string[]>(user.coachSkills?.length ? user.coachSkills : ['Construct 3', 'Python']);
    const [skillInput, setSkillInput] = useState('');
    const [dangerOpen, setDangerOpen] = useState(false);

    // Notification toggles initialized from DB
    const [notifNewClass, setNotifNewClass] = useState(user.notifNewClass ?? true);
    const [notifLeaveUpdate, setNotifLeaveUpdate] = useState(user.notifLeaveUpdate ?? true);
    const [notifSessionReminder, setNotifSessionReminder] = useState(user.notifSessionReminder ?? false);

    const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [profileMessage, setProfileMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    // Password strength
    const strength = password.length === 0 ? 0 : password.length < 6 ? 1 : password.length < 10 ? 2 : password.length < 14 ? 3 : 4;
    const strengthLabel = ['', 'Lemah', 'Cukup', 'Kuat', 'Sangat Kuat'][strength];
    const strengthColor = ['bg-slate-200', 'bg-red-400', 'bg-yellow-400', 'bg-emerald-400', 'bg-emerald-500'][strength];

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 2 * 1024 * 1024) { setProfileMessage({ type: 'error', text: 'Ukuran file maksimal 2MB' }); return; }
        if (!file.type.startsWith('image/')) { setProfileMessage({ type: 'error', text: 'File harus gambar' }); return; }
        setIsUploading(true);
        const formData = new FormData();
        formData.append('file', file);
        try {
            const res = await fetch('/api/profile/upload', { method: 'POST', body: formData });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Upload gagal');
            await fetch('/api/profile/update', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ avatarPath: data.filePath }) });
            setProfileMessage({ type: 'success', text: 'Foto profil diperbarui' });
            router.refresh();
        } catch (err: unknown) {
            setProfileMessage({ type: 'error', text: getErrorMessage(err) });
        } finally {
            setIsUploading(false);
        }
    };

    const handleSaveAll = async (e: React.FormEvent) => {
        e.preventDefault();
        setProfileMessage(null);
        setIsUpdatingProfile(true);
        try {
            const res = await fetch('/api/profile/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fullName,
                    parentContactPhone: whatsapp.trim() ? normalizeIndonesianPhone(whatsapp) : null,
                    coachBio: bio,
                    coachSkills: skills,
                    notifNewClass,
                    notifLeaveUpdate,
                    notifSessionReminder
                }),
            });
            if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Gagal update profil'); }

            // Change password if filled
            if (password && currentPassword) {
                const res2 = await fetch('/api/profile/change-password', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ currentPassword, newPassword: password }),
                });
                if (!res2.ok) { const d2 = await res2.json(); throw new Error(d2.error || 'Gagal ubah password'); }
            }

            setProfileMessage({ type: 'success', text: 'Perubahan berhasil disimpan' });
            router.refresh();
        } catch (err: unknown) {
            setProfileMessage({ type: 'error', text: getErrorMessage(err) });
        } finally {
            setIsUpdatingProfile(false);
        }
    };

    const addSkill = () => {
        const trimmed = skillInput.trim();
        if (trimmed && !skills.includes(trimmed)) setSkills(prev => [...prev, trimmed]);
        setSkillInput('');
    };

    const initials = fullName?.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || '?';

    return (
        <form onSubmit={handleSaveAll} className="-mx-8 -mt-4 font-sans">

            {/* ── Profile Hero ── */}
            <div className="bg-white border-b border-slate-200 px-8 py-8">
                <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">

                    {/* Left: avatar + info */}
                    <div className="flex items-center gap-6">
                        <div
                            className="relative group cursor-pointer shrink-0"
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <div className="size-24 rounded-full border-4 border-slate-50 overflow-hidden bg-slate-100 shadow">
                                {user.avatarPath ? (
                                    <img src={user.avatarPath} alt="Avatar" className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-emerald-100 text-emerald-700 text-2xl font-bold select-none">
                                        {initials}
                                    </div>
                                )}
                            </div>
                            <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <span className="material-symbols-outlined text-white">{isUploading ? 'hourglass_top' : 'photo_camera'}</span>
                            </div>
                        </div>
                        <input type="file" ref={fileInputRef} hidden accept="image/*" onChange={handleFileChange} />

                        <div>
                            <div className="flex items-center gap-3 flex-wrap">
                                <h2 className="text-2xl font-bold text-slate-900">{fullName}</h2>
                                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-bold uppercase tracking-wider rounded">
                                    {user.role}
                                </span>
                            </div>
                            <p className="text-slate-500 text-sm mt-1 flex items-center gap-1">
                                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>calendar_month</span>
                                @{user.username}
                            </p>
                            {profileMessage && (
                                <p className={`text-xs mt-1 font-medium ${profileMessage.type === 'success' ? 'text-emerald-600' : 'text-red-500'}`}>
                                    {profileMessage.text}
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Save button */}
                    <button
                        type="submit"
                        disabled={isUpdatingProfile}
                        className="bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 text-white px-6 py-3 rounded-xl font-bold text-sm shadow-lg shadow-emerald-500/20 transition-all flex items-center gap-2 shrink-0"
                    >
                        <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>save</span>
                        {isUpdatingProfile ? 'Menyimpan...' : 'Simpan semua perubahan'}
                    </button>
                </div>
            </div>

            {/* ── Form Content ── */}
            <div className="max-w-6xl mx-auto px-8 py-10">
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">

                    {/* Left: Personal Info (3 cols) */}
                    <div className="lg:col-span-3 space-y-8">
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                            <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
                                <span className="material-symbols-outlined text-emerald-500">person</span>
                                <h3 className="font-bold text-slate-800">Informasi Pribadi</h3>
                            </div>
                            <div className="p-6 space-y-6">

                                {/* Nama */}
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">Nama Lengkap</label>
                                    <input
                                        type="text"
                                        value={fullName}
                                        onChange={e => setFullName(e.target.value)}
                                        className="w-full rounded-xl border border-slate-200 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 px-4 py-3 text-slate-900 placeholder:text-slate-400 text-sm outline-none transition-all"
                                    />
                                </div>

                                {/* WhatsApp */}
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">Nomor WhatsApp</label>
                                    <div className="flex">
                                        <span className="inline-flex items-center px-4 rounded-l-xl border border-r-0 border-slate-200 bg-slate-50 text-slate-500 text-sm font-medium">+62</span>
                                        <input
                                            type="tel"
                                            value={whatsapp}
                                            onChange={e => setWhatsapp(formatIndonesianPhoneInput(e.target.value))}
                                            className="flex-1 rounded-r-xl border border-slate-200 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 px-4 py-3 text-slate-900 text-sm outline-none transition-all"
                                            placeholder="812xxxxxxxx"
                                        />
                                    </div>
                                </div>

                                {/* Password (current + new in one block) */}
                                <div className="space-y-3">
                                    <label className="block text-sm font-semibold text-slate-700">Password</label>
                                    <div className="relative">
                                        <input
                                            type={showPassword ? 'text' : 'password'}
                                            value={currentPassword}
                                            onChange={e => setCurrentPassword(e.target.value)}
                                            className="w-full rounded-xl border border-slate-200 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 px-4 py-3 pr-12 text-slate-900 text-sm outline-none transition-all"
                                            placeholder="Password saat ini"
                                        />
                                        <button
                                            type="button"
                                            onMouseDown={e => e.preventDefault()}
                                            onClick={() => setShowPassword(current => !current)}
                                            className="absolute right-2 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 cursor-pointer items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                                            aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                                        >
                                            <span className="material-symbols-outlined text-[20px] leading-none">{showPassword ? 'visibility_off' : 'visibility'}</span>
                                        </button>
                                    </div>
                                    <div className="relative">
                                        <input
                                            type={showPassword ? 'text' : 'password'}
                                            value={password}
                                            onChange={e => setPassword(e.target.value)}
                                            className="w-full rounded-xl border border-slate-200 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 px-4 py-3 pr-12 text-slate-900 text-sm outline-none transition-all"
                                            placeholder="Password baru"
                                        />
                                        <button
                                            type="button"
                                            onMouseDown={e => e.preventDefault()}
                                            onClick={() => setShowPassword(current => !current)}
                                            className="absolute right-2 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 cursor-pointer items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                                            aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                                        >
                                            <span className="material-symbols-outlined text-[20px] leading-none">{showPassword ? 'visibility_off' : 'visibility'}</span>
                                        </button>
                                    </div>
                                    {/* Strength Bar */}
                                    {password.length > 0 && (
                                        <>
                                            <div className="flex gap-1 h-1.5 w-full">
                                                {[1, 2, 3, 4].map(i => (
                                                    <div key={i} className={`flex-1 rounded-full transition-colors ${i <= strength ? strengthColor : 'bg-slate-200'}`} />
                                                ))}
                                            </div>
                                            <p className="text-[11px] text-slate-400 italic">Kekuatan password: {strengthLabel}</p>
                                        </>
                                    )}
                                </div>

                            </div>
                        </div>
                    </div>

                    {/* Right: Coach Info + Notifications (2 cols) */}
                    <div className="lg:col-span-2 space-y-8">

                        {/* Coach Info */}
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                            <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
                                <span className="material-symbols-outlined text-emerald-500">school</span>
                                <h3 className="font-bold text-slate-800">Info Coach</h3>
                            </div>
                            <div className="p-6 space-y-6">

                                {/* Bidang Keahlian */}
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">Bidang Keahlian</label>
                                    <div className="flex flex-wrap gap-2 p-3 border border-slate-200 rounded-xl bg-slate-50/50">
                                        {skills.map(skill => (
                                            <span key={skill} className="inline-flex items-center gap-1 px-3 py-1 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700">
                                                {skill}
                                                <button
                                                    type="button"
                                                    onClick={() => setSkills(prev => prev.filter(s => s !== skill))}
                                                    className="material-symbols-outlined text-slate-400 hover:text-red-500 transition-colors leading-none"
                                                    style={{ fontSize: '14px' }}
                                                >close</button>
                                            </span>
                                        ))}
                                        <input
                                            type="text"
                                            value={skillInput}
                                            onChange={e => setSkillInput(e.target.value)}
                                            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSkill(); } }}
                                            onBlur={addSkill}
                                            className="bg-transparent border-none focus:ring-0 p-0 text-xs w-20 outline-none text-slate-600 placeholder:text-slate-400"
                                            placeholder="Tambah..."
                                        />
                                    </div>
                                </div>

                                {/* Bio */}
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">Bio Singkat</label>
                                    <textarea
                                        value={bio}
                                        onChange={e => setBio(e.target.value)}
                                        rows={3}
                                        className="w-full rounded-xl border border-slate-200 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 px-4 py-3 text-slate-900 text-sm placeholder:text-slate-400 resize-none outline-none transition-all"
                                        placeholder="Ceritakan tentang dirimu sebagai coach..."
                                    />
                                </div>

                            </div>
                        </div>

                        {/* Notifications */}
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                            <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
                                <span className="material-symbols-outlined text-emerald-500">notifications</span>
                                <h3 className="font-bold text-slate-800">Preferensi Notifikasi</h3>
                            </div>
                            <div className="p-6 space-y-4">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-medium text-slate-600">Jadwal baru</span>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input type="checkbox" checked={notifNewClass} onChange={e => setNotifNewClass(e.target.checked)} className="sr-only peer" />
                                        <div className="w-11 h-6 bg-slate-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500" />
                                    </label>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-medium text-slate-600">Izin diproses</span>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input type="checkbox" checked={notifLeaveUpdate} onChange={e => setNotifLeaveUpdate(e.target.checked)} className="sr-only peer" />
                                        <div className="w-11 h-6 bg-slate-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500" />
                                    </label>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-medium text-slate-600">Pengingat sesi</span>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input type="checkbox" checked={notifSessionReminder} onChange={e => setNotifSessionReminder(e.target.checked)} className="sr-only peer" />
                                        <div className="w-11 h-6 bg-slate-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500" />
                                    </label>
                                </div>

                            </div>
                        </div>

                    </div>
                </div>

                {/* ── Danger Zone ── */}
                <div className="mt-12">
                    <div className="border border-red-200 rounded-2xl bg-red-50/30 overflow-hidden">
                        <button
                            type="button"
                            onClick={() => setDangerOpen(prev => !prev)}
                            className="w-full px-6 py-4 flex items-center justify-between text-left group"
                        >
                            <div className="flex items-center gap-3">
                                <span className="material-symbols-outlined text-red-500">warning</span>
                                <div>
                                    <h4 className="font-bold text-red-600 text-sm">Zona Berbahaya</h4>
                                    <p className="text-xs text-red-400">Pengaturan akun tingkat lanjut</p>
                                </div>
                            </div>
                            <span className={`material-symbols-outlined text-red-300 group-hover:text-red-500 transition-all ${dangerOpen ? 'rotate-180' : ''}`}>
                                expand_more
                            </span>
                        </button>
                        {dangerOpen && (
                            <div className="px-6 pb-6 pt-2 border-t border-red-100 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                                <div>
                                    <p className="text-sm font-semibold text-slate-700">Hapus Akun</p>
                                    <p className="text-xs text-slate-500 mt-1">Setelah Anda menghapus akun, tidak ada jalan kembali. Mohon berhati-hati.</p>
                                </div>
                                <button
                                    type="button"
                                    className="border border-red-500 text-red-500 hover:bg-red-500 hover:text-white px-6 py-2 rounded-xl text-sm font-bold transition-all shrink-0"
                                >
                                    Hapus Akun
                                </button>
                            </div>
                        )}
                    </div>
                </div>

            </div>
        </form>
    );
}
