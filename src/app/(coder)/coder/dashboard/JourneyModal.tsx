'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import JourneyMap, { JourneyCourse } from './JourneyMap';
import { motion, AnimatePresence } from 'framer-motion';
import { Map, X, Sparkles } from 'lucide-react';

// Simple CSS cloud component
function Cloud({ className = '' }: { className?: string }) {
    return (
        <div className={`pointer-events-none ${className}`}>
            <div className="relative">
                <div className="w-20 h-7 bg-white rounded-full" />
                <div className="w-12 h-10 bg-white rounded-full absolute -top-5 left-3" />
                <div className="w-10 h-8 bg-white rounded-full absolute -top-4 left-9" />
            </div>
        </div>
    );
}

export default function JourneyModal({ courses }: { courses: JourneyCourse[] }) {
    const [isOpen, setIsOpen] = useState(false);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (courses.length === 0) return null;

    const modalContent = (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 p-0 backdrop-blur-sm md:p-8"
                        onClick={() => setIsOpen(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.95, opacity: 0, y: 20 }}
                            transition={{ duration: 0.25, type: 'spring', damping: 25, stiffness: 280 }}
                            className="journey-modal-panel relative flex h-[100dvh] w-full max-w-5xl flex-col overflow-hidden border-0 border-white/40 shadow-[0_35px_80px_-15px_rgba(0,0,0,0.4)] md:h-auto md:max-h-[88vh] md:rounded-[2.5rem] md:border-[6px]"
                            data-coder-modal="true"
                            onClick={e => e.stopPropagation()}
                        >
                            {/* ── Cloud decorations (fixed, scattered) ─────── */}
                            <div className="pointer-events-none absolute inset-0 overflow-hidden md:rounded-[2.5rem]">
                                <Cloud className="absolute top-8 left-10 opacity-50" />
                                <Cloud className="absolute top-28 right-16 opacity-35 scale-125" />
                                <Cloud className="absolute bottom-12 left-1/4 opacity-40 scale-90" />
                                <Cloud className="absolute bottom-36 right-1/4 opacity-25 scale-110" />
                            </div>

                            {/* ── Header ──────────────────────────────────────── */}
                            <div className="relative z-20 flex items-center justify-between px-4 py-4 md:px-10 md:py-6">
                                <div className="flex min-w-0 items-center gap-3">
                                    <div className="flex size-10 shrink-0 -rotate-6 items-center justify-center rounded-xl border-2 border-sky/20 bg-white shadow-lg md:size-12 md:rounded-2xl">
                                        <Sparkles className="text-sky" size={20} />
                                    </div>
                                    <div className="min-w-0">
                                        <h2 className="journey-modal-title truncate text-lg font-black leading-tight tracking-tight text-sky-950 md:text-2xl">
                                            Peta Petualangan Belajar
                                        </h2>
                                        <p className="journey-modal-subtitle truncate text-[9px] font-black uppercase tracking-wider text-sky-700 md:text-xs md:tracking-widest">
                                            Clevio Innovator Camp · {courses[0]?.levelName || 'Level Coder'}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setIsOpen(false)}
                                    className="journey-close flex size-10 shrink-0 items-center justify-center rounded-full border border-white/50 bg-white/70 text-sky-900 shadow-md transition-all duration-300 hover:rotate-90 hover:bg-white md:size-11"
                                    aria-label="Tutup peta perjalanan"
                                >
                                    <X size={18} />
                                </button>
                            </div>

                            {/* ── Body ─────────────────────────────────────────── */}
                            <div className="journey-modal-body relative z-10 flex-1 min-h-0 overflow-y-auto overscroll-contain">
                                <JourneyMap courses={courses} />
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
    );

    return (
        <>
            <button
                onClick={() => setIsOpen(true)}
                className="inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-pastel-blue text-sky font-black rounded-2xl shadow-sm hover:scale-105 transition-all tracking-wide text-sm border-2 border-sky/20"
            >
                <Map size={18} />
                Learning Journey
            </button>

            {mounted ? createPortal(modalContent, document.body) : null}
        </>
    );
}
