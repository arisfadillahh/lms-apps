'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

type ClassLesson = {
    id: string;
    title: string;
    order_index: number;
    blockName: string;
    blockOrder: number;
};

type Props = {
    classId: string;
    sessionId: string;
    currentDate: string | Date;
    isOpen: boolean;
    onClose: () => void;
    availableLessons: ClassLesson[];
};

export default function AssignMaterialModal({ classId, sessionId, currentDate, isOpen, onClose, availableLessons }: Props) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [selectedLessonId, setSelectedLessonId] = useState<string>('');
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedLessonId) return;

        setError(null);
        startTransition(async () => {
            try {
                const res = await fetch(`/api/admin/sessions/${sessionId}/material`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ classLessonId: selectedLessonId }),
                });

                if (!res.ok) {
                    const payload = await res.json().catch(() => ({}));
                    throw new Error(payload.error || 'Gagal mengubah materi');
                }

                router.refresh();
                onClose();
            } catch (err) {
                console.error(err);
                setError(err instanceof Error ? err.message : 'Terjadi kesalahan sistem');
            }
        });
    };

    if (!isOpen) return null;

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.5)'
        }}>
            <div style={{ background: 'white', padding: '1.5rem', borderRadius: '12px', width: '450px', maxWidth: '90%', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>
                <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.5rem', color: '#1e293b' }}>Ubah Materi Pertemuan</h2>
                <p style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
                    Sesi tanggal: <strong style={{ color: '#0f172a' }}>{new Date(currentDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</strong>
                    <br />Pilih materi yang seharusnya diajarkan. Sistem akan menyusun ulang urutan materi secara otomatis.
                </p>

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', fontWeight: 600, color: '#334155' }}>
                            Materi
                        </label>
                        <select
                            value={selectedLessonId}
                            onChange={(e) => setSelectedLessonId(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '0.6rem 0.75rem',
                                borderRadius: '8px',
                                border: '1px solid #cbd5e1',
                                color: '#1e293b',
                                background: '#f8fafc',
                                fontSize: '0.9rem',
                                outline: 'none'
                            }}
                            required
                        >
                            <option value="" disabled>-- Pilih Materi --</option>
                            {(() => {
                                // Group lessons by block, maintaining curriculum order
                                const groups: { blockName: string; blockOrder: number; lessons: ClassLesson[] }[] = [];
                                for (const lesson of availableLessons) {
                                    const existing = groups.find(g => g.blockName === lesson.blockName);
                                    if (existing) {
                                        existing.lessons.push(lesson);
                                    } else {
                                        groups.push({ blockName: lesson.blockName, blockOrder: lesson.blockOrder, lessons: [lesson] });
                                    }
                                }
                                groups.sort((a, b) => a.blockOrder - b.blockOrder);
                                return groups.map(group => (
                                    <optgroup key={group.blockName} label={`📦 ${group.blockName}`}>
                                        {group.lessons.map(lesson => (
                                            <option key={lesson.id} value={lesson.id}>
                                                {lesson.title}
                                            </option>
                                        ))}
                                    </optgroup>
                                ));
                            })()}
                        </select>
                    </div>

                    {error && (
                        <div style={{ background: '#fee2e2', color: '#b91c1c', padding: '0.5rem 0.75rem', borderRadius: '6px', fontSize: '0.85rem', border: '1px solid #fecaca' }}>
                            {error}
                        </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isPending}
                            style={{
                                padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid #cbd5e1',
                                background: 'white', color: '#475569', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem'
                            }}
                        >
                            Batal
                        </button>
                        <button
                            type="submit"
                            disabled={isPending || !selectedLessonId}
                            style={{
                                padding: '0.5rem 1rem', borderRadius: '8px', border: 'none',
                                background: '#2563eb', color: 'white', cursor: isPending || !selectedLessonId ? 'not-allowed' : 'pointer', opacity: isPending || !selectedLessonId ? 0.7 : 1,
                                fontWeight: 600, fontSize: '0.9rem'
                            }}
                        >
                            {isPending ? 'Menyimpan...' : 'Simpan Materi'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
