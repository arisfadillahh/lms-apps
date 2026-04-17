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
    zoomLink: string;
    canComplete: boolean;
    slideUrl?: string | null;
    slideTitle?: string | null;
    isLastSessionOfBlock?: boolean;
    classId?: string;
    blockId?: string;
    templateId?: string | null;
    existingEvalSessionId?: string | null;
}

export default function AttendanceWrapper({
    sessionId,
    attendees,
    zoomLink,
    canComplete,
    slideUrl,
    slideTitle,
    isLastSessionOfBlock,
    classId,
    blockId,
    templateId,
    existingEvalSessionId,
}: AttendanceWrapperProps) {
    const router = useRouter();
    const listRef = useRef<AttendanceListHandle>(null);
    const [isSlideOpen, setIsSlideOpen] = useState(false);
    const [isStartingEval, setIsStartingEval] = useState(false);

    const [isSaving, setIsSaving] = useState(false);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await listRef.current?.save();
            
            // Auto complete session if it is not completed yet
            if (canComplete) {
                await fetch(`/api/coach/sessions/${sessionId}/status`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ status: 'COMPLETED' })
                });
                router.refresh();
            }
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
        } catch (err: any) {
            alert(err.message ?? 'Terjadi kesalahan');
        } finally {
            setIsStartingEval(false);
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

            {/* Fixed Bottom Action Strip */}
            <div className="fixed bottom-0 left-0 md:left-[260px] right-0 bg-white border-t border-slate-200 px-6 py-3 flex items-center justify-between z-30 shadow-[0_-2px_12px_rgba(0,0,0,0.06)]">
                <div className="flex items-center gap-2 min-w-0">
                    <span className="material-symbols-outlined text-slate-400 text-base shrink-0">info</span>
                    <p className="text-xs text-slate-500 font-medium whitespace-nowrap hidden sm:block">Auto-save aktif.</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
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
