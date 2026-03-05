'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import CreateClassForm from './CreateClassForm';

type AdminClassesPageWrapperProps = {
    coaches: any[];
    levels: any[];
    levelBlocks: Record<string, any[]>;
    ekskulPlans?: any[];
};

export default function AdminClassesPageWrapper({
    coaches,
    levels,
    levelBlocks,
    ekskulPlans = []
}: AdminClassesPageWrapperProps) {
    const [isModalOpen, setIsModalOpen] = useState(false);

    return (
        <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                    <h1 style={{ fontSize: '1.8rem', fontWeight: 800, color: '#1e293b', marginBottom: '0.5rem', letterSpacing: '-0.02em' }}>Manajemen Kelas</h1>
                    <p style={{ color: '#64748b', maxWidth: '48rem', fontSize: '1rem', lineHeight: '1.6', margin: 0 }}>
                        Kelola jadwal, pengajar, dan siswa coding Anda.
                    </p>
                </div>

                <button
                    onClick={() => setIsModalOpen(true)}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        background: '#3b82f6',
                        color: '#fff',
                        border: 'none',
                        padding: '0.6rem 1.25rem',
                        borderRadius: '9999px',
                        fontSize: '0.9rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        boxShadow: '0 4px 6px -1px rgba(59, 130, 246, 0.3)',
                        transition: 'all 0.2s',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                    onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                >
                    <Plus size={18} />
                    Buat Kelas Baru
                </button>
            </div>

            <CreateClassForm
                coaches={coaches}
                levels={levels}
                levelBlocks={levelBlocks}
                ekskulPlans={ekskulPlans}
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
            />
        </>
    );
}
