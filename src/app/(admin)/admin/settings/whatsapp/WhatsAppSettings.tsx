'use client';

import { useState, useEffect, type CSSProperties } from 'react';
import type { WhatsAppStatus } from '@/lib/types/invoice';

export default function WhatsAppSettings() {
    const [status, setStatus] = useState<WhatsAppStatus | null>(null);
    const [loading, setLoading] = useState(true);
    const [connecting, setConnecting] = useState(false);
    const [disconnecting, setDisconnecting] = useState(false);
    const [resetting, setResetting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);
    const [logs, setLogs] = useState<Array<{
        id: string;
        category: string;
        payload: { invoice_number?: string; parent_name?: string };
        status: string;
        created_at: string;
    }>>([]);

    useEffect(() => {
        fetchStatus();
        fetchLogs();
    }, []);

    const fetchStatus = async () => {
        try {
            const res = await fetch('/api/whatsapp/status');
            if (res.ok) {
                const data = await res.json();
                setStatus(data);
            }
        } catch (err) {
            console.error('Error fetching status:', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchLogs = async () => {
        try {
            const res = await fetch('/api/whatsapp/logs?limit=20');
            if (res.ok) {
                const data = await res.json();
                setLogs(data.logs || []);
            }
        } catch (err) {
            console.error('Error fetching logs:', err);
        }
    };

    const handleConnect = async () => {
        setConnecting(true);
        setError(null);

        try {
            const res = await fetch('/api/whatsapp/connect', { method: 'POST' });
            const data = await res.json();

            if (data.success) {
                // Refresh status to get QR code
                await fetchStatus();
            } else {
                setError(data.error || 'Failed to connect');
            }
        } catch (err) {
            setError('Connection error: ' + String(err));
        } finally {
            setConnecting(false);
        }
    };

    const handleDisconnect = async () => {
        setDisconnecting(true);

        try {
            await fetch('/api/whatsapp/disconnect', { method: 'POST' });
            await fetchStatus();
        } catch (err) {
            setError('Disconnect error: ' + String(err));
        } finally {
            setDisconnecting(false);
        }
    };

    const handleForceReset = async () => {
        if (!confirm('Apakah Anda yakin ingin reset session WhatsApp? Anda harus scan QR code ulang setelah ini.')) {
            return;
        }

        setResetting(true);
        setError(null);
        setSuccessMsg(null);

        try {
            const res = await fetch('/api/whatsapp/reset', { method: 'POST' });
            const data = await res.json();

            if (data.success) {
                setSuccessMsg(data.message);
                await fetchStatus();
            } else {
                setError(data.message || 'Reset gagal');
            }
        } catch (err) {
            setError('Reset error: ' + String(err));
        } finally {
            setResetting(false);
        }
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleString('id-ID');
    };

    if (loading) {
        return <div style={loadingStyle}>Loading...</div>;
    }

    return (
        <div style={containerStyle}>
            {/* Connection Status Card */}
            <div style={cardStyle}>
                <h2 style={sectionTitleStyle}>📱 Status Koneksi</h2>

                <div style={statusContainerStyle}>
                    <div style={statusIndicatorStyle(status?.isConnected || false)}>
                        {status?.isConnected ? '🟢 Connected' : '🔴 Disconnected'}
                    </div>

                    {status?.connectedPhone && (
                        <p style={phoneInfoStyle}>
                            Terhubung dengan: <strong>{status.connectedPhone}</strong>
                        </p>
                    )}

                    {error && <p style={errorTextStyle}>{error}</p>}
                    {successMsg && <p style={successTextStyle}>{successMsg}</p>}
                </div>

                {/* QR Code Display */}
                {status?.qrCode && !status.isConnected && (
                    <div style={qrContainerStyle}>
                        <p style={qrInstructionStyle}>Scan QR Code dengan WhatsApp:</p>
                        <img src={status.qrCode} alt="WhatsApp QR Code" style={qrImageStyle} />
                        <p style={qrHelpStyle}>
                            Buka WhatsApp &gt; Menu &gt; Linked Devices &gt; Link a Device
                        </p>
                    </div>
                )}

                {/* Action Buttons */}
                <div style={actionsStyle}>
                    {!status?.isConnected ? (
                        <button
                            onClick={handleConnect}
                            disabled={connecting}
                            style={connectButtonStyle}
                        >
                            {connecting ? '⏳ Connecting...' : '🔗 Connect WhatsApp'}
                        </button>
                    ) : (
                        <button
                            onClick={handleDisconnect}
                            disabled={disconnecting}
                            style={disconnectButtonStyle}
                        >
                            {disconnecting ? '⏳ Disconnecting...' : '🔌 Disconnect'}
                        </button>
                    )}

                    <button onClick={fetchStatus} style={refreshButtonStyle}>
                        🔄 Refresh Status
                    </button>

                    <button
                        onClick={handleForceReset}
                        disabled={resetting}
                        style={resetButtonStyle}
                    >
                        {resetting ? '⏳ Resetting...' : '🔧 Force Reset'}
                    </button>
                </div>
            </div>

            {/* Instructions Card */}
            <div style={cardStyle}>
                <h2 style={sectionTitleStyle}>📋 Petunjuk Penggunaan</h2>
                <ol style={instructionsListStyle}>
                    <li>Klik tombol &quot;Connect WhatsApp&quot; untuk memulai koneksi.</li>
                    <li>QR Code akan muncul di layar.</li>
                    <li>Buka WhatsApp di HP Anda &gt; Menu (⋮) &gt; Linked Devices &gt; Link a Device.</li>
                    <li>Scan QR Code yang tampil di layar.</li>
                    <li>Tunggu hingga status berubah menjadi &quot;Connected&quot;.</li>
                    <li>Setelah terhubung, Anda dapat mengirim reminder invoice dari halaman Invoice Management.</li>
                </ol>

                <div style={warningBoxStyle}>
                    <p style={warningTitleStyle}>⚠️ Penting:</p>
                    <ul style={warningListStyle}>
                        <li>Koneksi WhatsApp harus tetap aktif untuk mengirim pesan.</li>
                        <li>Jika server restart, Anda perlu scan QR Code ulang.</li>
                        <li>Pastikan HP terhubung ke internet saat mengirim pesan.</li>
                    </ul>
                </div>
            </div>

            {/* Message Logs Card */}
            <div style={cardStyle}>
                <div style={logsHeaderStyle}>
                    <h2 style={sectionTitleStyle}>📜 Log Pesan Terakhir</h2>
                    <button onClick={fetchLogs} style={refreshSmallButtonStyle}>🔄</button>
                </div>

                {logs.length === 0 ? (
                    <p style={emptyLogsStyle}>Belum ada log pesan</p>
                ) : (
                    <div style={logsTableContainerStyle}>
                        <table style={tableStyle}>
                            <thead>
                                <tr>
                                    <th style={thStyle}>Waktu</th>
                                    <th style={thStyle}>Invoice</th>
                                    <th style={thStyle}>Penerima</th>
                                    <th style={thStyle}>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {logs.map((log) => (
                                    <tr key={log.id}>
                                        <td style={tdStyle}>{formatDate(log.created_at)}</td>
                                        <td style={tdStyle}>{log.payload?.invoice_number || '-'}</td>
                                        <td style={tdStyle}>{log.payload?.parent_name || '-'}</td>
                                        <td style={tdStyle}>
                                            <span style={getLogStatusStyle(log.status)}>
                                                {log.status}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}

// Styles
const containerStyle: CSSProperties = { maxWidth: '800px' };
const loadingStyle: CSSProperties = { padding: '40px', textAlign: 'center', color: '#64748b' };
const cardStyle: CSSProperties = { backgroundColor: '#fff', padding: '24px', borderRadius: '12px', marginBottom: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' };
const sectionTitleStyle: CSSProperties = { fontSize: '16px', fontWeight: 600, marginBottom: '16px', color: '#1e293b', margin: 0 };

const statusContainerStyle: CSSProperties = { marginBottom: '20px' };
const statusIndicatorStyle = (connected: boolean): CSSProperties => ({
    display: 'inline-block',
    padding: '8px 16px',
    borderRadius: '20px',
    fontSize: '14px',
    fontWeight: 600,
    backgroundColor: connected ? '#e8f5e9' : '#ffebee',
    color: connected ? '#2e7d32' : '#c62828'
});
const phoneInfoStyle: CSSProperties = { marginTop: '12px', color: '#64748b' };
const errorTextStyle: CSSProperties = { color: '#c62828', marginTop: '12px' };

const qrContainerStyle: CSSProperties = { textAlign: 'center', padding: '20px', backgroundColor: '#f8fafc', borderRadius: '12px', marginBottom: '20px' };
const qrInstructionStyle: CSSProperties = { marginBottom: '16px', fontWeight: 500 };
const qrImageStyle: CSSProperties = { maxWidth: '280px', borderRadius: '8px' };
const qrHelpStyle: CSSProperties = { marginTop: '16px', color: '#64748b', fontSize: '14px' };

const actionsStyle: CSSProperties = { display: 'flex', gap: '12px', flexWrap: 'wrap' };
const connectButtonStyle: CSSProperties = { backgroundColor: '#25d366', color: '#fff', border: 'none', padding: '12px 24px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 };
const disconnectButtonStyle: CSSProperties = { backgroundColor: '#ef4444', color: '#fff', border: 'none', padding: '12px 24px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 };
const refreshButtonStyle: CSSProperties = { backgroundColor: '#f1f5f9', color: '#475569', border: 'none', padding: '12px 24px', borderRadius: '8px', cursor: 'pointer', fontWeight: 500 };
const resetButtonStyle: CSSProperties = { backgroundColor: '#fef3c7', color: '#d97706', border: 'none', padding: '12px 24px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 };
const successTextStyle: CSSProperties = { color: '#16a34a', marginTop: '12px', fontWeight: 500 };

const instructionsListStyle: CSSProperties = { paddingLeft: '20px', lineHeight: '1.8', color: '#475569' };
const warningBoxStyle: CSSProperties = { backgroundColor: '#fff3e0', padding: '16px', borderRadius: '8px', marginTop: '16px' };
const warningTitleStyle: CSSProperties = { fontWeight: 600, marginBottom: '8px', color: '#e65100' };
const warningListStyle: CSSProperties = { paddingLeft: '20px', margin: 0, color: '#bf360c', fontSize: '14px' };

const logsHeaderStyle: CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' };
const refreshSmallButtonStyle: CSSProperties = { background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px' };
const emptyLogsStyle: CSSProperties = { color: '#94a3b8', textAlign: 'center', padding: '20px' };
const logsTableContainerStyle: CSSProperties = { overflowX: 'auto' };
const tableStyle: CSSProperties = { width: '100%', borderCollapse: 'collapse' };
const thStyle: CSSProperties = { textAlign: 'left', padding: '10px 12px', backgroundColor: '#f8fafc', color: '#64748b', fontSize: '12px', fontWeight: 600 };
const tdStyle: CSSProperties = { padding: '10px 12px', borderBottom: '1px solid #f1f5f9', fontSize: '14px' };
const getLogStatusStyle = (status: string): CSSProperties => ({
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: '10px',
    fontSize: '11px',
    fontWeight: 600,
    backgroundColor: status === 'SENT' ? '#e8f5e9' : '#ffebee',
    color: status === 'SENT' ? '#2e7d32' : '#c62828'
});
