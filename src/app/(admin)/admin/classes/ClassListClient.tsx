'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Clock, Users, User, Search, ChevronDown, Plus, MoreHorizontal } from 'lucide-react';
import DeleteClassButton from './DeleteClassButton';
import ActionDropdown from '@/components/admin/ActionDropdown';

interface ClassListClientProps {
    initialClasses: any[];
    coaches: any[];
    levels: any[];
}

export default function ClassListClient({ initialClasses, coaches, levels }: ClassListClientProps) {
    const [activeTab, setActiveTab] = useState<'WEEKLY' | 'EKSKUL'>('WEEKLY');
    const [searchTerm, setSearchTerm] = useState('');
    const [levelFilter, setLevelFilter] = useState('ALL');
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [coachFilter, setCoachFilter] = useState('ALL');

    // Create maps for quick lookup
    const coachMap = new Map(coaches.map((coach) => [coach.id, coach]));
    const levelMap = new Map(levels.map((level) => [level.id, level]));

    // Filter classes
    const filteredClasses = initialClasses.filter((klass) => {
        if (klass.type !== activeTab) return false;

        const term = searchTerm.toLowerCase();
        const nameMatch = klass.name?.toLowerCase().includes(term);
        const coachMatch = coachMap.get(klass.coach_id)?.full_name?.toLowerCase().includes(term);
        const levelMatch = levelMap.get(klass.level_id)?.name?.toLowerCase().includes(term);
        const dayMatch = klass.schedule_day?.toLowerCase().includes(term);

        const matchesSearch = nameMatch || coachMatch || levelMatch || dayMatch;

        const matchesLevel = levelFilter === 'ALL' || klass.level_id === levelFilter;
        
        const isCompleted = klass.name?.toLowerCase().includes('completed');
        const isDraft = klass.name?.toLowerCase().includes('draft');
        let currentStatus = 'ACTIVE';
        if (isCompleted) currentStatus = 'COMPLETED';
        else if (isDraft) currentStatus = 'DRAFT';

        const matchesStatus = statusFilter === 'ALL' || currentStatus === statusFilter;
        const matchesCoach = coachFilter === 'ALL' || klass.coach_id === coachFilter;

        return matchesSearch && matchesLevel && matchesStatus && matchesCoach;
    });

    const weeklyCount = initialClasses.filter(c => c.type === 'WEEKLY').length;
    const ekskulCount = initialClasses.filter(c => c.type === 'EKSKUL').length;

    function levelTagClass(levelId: string | null) {
        if (!levelId) return 'tag-ekskul';
        const lname = levelMap.get(levelId)?.name?.toLowerCase() || '';
        if (lname.includes('explorer')) return 'tag-explorer';
        if (lname.includes('creator')) return 'tag-creator';
        if (lname.includes('innovator')) return 'tag-innovator';
        return 'tag-ekskul';
    }

    return (
        <div>
            {/* Tabs */}
            <div className="tabs">
                <div className={`tab ${activeTab === 'WEEKLY' ? 'active' : ''}`} onClick={() => setActiveTab('WEEKLY')}>
                    Weekly Class <span className="chip" style={{ marginLeft: 6, fontSize: 10 }}>{weeklyCount}</span>
                </div>
                <div className={`tab ${activeTab === 'EKSKUL' ? 'active' : ''}`} onClick={() => setActiveTab('EKSKUL')}>
                    Ekskul Sekolah <span className="chip" style={{ marginLeft: 6, fontSize: 10 }}>{ekskulCount}</span>
                </div>
            </div>

            {/* Filters */}
            <div className="filters" style={{ marginBottom: 18 }}>
                <div className="searchbar" style={{ maxWidth: 300, flex: 'none' }}>
                    <Search size={16} />
                    <input
                        placeholder="Cari nama kelas atau coach..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <select className="input" style={{ width: 'auto' }} value={levelFilter} onChange={(e) => setLevelFilter(e.target.value)}>
                    <option value="ALL">Semua Level</option>
                    {levels.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
                <select className="input" style={{ width: 'auto' }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                    <option value="ALL">Semua Status</option>
                    <option value="ACTIVE">Active</option>
                    <option value="DRAFT">Draft</option>
                    <option value="COMPLETED">Completed</option>
                </select>
                <select className="input" style={{ width: 'auto' }} value={coachFilter} onChange={(e) => setCoachFilter(e.target.value)}>
                    <option value="ALL">Semua Coach</option>
                    {coaches.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
                </select>
            </div>

            {/* Grid Layout */}
            <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
                {filteredClasses.map((klass, index) => {
                    const hasValidId = typeof klass.id === 'string' && klass.id.length > 0;
                    const rowKey = hasValidId ? klass.id : `missing-${index}`;
                    const coach = coachMap.get(klass.coach_id);
                    const levelName = klass.type === 'EKSKUL' ? 'Ekskul' : (levelMap.get(klass.level_id)?.name || 'Ekskul');

                    const isCompleted = klass.name?.toLowerCase().includes('completed');
                    const isDraft = klass.name?.toLowerCase().includes('draft');
                    
                    let status = 'ACTIVE';
                    if (isCompleted) status = 'COMPLETED';
                    else if (isDraft) status = 'DRAFT';

                    // Mock progress
                    const mockProgress = Math.floor(Math.random() * 100);

                    return (
                        <Link href={`/admin/classes/${klass.id}`} key={rowKey} style={{ textDecoration: 'none', color: 'inherit', display: 'flex' }}>
                            <div className="class-card" style={{ flex: 1 }}>
                                <div className="row between">
                                    <div className="row gap-2">
                                        <span className={`chip ${levelTagClass(klass.level_id)}`}>{levelName}</span>
                                        {status === 'ACTIVE' && <span className="badge badge-success chip-dot">Active</span>}
                                        {status === 'DRAFT' && <span className="badge badge-info">Draft</span>}
                                        {status === 'COMPLETED' && <span className="badge badge-neutral">Completed</span>}
                                    </div>
                                    <div onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
                                        <ActionDropdown>
                                            <div className="col gap-1" style={{ padding: '4px' }}>
                                                <DeleteClassButton classId={hasValidId ? klass.id : ''} className={klass.name} />
                                            </div>
                                        </ActionDropdown>
                                    </div>
                                </div>
                                
                                <div>
                                    <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 6, lineHeight: 1.3 }}>{klass.name}</div>
                                    <div className="muted row gap-2" style={{ fontSize: 12.5 }}>
                                        <Clock size={14} /> {klass.schedule_day}, {klass.schedule_time} WIB
                                    </div>
                                </div>

                                {status === 'ACTIVE' && (
                                    <div>
                                        <div className="row between" style={{ fontSize: 11, marginBottom: 6 }}>
                                            <span className="muted">Progress kurikulum</span>
                                            <span style={{ fontWeight: 700 }}>{mockProgress}%</span>
                                        </div>
                                        <div className="bar"><span style={{ width: `${mockProgress}%` }} /></div>
                                    </div>
                                )}

                                <div className="row between" style={{ paddingTop: 10, borderTop: '1px dashed var(--border)', marginTop: 'auto' }}>
                                    <div className="row gap-2">
                                        <div className="avatar">
                                            {coach?.avatar_url ? (
                                                <Image src={coach.avatar_url} alt={coach.full_name} width={28} height={28} style={{ objectFit: 'cover', borderRadius: '50%' }} />
                                            ) : (
                                                coach?.full_name ? coach.full_name.slice(0, 2).toUpperCase() : '?'
                                            )}
                                        </div>
                                        <div>
                                            <div className="muted" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 700 }}>Coach</div>
                                            <div style={{ fontSize: 12.5, fontWeight: 600 }}>{coach?.full_name || '—'}</div>
                                        </div>
                                    </div>
                                    <span className="chip"><Users size={14} /> {klass.studentCount || 0}</span>
                                </div>
                            </div>
                        </Link>
                    );
                })}

                <Link href="#create-class-form" style={{ textDecoration: 'none', display: 'flex' }}>
                    <div className="class-card" style={{
                        border: '1px dashed var(--border-strong)',
                        background: 'var(--surface-2)',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minHeight: 200,
                        flex: 1,
                        boxShadow: 'none'
                    }}>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{
                                width: 40, height: 40, borderRadius: 'var(--radius)', background: 'var(--surface)',
                                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                marginBottom: 8, color: 'var(--text-muted)'
                            }}>
                                <Plus size={20} strokeWidth={2} />
                            </div>
                            <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)' }}>Buat kelas baru</div>
                            <div className="muted" style={{ fontSize: 11.5, marginTop: 2 }}>dari template atau kosong</div>
                        </div>
                    </div>
                </Link>
            </div>
        </div>
    );
}
