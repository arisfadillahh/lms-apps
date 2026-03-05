'use client';

import { useState } from 'react';
import JourneyMap, { JourneyCourse } from './JourneyMap';
import { motion, AnimatePresence } from 'framer-motion';
import { Map, X } from 'lucide-react';

export default function JourneyModal({ courses }: { courses: JourneyCourse[] }) {
    const [isOpen, setIsOpen] = useState(false);

    if (courses.length === 0) return null;

    return (
        <>
            <button
                onClick={() => setIsOpen(true)}
                className="inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-pastel-blue text-sky font-black rounded-2xl shadow-sm hover:scale-105 transition-all tracking-wide text-sm border-2 border-sky/20"
            >
                <Map size={18} />
                Learning Journey
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                        onClick={() => setIsOpen(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.95, opacity: 0, y: 20 }}
                            transition={{ duration: 0.2, type: 'spring', damping: 25, stiffness: 300 }}
                            className="bg-white w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-[2rem] shadow-2xl flex flex-col relative"
                            onClick={e => e.stopPropagation()}
                        >
                            {/* Modal Header */}
                            <div className="px-5 py-4 sm:px-8 sm:py-6 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-20 rounded-t-[2rem]">
                                <div className="flex items-center gap-3 sm:gap-4">
                                    <div className="p-1.5 sm:p-2 bg-blue-500/10 rounded-full text-blue-500">
                                        <Map className="w-5 h-5 sm:w-8 sm:h-8" />
                                    </div>
                                    <div>
                                        <h2 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 leading-tight">Peta Perjalanan Belajar</h2>
                                        <p className="text-slate-500 text-xs sm:text-sm font-medium">Program Coding Clevio</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setIsOpen(false)}
                                    className="text-slate-400 hover:text-slate-600 transition-colors"
                                >
                                    <X className="w-6 h-6 sm:w-8 sm:h-8" />
                                </button>
                            </div>

                            {/* Modal Body (Scrollable Journey) */}
                            <div className="flex-1 overflow-y-auto w-full">
                                <JourneyMap courses={courses} />
                            </div>

                            {/* Modal Footer */}
                            <div className="px-5 py-4 sm:px-8 sm:py-6 border-t border-slate-100 bg-slate-50 flex justify-center mt-auto">
                                <p className="text-slate-500 text-[10px] sm:text-xs font-medium flex items-center gap-2 text-center">
                                    Selesaikan tahapan untuk menjadi Master Coder!
                                </p>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}
