'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { AttendanceListHandle } from './AttendanceList';
import AttendanceList from './AttendanceList';
import type { AttendanceStatus } from './AttendanceList';

interface Attendee {
    coderId: string;
    fullName: string;
    attendance: {
        status: AttendanceStatus;
        reason: string | null;
    } | null;
}

interface AttendanceWrapperProps {
    sessionId: string;
    attendees: Attendee[];
    canComplete: boolean;
    slideUrl?: string | null;
    slideTitle?: string | null;
    isLastSessionOfBlock?: boolean;
    classId?: string;
    blockId?: string;
    templateId?: string | null;
    existingEvalSessionId?: string | null;
    ekskulReportUrl?: string | null;
    canOpenEkskulReport?: boolean;
    ekskulReportLockedReason?: string | null;
    ekskulReportStatus?: 'SUBMITTED' | null;
    canExtendLesson?: boolean;
    extendLessonTitle?: string | null;
    nextLessonPart?: number;
}

export default function AttendanceWrapper({
    sessionId,
    attendees,
    canComplete,
    slideUrl,
    slideTitle,
    isLastSessionOfBlock,
    classId,
    blockId,
    templateId,
    existingEvalSessionId,
    ekskulReportUrl,
    canOpenEkskulReport = false,
    ekskulReportLockedReason,
    ekskulReportStatus,
    canExtendLesson = false,
    extendLessonTitle,
    nextLessonPart = 2,
}: AttendanceWrapperProps) {
    const router = useRouter();
    const listRef = useRef<AttendanceListHandle>(null);
    const [isSlideOpen, setIsSlideOpen] = useState(false);
    const [isStartingEval, setIsStartingEval] = useState(false);
    const [isGeneratingEkskulReport, setIsGeneratingEkskulReport] = useState(false);
    const [showExtendLesson, setShowExtendLesson] = useState(false);
    const [extensionReason, setExtensionReason] = useState('');
    const [isExtendingLesson, setIsExtendingLesson] = useState(false);
    const [extensionError, setExtensionError] = useState<string | null>(null);

    const [isSaving, setIsSaving] = useState(false);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await listRef.current?.save();
            
            // Auto complete session if it is not completed yet
            if (canComplete) {
                const response = await fetch(`/api/coach/sessions/${sessionId}/status`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ status: 'COMPLETED' })
                });
                if (!response.ok) {
                    const payload = await response.json().catch(() => ({}));
                    throw new Error(payload.error ?? 'Gagal menyelesaikan sesi.');
                }
                router.refresh();
            }
        } catch (err) {
            alert(err instanceof Error ? err.message : 'Gagal menyimpan presensi.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleOpenEvaluation = async () => {
        if (existingEvalSessionId) {
            router.push(`/coach/evaluation-present/${existingEvalSessionId}`);
            return;
        }
        setIsStartingEval(true);
        try {
            const res = await fetch('/api/coach/block-evaluations/start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId, classId, blockId, templateId }),
            });
            if (!res.ok) throw new Error('Gagal memulai evaluasi');
            const { evalSessionId } = await res.json();
            router.push(`/coach/evaluation-present/${evalSessionId}`);
        } catch (err: unknown) {
            alert(err instanceof Error ? err.message : 'Terjadi kesalahan');
        } finally {
            setIsStartingEval(false);
        }
    };

    const handleGenerateEkskulReport = async () => {
        if (!ekskulReportUrl) return;
        if (ekskulReportStatus === 'SUBMITTED') return;
        if (!canOpenEkskulReport) {
            alert(ekskulReportLockedReason ?? 'Lengkapi presensi sesi ini dulu sebelum generate rapor ekskul.');
            return;
        }

        setIsGeneratingEkskulReport(true);
        try {
            const response = await fetch('/api/coach/reports/generate-ekskul', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId }),
            });
            if (!response.ok) {
                const payload = await response.json().catch(() => ({}));
                throw new Error(payload.error ?? 'Gagal generate rapor ekskul.');
            }
            router.push(ekskulReportUrl);
            router.refresh();
        } catch (err) {
            alert(err instanceof Error ? err.message : 'Gagal generate rapor ekskul.');
        } finally {
            setIsGeneratingEkskulReport(false);
        }
    };

    const ekskulReportSubmitted = ekskulReportStatus === 'SUBMITTED';

    const handleExtendLesson = async () => {
        const reason = extensionReason.trim();
        if (reason.length < 10) {
            setExtensionError('Jelaskan alasan perpanjangan minimal 10 karakter.');
            return;
        }

        setIsExtendingLesson(true);
        setExtensionError(null);
        try {
            const response = await fetch('/api/coach/lessons/extend', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId, reason }),
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(payload.error ?? 'Gagal memperpanjang lesson.');
            }

            setShowExtendLesson(false);
            setExtensionReason('');
            router.refresh();
            alert(`Lesson berhasil ditambah menjadi Part ${payload.newPartNumber}. Materi berikutnya otomatis bergeser.`);
        } catch (error) {
            setExtensionError(error instanceof Error ? error.message : 'Gagal memperpanjang lesson.');
        } finally {
            setIsExtendingLesson(false);
        }
    };

    return (
        <>
            <AttendanceList ref={listRef} sessionId={sessionId} attendees={attendees} />

            {/* Slide Modal */}
            {isSlideOpen && slideUrl && (
                <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 z-[1000]" role="dialog" aria-modal="true">
                    <div className="bg-white rounded-2xl w-full max-w-5xl h-[85vh] shadow-xl flex flex-col overflow-hidden border border-slate-200">
                        <header className="flex justify-between items-center p-4 border-b border-slate-100">
                            <div>
                                <h3 className="text-lg font-bold text-slate-900">Slide Pembelajaran</h3>
                                {slideTitle && <p className="text-sm text-slate-500 truncate max-w-xl">{slideTitle}</p>}
                            </div>
                            <div className="flex items-center gap-3">
                                <a href={slideUrl} target="_blank" rel="noreferrer" className="hidden sm:flex items-center gap-2 text-blue-600 text-sm font-semibold bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-200 hover:bg-blue-100 transition-colors">
                                    <span className="material-symbols-outlined text-base">open_in_new</span>
                                    Buka Tab
                                </a>
                                <button type="button" onClick={() => setIsSlideOpen(false)} className="px-4 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600 font-semibold text-sm transition-colors">
                                    Tutup
                                </button>
                            </div>
                        </header>
                        <div className="flex-1 bg-black">
                            <iframe title={slideTitle ?? 'Slide pembelajaran'} src={slideUrl.replace('/pub?', '/embed?')} className="w-full h-full border-none" allowFullScreen />
                        </div>
                    </div>
                </div>
            )}

            {showExtendLesson && (
                <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="extend-lesson-title" aria-describedby="extend-lesson-description">
                    <div className="flex max-h-[calc(100dvh-2rem)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
                        <div className="flex items-start justify-between border-b border-slate-100 px-5 py-4 sm:px-6">
                            <div className="pr-4">
                                <p className="mb-1 text-xs font-bold uppercase text-blue-600">Khusus kelas ini</p>
                                <h2 id="extend-lesson-title" className="text-xl font-bold text-slate-900">Perpanjang Lesson</h2>
                            </div>
                            <button type="button" onClick={() => setShowExtendLesson(false)} disabled={isExtendingLesson} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-slate-500 hover:bg-slate-100" aria-label="Tutup">
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>

                        <div className="overflow-y-auto px-5 py-5 sm:px-6">
                            <div className="mb-5 rounded-xl border border-blue-100 bg-blue-50 p-4">
                                <p className="font-bold text-slate-900">{extendLessonTitle ?? 'Lesson saat ini'}</p>
                                <p id="extend-lesson-description" className="mt-1 text-sm leading-6 text-slate-600">
                                    Sistem akan membuat Part {nextLessonPart} di pertemuan aktif berikutnya. Semua lesson setelahnya di kelas ini bergeser satu pertemuan, tanpa mengubah kelas lain atau lesson global.
                                </p>
                            </div>

                            <label htmlFor="extension-reason" className="mb-2 block text-sm font-bold text-slate-800">Alasan perpanjangan</label>
                            <textarea
                                id="extension-reason"
                                value={extensionReason}
                                onChange={(event) => {
                                    setExtensionReason(event.target.value);
                                    setExtensionError(null);
                                }}
                                maxLength={500}
                                rows={4}
                                placeholder="Contoh: Coder membutuhkan satu sesi tambahan untuk menyelesaikan project dan review hasil."
                                className="w-full resize-none rounded-xl border border-slate-300 px-4 py-3 text-sm leading-6 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                                autoFocus
                            />
                            <div className="mt-1 flex items-start justify-between gap-4">
                                <p className={`text-xs ${extensionError ? 'font-semibold text-red-600' : 'text-slate-500'}`} role={extensionError ? 'alert' : undefined}>
                                    {extensionError ?? 'Alasan ini akan tercatat dan dikirim sebagai notifikasi ke admin.'}
                                </p>
                                <span className="shrink-0 text-xs text-slate-400">{extensionReason.length}/500</span>
                            </div>
                        </div>

                        <div className="flex flex-col-reverse gap-2 border-t border-slate-100 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
                            <button type="button" onClick={() => setShowExtendLesson(false)} disabled={isExtendingLesson} className="rounded-xl border border-slate-300 px-5 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50">Batal</button>
                            <button type="button" onClick={handleExtendLesson} disabled={isExtendingLesson || extensionReason.trim().length < 10} className="flex items-center justify-center gap-2 rounded-xl bg-[#22367b] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#162b46] disabled:cursor-not-allowed disabled:opacity-50">
                                <span className="material-symbols-outlined text-lg">add_circle</span>
                                {isExtendingLesson ? 'Memproses...' : `Tambah Part ${nextLessonPart}`}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="h-24 md:hidden" aria-hidden="true" />

            {/* Fixed Bottom Action Strip */}
            <div className="coach-attendance-action-strip fixed bottom-0 left-0 md:left-[260px] right-0 bg-white border-t border-slate-200 px-3 sm:px-6 py-3 flex items-center justify-between z-30 shadow-[0_-2px_12px_rgba(0,0,0,0.06)]">
                <div className="flex items-center gap-2 min-w-0">
                    <span className="material-symbols-outlined text-slate-400 text-base shrink-0">info</span>
                    <p className="text-xs text-slate-500 font-medium whitespace-nowrap hidden sm:block">Auto-save aktif.</p>
                </div>
                <div className="flex max-w-full items-center gap-2 overflow-x-auto sm:gap-3 shrink-0">
                    {canExtendLesson && (
                        <button
                            type="button"
                            onClick={() => setShowExtendLesson(true)}
                            className="flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-bold text-blue-700 transition-colors hover:bg-blue-100 whitespace-nowrap"
                        >
                            <span className="material-symbols-outlined text-lg">more_time</span>
                            Perpanjang Lesson
                        </button>
                    )}
                    {isLastSessionOfBlock && (
                        <button
                            type="button"
                            onClick={handleOpenEvaluation}
                            disabled={isStartingEval}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold bg-[#22367b] hover:bg-[#162b46] text-white whitespace-nowrap transition-colors disabled:opacity-60"
                        >
                            <span className="material-symbols-outlined text-base">quiz</span>
                            {existingEvalSessionId ? 'Lanjut Evaluasi' : isStartingEval ? 'Memulai...' : 'Buka Evaluasi'}
                        </button>
                    )}

                    {ekskulReportUrl && (
                        <button
                            type="button"
                            onClick={handleGenerateEkskulReport}
                            disabled={isGeneratingEkskulReport || ekskulReportSubmitted}
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold whitespace-nowrap transition-colors ${
                                ekskulReportSubmitted
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 cursor-default'
                                    : canOpenEkskulReport
                                    ? 'bg-[#22367b] hover:bg-[#162b46] text-white'
                                    : 'bg-slate-100 text-slate-500 border border-slate-200'
                            }`}
                            title={ekskulReportSubmitted ? 'Rapor sudah dikirim ke admin.' : ekskulReportLockedReason ?? undefined}
                        >
                            <span className="material-symbols-outlined text-base">
                                {ekskulReportSubmitted ? 'check_circle' : isGeneratingEkskulReport ? 'progress_activity' : canOpenEkskulReport ? 'summarize' : 'lock'}
                            </span>
                            {ekskulReportSubmitted ? 'Sudah Submit' : isGeneratingEkskulReport ? 'Generating...' : canOpenEkskulReport ? 'Generate Rapor Ekskul' : 'Lengkapi Presensi'}
                        </button>
                    )}

                    {slideUrl && (
                        <button type="button" onClick={() => setIsSlideOpen(true)} className="hidden sm:flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 whitespace-nowrap transition-colors">
                            <span className="material-symbols-outlined text-base">menu_book</span>
                            Lihat Slide
                        </button>
                    )}
                    <button type="button" onClick={handleSave} disabled={isSaving} className="bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-2.5 rounded-xl font-bold text-sm transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 disabled:opacity-60">
                        {isSaving ? 'Menyimpan...' : 'Simpan Presensi'}
                        {!isSaving && <span className="material-symbols-outlined text-lg">check_circle</span>}
                    </button>
                </div>
            </div>
        </>
    );
}
