'use client';

import { useState } from 'react';
import Link from 'next/link';
import PageHead from '@/components/admin/PageHead';
import ActionDropdown from '@/components/admin/ActionDropdown';
import AddEkskulPlanButton from './AddEkskulPlanButton';
import EditEkskulPlanButton from './EditEkskulPlanButton';
import DeleteEkskulPlanButton from './DeleteEkskulPlanButton';
import AddEkskulLessonButton from './[id]/AddEkskulLessonButton';
import EditEkskulLessonButton from './[id]/EditEkskulLessonButton';
import DeleteLessonButton from './[id]/DeleteLessonButton';
import ExportEkskulLessonsButton from './[id]/ExportEkskulLessonsButton';
import ImportEkskulLessonsButton from './[id]/ImportEkskulLessonsButton';

type EkskulLesson = {
    id: string;
    title: string;
    summary: string | null;
    slide_url?: string | null;
    make_up_instructions?: string | null;
    estimated_meetings: number | null;
    order_index: number;
    plan_id: string;
};

type EkskulPlan = {
    id: string;
    name: string;
    description: string | null;
    is_active: boolean;
    level: string | null;
    ekskul_lessons: EkskulLesson[];
    ekskul_plan_software?: any[];
};

export default function EkskulSplitViewClient({ plans }: { plans: EkskulPlan[] }) {
    const [selectedId, setSelectedId] = useState<string | null>(plans[0]?.id || null);

    const selectedPlan = plans.find(p => p.id === selectedId) || null;
    const sortedLessons = selectedPlan?.ekskul_lessons?.slice().sort((a, b) => a.order_index - b.order_index) || [];

    const totalSessions = selectedPlan?.ekskul_lessons?.reduce((sum, l) => sum + (l.estimated_meetings || 1), 0) || 0;

    return (
        <div className="col gap-4">
            <PageHead
                title="Ekskul Plans"
                desc="Kurikulum ekstrakurikuler — lesson plan per track kompetensi sekolah."
                actions={<AddEkskulPlanButton />}
            />

            <div className="grid" style={{ gridTemplateColumns: '280px minmax(0,1fr)', gap: '20px' }}>
                {/* Track list */}
                <div className="col gap-2">
                    <div className="muted" style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', padding: '0 4px 4px' }}>
                        Lesson Plan
                    </div>
                    {plans.map(plan => {
                        const active = plan.id === selectedId;
                        const planSessions = plan.ekskul_lessons?.reduce((sum, l) => sum + (l.estimated_meetings || 1), 0) || 0;
                        const planLevelName = plan.level || 'Ekskul';
                        
                        return (
                            <div key={plan.id} onClick={() => setSelectedId(plan.id)}
                                className="card"
                                style={{
                                    padding: 14, cursor: 'pointer',
                                    borderColor: active ? 'var(--accent)' : 'var(--border)',
                                    background: active ? 'var(--accent-weak)' : 'var(--surface)',
                                    boxShadow: active ? '0 2px 10px -2px color-mix(in srgb, var(--accent) 30%, transparent)' : 'var(--shadow-sm)',
                                    transition: 'all .15s',
                                }}>
                                <div className="row between" style={{ marginBottom: 6 }}>
                                    <span className="chip tag-ekskul" style={{ fontSize: 10 }}>{planLevelName}</span>
                                    {active && <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)' }} />}
                                </div>
                                <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 2 }}>{plan.name}</div>
                                <div className="muted" style={{ fontSize: 11.5 }}>
                                    {plan.ekskul_lessons?.length || 0} lesson · {planSessions} sesi
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Lesson plan detail */}
                {selectedPlan ? (
                    <div className="card">
                        <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border)' }}>
                            <div className="row between" style={{ flexWrap: 'wrap', gap: 10 }}>
                                <div>
                                    <div className="row gap-2" style={{ marginBottom: 4 }}>
                                        <span className="chip tag-ekskul">{selectedPlan.level || 'Ekskul'}</span>
                                        <span className="chip">{totalSessions} sesi / semester</span>
                                        {selectedPlan.is_active ? (
                                            <span className="badge badge-success chip-dot">Aktif</span>
                                        ) : (
                                            <span className="badge badge-neutral">Nonaktif</span>
                                        )}
                                    </div>
                                    <div style={{ fontSize: 18, fontWeight: 800 }}>{selectedPlan.name}</div>
                                    <div className="muted" style={{ fontSize: 12.5, marginTop: 2 }}>{selectedPlan.description || 'Lesson plan kurikulum ekskul'}</div>
                                </div>
                                <div className="row gap-2" style={{ flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                                    <ExportEkskulLessonsButton planId={selectedPlan.id} />
                                    <ImportEkskulLessonsButton planId={selectedPlan.id} currentLessonCount={sortedLessons.length} />
                                    <EditEkskulPlanButton plan={selectedPlan as unknown as any} />
                                    <DeleteEkskulPlanButton planId={selectedPlan.id} planName={selectedPlan.name} />
                                </div>
                            </div>
                        </div>
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>#</th>
                                    <th>Lesson</th>
                                    <th>Pertemuan</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {sortedLessons.map((l, index) => (
                                    <tr key={l.id} className="row-click">
                                        <td className="mono muted" style={{ width: 48 }}>{String(l.order_index).padStart(2, '0')}</td>
                                        <td style={{ fontWeight: 600 }}>
                                            {l.title}
                                            {l.summary && <div className="muted" style={{ fontSize: 11.5, marginTop: 2, fontWeight: 400 }}>{l.summary}</div>}
                                        </td>
                                        <td><span className="chip" style={{ fontSize: 10.5 }}>{l.estimated_meetings} sesi</span></td>
                                        <td style={{ textAlign: 'right', width: 80 }}>
                                            <ActionDropdown>
                                                <div className="col gap-1" style={{ padding: '4px' }}>
                                                    <EditEkskulLessonButton lesson={l as unknown as any} planId={selectedPlan.id} />
                                                    <DeleteLessonButton lessonId={l.id} lessonTitle={l.title} planId={selectedPlan.id} />
                                                </div>
                                            </ActionDropdown>
                                        </td>
                                    </tr>
                                ))}
                                <tr>
                                    <td colSpan={4} style={{ textAlign: 'center', padding: 16 }}>
                                        <AddEkskulLessonButton planId={selectedPlan.id} suggestedOrderIndex={sortedLessons.length + 1} />
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
                        Pilih lesson plan di sebelah kiri untuk melihat detailnya.
                    </div>
                )}
            </div>
        </div>
    );
}
