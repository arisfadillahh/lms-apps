'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Settings, UserCircle, Users, Lock, ChevronDown, Camera, Save, KeyRound } from 'lucide-react';

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

export default function CoderSettingsAccordion({ profile }: { profile: CoderProfileData }) {
    const router = useRouter();
    const fileInputRef = useRef<HTMLInputElement>(null);

    // State
    const [formData, setFormData] = useState<CoderProfileData>(profile);
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');

    // Loading & Error States
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

    // 1. Avatar Upload
    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setAccountMsg(null);
        if (file.size > 2 * 1024 * 1024) {
            setAccountMsg({ type: 'error', text: 'Ukuran maksimum 2MB' });
            return;
        }
        if (!file.type.startsWith('image/')) {
            setAccountMsg({ type: 'error', text: 'Harus berupa gambar' });
            return;
        }

        setIsUploading(true);
        const submitData = new FormData();
        submitData.append('file', file);

        try {
            const res = await fetch('/api/profile/upload', {
                method: 'POST',
                body: submitData,
            });
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

    // 2. Update Name only
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

    // 3. Update Personal & Parent
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

    // 4. Update Password
    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setPasswordMsg(null);

        if (newPassword.length < 6) {
            setPasswordMsg({ type: 'error', text: 'Password minimal 6 karakter' });
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
            if (!res.ok) throw new Error(data.error || 'Password salah');

            setPasswordMsg({ type: 'success', text: 'Password baru sudah aktif!' });
            setCurrentPassword('');
            setNewPassword('');
        } catch (err: any) {
            setPasswordMsg({ type: 'error', text: err.message });
        } finally {
            setIsChangingPassword(false);
        }
    };

    return (
        <div className="max-w-[960px] w-full flex flex-col gap-4">

            <div className="flex items-center gap-4 mb-4">
                <div className="size-16 bg-clevio-sky/20 text-clevio-sky rounded-2xl flex items-center justify-center">
                    <Settings className="size-9" />
                </div>
                <div>
                    <h1 className="text-4xl font-black text-clevio-navy mb-1">Pengaturan Profil</h1>
                    <p className="text-slate-500 font-medium text-lg">Atur data diri dan akun Clevio kamu di sini ya!</p>
                </div>
            </div>

            <div className="flex flex-col gap-4">

                {/* 1. AKUN CLEVIO KAMU */}
                <div className="group">
                    <input defaultChecked className="hidden peer" id="acc-account" name="settings-accordion" type="radio" />
                    <label className="flex items-center justify-between cursor-pointer bg-white rounded-xl p-6 shadow-sm border-2 border-slate-100 transition-all peer-checked:rounded-b-none peer-checked:border-b-0" htmlFor="acc-account">
                        <div className="flex items-center gap-3">
                            <UserCircle className="text-clevio-coral size-8" />
                            <h2 className="text-2xl font-bold text-clevio-navy">Akun Clevio Kamu</h2>
                        </div>
                        <ChevronDown className="text-slate-400 transition-transform duration-300 peer-checked:rotate-180" size={24} />
                    </label>

                    <div className="grid grid-rows-[0fr] opacity-0 peer-checked:grid-rows-[1fr] peer-checked:opacity-100 transition-all duration-300 ease-in-out bg-white rounded-b-xl shadow-sm border-x-2 border-slate-100 peer-checked:border-b-2 overflow-hidden">
                        <div className="min-h-0 px-8">
                            <form onSubmit={handleUpdateName} className="flex flex-col md:flex-row gap-10 items-start pb-8 pt-6 border-t-2 border-slate-50">

                                <div className="flex flex-col items-center gap-4 w-full md:w-auto">
                                    <div className="relative cursor-pointer group/avatar" onClick={() => fileInputRef.current?.click()}>
                                        <div className="size-32 rounded-full border-8 border-slate-50 shadow-md overflow-hidden relative">
                                            {formData.avatarPath ? (
                                                <img src={formData.avatarPath} alt="Avatar" className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center bg-clevio-sky text-white text-5xl font-black">
                                                    {formData.fullName.charAt(0)}
                                                </div>
                                            )}
                                            <div className="absolute inset-0 bg-clevio-navy/50 opacity-0 group-hover/avatar:opacity-100 transition-opacity flex items-center justify-center text-white">
                                                <Camera size={32} />
                                            </div>
                                        </div>
                                    </div>

                                    <input type="file" ref={fileInputRef} hidden accept="image/*" onChange={handleFileChange} />
                                    <button type="button" onClick={() => fileInputRef.current?.click()} className="mt-2 text-clevio-coral font-bold bg-clevio-coral/10 hover:bg-clevio-coral/20 px-4 py-2 rounded-full transition-colors text-sm">
                                        {isUploading ? 'Mengupload...' : 'Ganti Foto Profil'}
                                    </button>
                                </div>

                                <div className="flex-1 w-full grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <label className="flex flex-col gap-2">
                                        <span className="font-bold text-slate-700">Username (Disabled)</span>
                                        <input className="bg-slate-100 border-2 border-transparent text-slate-500 rounded-xl px-4 py-3 font-medium cursor-not-allowed" disabled value={formData.username} />
                                    </label>
                                    <label className="flex flex-col gap-2">
                                        <span className="font-bold text-clevio-navy">Nama Panggilan</span>
                                        <input
                                            className="bg-slate-50 border-2 border-slate-200 focus:border-clevio-sky focus:ring-0 text-clevio-navy rounded-xl px-4 py-3 font-medium transition-colors outline-none"
                                            value={formData.fullName}
                                            onChange={e => handleChange('fullName', e.target.value)}
                                            required
                                        />
                                    </label>

                                    {accountMsg && (
                                        <div className={`md:col-span-2 p-3 text-sm font-bold rounded-xl ${accountMsg.type === 'success' ? 'bg-clevio-green/10 text-clevio-green' : 'bg-clevio-coral/10 text-clevio-coral'}`}>
                                            {accountMsg.text}
                                        </div>
                                    )}

                                    <div className="md:col-span-2 flex justify-end mt-2">
                                        <button disabled={isUpdatingAccount} className="bg-[#ff6b6b] text-white font-bold rounded-xl px-8 py-3 shadow-[0_4px_0_0_#D94833] hover:translate-y-[2px] hover:shadow-[0_2px_0_0_#D94833] active:translate-y-1 active:shadow-none transition-all disabled:opacity-50">
                                            {isUpdatingAccount ? 'Menyimpan...' : 'Simpan Nama'}
                                        </button>
                                    </div>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>

                {/* 2. DATA PRIBADI & ORANG TUA */}
                <div className="group">
                    <input className="hidden peer" id="acc-personal" name="settings-accordion" type="radio" />
                    <label className="flex items-center justify-between cursor-pointer bg-white rounded-xl p-6 shadow-sm border-2 border-slate-100 transition-all peer-checked:rounded-b-none peer-checked:border-b-0" htmlFor="acc-personal">
                        <div className="flex items-center gap-3">
                            <Users className="text-clevio-green size-8" />
                            <h2 className="text-2xl font-bold text-clevio-navy">Data Pribadi & Orang Tua</h2>
                        </div>
                        <ChevronDown className="text-slate-400 transition-transform duration-300 peer-checked:rotate-180" size={24} />
                    </label>

                    <div className="grid grid-rows-[0fr] opacity-0 peer-checked:grid-rows-[1fr] peer-checked:opacity-100 transition-all duration-300 ease-in-out bg-white rounded-b-xl shadow-sm border-x-2 border-slate-100 peer-checked:border-b-2 overflow-hidden">
                        <div className="min-h-0 px-8">
                            <form onSubmit={handleUpdatePersonal} className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-8 pb-8 pt-6 border-t-2 border-slate-50">

                                <div className="flex flex-col gap-5">
                                    <h3 className="text-lg font-bold text-slate-400 border-b-2 border-slate-100 pb-2 mb-2">Data Pribadi</h3>
                                    <label className="flex flex-col gap-2">
                                        <span className="font-bold text-clevio-navy">Tanggal Lahir</span>
                                        <input type="date" className="bg-slate-50 border-2 border-slate-200 focus:border-clevio-sky focus:ring-0 text-clevio-navy rounded-xl px-4 py-3 font-medium outline-none"
                                            value={formData.birthDate || ''} onChange={e => handleChange('birthDate', e.target.value)} />
                                    </label>
                                    <label className="flex flex-col gap-2">
                                        <span className="font-bold text-clevio-navy">Jenis Kelamin</span>
                                        <select className="bg-slate-50 border-2 border-slate-200 focus:border-clevio-sky focus:ring-0 text-clevio-navy rounded-xl px-4 py-3 font-medium outline-none"
                                            value={formData.gender || ''} onChange={e => handleChange('gender', e.target.value as any)}>
                                            <option value="">Pilih</option>
                                            <option value="MALE">Laki-laki</option>
                                            <option value="FEMALE">Perempuan</option>
                                        </select>
                                    </label>
                                    <label className="flex flex-col gap-2">
                                        <span className="font-bold text-clevio-navy">Nama Sekolah</span>
                                        <input type="text" className="bg-slate-50 border-2 border-slate-200 focus:border-clevio-sky focus:ring-0 text-clevio-navy rounded-xl px-4 py-3 font-medium outline-none"
                                            value={formData.schoolName || ''} onChange={e => handleChange('schoolName', e.target.value)} />
                                    </label>
                                    <label className="flex flex-col gap-2">
                                        <span className="font-bold text-clevio-navy">Kelas</span>
                                        <input type="text" className="bg-slate-50 border-2 border-slate-200 focus:border-clevio-sky focus:ring-0 text-clevio-navy rounded-xl px-4 py-3 font-medium outline-none"
                                            value={formData.schoolGrade || ''} onChange={e => handleChange('schoolGrade', e.target.value)} />
                                    </label>
                                </div>

                                <div className="flex flex-col gap-5">
                                    <h3 className="text-lg font-bold text-slate-400 border-b-2 border-slate-100 pb-2 mb-2">Data Orang Tua</h3>
                                    <label className="flex flex-col gap-2">
                                        <span className="font-bold text-clevio-navy">Nama Orang Tua</span>
                                        <input type="text" className="bg-slate-50 border-2 border-slate-200 focus:border-clevio-sky focus:ring-0 text-clevio-navy rounded-xl px-4 py-3 font-medium outline-none"
                                            value={formData.parentName || ''} onChange={e => handleChange('parentName', e.target.value)} />
                                    </label>
                                    <label className="flex flex-col gap-2">
                                        <span className="font-bold text-clevio-navy">No. HP Orang Tua</span>
                                        <input type="tel" className="bg-slate-50 border-2 border-slate-200 focus:border-clevio-sky focus:ring-0 text-clevio-navy rounded-xl px-4 py-3 font-medium outline-none"
                                            value={formData.parentContactPhone || ''} onChange={e => handleChange('parentContactPhone', e.target.value)} />
                                    </label>
                                    <label className="flex flex-col gap-2">
                                        <span className="font-bold text-clevio-navy">Email Orang Tua</span>
                                        <input type="email" className="bg-slate-50 border-2 border-slate-200 focus:border-clevio-sky focus:ring-0 text-clevio-navy rounded-xl px-4 py-3 font-medium outline-none"
                                            value={formData.parentEmail || ''} onChange={e => handleChange('parentEmail', e.target.value)} />
                                    </label>
                                    <label className="flex flex-col gap-2">
                                        <span className="font-bold text-clevio-navy">Alamat Lengkap</span>
                                        <textarea className="bg-slate-50 border-2 border-slate-200 focus:border-clevio-sky focus:ring-0 text-clevio-navy rounded-xl px-4 py-3 font-medium resize-none h-24 outline-none"
                                            value={formData.address || ''} onChange={e => handleChange('address', e.target.value)} />
                                    </label>
                                </div>

                                {personalMsg && (
                                    <div className={`md:col-span-2 p-3 text-sm font-bold rounded-xl ${personalMsg.type === 'success' ? 'bg-clevio-green/10 text-clevio-green' : 'bg-clevio-coral/10 text-clevio-coral'}`}>
                                        {personalMsg.text}
                                    </div>
                                )}

                                <div className="md:col-span-2 flex justify-end mt-4 border-t-2 border-slate-100 pt-6">
                                    <button disabled={isUpdatingPersonal} className="bg-[#4ade80] text-white font-bold rounded-xl px-8 py-3 shadow-[0_4px_0_0_#5A9832] hover:translate-y-[2px] hover:shadow-[0_2px_0_0_#5A9832] active:translate-y-1 active:shadow-none transition-all text-lg flex items-center gap-2 disabled:opacity-50">
                                        <Save size={20} />
                                        {isUpdatingPersonal ? 'Menyimpan...' : 'Simpan Data Profil'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>

                {/* 3. KEAMANAN PASSWORD */}
                <div className="group">
                    <input className="hidden peer" id="acc-password" name="settings-accordion" type="radio" />
                    <label className="flex items-center justify-between cursor-pointer bg-white rounded-xl p-6 shadow-sm border-2 border-slate-100 transition-all peer-checked:rounded-b-none peer-checked:border-b-0" htmlFor="acc-password">
                        <div className="flex items-center gap-3">
                            <Lock className="text-clevio-amber size-8" />
                            <h2 className="text-2xl font-bold text-clevio-navy">Keamanan Password</h2>
                        </div>
                        <ChevronDown className="text-slate-400 transition-transform duration-300 peer-checked:rotate-180" size={24} />
                    </label>

                    <div className="grid grid-rows-[0fr] opacity-0 peer-checked:grid-rows-[1fr] peer-checked:opacity-100 transition-all duration-300 ease-in-out bg-white rounded-b-xl shadow-sm border-x-2 border-slate-100 peer-checked:border-b-2 overflow-hidden">
                        <div className="min-h-0 px-8">
                            <form onSubmit={handleChangePassword} className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end pb-8 pt-6 border-t-2 border-slate-50">
                                <label className="flex flex-col gap-2">
                                    <span className="font-bold text-clevio-navy">Password Saat Ini</span>
                                    <input className="bg-slate-50 border-2 border-slate-200 focus:border-clevio-amber focus:ring-0 text-clevio-navy rounded-xl px-4 py-3 font-medium outline-none"
                                        placeholder="••••••••" type="password" required value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} />
                                </label>
                                <label className="flex flex-col gap-2">
                                    <span className="font-bold text-clevio-navy">Password Baru</span>
                                    <input className="bg-slate-50 border-2 border-slate-200 focus:border-clevio-amber focus:ring-0 text-clevio-navy rounded-xl px-4 py-3 font-medium outline-none"
                                        placeholder="Ketik sandi baru" type="password" required value={newPassword} onChange={e => setNewPassword(e.target.value)} />
                                </label>

                                <button disabled={isChangingPassword} className="bg-[#f59e0b] text-white font-bold rounded-xl px-8 py-3 shadow-[0_4px_0_0_#D97706] hover:translate-y-[2px] hover:shadow-[0_2px_0_0_#D97706] active:translate-y-1 active:shadow-none transition-all h-[52px] disabled:opacity-50">
                                    {isChangingPassword ? 'Diproses...' : 'Ubah Password'}
                                </button>

                                {passwordMsg && (
                                    <div className={`md:col-span-3 p-3 text-sm font-bold rounded-xl ${passwordMsg.type === 'success' ? 'bg-clevio-green/10 text-clevio-green' : 'bg-clevio-coral/10 text-clevio-coral'}`}>
                                        {passwordMsg.text}
                                    </div>
                                )}
                            </form>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}
