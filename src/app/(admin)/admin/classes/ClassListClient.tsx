'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Clock, Users, User, Search, ChevronDown, Plus } from 'lucide-react';
import DeleteClassButton from './DeleteClassButton';

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
        // Mock status logic for now (could be refined based on dates if available)
        const isCompleted = klass.name?.toLowerCase().includes('completed');
        const isDraft = klass.name?.toLowerCase().includes('draft');
        let currentStatus = 'ACTIVE';
        if (isCompleted) currentStatus = 'COMPLETED';
        else if (isDraft) currentStatus = 'DRAFT';

        const matchesStatus = statusFilter === 'ALL' || currentStatus === statusFilter;
        const matchesCoach = coachFilter === 'ALL' || klass.coach_id === coachFilter;

        return matchesSearch && matchesLevel && matchesStatus && matchesCoach;
    });

    // Determine category based on actual Level classifications like Xplorer, Innovator, Creator
    const getCategoryFromLevel = (klass: any) => {
        if (klass.type === 'EKSKUL') return 'Ekskul';
        const level = levelMap.get(klass.level_id);
        if (!level || !level.name) return 'Lainnya';

        const lname = level.name.toLowerCase();
        if (lname.includes('xplorer') || lname.includes('explorer')) return 'Xplorer';
        if (lname.includes('innovator')) return 'Innovator';
        if (lname.includes('creator')) return 'Creator';
        // Fallback to exactly what the level name is
        return level.name;
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Tabs */}
            <div style={{ display: 'flex', gap: '2rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0' }}>
                <button
                    onClick={() => setActiveTab('WEEKLY')}
                    style={{
                        padding: '0.75rem 0',
                        fontWeight: 600,
                        fontSize: '1rem',
                        color: activeTab === 'WEEKLY' ? '#3b82f6' : '#64748b',
                        borderBottom: activeTab === 'WEEKLY' ? '2px solid #3b82f6' : '2px solid transparent',
                        background: 'none',
                        borderTop: 'none',
                        borderLeft: 'none',
                        borderRight: 'none',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                    }}
                >
                    Weekly Class
                </button>
                <button
                    onClick={() => setActiveTab('EKSKUL')}
                    style={{
                        padding: '0.75rem 0',
                        fontWeight: 600,
                        fontSize: '1rem',
                        color: activeTab === 'EKSKUL' ? '#3b82f6' : '#64748b',
                        borderBottom: activeTab === 'EKSKUL' ? '2px solid #3b82f6' : '2px solid transparent',
                        background: 'none',
                        borderTop: 'none',
                        borderLeft: 'none',
                        borderRight: 'none',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                    }}
                >
                    Ekskul Sekolah
                </button>
            </div>

            {/* Filters */}
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'space-between' }}>
                <div style={{ position: 'relative', flex: '1', minWidth: '300px', maxWidth: '400px' }}>
                    <input
                        type="text"
                        placeholder="Cari nama kelas, pengajar, atau jadwal..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{
                            width: '100%',
                            padding: '0.6rem 1rem 0.6rem 2.5rem',
                            borderRadius: '9999px',
                            border: '1px solid #e2e8f0',
                            fontSize: '0.9rem',
                            outline: 'none',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                        }}
                    />
                    <Search size={16} color="#94a3b8" style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)' }} />
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <div style={{ position: 'relative' }}>
                        <select
                            value={levelFilter}
                            onChange={(e) => setLevelFilter(e.target.value)}
                            style={{
                                appearance: 'none',
                                padding: '0.6rem 2.2rem 0.6rem 1rem',
                                borderRadius: '9999px',
                                border: '1px solid #e2e8f0',
                                fontSize: '0.85rem',
                                color: '#475569',
                                background: '#fff',
                                outline: 'none',
                                cursor: 'pointer',
                            }}
                        >
                            <option value="ALL">Semua Level</option>
                            {levels.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                        </select>
                        <ChevronDown size={14} color="#64748b" style={{ position: 'absolute', right: '0.8rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                    </div>

                    <div style={{ position: 'relative' }}>
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            style={{
                                appearance: 'none',
                                padding: '0.6rem 2.2rem 0.6rem 1rem',
                                borderRadius: '9999px',
                                border: '1px solid #e2e8f0',
                                fontSize: '0.85rem',
                                color: '#475569',
                                background: '#fff',
                                outline: 'none',
                                cursor: 'pointer',
                            }}
                        >
                            <option value="ALL">Active</option>
                            <option value="DRAFT">Draft</option>
                            <option value="COMPLETED">Completed</option>
                        </select>
                        <ChevronDown size={14} color="#64748b" style={{ position: 'absolute', right: '0.8rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                    </div>

                    <div style={{ position: 'relative' }}>
                        <select
                            value={coachFilter}
                            onChange={(e) => setCoachFilter(e.target.value)}
                            style={{
                                appearance: 'none',
                                padding: '0.6rem 2.2rem 0.6rem 1rem',
                                borderRadius: '9999px',
                                border: '1px solid #e2e8f0',
                                fontSize: '0.85rem',
                                color: '#475569',
                                background: '#fff',
                                outline: 'none',
                                cursor: 'pointer',
                            }}
                        >
                            <option value="ALL">Coach</option>
                            {coaches.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
                        </select>
                        <ChevronDown size={14} color="#64748b" style={{ position: 'absolute', right: '0.8rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                    </div>
                </div>
            </div>

            {/* Grid Layout */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                gap: '1.5rem'
            }}>
                {filteredClasses.map((klass, index) => {
                    const hasValidId = typeof klass.id === 'string' && klass.id.length > 0;
                    const rowKey = hasValidId ? klass.id : `missing-${index}`;
                    const coach = coachMap.get(klass.coach_id);
                    const category = getCategoryFromLevel(klass);

                    // Determine mock status based on active
                    const isCompleted = klass.name?.toLowerCase().includes('completed');
                    const isDraft = klass.name?.toLowerCase().includes('draft');

                    let bgStatus = '#dcfce7';
                    let textStatus = '#166534';
                    let dotStatus = '#16a34a';
                    let labelStatus = 'Active';

                    if (isCompleted) {
                        bgStatus = '#f1f5f9';
                        textStatus = '#475569';
                        dotStatus = 'transparent';
                        labelStatus = 'Completed';
                    } else if (isDraft) {
                        bgStatus = '#dbeafe';
                        textStatus = '#1e3a8a';
                        dotStatus = 'transparent';
                        labelStatus = 'Draft';
                    }

                    return (
                        <div key={rowKey} style={{ position: 'relative', display: 'flex', flexDirection: 'column' }}>
                            <Link href={`/admin/classes/${klass.id}`} style={{ textDecoration: 'none', flex: 1, display: 'flex' }}>
                                <div style={{
                                    background: '#fff',
                                    borderRadius: '16px',
                                    border: '1px solid #e2e8f0',
                                    padding: '1.25rem',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '1rem',
                                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
                                    flex: 1,
                                    transition: 'transform 0.2s, box-shadow 0.2s',
                                    cursor: 'pointer'
                                }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.transform = 'translateY(-4px)';
                                        e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1)';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.transform = 'translateY(0)';
                                        e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.05)';
                                    }}
                                >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                            <span style={{
                                                background: category === 'Xplorer' ? '#3b82f6' : category === 'Innovator' ? '#a855f7' : category === 'Creator' ? '#f97316' : '#ec4899',
                                                color: '#fff',
                                                padding: '0.2rem 0.6rem',
                                                borderRadius: '9999px',
                                                fontSize: '0.75rem',
                                                fontWeight: 600
                                            }}>
                                                {category}
                                            </span>
                                            <span style={{
                                                background: bgStatus,
                                                color: textStatus,
                                                padding: '0.2rem 0.6rem',
                                                borderRadius: '9999px',
                                                fontSize: '0.75rem',
                                                fontWeight: 600,
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: dotStatus !== 'transparent' ? '0.35rem' : '0'
                                            }}>
                                                {dotStatus !== 'transparent' && (
                                                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: dotStatus }} />
                                                )}
                                                {labelStatus}
                                            </span>
                                        </div>
                                        
                                        {/* Stop propagation so clicking delete doesn't route to the class detail page */}
                                        <div onClick={(e) => e.preventDefault()}>
                                            <DeleteClassButton classId={hasValidId ? klass.id : ''} className={klass.name} />
                                        </div>
                                    </div>

                                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', marginTop: '0.5rem' }}>
                                        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.75rem', lineHeight: 1.3 }}>{klass.name}</h3>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#64748b', fontSize: '0.875rem' }}>
                                            <Clock size={16} />
                                            <span>{klass.schedule_day}, {klass.schedule_time} WIB</span>
                                        </div>
                                    </div>

                                    <div style={{ borderTop: '1px dashed #e2e8f0', margin: '0.5rem 0' }} />

                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                            <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                                                {coach?.avatar_url ? (
                                                    <Image src={coach.avatar_url} alt={coach.full_name} width={36} height={36} style={{ objectFit: 'cover' }} />
                                                ) : (
                                                    <User size={18} color="#94a3b8" />
                                                )}
                                            </div>
                                            <div>
                                                <div style={{ fontSize: '0.7rem', color: '#94a3b8', lineHeight: 1, marginBottom: '0.2rem' }}>Coach</div>
                                                <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#334155' }}>{coach?.full_name || <span style={{ fontStyle: 'italic', fontWeight: 400 }}>Belum ada</span>}</div>
                                            </div>
                                        </div>

                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: '#f8fafc', padding: '0.4rem 0.75rem', borderRadius: '8px', color: '#475569', fontSize: '0.85rem', fontWeight: 600, border: '1px solid #f1f5f9' }}>
                                            <Users size={16} />
                                            <span>{klass.studentCount || 0} Siswa</span>
                                        </div>
                                    </div>
                                </div>
                            </Link>
                        </div>
                    );
                })}

                {/* Create New Class Card Placeholder */}
                <Link href="#create-class-form" style={{ textDecoration: 'none', display: 'flex' }}>
                    <div style={{
                        borderRadius: '16px',
                        border: '1px dashed #cbd5e1',
                        padding: '1.25rem',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '1rem',
                        flex: 1,
                        minHeight: '220px',
                        cursor: 'pointer',
                        background: '#f8fafc',
                        transition: 'all 0.2s'
                    }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.background = '#f1f5f9';
                            e.currentTarget.style.borderColor = '#94a3b8';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.background = '#f8fafc';
                            e.currentTarget.style.borderColor = '#cbd5e1';
                        }}
                    >
                        <div style={{ color: '#94a3b8' }}>
                            <Plus size={32} strokeWidth={2} />
                        </div>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontWeight: 600, color: '#64748b', fontSize: '1rem', marginBottom: '0.25rem' }}>Buat Kelas Baru</div>
                            <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Klik untuk menambahkan jadwal</div>
                        </div>
                    </div>
                </Link>
            </div>
        </div>
    );
}
