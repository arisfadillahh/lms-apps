'use client';

import { useState, useEffect, type CSSProperties } from 'react';

interface CCR {
    id: string;
    ccr_code: string;
    parent_phone: string;
    parent_name: string;
    ccr_sequence: number;
    created_at: string;
}

export default function CCRList() {
    const [ccrs, setCcrs] = useState<CCR[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editCode, setEditCode] = useState('');
    const [editParentName, setEditParentName] = useState('');
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    useEffect(() => {
        fetchCCRs();
    }, []);

    const fetchCCRs = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/ccr');
            const data = await res.json();
            setCcrs(data.ccrs || []);
        } catch (error) {
            console.error('Error fetching CCRs:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleEdit = (ccr: CCR) => {
        setEditingId(ccr.id);
        setEditCode(ccr.ccr_code);
        setEditParentName(ccr.parent_name);
    };

    const handleCancelEdit = () => {
        setEditingId(null);
        setEditCode('');
        setEditParentName('');
    };

    const handleSave = async (id: string) => {
        setSaving(true);
        setMessage(null);
        try {
            const res = await fetch(`/api/ccr/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ccr_code: editCode,
                    parent_name: editParentName
                })
            });
            const data = await res.json();

            if (res.ok && data.success) {
                setMessage({ type: 'success', text: 'ID Invoice berhasil diupdate!' });
                setEditingId(null);
                await fetchCCRs();
            } else {
                setMessage({ type: 'error', text: data.error || 'Gagal update' });
            }
        } catch (error) {
            setMessage({ type: 'error', text: 'Error: ' + String(error) });
        } finally {
            setSaving(false);
        }
    };

    const filteredCCRs = ccrs.filter(ccr =>
        ccr.ccr_code.toLowerCase().includes(search.toLowerCase()) ||
        ccr.parent_name.toLowerCase().includes(search.toLowerCase()) ||
        ccr.parent_phone.includes(search)
    );

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
                    <p style={statLabelStyle}>Total ID Invoice</p>
                    <p style={statValueStyle}>{ccrs.length}</p>
                </div>
            </div>

            {/* Search */}
            <div style={searchContainerStyle}>
                <input
                    type="text"
                    placeholder="Cari ID Invoice, nama orang tua, atau nomor HP..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    style={searchInputStyle}
                />
            </div>

            {/* Table */}
            <div style={tableContainerStyle}>
                <table style={tableStyle}>
                    <thead>
                        <tr>
                            <th style={thStyle}>ID Invoice</th>
                            <th style={thStyle}>Nama Orang Tua</th>
                            <th style={thStyle}>No. HP</th>
                            <th style={thStyle}>Tanggal Dibuat</th>
                            <th style={thStyle}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredCCRs.length === 0 ? (
                            <tr>
                                <td colSpan={5} style={emptyStyle}>
                                    {search ? 'Tidak ada hasil untuk pencarian ini' : 'Belum ada ID Invoice'}
                                </td>
                            </tr>
                        ) : (
                            filteredCCRs.map((ccr) => (
                                <tr key={ccr.id} style={rowStyle}>
                                    <td style={tdStyle}>
                                        {editingId === ccr.id ? (
                                            <input
                                                type="text"
                                                value={editCode}
                                                onChange={(e) => setEditCode(e.target.value.toUpperCase())}
                                                style={editInputStyle}
                                            />
                                        ) : (
                                            <span style={codeStyle}>{ccr.ccr_code}</span>
                                        )}
                                    </td>
                                    <td style={tdStyle}>
                                        {editingId === ccr.id ? (
                                            <input
                                                type="text"
                                                value={editParentName}
                                                onChange={(e) => setEditParentName(e.target.value)}
                                                style={editInputStyle}
                                            />
                                        ) : (
                                            ccr.parent_name
                                        )}
                                    </td>
                                    <td style={tdStyle}>{ccr.parent_phone}</td>
                                    <td style={tdStyle}>
                                        {new Date(ccr.created_at).toLocaleDateString('id-ID', {
                                            day: 'numeric', month: 'short', year: 'numeric'
                                        })}
                                    </td>
                                    <td style={tdStyle}>
                                        {editingId === ccr.id ? (
                                            <div style={actionsStyle}>
                                                <button
                                                    onClick={() => handleSave(ccr.id)}
                                                    disabled={saving}
                                                    style={saveButtonStyle}
                                                >
                                                    {saving ? '...' : '💾 Simpan'}
                                                </button>
                                                <button
                                                    onClick={handleCancelEdit}
                                                    style={cancelButtonStyle}
                                                >
                                                    Batal
                                                </button>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => handleEdit(ccr)}
                                                style={editButtonStyle}
                                            >
                                                ✏️ Edit
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Refresh */}
            <button onClick={fetchCCRs} style={refreshButtonStyle}>
                🔄 Refresh
            </button>
        </div>
    );
}

// Styles
const containerStyle: CSSProperties = { maxWidth: '1000px' };
const loadingStyle: CSSProperties = { padding: '40px', textAlign: 'center', color: '#64748b' };
const successStyle: CSSProperties = { backgroundColor: '#e8f5e9', color: '#2e7d32', padding: '12px 16px', borderRadius: '8px', marginBottom: '20px' };
const errorStyle: CSSProperties = { backgroundColor: '#ffebee', color: '#c62828', padding: '12px 16px', borderRadius: '8px', marginBottom: '20px' };
const statsStyle: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' };
const statCardStyle: CSSProperties = { backgroundColor: '#fff', padding: '16px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' };
const statLabelStyle: CSSProperties = { color: '#64748b', fontSize: '12px', marginBottom: '4px' };
const statValueStyle: CSSProperties = { fontSize: '24px', fontWeight: 'bold', color: '#1e293b' };
const searchContainerStyle: CSSProperties = { marginBottom: '20px' };
const searchInputStyle: CSSProperties = { width: '100%', maxWidth: '400px', padding: '12px 16px', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '14px', outline: 'none' };
const tableContainerStyle: CSSProperties = { backgroundColor: '#fff', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: '1px solid #e2e8f0' };
const tableStyle: CSSProperties = { width: '100%', borderCollapse: 'collapse' };
const thStyle: CSSProperties = { textAlign: 'left', padding: '12px 16px', backgroundColor: '#f8fafc', fontSize: '12px', fontWeight: 600, color: '#64748b', borderBottom: '1px solid #e2e8f0', textTransform: 'uppercase' };
const tdStyle: CSSProperties = { padding: '12px 16px', borderBottom: '1px solid #f1f5f9', color: '#334155', fontSize: '14px' };
const rowStyle: CSSProperties = { transition: 'background 0.2s' };
const emptyStyle: CSSProperties = { padding: '40px', textAlign: 'center', color: '#94a3b8' };
const codeStyle: CSSProperties = { fontWeight: 700, color: '#3b82f6', fontFamily: 'monospace', fontSize: '15px' };
const editInputStyle: CSSProperties = { padding: '6px 10px', borderRadius: '6px', border: '1px solid #3b82f6', fontSize: '14px', width: '100%', outline: 'none' };
const actionsStyle: CSSProperties = { display: 'flex', gap: '8px' };
const editButtonStyle: CSSProperties = { padding: '6px 12px', backgroundColor: '#f1f5f9', color: '#475569', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 500 };
const saveButtonStyle: CSSProperties = { padding: '6px 12px', backgroundColor: '#3b82f6', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 500 };
const cancelButtonStyle: CSSProperties = { padding: '6px 12px', backgroundColor: '#f1f5f9', color: '#64748b', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' };
const refreshButtonStyle: CSSProperties = { backgroundColor: '#f1f5f9', color: '#475569', border: 'none', padding: '12px 24px', borderRadius: '8px', cursor: 'pointer', marginTop: '24px', fontWeight: 500 };
