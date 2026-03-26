'use client';

import { useState, useEffect, useRef } from 'react';
import { Search, Book, Users, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/navigation';
import { useRouter } from 'next/navigation';

export default function CoachSearch() {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<{ classes: any[], materials: any[], lessons: any[] }>({
        classes: [],
        materials: [],
        lessons: []
    });
    const [isLoading, setIsLoading] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const router = useRouter();

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        const fetchResults = async () => {
            if (query.length < 2) {
                setResults({ classes: [], materials: [], lessons: [] });
                return;
            }

            setIsLoading(true);
            try {
                const res = await fetch(`/api/coach/search?q=${encodeURIComponent(query)}`);
                const data = await res.json();
                if (data.success) {
                    setResults(data.results);
                    setIsOpen(true);
                }
            } catch (error) {
                console.error('Search error:', error);
            } finally {
                setIsLoading(false);
            }
        };

        const debounce = setTimeout(fetchResults, 300);
        return () => clearTimeout(debounce);
    }, [query]);

    return (
        <div className="relative w-full max-w-none" ref={containerRef}>
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                <input
                    type="text"
                    className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-sophisticatedBlue/20 focus:border-brand-sophisticatedBlue transition-all"
                    placeholder="Cari kelas, sesi, atau materi..."
                    value={query}
                    onChange={(e) => {
                        setQuery(e.target.value);
                        setIsOpen(true);
                    }}
                    onFocus={() => query.length >= 2 && setIsOpen(true)}
                />
                {isLoading && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />
                    </div>
                )}
            </div>

            <AnimatePresence>
                {isOpen && (query.length >= 2) && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 overflow-hidden"
                    >
                        <div className="max-h-[400px] overflow-y-auto p-2">
                            {results.classes.length === 0 && results.materials.length === 0 && results.lessons.length === 0 && !isLoading && (
                                <div className="p-4 text-center text-slate-500 text-sm">
                                    Tidak ada hasil ditemukan
                                </div>
                            )}

                            {results.classes.length > 0 && (
                                <div className="mb-2">
                                    <h3 className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Kelas Aktif</h3>
                                    {results.classes.map((cls) => (
                                        <button
                                            key={cls.id}
                                            onClick={() => {
                                                router.push(`/coach/classes/${cls.id}`);
                                                setIsOpen(false);
                                                setQuery('');
                                            }}
                                            className="w-full flex items-center gap-3 px-3 py-2 hover:bg-slate-50 rounded-lg transition-colors text-left"
                                        >
                                            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
                                                <Users className="w-4 h-4" />
                                            </div>
                                            <div>
                                                <div className="text-sm font-semibold text-slate-700">{cls.name}</div>
                                                <div className="text-[10px] text-slate-400">Klik untuk buka kelas</div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}

                            {results.lessons.length > 0 && (
                                <div className="mb-2">
                                    <h3 className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Sesi Belajar (Lesson)</h3>
                                    {results.lessons.map((lesson) => (
                                        <button
                                            key={lesson.id}
                                            onClick={() => {
                                                // Navigate directly to the lesson detail page with context
                                                const sessionId = lesson.id.replace('session-', '');
                                                router.push(`/coach/lesson/${lesson.lesson_id}?classId=${lesson.class_id}&sessionId=${sessionId}`);
                                                setIsOpen(false);
                                                setQuery('');
                                            }}
                                            className="w-full flex items-center gap-3 px-3 py-2 hover:bg-slate-50 rounded-lg transition-colors text-left"
                                        >
                                            <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center text-purple-600">
                                                <Book className="w-4 h-4" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="text-sm font-semibold text-slate-700 truncate">{lesson.name}</div>
                                                <div className="text-[10px] text-slate-400">Buka Modul Belajar</div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}

                            {results.materials.length > 0 && (
                                <div>
                                    <h3 className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Materi (File)</h3>
                                    {results.materials.map((mat) => (
                                        <button
                                            key={mat.id}
                                            onClick={() => {
                                                router.push(`/coach/classes/${mat.class_id}`);
                                                setIsOpen(false);
                                                setQuery('');
                                            }}
                                            className="w-full flex items-center gap-3 px-3 py-2 hover:bg-slate-50 rounded-lg transition-colors text-left"
                                        >
                                            <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
                                                <Book className="w-4 h-4" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="text-sm font-semibold text-slate-700 truncate">{mat.name}</div>
                                                <div className="text-[10px] text-slate-400">Materi di kelas {mat.class_id.split('-')[0]}...</div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
