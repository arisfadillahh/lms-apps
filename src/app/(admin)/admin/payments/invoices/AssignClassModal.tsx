'use client';

import { useState, useEffect, type CSSProperties } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X, Search, GraduationCap, CheckCircle2 } from 'lucide-react';

type ClassItem = {
    id: string;
    name: string;
    type: 'WEEKLY' | 'EKSKUL';
    level_name: string | null;
    coach_name: string;
    schedule_day: string;
    schedule_time: string;
};

type CoderInfo = {
    id: string;
    name: string;
};

interface AssignClassModalProps {
    open: boolean;
    onClose: () => void;
    coder: CoderInfo | null;
}

export default function AssignClassModal({ open, onClose, coder }: AssignClassModalProps) {
    const [classes, setClasses] = useState<ClassItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [typeFilter, setTypeFilter] = useState<'' | 'WEEKLY' | 'EKSKUL'>('');
    const [assigning, setAssigning] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    useEffect(() => {
        if (open && coder) {
            fetchClasses();
        }
    }, [open, coder]);

    const fetchClasses = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/admin/classes');
            if (res.ok) {
                const data = await res.json();
                setClasses(data.classes || []);
            }
        } catch (error) {
            console.error('Error fetching classes:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleAssign = async (classId: string) => {
        if (!coder) return;

        setAssigning(classId);
        try {
            const res = await fetch(`/api/admin/classes/${classId}/enrollments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ coderId: coder.id })
            });

            if (res.ok) {
                setSuccess(true);
                setTimeout(() => {
                    onClose();
                    setSuccess(false);
                }, 1500);
            }
        } catch (error) {
            console.error('Error assigning class:', error);
        } finally {
            setAssigning(null);
        }
    };

    const filteredClasses = classes.filter(c => {
        if (typeFilter && c.type !== typeFilter) return false;
        if (search) {
            const query = search.toLowerCase();
            return c.name.toLowerCase().includes(query) ||
                c.coach_name.toLowerCase().includes(query) ||
                (c.level_name && c.level_name.toLowerCase().includes(query));
        }
        return true;
    });

    const handleClose = () => {
        setSearch('');
        setTypeFilter('');
        setSuccess(false);
        onClose();
    };

    return (
        <Dialog.Root open={open} onOpenChange={(val) => !val && handleClose()}>
            <Dialog.Portal>
                <Dialog.Overlay style={overlayStyle} />
                <Dialog.Content style={contentStyle}>
                    <div style={headerStyle}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <div style={iconBoxStyle}>
                                <GraduationCap size={20} />
                            </div>
                            <div>
                                <Dialog.Title style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600, color: '#0f172a' }}>
                                    Assign ke Kelas
                                </Dialog.Title>
                                {coder && (
                                    <p style={{ margin: '0.25rem 0 0', color: '#64748b', fontSize: '0.85rem' }}>
                                        Coder: <strong>{coder.name}</strong>
                                    </p>
                                )}
                            </div>
                        </div>
                        <Dialog.Close asChild>
                            <button style={closeButtonStyle}>
                                <X size={18} />
                            </button>
                        </Dialog.Close>
                    </div>

                    {success ? (
                        <div style={successBoxStyle}>
                            <CheckCircle2 size={24} />
                            <span>Berhasil assign ke kelas!</span>
                        </div>
                    ) : (
                        <>
                            {/* Filters */}
                            <div style={filtersStyle}>
                                <div style={searchBoxStyle}>
                                    <Search size={16} color="#94a3b8" />
                                    <input
                                        type="text"
                                        placeholder="Cari kelas..."
                                        value={search}
                                        onChange={(e) => setSearch(e.target.value)}
                                        style={searchInputStyle}
                                    />
                                </div>
                                <select
                                    value={typeFilter}
                                    onChange={(e) => setTypeFilter(e.target.value as any)}
                                    style={selectStyle}
                                >
                                    <option value="">Semua Tipe</option>
                                    <option value="WEEKLY">Weekly</option>
                                    <option value="EKSKUL">Ekskul</option>
                                </select>
                            </div>

                            {/* Class List */}
                            <div style={listContainerStyle}>
                                {loading ? (
                                    <div style={emptyStyle}>Loading classes...</div>
                                ) : filteredClasses.length === 0 ? (
                                    <div style={emptyStyle}>Tidak ada kelas yang ditemukan</div>
                                ) : (
                                    filteredClasses.map((cls) => (
                                        <div key={cls.id} style={classItemStyle}>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontWeight: 600, color: '#1e293b' }}>{cls.name}</div>
                                                <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.25rem' }}>
                                                    {cls.level_name || cls.type} • {cls.coach_name} • {cls.schedule_day} {cls.schedule_time}
                                                </div>
                                            </div>
                                            <button
                                                style={assignButtonStyle}
                                                onClick={() => handleAssign(cls.id)}
                                                disabled={assigning === cls.id}
                                            >
                                                {assigning === cls.id ? 'Assigning...' : 'Assign'}
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </>
                    )}

                    <div style={footerStyle}>
                        <button style={cancelButtonStyle} onClick={handleClose}>
                            {success ? 'Tutup' : 'Lewati'}
                        </button>
                    </div>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
}

// Styles
const overlayStyle: CSSProperties = {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    position: 'fixed',
    inset: 0,
    zIndex: 50,
};

const contentStyle: CSSProperties = {
    backgroundColor: 'white',
    borderRadius: '12px',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
    position: 'fixed',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: '90%',
    maxWidth: '500px',
    maxHeight: '80vh',
    padding: '1.5rem',
    zIndex: 51,
    display: 'flex',
    flexDirection: 'column',
};

const headerStyle: CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '1.25rem',
};

const iconBoxStyle: CSSProperties = {
    width: '40px',
    height: '40px',
    borderRadius: '10px',
    background: 'linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'white',
};

const closeButtonStyle: CSSProperties = {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: '#64748b',
};

const filtersStyle: CSSProperties = {
    display: 'flex',
    gap: '0.75rem',
    marginBottom: '1rem',
};

const searchBoxStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    flex: 1,
    padding: '0.5rem 0.75rem',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    backgroundColor: '#f8fafc',
};

const searchInputStyle: CSSProperties = {
    border: 'none',
    outline: 'none',
    background: 'transparent',
    fontSize: '0.9rem',
    flex: 1,
};

const selectStyle: CSSProperties = {
    padding: '0.5rem 0.75rem',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    fontSize: '0.9rem',
    backgroundColor: '#f8fafc',
};

const listContainerStyle: CSSProperties = {
    flex: 1,
    overflowY: 'auto',
    maxHeight: '300px',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
};

const emptyStyle: CSSProperties = {
    padding: '2rem',
    textAlign: 'center',
    color: '#94a3b8',
};

const classItemStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    padding: '0.75rem 1rem',
    borderBottom: '1px solid #f1f5f9',
};

const assignButtonStyle: CSSProperties = {
    padding: '0.375rem 0.75rem',
    backgroundColor: '#3b82f6',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    fontSize: '0.8rem',
    fontWeight: 500,
    cursor: 'pointer',
};

const successBoxStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.75rem',
    padding: '3rem',
    color: '#16a34a',
};

const footerStyle: CSSProperties = {
    display: 'flex',
    justifyContent: 'flex-end',
    marginTop: '1rem',
    paddingTop: '1rem',
    borderTop: '1px solid #f1f5f9',
};

const cancelButtonStyle: CSSProperties = {
    padding: '0.5rem 1rem',
    backgroundColor: '#f1f5f9',
    color: '#475569',
    border: 'none',
    borderRadius: '8px',
    fontSize: '0.9rem',
    cursor: 'pointer',
};
