'use client';

import { useState, useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Settings, CheckCircle, Circle, Save, X, SlidersHorizontal } from 'lucide-react';

type CoderJourneyOverrideProps = {
    classId: string;
    coderId: string;
    coderName: string;
};

type BlockProgress = {
    block_id: string;
    block_name: string;
    status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
    journey_order: number;
};

export default function CoderJourneyOverride({ classId, coderId, coderName }: CoderJourneyOverrideProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [journey, setJourney] = useState<(BlockProgress & { block_name: string })[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, startTransition] = useTransition();
    const [message, setMessage] = useState<string | null>(null);

    const router = useRouter();

    useEffect(() => {
        if (!isOpen) return;

        setIsLoading(true);
        fetch(`/api/admin/classes/${classId}/progress?coderId=${coderId}`)
            .then(res => res.json())
            .then(data => {
                if (data.journey) {
                    setJourney(data.journey);
                }
            })
            .catch(err => console.error(err))
            .finally(() => setIsLoading(false));
    }, [isOpen, classId, coderId]);

    const toggleBlock = (blockId: string) => {
        setJourney(prev => prev.map(item => {
            if (item.block_id !== blockId) return item;
            const isCompleted = item.status === 'COMPLETED';
            return { ...item, status: isCompleted ? 'PENDING' : 'COMPLETED' };
        }));
    };

    const handleSave = () => {
        const completedBlockIds = journey
            .filter(j => j.status === 'COMPLETED')
            .map(j => j.block_id);

        startTransition(async () => {
            try {
                const res = await fetch(`/api/admin/classes/${classId}/progress/bypass`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ coderId, completedBlockIds }),
                });

                if (!res.ok) throw new Error('Failed to save');

                setMessage('Tersimpan!');
                setTimeout(() => {
                    setMessage(null);
                    setIsOpen(false);
                    router.refresh();
                }, 1000);
            } catch (error) {
                console.error(error);
                setMessage('Gagal.');
            }
        });
    };

    return (
        <>
            <button
                onClick={() => setIsOpen(true)}
                title={`Atur Progress: ${coderName}`}
                style={{
                    width: '32px', height: '32px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    borderRadius: '6px',
                    border: '1px solid #3b82f6', background: '#eff6ff', color: '#2563eb',
                    cursor: 'pointer', transition: 'all 0.2s'
                }}
            >
                <SlidersHorizontal size={16} />
            </button>

            {isOpen && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
                    background: 'rgba(0,0,0,0.5)', zIndex: 9999,
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                    <div style={{
                        background: 'white', borderRadius: '16px',
                        width: '90%', maxWidth: '500px',
                        maxHeight: '90vh', overflowY: 'auto',
                        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
                    }}>
                        <div style={{ padding: '1.5rem', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#1e293b' }}>
                                Atur Progress Coder
                            </h3>
                            <button
                                onClick={() => setIsOpen(false)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div style={{ padding: '1.5rem' }}>
                            <div style={{ marginBottom: '1.5rem', padding: '0.75rem', background: '#f8fafc', borderRadius: '8px' }}>
                                <span style={{ display: 'block', fontSize: '0.75rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Nama Siswa</span>
                                <strong style={{ fontSize: '1rem', color: '#334155' }}>{coderName}</strong>
                            </div>

                            {isLoading ? (
                                <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>Memuat data journey...</div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                    {journey.map((block) => (
                                        <div
                                            key={block.block_id}
                                            onClick={() => toggleBlock(block.block_id)}
                                            style={{
                                                display: 'flex', alignItems: 'center', gap: '0.75rem',
                                                padding: '0.75rem 1rem', borderRadius: '8px',
                                                border: block.status === 'COMPLETED' ? '1px solid #86efac' : '1px solid #e2e8f0',
                                                cursor: 'pointer', transition: 'all 0.2s',
                                                background: block.status === 'COMPLETED' ? '#f0fdf4' : 'white'
                                            }}
                                        >
                                            {block.status === 'COMPLETED'
                                                ? <CheckCircle size={20} color="#16a34a" fill="#dcfce7" />
                                                : <Circle size={20} color="#cbd5e1" />
                                            }
                                            <span style={{
                                                flex: 1, fontSize: '0.95rem', fontWeight: 500,
                                                color: block.status === 'COMPLETED' ? '#166534' : '#64748b'
                                            }}>
                                                {block.block_name}
                                            </span>
                                            {block.status === 'COMPLETED' && (
                                                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#16a34a', background: '#dcfce7', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>SELESAI</span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div style={{ padding: '1.5rem', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                            <button
                                onClick={() => setIsOpen(false)}
                                style={{
                                    padding: '0.6rem 1.25rem', borderRadius: '8px',
                                    border: '1px solid #e2e8f0', background: 'white',
                                    color: '#64748b', fontWeight: 600, cursor: 'pointer'
                                }}
                            >
                                Batal
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={isSaving || isLoading}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '0.5rem',
                                    padding: '0.6rem 1.25rem', borderRadius: '8px',
                                    border: 'none', background: '#2563eb',
                                    color: 'white', fontWeight: 600, cursor: isSaving ? 'wait' : 'pointer',
                                    opacity: isSaving ? 0.7 : 1
                                }}
                            >
                                {isSaving ? 'Menyimpan...' : 'Simpan Perubahan'}
                            </button>
                            {message && (
                                <span style={{ marginLeft: '1rem', color: message === 'Gagal.' ? 'red' : 'green' }}>{message}</span>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
