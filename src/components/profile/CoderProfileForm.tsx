'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { User, Calendar as CalendarIcon, MapPin, School, Users, AtSign, Phone, Link as LinkIcon, Save } from 'lucide-react';

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
        <form onSubmit={handleSubmit} className="bg-white rounded-[2.5rem] p-8 border-2 border-slate-50 shadow-sm relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-sky/5 rounded-bl-full -z-10 transition-transform group-hover:scale-110"></div>

            {/* PERSONAL DATA */}
            <h3 className="text-xl font-black text-clevio-navy mb-6 pb-4 border-b-2 border-dashed border-pastel-blue/50 flex items-center gap-2">
                <span className="p-2 bg-pastel-blue rounded-xl text-sky"><User size={20} /></span>
                Data Pribadi
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
                <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-500 flex items-center gap-2">Nama Lengkap <span className="text-coral">*</span></label>
                    <input
                        type="text"
                        value={formData.fullName}
                        onChange={(e) => handleChange('fullName', e.target.value)}
                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-3 text-clevio-navy font-bold focus:border-sky focus:bg-white focus:outline-none transition-all"
                        required
                    />
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-500 flex items-center gap-2">Tanggal Lahir</label>
                    <div className="relative">
                        <CalendarIcon size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="date"
                            value={formData.birthDate || ''}
                            onChange={(e) => handleChange('birthDate', e.target.value)}
                            className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl pl-12 pr-5 py-3 text-clevio-navy font-bold focus:border-sky focus:bg-white focus:outline-none transition-all"
                        />
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-500 flex items-center gap-2">Jenis Kelamin</label>
                    <select
                        value={formData.gender || ''}
                        onChange={(e) => handleChange('gender', e.target.value as 'MALE' | 'FEMALE' | null)}
                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-3 text-clevio-navy font-bold focus:border-sky focus:bg-white focus:outline-none transition-all appearance-none cursor-pointer"
                    >
                        <option value="">Pilih Jenis Kelamin</option>
                        <option value="MALE">Laki-laki</option>
                        <option value="FEMALE">Perempuan</option>
                    </select>
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-500 flex items-center gap-2">Nama Sekolah</label>
                    <div className="relative">
                        <School size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            value={formData.schoolName || ''}
                            onChange={(e) => handleChange('schoolName', e.target.value)}
                            placeholder="Contoh: SDN 01"
                            className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl pl-12 pr-5 py-3 text-clevio-navy font-bold focus:border-sky focus:bg-white focus:outline-none transition-all"
                        />
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-500 flex items-center gap-2">Kelas / Tingkat Sekolah</label>
                    <input
                        type="text"
                        value={formData.schoolGrade || ''}
                        onChange={(e) => handleChange('schoolGrade', e.target.value)}
                        placeholder="Contoh: 5 SD"
                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-3 text-clevio-navy font-bold focus:border-sky focus:bg-white focus:outline-none transition-all"
                    />
                </div>
            </div>


            {/* PARENT DATA */}
            <h3 className="text-xl font-black text-clevio-navy mb-6 pb-4 border-b-2 border-dashed border-pastel-pink/50 flex items-center gap-2">
                <span className="p-2 bg-pastel-pink rounded-xl text-coral"><Users size={20} /></span>
                Data Orang Tua / Wali
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
                <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-500 flex items-center gap-2">Nama Orang Tua</label>
                    <input
                        type="text"
                        value={formData.parentName || ''}
                        onChange={(e) => handleChange('parentName', e.target.value)}
                        placeholder="Nama Ayah/Ibu/Wali"
                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-3 text-clevio-navy font-bold focus:border-coral focus:bg-white focus:outline-none transition-all"
                    />
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-500 flex items-center gap-2">Nomor HP / WhatsApp</label>
                    <div className="relative">
                        <Phone size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="tel"
                            value={formData.parentContactPhone || ''}
                            onChange={(e) => handleChange('parentContactPhone', e.target.value)}
                            placeholder="08123456789"
                            className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl pl-12 pr-5 py-3 text-clevio-navy font-bold focus:border-coral focus:bg-white focus:outline-none transition-all"
                        />
                    </div>
                </div>

                <div className="space-y-2 md:col-span-2">
                    <label className="text-sm font-bold text-slate-500 flex items-center gap-2">Email Orang Tua</label>
                    <div className="relative">
                        <AtSign size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="email"
                            value={formData.parentEmail || ''}
                            onChange={(e) => handleChange('parentEmail', e.target.value)}
                            placeholder="email@contoh.com"
                            className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl pl-12 pr-5 py-3 text-clevio-navy font-bold focus:border-coral focus:bg-white focus:outline-none transition-all"
                        />
                    </div>
                </div>

                <div className="space-y-2 md:col-span-2">
                    <label className="text-sm font-bold text-slate-500 flex items-center gap-2">Alamat Lengkap</label>
                    <div className="relative">
                        <MapPin size={18} className="absolute left-4 top-4 text-slate-400" />
                        <textarea
                            value={formData.address || ''}
                            onChange={(e) => handleChange('address', e.target.value)}
                            rows={3}
                            placeholder="Alamat rumah"
                            className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl pl-12 pr-5 py-3 text-clevio-navy font-bold focus:border-coral focus:bg-white focus:outline-none transition-all resize-none"
                        />
                    </div>
                </div>

                <div className="space-y-2 md:col-span-2">
                    <label className="text-sm font-bold text-slate-500 flex items-center gap-2">Tahu Clevio dari mana?</label>
                    <div className="relative">
                        <LinkIcon size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                        <select
                            value={formData.referralSource || ''}
                            onChange={(e) => handleChange('referralSource', e.target.value)}
                            className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl pl-12 pr-5 py-3 text-clevio-navy font-bold focus:border-coral focus:bg-white focus:outline-none transition-all appearance-none cursor-pointer"
                        >
                            <option value="">-- Pilih --</option>
                            <option value="INSTAGRAM">Instagram</option>
                            <option value="FACEBOOK">Facebook</option>
                            <option value="TIKTOK">TikTok</option>
                            <option value="YOUTUBE">YouTube</option>
                            <option value="GOOGLE">Pencarian Google</option>
                            <option value="FRIEND">Teman/Keluarga</option>
                            <option value="SCHOOL">Sekolah</option>
                            <option value="OTHER">Lainnya</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* MESSAGE */}
            {message && (
                <div className={`mb-6 p-4 rounded-2xl flex items-center gap-3 font-bold text-sm border-2 ${message.type === 'success' ? 'bg-pastel-green text-clevio-green border-clevio-green/20' : 'bg-pastel-pink text-coral border-coral/20'}`}>
                    {message.text}
                </div>
            )}

            {/* SUBMIT BUTTON */}
            <div className="flex justify-end pt-4 border-t-2 border-dashed border-slate-100">
                <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex items-center gap-2 bg-clevio-green text-white px-8 py-4 rounded-2xl font-black text-sm shadow-[0_4px_0_0_#5A9832] hover:translate-y-1 hover:shadow-[0_2px_0_0_#5A9832] focus:translate-y-1 focus:shadow-[0_2px_0_0_#5A9832] active:translate-y-2 active:shadow-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <Save size={18} />
                    {isSubmitting ? 'MENYIMPAN...' : 'SIMPAN DATA PROFIL'}
                </button>
            </div>
        </form>
    );
}
