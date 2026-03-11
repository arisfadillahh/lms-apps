'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';

type Session = {
    id: string;
    date_time: string;
    class_name?: string | null;
    block_name?: string | null;
    lesson_title?: string | null;
};

type Props = {
    availableSessions: Session[];
};

export default function CreateLeaveRequestDialog({ availableSessions }: Props) {
    const [open, setOpen] = useState(false);
    const [selectedSessionId, setSelectedSessionId] = useState('');
    const [note, setNote] = useState('');
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();

    const selectedSession = availableSessions.find((s) => s.id === selectedSessionId);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedSessionId) {
            setError('Silakan pilih jadwal terlebih dahulu.');
            return;
        }
        if (!note.trim()) {
            setError('Silakan isi alasan ketidakhadiran.');
            return;
        }
        setError(null);

        startTransition(async () => {
            try {
                const res = await fetch('/api/coach/leave', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ sessionId: selectedSessionId, note }),
                });

                if (!res.ok) {
                    const payload = await res.json().catch(() => ({}));
                    setError(payload.error ?? 'Gagal mengirim pengajuan');
                    return;
                }

                setOpen(false);
                setSelectedSessionId('');
                setNote('');
                router.refresh();
            } catch {
                setError('Terjadi kesalahan sistem');
            }
        });
    };

    return (
        <>
            {/* Trigger Button */}
            <button
                onClick={() => setOpen(true)}
                className="flex h-10 items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-6 text-white text-sm font-bold transition-all shadow-lg shadow-emerald-500/20 active:scale-95"
            >
                <span className="material-symbols-outlined text-xl">add_circle</span>
                <span>Ajukan Izin</span>
            </button>

            {/* Backdrop + Modal */}
            {open && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
                    <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden border border-slate-200">
                        {/* Modal Header */}
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                            <h3 className="text-xl font-bold text-slate-900">Ajukan Izin Ketidakhadiran</h3>
                            <button
                                onClick={() => setOpen(false)}
                                className="text-slate-400 hover:text-slate-600 transition-colors"
                            >
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>

                        {/* Modal Body */}
                        <form onSubmit={handleSubmit}>
                            <div className="p-6 space-y-6">

                                {/* Session Dropdown */}
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-slate-700">Pilih Sesi Mengajar</label>
                                    <div className="relative">
                                        <select
                                            value={selectedSessionId}
                                            onChange={(e) => setSelectedSessionId(e.target.value)}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 appearance-none text-slate-700 pr-10"
                                        >
                                            <option value="">Pilih sesi yang akan ditinggalkan</option>
                                            {availableSessions.length === 0 ? (
                                                <option disabled>Tidak ada jadwal tersedia</option>
                                            ) : (
                                                availableSessions.map((session) => (
                                                    <option key={session.id} value={session.id}>
                                                        {session.class_name ?? 'Kelas'} — {format(new Date(session.date_time), 'EEE, d MMM HH:mm', { locale: id })}
                                                    </option>
                                                ))
                                            )}
                                        </select>
                                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                            <span className="material-symbols-outlined">expand_more</span>
                                        </div>
                                    </div>

                                    {/* Session Preview Info Box */}
                                    <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100 flex items-start gap-3 mt-2">
                                        <span className="material-symbols-outlined text-emerald-600 text-xl mt-0.5">info</span>
                                        {selectedSession ? (
                                            <div className="space-y-1.5 min-w-0">
                                                <p className="text-xs font-bold text-slate-800">
                                                    {selectedSession.class_name ?? 'Kelas'}
                                                </p>
                                                <p className="text-[11px] text-slate-500">
                                                    {format(new Date(selectedSession.date_time), 'EEEE, d MMMM yyyy · HH:mm', { locale: id })} WIB
                                                </p>
                                                {selectedSession.block_name && (
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="material-symbols-outlined text-slate-400 text-sm">layers</span>
                                                        <span className="text-[11px] text-slate-500">Block: <span className="font-semibold text-slate-700">{selectedSession.block_name}</span></span>
                                                    </div>
                                                )}
                                                {selectedSession.lesson_title && (
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="material-symbols-outlined text-slate-400 text-sm">menu_book</span>
                                                        <span className="text-[11px] text-slate-500">Materi: <span className="font-semibold text-slate-700">{selectedSession.lesson_title}</span></span>
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <div>
                                                <p className="text-xs font-medium text-slate-800">Preview Sesi Terpilih</p>
                                                <p className="text-[11px] text-slate-500">Pastikan memilih sesi minimal 2×24 jam sebelum jadwal dimulai kecuali untuk alasan darurat.</p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Note Textarea */}
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-slate-700">Alasan Ketidakhadiran</label>
                                    <textarea
                                        value={note}
                                        onChange={(e) => setNote(e.target.value)}
                                        rows={4}
                                        placeholder="Jelaskan alasan Anda dengan detail (Misal: Sakit, Urusan Keluarga Urgent, dll)"
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 placeholder-slate-400 resize-none"
                                        required
                                    />
                                </div>

                                {/* Error */}
                                {error && (
                                    <div className="flex items-start gap-2 bg-red-50 border border-red-100 text-red-700 text-sm p-3 rounded-xl">
                                        <span className="material-symbols-outlined text-red-500 text-lg mt-0.5">error</span>
                                        {error}
                                    </div>
                                )}

                                {/* Action Buttons */}
                                <div className="space-y-3 pt-1">
                                    <button
                                        type="submit"
                                        disabled={isPending}
                                        className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl shadow-lg shadow-emerald-500/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                                    >
                                        {isPending && (
                                            <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                            </svg>
                                        )}
                                        {isPending ? 'Mengirim...' : 'Kirim Pengajuan'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setOpen(false)}
                                        className="w-full text-center text-sm font-semibold text-slate-500 hover:text-slate-700 transition-colors py-1"
                                    >
                                        Batal
                                    </button>
                                </div>
                            </div>

                            {/* Footer Note */}
                            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 text-center">
                                <p className="text-[11px] text-slate-400 leading-relaxed uppercase tracking-widest font-bold">
                                    Clevio Coach Excellence Standards
                                </p>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
}
