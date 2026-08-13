'use client';

import Link from 'next/link';
import { BookOpen, ChevronRight } from 'lucide-react';

import PageHead from '@/components/admin/PageHead';
import AddEkskulPlanButton from './AddEkskulPlanButton';
import EditEkskulPlanButton from './EditEkskulPlanButton';
import DeleteEkskulPlanButton from './DeleteEkskulPlanButton';

type EkskulLesson = {
    id: string;
    estimated_meetings: number | null;
};

type EkskulPlan = {
    id: string;
    name: string;
    description: string | null;
    is_active: boolean;
    level: string | null;
    ekskul_lessons: EkskulLesson[];
    ekskul_plan_software?: { software: { id: string; name: string } }[];
};

export default function EkskulSplitViewClient({ plans }: { plans: EkskulPlan[] }) {
    return (
        <div className="col gap-4 ekskul-plan-index">
            <PageHead
                title="Ekskul Plans"
                desc="Kelola lesson plan ekstrakurikuler per track kompetensi sekolah."
                actions={<AddEkskulPlanButton />}
            />

            {plans.length === 0 ? (
                <div className="card ekskul-plan-index-empty">
                    <BookOpen aria-hidden="true" size={24} />
                    <div>
                        <strong>Belum ada lesson plan ekskul</strong>
                        <p>Buat lesson plan pertama untuk mulai menyusun materi ekskul.</p>
                    </div>
                </div>
            ) : (
                <div className="col gap-3 ekskul-plan-index-list">
                    {plans.map((plan) => {
                        const lessonCount = plan.ekskul_lessons?.length || 0;
                        const sessionCount = plan.ekskul_lessons?.reduce(
                            (sum, lesson) => sum + (lesson.estimated_meetings || 1),
                            0,
                        ) || 0;
                        const softwareNames = plan.ekskul_plan_software
                            ?.map((item) => item.software?.name)
                            .filter(Boolean)
                            .join(', ');

                        return (
                            <article key={plan.id} className="card ekskul-plan-index-card">
                                <div className="ekskul-plan-index-main">
                                    <div className="ekskul-plan-index-icon" aria-hidden="true">
                                        <BookOpen size={20} />
                                    </div>
                                    <div className="ekskul-plan-index-copy">
                                        <div className="row gap-2 ekskul-plan-index-tags">
                                            <span className="chip tag-ekskul">{plan.level || 'Ekskul'}</span>
                                            <span className={plan.is_active ? 'badge badge-success chip-dot' : 'badge badge-neutral'}>
                                                {plan.is_active ? 'Aktif' : 'Nonaktif'}
                                            </span>
                                        </div>
                                        <h2>{plan.name}</h2>
                                        <p>{plan.description || 'Lesson plan kurikulum ekskul.'}</p>
                                        <div className="ekskul-plan-index-meta">
                                            <span>{lessonCount} lesson</span>
                                            <span>{sessionCount} sesi</span>
                                            {softwareNames && <span>{softwareNames}</span>}
                                        </div>
                                    </div>
                                </div>

                                <div className="ekskul-plan-index-actions">
                                    <EditEkskulPlanButton plan={plan} />
                                    <DeleteEkskulPlanButton planId={plan.id} planName={plan.name} />
                                    <Link href={`/admin/ekskul/${plan.id}`} className="btn btn-primary">
                                        <span>Kelola Lesson</span>
                                        <ChevronRight aria-hidden="true" size={16} />
                                    </Link>
                                </div>
                            </article>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
