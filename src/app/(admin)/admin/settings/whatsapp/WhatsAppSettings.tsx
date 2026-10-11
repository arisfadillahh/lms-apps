'use client';

import { useState, useEffect, type CSSProperties } from 'react';
import type { InvoiceSettings, WhatsAppStatus } from '@/lib/types/invoice';
import { renderClassReminderMessage } from '@/lib/classDelivery';
import { resolveClassReminderTemplate } from '@/lib/classReminderTemplates';

interface ExtendedStatus extends WhatsAppStatus {
    serverTime?: string;
}

export default function WhatsAppSettings() {
    const [status, setStatus] = useState<ExtendedStatus | null>(null);
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



    // Invoice Settings State (for Class Reminder)
    const [invoiceSettings, setInvoiceSettings] = useState<Partial<InvoiceSettings>>({});
    const [savingSettings, setSavingSettings] = useState(false);
    const [settingsMsg, setSettingsMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    // Test Modal State
    const [showTestModal, setShowTestModal] = useState(false);
    const [testPhone, setTestPhone] = useState('');
    const [testStudent, setTestStudent] = useState<any>(null); // { name, time, zoom_link, parent_name }
    const [availableStudents, setAvailableStudents] = useState<any[]>([]); // List of students with sessions today
    const [loadingStudents, setLoadingStudents] = useState(false);
    const [sendingTest, setSendingTest] = useState(false);
    const [testMsg, setTestMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    useEffect(() => {
        fetchStatus();
        fetchLogs();
        fetchInvoiceSettings();
    }, []);

    const fetchInvoiceSettings = async () => {
        try {
            const res = await fetch('/api/invoices/settings');
            if (res.ok) {
                const data = await res.json();

                // Set default template if empty
                if (!data.class_reminder_message_template) {
                    data.class_reminder_message_template = `Halo Ayah/Bunda {parent_name} 👋

Reminder kelas coding untuk:
💻 {student_name}
🕒 Pukul: {time}
🔗 Zoom: {zoom_link}

Mohon hadir tepat waktu ya. Terima kasih! 🙏`;
                }

                setInvoiceSettings(data);
            }
        } catch (err) {
            console.error('Error fetching invoice settings:', err);
        }
    };

    const handleSettingChange = (field: string, value: any) => {
        setInvoiceSettings(prev => ({ ...prev, [field]: value }));
    };

    const handleSaveSettings = async () => {
        setSavingSettings(true);
        setSettingsMsg(null);
        try {
            const res = await fetch('/api/invoices/settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(invoiceSettings)
            });

            if (res.ok) {
                setSettingsMsg({ type: 'success', text: 'Settings saved successfully!' });
            } else {
                const data = await res.json();
                setSettingsMsg({ type: 'error', text: data.error || 'Failed to save settings' });
            }
        } catch (error) {
            setSettingsMsg({ type: 'error', text: 'Error: ' + String(error) });
        } finally {
            setSavingSettings(false);
        }
    };

    const fetchTodayStudents = async () => {
        setLoadingStudents(true);
        try {
            // We reuse the existing sessions API or create a focused one. 
            // For now, let's assume we create a quick helper or reuse an existing route. 
            // Actually, best to just create a quick server action or route. 
            // Let's use a new route /api/sessions/today-simple for this specific UI need if possible, 
            // OR reuse the cron logic but that's internal.
            // Let's TRY to fetch the cron job logic results WITHOUT sending? No.
            // Let's fetch from the generic sessions endpoint if available?
            // To be safe and quick, I'll add a specific logic here to fetch via a new dedicated small endpoint or just list sessions.
            // Wait, we don't have a simple endpoint. Let's add a `fetchStudents` logic in the component that calls a new endpoint.
            // I'll create `api/sessions/today-options` effectively.

            // Re-using the logic from `classReminderScheduler` but exposed as API? 
            // Let's make a new endpoint: /api/admin/sessions/today
            const res = await fetch('/api/admin/sessions/today'); // I will create this next
            if (res.ok) {
                const data = await res.json();
                setAvailableStudents(data.students || []);
            }
        } catch (err) {
            console.error('Error fetching students:', err);
        } finally {
            setLoadingStudents(false);
        }
    };

    const handleOpenTestModal = () => {
        setShowTestModal(true);
        fetchTodayStudents();
    };

    const handleSendTest = async () => {
        if (!testPhone || !testStudent) {
            setTestMsg({ type: 'error', text: 'Pilih siswa dan isi nomor WA.' });
            return;
        }

        setSendingTest(true);
        setTestMsg(null);

        try {
            const klass = {
                name: testStudent.class_name,
                delivery_mode: testStudent.delivery_mode,
                zoom_link: testStudent.zoom_link,
                location_name: testStudent.location_name,
                location_address: testStudent.location_address,
                location_maps_url: testStudent.location_maps_url,
            } as const;
            const msg = renderClassReminderMessage({
                template: resolveClassReminderTemplate(klass, {}, invoiceSettings.class_reminder_message_template),
                parentName: testStudent.parent_name || 'Ayah/Bunda',
                studentNames: [testStudent.student_name],
                time: testStudent.time,
                klass,
            });

            const res = await fetch('/api/whatsapp/test-reminder', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    phone: testPhone,
                    message: msg,
                    studentName: testStudent.student_name
                })
            });

            const data = await res.json();
            if (res.ok && data.success) {
                setTestMsg({ type: 'success', text: 'Pesan tes terkirim!' });
            } else {
                setTestMsg({ type: 'error', text: data.error || 'Gagal mengirim pesan.' });
            }
        } catch (error) {
            setTestMsg({ type: 'error', text: 'Error: ' + String(error) });
        } finally {
            setSendingTest(false);
        }
    };

    // Auto-connect and poll for QR when not connected
    useEffect(() => {
        if (loading) return;

        // If not connected and no QR, trigger connect
        if (!status?.isConnected && !status?.qrCode && !connecting) {
            console.log('[WhatsAppSettings] Auto-triggering connect...');
            handleConnectSilent();
        }

        // Poll for status every 3 seconds while waiting for QR or connection
        let pollInterval: NodeJS.Timeout | null = null;
        if (!status?.isConnected) {
            pollInterval = setInterval(() => {
                fetchStatus();
            }, 3000);
        }

        return () => {
            if (pollInterval) clearInterval(pollInterval);
        };
    }, [loading, status?.isConnected, status?.qrCode]);

    // Silent connect (no UI feedback, used for auto-connect)
    const handleConnectSilent = async () => {
        setConnecting(true);
        try {
            await fetch('/api/whatsapp/connect', { method: 'POST' });
            await fetchStatus();
        } catch (err) {
            console.error('Auto-connect error:', err);
        } finally {
            setConnecting(false);
        }
    };

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

            {/* Class Reminder Settings Card */}
            <div style={cardStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <h2 style={{ ...sectionTitleStyle, marginBottom: 0 }}>⏰ Reminder Kelas Hari Ini</h2>
                        {status?.serverTime && (
                            <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 500, marginTop: '4px' }}>
                                🕒 Server Time: {status.serverTime} (WIB)
                            </span>
                        )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <label style={{ fontSize: '14px', fontWeight: 600, color: invoiceSettings.enable_class_reminder ? '#2e7d32' : '#64748b' }}>
                            {invoiceSettings.enable_class_reminder ? 'AKTIF' : 'NON-AKTIF'}
                        </label>
                        <input
                            type="checkbox"
                            checked={invoiceSettings.enable_class_reminder || false}
                            onChange={(e) => handleSettingChange('enable_class_reminder', e.target.checked)}
                            style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                        />
                    </div>
                </div>

                {settingsMsg && (
                    <div style={settingsMsg.type === 'success' ? successStyle : errorStyle}>
                        {settingsMsg.text}
                    </div>
                )}

                <div style={{ /* opacity: invoiceSettings.enable_class_reminder ? 1 : 0.6, pointerEvents: invoiceSettings.enable_class_reminder ? 'auto' : 'none', transition: 'opacity 0.2s' */ }}>
                    <div style={formGroupStyle}>
                        <label style={labelStyle}>Waktu Pengiriman</label>
                        <input
                            type="time"
                            value={invoiceSettings.class_reminder_time || '09:00'}
                            onChange={(e) => handleSettingChange('class_reminder_time', e.target.value)}
                            style={inputStyle}
                        />
                        <p style={helpTextStyle}>Jam berapa sistem akan mulai mengecek dan mengirim reminder (WIB/Server Time).</p>
                    </div>

                    <div style={formRowStyle}>
                        <div style={formGroupStyle}>
                            <label style={labelStyle}>Min Delay (detik)</label>
                            <input
                                type="number"
                                min={1}
                                value={invoiceSettings.class_reminder_delay_min || 5}
                                onChange={(e) => handleSettingChange('class_reminder_delay_min', parseInt(e.target.value))}
                                style={inputStyle}
                            />
                        </div>
                        <div style={formGroupStyle}>
                            <label style={labelStyle}>Max Delay (detik)</label>
                            <input
                                type="number"
                                min={1}
                                value={invoiceSettings.class_reminder_delay_max || 15}
                                onChange={(e) => handleSettingChange('class_reminder_delay_max', parseInt(e.target.value))}
                                style={inputStyle}
                            />
                        </div>
                    </div>

                    <div style={{ ...formGroupStyle, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: 14 }}>
                        <strong style={{ color: '#0f172a' }}>Template pesan dipisah berdasarkan jenis kelas</strong>
                        <p style={{ ...helpTextStyle, marginBottom: 8 }}>Atur template Online dan Offline di halaman Template WhatsApp agar pengaturan jadwal tidak tercampur dengan isi pesan.</p>
                        <a href="/admin/whatsapp/templates" style={{ color: '#15803d', fontWeight: 600, fontSize: 13 }}>Buka Template WhatsApp →</a>
                    </div>

                    <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'space-between' }}>
                        <button onClick={handleOpenTestModal} style={testButtonStyle}>
                            🧪 Tes Kirim Pesan
                        </button>
                        <button onClick={handleSaveSettings} disabled={savingSettings} style={saveButtonStyle}>
                            {savingSettings ? 'Saving...' : '💾 Simpan Konfigurasi'}
                        </button>
                    </div>
                </div>

                {/* Test Modal (Simple implementation) */}
                {showTestModal && (
                    <div style={modalOverlayStyle}>
                        <div style={modalContentStyle}>
                            <h3 style={{ marginTop: 0 }}>🧪 Tes Kirim Reminder</h3>

                            {testMsg && (
                                <div style={testMsg.type === 'success' ? successStyle : errorStyle}>
                                    {testMsg.text}
                                </div>
                            )}

                            <div style={formGroupStyle}>
                                <label style={labelStyle}>Nomor WhatsApp Tujuan</label>
                                <input
                                    type="text"
                                    value={testPhone}
                                    onChange={(e) => setTestPhone(e.target.value)}
                                    placeholder="0812xxx"
                                    style={inputStyle}
                                />
                            </div>

                            <div style={formGroupStyle}>
                                <label style={labelStyle}>Sampel Siswa (dari sesi hari ini)</label>
                                {loadingStudents ? (
                                    <p>Loading students...</p>
                                ) : availableStudents.length === 0 ? (
                                    <p style={{ color: '#c62828' }}>Tidak ada sesi kelas hari ini untuk ditest.</p>
                                ) : (
                                    <select
                                        style={inputStyle}
                                        onChange={(e) => {
                                            const selected = availableStudents.find(s => s.id === e.target.value);
                                            setTestStudent(selected);
                                        }}
                                        value={testStudent?.id || ''}
                                    >
                                        <option value="">-- Pilih Siswa --</option>
                                        {availableStudents.map(s => (
                                            <option key={s.id} value={s.id}>
                                                {s.student_name} ({s.time})
                                            </option>
                                        ))}
                                    </select>
                                )}
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                                <button onClick={() => setShowTestModal(false)} style={cancelButtonStyle}>Tutup</button>
                                <button
                                    onClick={handleSendTest}
                                    disabled={sendingTest || !testStudent}
                                    style={connectButtonStyle}
                                >
                                    {sendingTest ? 'Mengirim...' : 'Kirim Pesan'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
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
                                {logs.map((log) => {
                                    const payloadType = (log.payload as any)?.type;
                                    const isClassReminder = payloadType === 'CLASS_REMINDER';
                                    const isInvoiceReminder = log.category === 'REMINDER' && !isClassReminder;

                                    const invoiceNum = (log.payload as any)?.invoice_number || '-';
                                    const studentName = (log.payload as any)?.student_name || '-';
                                    const refText = isClassReminder ? `Class: ${studentName}` :
                                        isInvoiceReminder ? `Invoice: ${invoiceNum}` :
                                            invoiceNum;
                                    const recipient = (log.payload as any)?.parent_name || '-';

                                    // Display category name
                                    const categoryDisplay = isClassReminder ? 'CLASS REMINDER' :
                                        log.category.replace(/_/g, ' ');

                                    return (
                                        <tr key={log.id}>
                                            <td style={tdStyle}>
                                                <div style={{ fontSize: '12px', color: '#64748b' }}>
                                                    {formatDate(log.created_at)}
                                                </div>
                                                <div style={{ fontSize: '10px', fontWeight: 600, color: '#0f172a' }}>
                                                    {categoryDisplay}
                                                </div>
                                            </td>
                                            <td style={tdStyle}>{refText}</td>
                                            <td style={tdStyle}>{recipient}</td>
                                            <td style={tdStyle}>
                                                <span style={getLogStatusStyle(log.status)}>
                                                    {log.status}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
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

// Added missing styles for form
const formRowStyle: CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' };
const formGroupStyle: CSSProperties = { marginBottom: '16px' };
const labelStyle: CSSProperties = { display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: 500, color: '#374151' };
const inputStyle: CSSProperties = { width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '14px', boxSizing: 'border-box' };
const textareaStyle: CSSProperties = { ...inputStyle, fontFamily: 'monospace', resize: 'vertical' };
const helpTextStyle: CSSProperties = { fontSize: '12px', color: '#94a3b8', marginTop: '4px' };
const saveButtonStyle: CSSProperties = { backgroundColor: '#00a8e8', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px' };
const testButtonStyle: CSSProperties = { backgroundColor: '#6366f1', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px' };
const successStyle: CSSProperties = { backgroundColor: '#e8f5e9', color: '#2e7d32', padding: '12px 16px', borderRadius: '8px', marginBottom: '20px' };
const errorStyle: CSSProperties = { backgroundColor: '#ffebee', color: '#c62828', padding: '12px 16px', borderRadius: '8px', marginBottom: '20px' };

const modalOverlayStyle: CSSProperties = { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 };
const modalContentStyle: CSSProperties = { backgroundColor: '#fff', padding: '24px', borderRadius: '12px', width: '90%', maxWidth: '500px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' };
const cancelButtonStyle: CSSProperties = { backgroundColor: '#f1f5f9', color: '#475569', border: 'none', padding: '12px 24px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 };


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
