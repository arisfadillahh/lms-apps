'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

type ReportLessonButtonProps = {
    lessonId: string;
    lessonTitle: string;
    coachId: string;
};

const REPORT_TYPES = [
    { value: 'TOO_DIFFICULT', label: 'Terlalu Sulit' },
    { value: 'UNCLEAR', label: 'Materi Kurang Jelas' },
    { value: 'BUG', label: 'Ada Bug/Error' },
    { value: 'OUTDATED', label: 'Materi Sudah Tidak Relevan' },
    { value: 'OTHER', label: 'Lainnya' },
];

export default function ReportLessonButton({ lessonId, lessonTitle, coachId }: ReportLessonButtonProps) {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [isPending, startTransition] = useTransition();
    const [reportType, setReportType] = useState('');
    const [description, setDescription] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const handleClose = () => {
        setOpen(false);
        setReportType('');
        setDescription('');
        setError(null);
        setSuccess(false);
    };

    const handleSubmit = () => {
        if (!reportType) { setError('Pilih jenis masalah'); return; }
        if (!description.trim()) { setError('Deskripsi wajib diisi'); return; }
        setError(null);

        startTransition(async () => {
            try {
                const res = await fetch('/api/coach/lesson-reports', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ lessonTemplateId: lessonId, reportType, description: description.trim() }),
                });
                if (!res.ok) {
                    const data = await res.json().catch(() => ({}));
                    setError(data.error || 'Gagal mengirim laporan');
                    return;
                }
                setSuccess(true);
                setTimeout(() => { handleClose(); router.refresh(); }, 2000);
            } catch {
                setError('Terjadi kesalahan');
            }
        });
    };

    return (
        <>
            {/* Trigger — matches hero button style */}
            <button
                onClick={() => setOpen(true)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-rose-400/40 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 font-semibold transition-all text-sm"
            >
                <span className="material-symbols-outlined text-xl">flag</span>
                Laporkan Masalah
            </button>

            {/* Modal */}
            {open && (
                <div
                    className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm"
                    onClick={handleClose}
                >
                    <div
                        className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden border border-slate-200"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Modal Header */}
                        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                            <div>
                                <h3 className="text-lg font-bold text-slate-900">Laporkan Masalah</h3>
                                <p className="text-xs text-slate-500 mt-0.5 truncate max-w-xs">{lessonTitle}</p>
                            </div>
                            <button
                                onClick={handleClose}
                                className="text-slate-400 hover:text-slate-600 transition-colors"
                            >
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-6 space-y-5">
                            {success ? (
                                <div className="flex flex-col items-center justify-center py-6 text-center gap-3">
                                    <span className="material-symbols-outlined text-5xl text-emerald-500">check_circle</span>
                                    <p className="font-bold text-slate-800">Laporan Terkirim!</p>
                                    <p className="text-sm text-slate-500">Admin akan segera meninjau laporan Anda.</p>
                                </div>
                            ) : (
                                <>
                                    {/* Jenis Masalah */}
                                    <div className="space-y-2">
                                        <label className="text-sm font-semibold text-slate-700">Jenis Masalah</label>
                                        <div className="relative">
                                            <select
                                                value={reportType}
                                                onChange={(e) => setReportType(e.target.value)}
                                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-slate-400 focus:border-slate-400 appearance-none text-slate-700 pr-10"
                                            >
                                                <option value="">Pilih jenis masalah...</option>
                                                {REPORT_TYPES.map((t) => (
                                                    <option key={t.value} value={t.value}>{t.label}</option>
                                                ))}
                                            </select>
                                            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                                <span className="material-symbols-outlined">expand_more</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Deskripsi */}
                                    <div className="space-y-2">
                                        <label className="text-sm font-semibold text-slate-700">Deskripsi Masalah</label>
                                        <textarea
                                            value={description}
                                            onChange={(e) => setDescription(e.target.value)}
                                            placeholder="Jelaskan masalah yang Anda temukan secara detail..."
                                            rows={4}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-slate-400 placeholder-slate-400 resize-none"
                                        />
                                    </div>

                                    {/* Error */}
                                    {error && (
                                        <div className="flex items-center gap-2 bg-red-50 border border-red-100 text-red-700 text-sm p-3 rounded-xl">
                                            <span className="material-symbols-outlined text-red-500 text-lg">error</span>
                                            {error}
                                        </div>
                                    )}

                                    {/* Actions */}
                                    <div className="flex gap-3 pt-1">
                                        <button
                                            onClick={handleClose}
                                            disabled={isPending}
                                            className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-semibold text-sm hover:bg-slate-50 transition-colors"
                                        >
                                            Batal
                                        </button>
                                        <button
                                            onClick={handleSubmit}
                                            disabled={isPending}
                                            className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white font-bold text-sm transition-colors flex items-center justify-center gap-2"
                                        >
                                            {isPending ? (
                                                <>
                                                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                                    </svg>
                                                    Mengirim...
                                                </>
                                            ) : 'Kirim Laporan'}
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 text-center">
                            <p className="text-[11px] text-slate-400 uppercase tracking-widest font-bold">Clevio Coach Quality Control</p>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
