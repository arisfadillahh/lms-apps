'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { CSSProperties } from 'react';
import DeleteClassButton from './DeleteClassButton';

interface ClassListClientProps {
    initialClasses: any[];
    coaches: any[];
    levels: any[];
}

export default function ClassListClient({ initialClasses, coaches, levels }: ClassListClientProps) {
    const [searchTerm, setSearchTerm] = useState('');

    // Create maps for quick lookup
    const coachMap = new Map(coaches.map((coach) => [coach.id, coach.full_name]));
    const levelMap = new Map(levels.map((level) => [level.id, level.name]));

    // Filter classes
    const filteredClasses = initialClasses.filter((klass) => {
        if (!searchTerm) return true;

        const term = searchTerm.toLowerCase();
        const nameMatch = klass.name?.toLowerCase().includes(term);
        const coachMatch = coachMap.get(klass.coach_id)?.toLowerCase().includes(term);
        const levelMatch = levelMap.get(klass.level_id)?.toLowerCase().includes(term);
        const dayMatch = klass.schedule_day?.toLowerCase().includes(term);

        return nameMatch || coachMatch || levelMatch || dayMatch;
    });

    return (
        <section style={{
            background: '#ffffff',
            borderRadius: '16px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
            overflow: 'hidden'
        }}>
            <div style={{
                padding: '1.25rem 1.5rem',
                borderBottom: '1px solid #f1f5f9',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '1rem'
            }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1e293b', margin: 0 }}>Daftar Kelas Aktif</h3>

                <div style={{ position: 'relative', minWidth: '250px' }}>
                    <input
                        type="text"
                        placeholder="Cari kelas, coach, level..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{
                            width: '100%',
                            padding: '0.6rem 1rem 0.6rem 2.5rem',
                            borderRadius: '8px',
                            border: '1px solid #cbd5e1',
                            fontSize: '0.9rem',
                            outline: 'none',
                            transition: 'border-color 0.2s',
                        }}
                    />
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#94a3b8"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        style={{ position: 'absolute', left: '0.8rem', top: '50%', transform: 'translateY(-50%)' }}
                    >
                        <circle cx="11" cy="11" r="8"></circle>
                        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                    </svg>
                </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead style={{ background: '#f8fafc', textAlign: 'left' }}>
                        <tr>
                            <th style={thStyle}>Nama Kelas</th>
                            <th style={thStyle}>Tipe</th>
                            <th style={thStyle}>Coach</th>
                            <th style={thStyle}>Level</th>
                            <th style={thStyle}>Jadwal</th>
                            <th style={thStyle}>Aksi</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredClasses.length === 0 ? (
                            <tr>
                                <td colSpan={6} style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>
                                    {searchTerm ? 'Tidak ada kelas yang cocok dengan pencarian Anda.' : 'Belum ada kelas yang dibuat.'}
                                </td>
                            </tr>
                        ) : (
                            filteredClasses.map((klass, index) => {
                                const hasValidId = typeof klass.id === 'string' && klass.id.length > 0;
                                const rowKey = hasValidId ? klass.id : `missing-${index}`;

                                return (
                                    <tr key={rowKey} style={{ borderBottom: '1px solid #f1f5f9', transition: 'background 0.2s' }}>
                                        <td style={tdStyle}>
                                            <span style={{ fontWeight: 600, color: '#1e293b' }}>{klass.name}</span>
                                        </td>
                                        <td style={tdStyle}>
                                            <span style={{
                                                padding: '0.25rem 0.6rem',
                                                borderRadius: '6px',
                                                fontSize: '0.75rem',
                                                fontWeight: 600,
                                                background: klass.type === 'WEEKLY' ? '#eff6ff' : '#fdf4ff',
                                                color: klass.type === 'WEEKLY' ? '#3b82f6' : '#d946ef'
                                            }}>
                                                {klass.type}
                                            </span>
                                        </td>
                                        <td style={tdStyle}>{coachMap.get(klass.coach_id) ?? <span style={{ color: '#94a3b8' }}>Belum ditentukan</span>}</td>
                                        <td style={tdStyle}>{klass.level_id ? levelMap.get(klass.level_id) ?? '—' : '—'}</td>
                                        <td style={tdStyle}>
                                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#475569' }}>
                                                <span style={{ fontWeight: 500 }}>{klass.schedule_day}</span>
                                                <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#cbd5e1' }} />
                                                {klass.schedule_time}
                                            </span>
                                        </td>
                                        <td style={{ ...tdStyle, width: '180px' }}>
                                            {hasValidId ? (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                    <Link
                                                        href={`/admin/classes/${klass.id}`}
                                                        style={{
                                                            padding: '0.4rem 0.85rem',
                                                            borderRadius: '8px',
                                                            background: '#eff6ff',
                                                            color: '#3b82f6',
                                                            fontWeight: 600,
                                                            fontSize: '0.85rem',
                                                            textDecoration: 'none',
                                                            border: '1px solid #dbeafe',
                                                            transition: 'all 0.15s'
                                                        }}
                                                    >
                                                        Kelola
                                                    </Link>
                                                    <DeleteClassButton classId={klass.id} className={klass.name} />
                                                </div>
                                            ) : (
                                                <span style={{ color: '#b91c1c', fontWeight: 500 }}>ID tidak valid</span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
            <div style={{ padding: '0.8rem 1.5rem', background: '#f8fafc', borderTop: '1px solid #e2e8f0', fontSize: '0.85rem', color: '#64748b' }}>
                Menampilkan {filteredClasses.length} dari {initialClasses.length} kelas
            </div>
        </section>
    );
}

const thStyle: CSSProperties = {
    padding: '1rem 1.5rem',
    fontSize: '0.75rem',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    fontWeight: 600,
    borderBottom: '1px solid #e2e8f0',
};

const tdStyle: CSSProperties = {
    padding: '1rem 1.5rem',
    fontSize: '0.9rem',
    color: '#334155',
    verticalAlign: 'middle',
};
