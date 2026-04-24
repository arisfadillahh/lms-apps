'use client';

import { useState, useEffect } from 'react';

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
                body: JSON.stringify({ ccr_code: editCode, parent_name: editParentName })
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
        return <div className="empty">Memuat data...</div>;
    }

    return (
        <div>
            {/* Message */}
            {message && (
                <div
                    className={message.type === 'success' ? 'badge badge-success' : 'badge badge-danger'}
                    style={{ display: 'block', padding: '10px 14px', borderRadius: 'var(--radius)', marginBottom: 16, fontSize: 13 }}
                >
                    {message.type === 'success' ? '✅' : '❌'} {message.text}
                </div>
            )}

            {/* Stats + Search row */}
            <div className="row gap-3 between" style={{ marginBottom: 18, flexWrap: 'wrap' }}>
                <div className="stat" style={{ flex: '0 0 auto', minWidth: 160 }}>
                    <div className="stat-label">Total ID Invoice</div>
                    <div className="stat-value">{ccrs.length}</div>
                    <div className="stat-icon">🆔</div>
                </div>
                <div style={{ flex: 1, maxWidth: 380, alignSelf: 'flex-end' }}>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.05em' }}>
                        Cari
                    </label>
                    <input
                        type="text"
                        placeholder="Cari ID Invoice, nama orang tua, atau No. HP..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="input"
                    />
                </div>
            </div>

            {/* Table */}
            <div className="card" style={{ padding: 0 }}>
                <table className="table">
                    <thead>
                        <tr>
                            <th>ID Invoice</th>
                            <th>Nama Orang Tua</th>
                            <th>No. HP</th>
                            <th>Tanggal Dibuat</th>
                            <th style={{ textAlign: 'right' }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredCCRs.length === 0 ? (
                            <tr>
                                <td colSpan={5} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-dim)' }}>
                                    {search ? 'Tidak ada hasil untuk pencarian ini' : 'Belum ada ID Invoice'}
                                </td>
                            </tr>
                        ) : (
                            filteredCCRs.map((ccr) => (
                                <tr key={ccr.id}>
                                    <td>
                                        {editingId === ccr.id ? (
                                            <input
                                                type="text"
                                                value={editCode}
                                                onChange={(e) => setEditCode(e.target.value.toUpperCase())}
                                                className="input mono"
                                                style={{ padding: '5px 8px', width: 110, fontWeight: 700 }}
                                            />
                                        ) : (
                                            <span className="mono" style={{ fontWeight: 700, color: 'var(--accent)', fontSize: 13.5 }}>
                                                {ccr.ccr_code}
                                            </span>
                                        )}
                                    </td>
                                    <td>
                                        {editingId === ccr.id ? (
                                            <input
                                                type="text"
                                                value={editParentName}
                                                onChange={(e) => setEditParentName(e.target.value)}
                                                className="input"
                                                style={{ padding: '5px 8px' }}
                                            />
                                        ) : (
                                            <span style={{ fontWeight: 600 }}>{ccr.parent_name}</span>
                                        )}
                                    </td>
                                    <td className="muted mono" style={{ fontSize: 12.5 }}>{ccr.parent_phone}</td>
                                    <td className="muted" style={{ fontSize: 12.5 }}>
                                        {new Date(ccr.created_at).toLocaleDateString('id-ID', {
                                            day: 'numeric', month: 'short', year: 'numeric'
                                        })}
                                    </td>
                                    <td style={{ textAlign: 'right' }}>
                                        {editingId === ccr.id ? (
                                            <div className="row gap-1" style={{ justifyContent: 'flex-end' }}>
                                                <button
                                                    onClick={() => handleSave(ccr.id)}
                                                    disabled={saving}
                                                    className="btn btn-sm btn-primary"
                                                >
                                                    {saving ? '...' : '💾 Simpan'}
                                                </button>
                                                <button onClick={handleCancelEdit} className="btn btn-sm btn-ghost">
                                                    Batal
                                                </button>
                                            </div>
                                        ) : (
                                            <button onClick={() => handleEdit(ccr)} className="btn btn-sm btn-ghost">
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
            <button onClick={fetchCCRs} className="btn" style={{ marginTop: 16 }}>
                🔄 Refresh
            </button>
        </div>
    );
}
