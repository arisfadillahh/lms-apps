'use client';

import { useState, useEffect, type CSSProperties } from 'react';

interface Coder {
    id: string;
    full_name: string;
    class_name?: string;
    level_name?: string;
}

interface ParentGroup {
    parent_phone: string;
    parent_name: string;
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

            // Initialize CCR inputs with suggested next CCR
            const inputs: Record<string, string> = {};
            let currentSeq = parseInt(data.nextCCR?.substring(3) || '1', 10);
            for (const group of data.groups || []) {
                inputs[group.parent_phone] = `CCR${String(currentSeq).padStart(3, '0')}`;
                currentSeq++;
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
                body: JSON.stringify({
                    parent_phone: parentPhone,
                    ccr_code: ccrCode,
                    parent_name: parentName
                })
            });

            const data = await res.json();

            if (res.ok && data.success) {
                setMessage({ type: 'success', text: `CCR ${ccrCode} assigned successfully!` });
                // Remove from list
                setGroups(prev => prev.filter(g => g.parent_phone !== parentPhone));
            } else {
                setMessage({ type: 'error', text: data.error || 'Failed to assign CCR' });
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
        return <div style={loadingStyle}>Loading...</div>;
    }

    return (
        <div style={containerStyle}>
            {message && (
                <div style={message.type === 'success' ? successStyle : errorStyle}>
                    {message.text}
                </div>
            )}

            {/* Stats */}
            <div style={statsStyle}>
                <div style={statCardStyle}>
                    <p style={statLabelStyle}>Belum Punya CCR</p>
                    <p style={statValueStyle}>{groups.length} Keluarga</p>
                </div>
                <div style={statCardStyle}>
                    <p style={statLabelStyle}>Next Available CCR</p>
                    <p style={statValueStyle}>{nextCCR}</p>
                </div>
            </div>

            {groups.length === 0 ? (
                <div style={emptyStyle}>
                    ✅ Semua coder sudah memiliki CCR number!
                </div>
            ) : (
                <div style={listStyle}>
                    {groups.map((group) => (
                        <div key={group.parent_phone} style={cardStyle}>
                            <div style={cardHeaderStyle}>
                                <div>
                                    <h3 style={parentNameStyle}>
                                        Parent: {group.parent_name}
                                    </h3>
                                    <p style={phoneStyle}>{group.parent_phone}</p>
                                </div>
                                <span style={badgeStyle}>
                                    {group.coders.length} Anak
                                </span>
                            </div>

                            <div style={codersListStyle}>
                                {group.coders.map((coder) => (
                                    <div key={coder.id} style={coderItemStyle}>
                                        <span style={coderNameStyle}>• {coder.full_name}</span>
                                        <span style={coderInfoStyle}>
                                            {coder.level_name}{coder.class_name ? `, ${coder.class_name}` : ''}
                                        </span>
                                    </div>
                                ))}
                            </div>

                            <div style={formRowStyle}>
                                <div style={inputGroupStyle}>
                                    <label style={labelStyle}>CCR Number:</label>
                                    <input
                                        type="text"
                                        value={ccrInputs[group.parent_phone] || ''}
                                        onChange={(e) => setCcrInputs(prev => ({
                                            ...prev,
                                            [group.parent_phone]: e.target.value.toUpperCase()
                                        }))}
                                        placeholder="CCR001"
                                        style={inputStyle}
                                    />
                                    <span style={hintStyle}>Next available: {nextCCR}</span>
                                </div>

                                <div style={actionsStyle}>
                                    <button
                                        onClick={() => handleAssign(group.parent_phone, group.parent_name)}
                                        disabled={assigning === group.parent_phone}
                                        style={assignButtonStyle}
                                    >
                                        {assigning === group.parent_phone
                                            ? '...'
                                            : group.coders.length > 1
                                                ? 'Assign to All'
                                                : 'Assign'
                                        }
                                    </button>
                                    <button
                                        onClick={() => handleSkip(group.parent_phone)}
                                        style={skipButtonStyle}
                                    >
                                        Skip
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Refresh button */}
            <button onClick={fetchUnassigned} style={refreshButtonStyle}>
                🔄 Refresh List
            </button>
        </div>
    );
}

// Styles
const containerStyle: CSSProperties = { maxWidth: '800px' };
const loadingStyle: CSSProperties = { padding: '40px', textAlign: 'center', color: '#64748b' };
const successStyle: CSSProperties = { backgroundColor: '#e8f5e9', color: '#2e7d32', padding: '12px 16px', borderRadius: '8px', marginBottom: '20px' };
const errorStyle: CSSProperties = { backgroundColor: '#ffebee', color: '#c62828', padding: '12px 16px', borderRadius: '8px', marginBottom: '20px' };
const statsStyle: CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' };
const statCardStyle: CSSProperties = { backgroundColor: '#fff', padding: '16px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' };
const statLabelStyle: CSSProperties = { color: '#64748b', fontSize: '12px', marginBottom: '4px' };
const statValueStyle: CSSProperties = { fontSize: '20px', fontWeight: 'bold', color: '#1e293b' };
const emptyStyle: CSSProperties = { backgroundColor: '#e8f5e9', padding: '40px', borderRadius: '12px', textAlign: 'center', color: '#2e7d32', fontSize: '16px' };
const listStyle: CSSProperties = { display: 'flex', flexDirection: 'column', gap: '16px' };
const cardStyle: CSSProperties = { backgroundColor: '#fff', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: '1px solid #e2e8f0' };
const cardHeaderStyle: CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' };
const parentNameStyle: CSSProperties = { fontSize: '16px', fontWeight: 600, color: '#1e293b', margin: 0 };
const phoneStyle: CSSProperties = { fontSize: '14px', color: '#64748b', marginTop: '4px' };
const badgeStyle: CSSProperties = { backgroundColor: '#eff6ff', color: '#3b82f6', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 600 };
const codersListStyle: CSSProperties = { backgroundColor: '#f8fafc', padding: '12px', borderRadius: '8px', marginBottom: '16px' };
const coderItemStyle: CSSProperties = { display: 'flex', justifyContent: 'space-between', padding: '6px 0' };
const coderNameStyle: CSSProperties = { fontWeight: 500, color: '#1e293b' };
const coderInfoStyle: CSSProperties = { color: '#64748b', fontSize: '13px' };
const formRowStyle: CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '16px', flexWrap: 'wrap' };
const inputGroupStyle: CSSProperties = { flex: 1, minWidth: '200px' };
const labelStyle: CSSProperties = { display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '6px', color: '#374151' };
const inputStyle: CSSProperties = { width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '14px', fontWeight: 600 };
const hintStyle: CSSProperties = { fontSize: '12px', color: '#94a3b8', marginTop: '4px', display: 'block' };
const actionsStyle: CSSProperties = { display: 'flex', gap: '8px' };
const assignButtonStyle: CSSProperties = { backgroundColor: '#3b82f6', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 };
const skipButtonStyle: CSSProperties = { backgroundColor: '#f1f5f9', color: '#64748b', border: 'none', padding: '10px 16px', borderRadius: '8px', cursor: 'pointer' };
const refreshButtonStyle: CSSProperties = { backgroundColor: '#f1f5f9', color: '#475569', border: 'none', padding: '12px 24px', borderRadius: '8px', cursor: 'pointer', marginTop: '24px', fontWeight: 500 };
