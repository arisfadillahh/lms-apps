'use client';

import { useState, useEffect } from 'react';

interface Coder {
    id: string;
    full_name: string;
    class_name?: string;
    level_name?: string;
}

interface ParentGroup {
    parent_phone: string;
    parent_name: string;
    existing_ccr?: string;
    coders: Coder[];
}

export default function CCRAssignment() {
    const [groups, setGroups] = useState<ParentGroup[]>([]);
    const [nextCCR, setNextCCR] = useState<string>('CCR001');
    const [loading, setLoading] = useState(true);
    const [assigning, setAssigning] = useState<string | null>(null);
    const [ccrInputs, setCcrInputs] = useState<Record<string, string>>({});
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    useEffect(() => {
        fetchUnassigned();
    }, []);

    const fetchUnassigned = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/ccr?action=unassigned');
            const data = await res.json();
            setGroups(data.groups || []);
            setNextCCR(data.nextCCR || 'CCR001');

            const inputs: Record<string, string> = {};
            let currentSeq = parseInt(data.nextCCR?.substring(3) || '1', 10);
            for (const group of data.groups || []) {
                if (group.existing_ccr) {
                    inputs[group.parent_phone] = group.existing_ccr;
                } else {
                    inputs[group.parent_phone] = `CCR${String(currentSeq).padStart(3, '0')}`;
                    currentSeq++;
                }
            }
            setCcrInputs(inputs);
        } catch (error) {
            console.error('Error fetching unassigned:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleAssign = async (parentPhone: string, parentName: string) => {
        const ccrCode = ccrInputs[parentPhone];
        if (!ccrCode) {
            setMessage({ type: 'error', text: 'Please enter a CCR code' });
            return;
        }

        setAssigning(parentPhone);
        setMessage(null);

        try {
            const res = await fetch('/api/ccr', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ parent_phone: parentPhone, ccr_code: ccrCode, parent_name: parentName })
            });

            const data = await res.json();

            if (res.ok && data.success) {
                setMessage({ type: 'success', text: `CCR ${ccrCode} berhasil di-assign!` });
                setGroups(prev => prev.filter(g => g.parent_phone !== parentPhone));
            } else {
                setMessage({ type: 'error', text: data.error || 'Gagal assign CCR' });
            }
        } catch (error) {
            setMessage({ type: 'error', text: 'Error: ' + String(error) });
        } finally {
            setAssigning(null);
        }
    };

    const handleSkip = (parentPhone: string) => {
        setGroups(prev => prev.filter(g => g.parent_phone !== parentPhone));
    };

    if (loading) {
        return <div className="empty">Memuat data...</div>;
    }

    return (
        <div style={{ maxWidth: 800 }}>
            {/* Message */}
            {message && (
                <div
                    className={message.type === 'success' ? 'badge badge-success' : 'badge badge-danger'}
                    style={{ display: 'block', padding: '10px 14px', borderRadius: 'var(--radius)', marginBottom: 16, fontSize: 13 }}
                >
                    {message.type === 'success' ? '✅' : '❌'} {message.text}
                </div>
            )}

            {/* Stats */}
            <div className="grid grid-2" style={{ marginBottom: 18 }}>
                <div className="stat">
                    <div className="stat-label">Belum Punya ID Invoice</div>
                    <div className="stat-value">{groups.length} <span style={{ fontSize: 16, fontWeight: 500 }}>Keluarga</span></div>
                    <div className="stat-icon">👨‍👩‍👧</div>
                </div>
                <div className="stat">
                    <div className="stat-label">Next Available CCR</div>
                    <div className="stat-value mono" style={{ fontSize: 26 }}>{nextCCR}</div>
                    <div className="stat-icon">🔢</div>
                </div>
            </div>

            {/* Empty state */}
            {groups.length === 0 ? (
                <div className="card" style={{ padding: '48px 20px', textAlign: 'center' }}>
                    <div style={{ fontSize: 32, marginBottom: 8 }}>✅</div>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>Semua coder sudah memiliki ID Invoice!</div>
                    <div className="muted" style={{ marginTop: 4, fontSize: 13 }}>Tidak ada keluarga yang perlu di-assign saat ini.</div>
                </div>
            ) : (
                <div className="col gap-3">
                    {groups.map((group) => (
                        <div key={group.parent_phone} className="card" style={{ padding: 20 }}>
                            {/* Card header */}
                            <div className="row between" style={{ marginBottom: 12 }}>
                                <div>
                                    <div style={{ fontWeight: 700, fontSize: 15 }}>{group.parent_name}</div>
                                    <div className="muted mono" style={{ fontSize: 12.5, marginTop: 2 }}>{group.parent_phone}</div>
                                </div>
                                <div className="row gap-2">
                                    <span className="chip">{group.coders.length} Anak</span>
                                    {group.existing_ccr && (
                                        <span className="badge badge-warn">👨‍👩‍👧‍👦 Sibling</span>
                                    )}
                                </div>
                            </div>

                            {/* Coders list */}
                            <div className="subcard" style={{ marginBottom: 14 }}>
                                {group.coders.map((coder) => (
                                    <div key={coder.id} className="row between" style={{ padding: '5px 0', borderBottom: '1px solid var(--border)' }}>
                                        <span style={{ fontWeight: 600, fontSize: 13 }}>• {coder.full_name}</span>
                                        <span className="muted" style={{ fontSize: 12 }}>
                                            {coder.level_name}{coder.class_name ? `, ${coder.class_name}` : ''}
                                        </span>
                                    </div>
                                ))}
                            </div>

                            {/* CCR Input + Actions */}
                            <div className="row gap-3" style={{ flexWrap: 'wrap', alignItems: 'flex-end' }}>
                                <div style={{ flex: 1, minWidth: 200 }}>
                                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.05em' }}>
                                        CCR Number
                                    </label>
                                    <input
                                        type="text"
                                        value={ccrInputs[group.parent_phone] || ''}
                                        onChange={(e) => setCcrInputs(prev => ({
                                            ...prev,
                                            [group.parent_phone]: e.target.value.toUpperCase()
                                        }))}
                                        placeholder="CCR001"
                                        className="input mono"
                                        style={{ fontWeight: 700, letterSpacing: '.05em' }}
                                    />
                                    <span style={{ fontSize: 11.5, color: 'var(--text-dim)', marginTop: 4, display: 'block' }}>
                                        {group.existing_ccr
                                            ? `✅ Parent sudah punya CCR: ${group.existing_ccr}`
                                            : `Next available: ${nextCCR}`}
                                    </span>
                                </div>
                                <div className="row gap-2">
                                    <button
                                        onClick={() => handleAssign(group.parent_phone, group.parent_name)}
                                        disabled={assigning === group.parent_phone}
                                        className="btn btn-primary"
                                    >
                                        {assigning === group.parent_phone
                                            ? '⏳ Assigning...'
                                            : group.coders.length > 1 ? 'Assign to All' : 'Assign'}
                                    </button>
                                    <button
                                        onClick={() => handleSkip(group.parent_phone)}
                                        className="btn btn-ghost"
                                    >
                                        Skip
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Refresh */}
            <button onClick={fetchUnassigned} className="btn" style={{ marginTop: 20 }}>
                🔄 Refresh List
            </button>
        </div>
    );
}
