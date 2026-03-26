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
                    className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4 md:p-8"
                        onClick={() => setIsOpen(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.95, opacity: 0, y: 20 }}
                            transition={{ duration: 0.25, type: 'spring', damping: 25, stiffness: 280 }}
                            className="w-full max-w-5xl max-h-[88vh] flex flex-col overflow-hidden rounded-[2.5rem] shadow-[0_35px_80px_-15px_rgba(0,0,0,0.4)] border-[6px] border-white/40 relative"
                            style={{ background: 'linear-gradient(to bottom, #7dd3fc 0%, #e0f2fe 100%)' }}
                            onClick={e => e.stopPropagation()}
                        >
                            {/* ── Cloud decorations (fixed, scattered) ─────── */}
                            <div className="absolute inset-0 overflow-hidden pointer-events-none rounded-[2.5rem]">
                                <Cloud className="absolute top-8 left-10 opacity-50" />
                                <Cloud className="absolute top-28 right-16 opacity-35 scale-125" />
                                <Cloud className="absolute bottom-12 left-1/4 opacity-40 scale-90" />
                                <Cloud className="absolute bottom-36 right-1/4 opacity-25 scale-110" />
                            </div>

                            {/* ── Header ──────────────────────────────────────── */}
                            <div className="relative z-20 flex items-center justify-between px-8 py-5 md:px-10 md:py-6">
                                <div className="flex items-center gap-3">
                                    <div className="size-10 md:size-12 bg-white rounded-xl md:rounded-2xl flex items-center justify-center shadow-lg -rotate-6 border-2 border-sky/20">
                                        <Sparkles className="text-sky" size={20} />
                                    </div>
                                    <div>
                                        <h2 className="text-xl md:text-2xl font-black text-sky-950 tracking-tight leading-tight">
                                            Peta Petualangan Belajar
                                        </h2>
                                        <p className="text-[10px] md:text-xs font-black text-sky-700 uppercase tracking-widest">
                                            Clevio Innovator Camp · {courses[0]?.levelName || 'Level Coder'}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setIsOpen(false)}
                                    className="size-10 md:size-11 rounded-full bg-white/70 hover:bg-white text-sky-900 transition-all shadow-md flex items-center justify-center hover:rotate-90 duration-300 border border-white/50"
                                >
                                    <X size={18} />
                                </button>
                            </div>

                            {/* ── Body ─────────────────────────────────────────── */}
                            <div className="relative z-10 flex-1 overflow-y-auto">
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
