'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import CreateClassForm from './CreateClassForm';
import PageHead from '@/components/admin/PageHead';

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
            <PageHead
                title="Kelas"
                desc="Kelola kelas Weekly dan Ekskul. Klik kartu untuk detail jadwal, roster, dan absensi."
                actions={
                    <>
                        <button className="btn">
                            <Plus size={16} /> {/* Should be Import icon, but using Plus as placeholder */}
                            Import
                        </button>
                        <button
                            onClick={() => setIsModalOpen(true)}
                            className="btn btn-primary"
                        >
                            <Plus size={16} />
                            Buat Kelas
                        </button>
                    </>
                }
            />

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
