'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';

interface CoderProfileData {
    username: string;
    fullName: string;
    avatarPath: string | null;
    birthDate: string | null;
    gender: 'MALE' | 'FEMALE' | null;
    schoolName: string | null;
    schoolGrade: string | null;
    parentName: string | null;
    parentEmail: string | null;
    parentContactPhone: string | null;
    address: string | null;
}

interface ClassInfo {
    className: string;
    completedBlocks: number;
    totalBlocks: number;
}

export default function CoderSettingsAccordion({
    profile,
    classInfo,
}: {
    profile: CoderProfileData;
    classInfo: ClassInfo | null;
}) {
    const router = useRouter();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [formData, setFormData] = useState<CoderProfileData>(profile);
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    const [isUpdatingAccount, setIsUpdatingAccount] = useState(false);
    const [isUpdatingPersonal, setIsUpdatingPersonal] = useState(false);
    const [isChangingPassword, setIsChangingPassword] = useState(false);
    const [isUploading, setIsUploading] = useState(false);

    const [accountMsg, setAccountMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    const [personalMsg, setPersonalMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    const [passwordMsg, setPasswordMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    const handleChange = (field: keyof CoderProfileData, value: string | null) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setAccountMsg(null);
        if (file.size > 2 * 1024 * 1024) { setAccountMsg({ type: 'error', text: 'Ukuran maksimum 2MB' }); return; }
        if (!file.type.startsWith('image/')) { setAccountMsg({ type: 'error', text: 'Harus berupa gambar' }); return; }

        setIsUploading(true);
        const submitData = new FormData();
        submitData.append('file', file);
        try {
            const res = await fetch('/api/profile/upload', { method: 'POST', body: submitData });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Upload gagal');
            const updateRes = await fetch('/api/profile/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ avatarPath: data.filePath })
            });
            if (!updateRes.ok) throw new Error('Gagal simpan path');
            setFormData(prev => ({ ...prev, avatarPath: data.filePath }));
            setAccountMsg({ type: 'success', text: 'Foto terbaru berhasil dipasang!' });
            router.refresh();
        } catch (err: any) {
            setAccountMsg({ type: 'error', text: err.message });
        } finally {
            setIsUploading(false);
        }
    };

    const handleUpdateName = async (e: React.FormEvent) => {
        e.preventDefault();
        setAccountMsg(null);
        setIsUpdatingAccount(true);
        try {
            const res = await fetch('/api/profile/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fullName: formData.fullName }),
            });
            if (!res.ok) throw new Error('Gagal memperbarui nama');
            setAccountMsg({ type: 'success', text: 'Nama berhasil diubah!' });
            router.refresh();
        } catch (err: any) {
            setAccountMsg({ type: 'error', text: err.message });
        } finally {
            setIsUpdatingAccount(false);
        }
    };

    const handleUpdatePersonal = async (e: React.FormEvent) => {
        e.preventDefault();
        setPersonalMsg(null);
        setIsUpdatingPersonal(true);
        try {
            const res = await fetch('/api/profile/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    birthDate: formData.birthDate,
                    gender: formData.gender,
                    schoolName: formData.schoolName,
                    schoolGrade: formData.schoolGrade,
                    parentName: formData.parentName,
                    parentEmail: formData.parentEmail,
                    parentContactPhone: formData.parentContactPhone,
                    address: formData.address,
                }),
            });
            if (!res.ok) throw new Error('Gagal memperbarui profil');
            setPersonalMsg({ type: 'success', text: 'Data profil berhasil diamankan!' });
            router.refresh();
        } catch (err: any) {
            setPersonalMsg({ type: 'error', text: err.message });
        } finally {
            setIsUpdatingPersonal(false);
        }
    };

    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setPasswordMsg(null);
        if (newPassword.length < 6) { setPasswordMsg({ type: 'error', text: 'Password minimal 6 karakter' }); return; }
        if (newPassword !== confirmPassword) { setPasswordMsg({ type: 'error', text: 'Konfirmasi password tidak cocok' }); return; }
        setIsChangingPassword(true);
        try {
            const res = await fetch('/api/profile/change-password', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ currentPassword, newPassword }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Password salah');
            setPasswordMsg({ type: 'success', text: 'Password baru sudah aktif!' });
            setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
        } catch (err: any) {
            setPasswordMsg({ type: 'error', text: err.message });
        } finally {
            setIsChangingPassword(false);
        }
    };

    const inputClass = "w-full px-5 py-3.5 bg-[#f6f7f8] border-none rounded-2xl focus:ring-4 focus:ring-[#3db8eb]/30 font-bold text-[#1e3a5f] outline-none transition-all";

    return (
        <div className="w-full max-w-[1100px] flex flex-col gap-8 pb-24">

            {/* Section Header */}
            <div className="flex items-center gap-5">
                <div className="size-16 bg-[#3db8eb]/20 flex items-center justify-center rounded-3xl shrink-0">
                    <svg xmlns="http://www.w3.org/2000/svg" className="text-[#3db8eb] size-9" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 112.828 2.828L11.828 15.828a4 4 0 01-1.414.93l-3.328 1.11 1.11-3.328a4 4 0 01.93-1.414z" />
                    </svg>
                </div>
                <div>
                    <h1 className="text-3xl lg:text-4xl font-black text-[#1e3a5f] leading-none">Pengaturan Profil</h1>
                    <p className="text-[#1e3a5f]/60 font-medium mt-1">Kelola akun belajar seru kamu di sini!</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-7">

                {/* ── LEFT COLUMN: Avatar Card ── */}
                <div className="lg:col-span-4 flex flex-col gap-7">

                    {/* Avatar Card */}
                    <div className="bg-white p-8 rounded-[2.5rem] shadow-xl shadow-[#1e3a5f]/5 flex flex-col items-center text-center border-4 border-[#3db8eb]/10">
                        <div className="relative">
                            <div className="size-44 rounded-full overflow-hidden border-8 border-[#3db8eb]/20 bg-[#3db8eb]/10 mb-5">
                                {formData.avatarPath ? (
                                    <img src={formData.avatarPath} alt="Avatar" className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-[#3db8eb] text-white text-6xl font-black">
                                        {formData.fullName.charAt(0)}
                                    </div>
                                )}
                            </div>
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className="absolute bottom-5 right-0 size-12 bg-[#ff6b6b] text-white rounded-2xl flex items-center justify-center shadow-lg hover:scale-110 transition-transform"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                            </button>
                        </div>

                        <h3 className="text-2xl font-black text-[#1e3a5f] mb-0.5">{formData.fullName}</h3>
                        <p className="text-[#1e3a5f]/40 font-bold text-xs uppercase tracking-widest mb-7">Siswa Clevio</p>

                        <input type="file" ref={fileInputRef} hidden accept="image/*" onChange={handleFileChange} />

                        {accountMsg && (
                            <div className={`w-full mb-4 p-3 text-sm font-bold rounded-2xl text-center ${accountMsg.type === 'success' ? 'bg-[#4ade80]/15 text-[#16a34a]' : 'bg-[#ff6b6b]/15 text-[#ff6b6b]'}`}>
                                {accountMsg.text}
                            </div>
                        )}

                        <div className="w-full flex flex-col gap-3">
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={isUploading}
                                className="w-full py-3.5 bg-[#fce7f3] text-[#db2777] font-black rounded-3xl shadow-[0_4px_0_#f472b6] hover:translate-y-[2px] hover:shadow-[0_2px_0_#f472b6] transition-all disabled:opacity-50"
                            >
                                {isUploading ? 'Mengupload...' : 'Ganti Foto Profil'}
                            </button>
                        </div>
                    </div>

                    {/* Class Progress Stats */}
                    <div className="bg-[#1e3a5f] p-8 rounded-[2.5rem] text-white">
                        <div className="flex items-center gap-4 mb-5">
                            <div className="size-12 bg-[#3db8eb] rounded-2xl flex items-center justify-center shrink-0">
                                <svg xmlns="http://www.w3.org/2000/svg" className="size-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                                </svg>
                            </div>
                            <div className="min-w-0">
                                <p className="text-white/60 text-xs font-bold uppercase tracking-widest">Clevio Program</p>
                                <p className="text-base font-black text-white truncate">
                                    {classInfo ? classInfo.className : 'Belum Ada Kelas'}
                                </p>
                            </div>
                        </div>
                        {classInfo ? (
                            <>
                                <div className="w-full bg-white/10 h-3 rounded-full overflow-hidden">
                                    <div
                                        className="bg-[#3db8eb] h-full rounded-full transition-all duration-700"
                                        style={{ width: `${classInfo.totalBlocks > 0 ? Math.round((classInfo.completedBlocks / classInfo.totalBlocks) * 100) : 0}%` }}
                                    />
                                </div>
                                <div className="flex justify-between items-center mt-2">
                                    <p className="text-white/40 text-xs font-bold">{classInfo.completedBlocks} dari {classInfo.totalBlocks} block selesai</p>
                                    <p className="text-[#3db8eb] text-xs font-black">{classInfo.totalBlocks > 0 ? Math.round((classInfo.completedBlocks / classInfo.totalBlocks) * 100) : 0}%</p>
                                </div>
                            </>
                        ) : (
                            <p className="text-white/30 text-xs font-bold mt-3">Daftarkan diri ke kelas untuk mulai belajar!</p>
                        )}
                    </div>
                </div>

                {/* ── RIGHT COLUMN ── */}
                <div className="lg:col-span-8 flex flex-col gap-7">

                    {/* Card: Nama & Avatar — Save Name */}
                    <form onSubmit={handleUpdateName} className="bg-white p-8 lg:p-10 rounded-[2.5rem] shadow-xl shadow-[#1e3a5f]/5 border-b-8 border-[#3db8eb]">
                        <div className="flex items-center gap-4 mb-8">
                            <div className="size-12 bg-[#3db8eb]/20 rounded-2xl flex items-center justify-center shrink-0">
                                <svg xmlns="http://www.w3.org/2000/svg" className="size-6 text-[#3db8eb]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                </svg>
                            </div>
                            <h2 className="text-2xl font-black text-[#1e3a5f]">Akun Clevio Kamu</h2>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-bold text-[#1e3a5f]/40 mb-2 ml-1">Username</label>
                                <input className={`${inputClass} opacity-60 cursor-not-allowed`} type="text" value={formData.username} disabled />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-[#1e3a5f]/40 mb-2 ml-1">Nama Panggilan</label>
                                <input
                                    className={inputClass}
                                    type="text"
                                    value={formData.fullName}
                                    onChange={e => handleChange('fullName', e.target.value)}
                                    required
                                />
                            </div>
                        </div>

                        <div className="mt-8">
                            <button
                                type="submit"
                                disabled={isUpdatingAccount}
                                className="w-full md:w-auto px-10 py-3.5 bg-[#ff6b6b] text-white font-black rounded-3xl shadow-[0_6px_0_#e11d48] hover:translate-y-[2px] hover:shadow-[0_3px_0_#e11d48] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                                {isUpdatingAccount ? 'Menyimpan...' : 'Simpan Nama'}
                            </button>
                        </div>
                    </form>

                    {/* Card: Data Pribadi & Orang Tua */}
                    <form onSubmit={handleUpdatePersonal} className="bg-white p-8 lg:p-10 rounded-[2.5rem] shadow-xl shadow-[#1e3a5f]/5 border-b-8 border-[#4ade80]">
                        <div className="flex items-center gap-4 mb-8">
                            <div className="size-12 bg-[#4ade80]/20 rounded-2xl flex items-center justify-center shrink-0">
                                <svg xmlns="http://www.w3.org/2000/svg" className="size-6 text-[#4ade80]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                            </div>
                            <h2 className="text-2xl font-black text-[#1e3a5f]">Data Pribadi &amp; Orang Tua</h2>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            {/* Student column */}
                            <div className="flex flex-col gap-5">
                                <p className="text-[#1e3a5f] font-black text-lg border-l-4 border-[#3db8eb] pl-3">Data Siswa</p>
                                <div>
                                    <label className="block text-sm font-bold text-[#1e3a5f]/40 mb-2 ml-1">Tanggal Lahir</label>
                                    <input type="date" className={inputClass} value={formData.birthDate || ''} onChange={e => handleChange('birthDate', e.target.value)} />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-[#1e3a5f]/40 mb-2 ml-1">Jenis Kelamin</label>
                                    <select className={inputClass} value={formData.gender || ''} onChange={e => handleChange('gender', e.target.value as any)}>
                                        <option value="">Pilih</option>
                                        <option value="MALE">Laki-laki</option>
                                        <option value="FEMALE">Perempuan</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-[#1e3a5f]/40 mb-2 ml-1">Nama Sekolah</label>
                                    <input type="text" className={inputClass} value={formData.schoolName || ''} onChange={e => handleChange('schoolName', e.target.value)} />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-[#1e3a5f]/40 mb-2 ml-1">Kelas</label>
                                    <input type="text" className={inputClass} value={formData.schoolGrade || ''} onChange={e => handleChange('schoolGrade', e.target.value)} />
                                </div>
                            </div>

                            {/* Parent column */}
                            <div className="flex flex-col gap-5">
                                <p className="text-[#1e3a5f] font-black text-lg border-l-4 border-[#f59e0b] pl-3">Data Orang Tua</p>
                                <div>
                                    <label className="block text-sm font-bold text-[#1e3a5f]/40 mb-2 ml-1">Nama Orang Tua</label>
                                    <input type="text" className={inputClass} placeholder="Masukkan Nama Ayah/Ibu" value={formData.parentName || ''} onChange={e => handleChange('parentName', e.target.value)} />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-[#1e3a5f]/40 mb-2 ml-1">No. WhatsApp</label>
                                    <input type="tel" className={inputClass} placeholder="0812xxxx" value={formData.parentContactPhone || ''} onChange={e => handleChange('parentContactPhone', e.target.value)} />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-[#1e3a5f]/40 mb-2 ml-1">Email Orang Tua</label>
                                    <input type="email" className={inputClass} value={formData.parentEmail || ''} onChange={e => handleChange('parentEmail', e.target.value)} />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-[#1e3a5f]/40 mb-2 ml-1">Alamat Lengkap</label>
                                    <textarea className={`${inputClass} resize-none h-[100px]`} value={formData.address || ''} onChange={e => handleChange('address', e.target.value)} />
                                </div>
                            </div>
                        </div>

                        {personalMsg && (
                            <div className={`mt-5 p-3 text-sm font-bold rounded-2xl ${personalMsg.type === 'success' ? 'bg-[#4ade80]/15 text-[#16a34a]' : 'bg-[#ff6b6b]/15 text-[#ff6b6b]'}`}>
                                {personalMsg.text}
                            </div>
                        )}

                        <div className="mt-8">
                            <button
                                type="submit"
                                disabled={isUpdatingPersonal}
                                className="w-full md:w-auto px-10 py-3.5 bg-[#4ade80] text-white font-black rounded-3xl shadow-[0_6px_0_#16a34a] hover:translate-y-[2px] hover:shadow-[0_3px_0_#16a34a] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                                </svg>
                                {isUpdatingPersonal ? 'Menyimpan...' : 'Simpan Data Profil'}
                            </button>
                        </div>
                    </form>

                    {/* Card: Keamanan Password */}
                    <form onSubmit={handleChangePassword} className="bg-white p-8 lg:p-10 rounded-[2.5rem] shadow-xl shadow-[#1e3a5f]/5 border-b-8 border-[#f59e0b]">
                        <div className="flex items-center gap-4 mb-8">
                            <div className="size-12 bg-[#f59e0b]/20 rounded-2xl flex items-center justify-center shrink-0">
                                <svg xmlns="http://www.w3.org/2000/svg" className="size-6 text-[#f59e0b]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                </svg>
                            </div>
                            <h2 className="text-2xl font-black text-[#1e3a5f]">Keamanan Password</h2>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div>
                                <label className="block text-sm font-bold text-[#1e3a5f]/40 mb-2 ml-1">Password Saat Ini</label>
                                <input className={inputClass} type="password" placeholder="••••••••" required value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-[#1e3a5f]/40 mb-2 ml-1">Password Baru</label>
                                <input className={inputClass} type="password" placeholder="••••••••" required value={newPassword} onChange={e => setNewPassword(e.target.value)} />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-[#1e3a5f]/40 mb-2 ml-1">Konfirmasi Password</label>
                                <input className={inputClass} type="password" placeholder="••••••••" required value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />
                            </div>
                        </div>

                        {passwordMsg && (
                            <div className={`mt-5 p-3 text-sm font-bold rounded-2xl ${passwordMsg.type === 'success' ? 'bg-[#4ade80]/15 text-[#16a34a]' : 'bg-[#ff6b6b]/15 text-[#ff6b6b]'}`}>
                                {passwordMsg.text}
                            </div>
                        )}

                        <div className="mt-8">
                            <button
                                type="submit"
                                disabled={isChangingPassword}
                                className="w-full md:w-auto px-10 py-3.5 bg-[#f59e0b] text-white font-black rounded-3xl shadow-[0_6px_0_#b45309] hover:translate-y-[2px] hover:shadow-[0_3px_0_#b45309] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                                </svg>
                                {isChangingPassword ? 'Diproses...' : 'Ubah Password'}
                            </button>
                        </div>
                    </form>

                </div>
            </div>
        </div>
    );
}
