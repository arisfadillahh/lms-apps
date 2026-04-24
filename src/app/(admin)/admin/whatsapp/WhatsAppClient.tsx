'use client';

import { useState, useEffect, type CSSProperties } from 'react';
import type { InvoiceSettings, WhatsAppStatus } from '@/lib/types/invoice';
import WhatsAppTemplatesContent from './WhatsAppTemplates';
import WhatsAppReportTemplates from './WhatsAppReportTemplates';

// SVG Icons
const ConnectionIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M15 7h3a5 5 0 0 1 5 5 5 5 0 0 1-5 5h-3m-6 0H6a5 5 0 0 1-5-5 5 5 0 0 1 5-5h3" />
        <line x1="8" y1="12" x2="16" y2="12" />
    </svg>
);

const ClassIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
);

const MakeupIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
    </svg>
);

const LogIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <line x1="8" y1="6" x2="21" y2="6" />
        <line x1="8" y1="12" x2="21" y2="12" />
        <line x1="8" y1="18" x2="21" y2="18" />
        <line x1="3" y1="6" x2="3.01" y2="6" />
        <line x1="3" y1="12" x2="3.01" y2="12" />
        <line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
);

const TemplateIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
);

interface ExtendedStatus extends WhatsAppStatus {
    serverTime?: string;
}

type TabKey = 'connection' | 'class' | 'makeup' | 'templates' | 'reports' | 'logs';

export default function WhatsAppSettingsPage() {
    const [activeTab, setActiveTab] = useState<TabKey>('connection');

    // Connection State
    const [status, setStatus] = useState<ExtendedStatus | null>(null);
    const [loading, setLoading] = useState(true);
    const [connecting, setConnecting] = useState(false);
    const [disconnecting, setDisconnecting] = useState(false);
    const [resetting, setResetting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);

    // Settings State
    const [settings, setSettings] = useState<Partial<InvoiceSettings>>({});
    const [savingSettings, setSavingSettings] = useState(false);
    const [settingsMsg, setSettingsMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    // Logs State
    const [logs, setLogs] = useState<Array<{
        id: string;
        category: string;
        payload: any;
        status: string;
        created_at: string;
    }>>([]);
    const [deliveryStats, setDeliveryStats] = useState({ sentToday: 0, failedToday: 0, queuedToday: 0 });

    // Test Modal State
    const [showTestModal, setShowTestModal] = useState(false);
    const [testPhone, setTestPhone] = useState('');
    const [testStudent, setTestStudent] = useState<any>(null);
    const [availableStudents, setAvailableStudents] = useState<any[]>([]);
    const [loadingStudents, setLoadingStudents] = useState(false);
    const [sendingTest, setSendingTest] = useState(false);
    const [testMsg, setTestMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    useEffect(() => {
        fetchStatus();
        fetchSettings();
        fetchLogs();
    }, []);

    // Auto-connect and poll for QR
    useEffect(() => {
        if (loading) return;

        if (!status?.isConnected && !status?.qrCode && !connecting) {
            handleConnectSilent();
        }

        let pollInterval: NodeJS.Timeout | null = null;
        if (!status?.isConnected) {
            pollInterval = setInterval(fetchStatus, 3000);
        }

        return () => { if (pollInterval) clearInterval(pollInterval); };
    }, [loading, status?.isConnected, status?.qrCode]);

    // API Calls
    const fetchStatus = async () => {
        try {
            const res = await fetch('/api/whatsapp/status');
            if (res.ok) setStatus(await res.json());
        } catch (err) {
            console.error('Error fetching status:', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchSettings = async () => {
        try {
            const res = await fetch('/api/invoices/settings');
            if (res.ok) {
                const data = await res.json();
                // Set defaults
                if (!data.class_reminder_message_template) {
                    data.class_reminder_message_template = `Halo Ayah/Bunda {parent_name} 👋\n\nReminder kelas coding untuk:\n💻 {student_name}\n🕒 Pukul: {time}\n🔗 Zoom: {zoom_link}\n\nMohon hadir tepat waktu ya. Terima kasih! 🙏`;
                }
                setSettings(data);
            }
        } catch (err) {
            console.error('Error fetching settings:', err);
        }
    };

    const fetchLogs = async () => {
        try {
            const res = await fetch('/api/whatsapp/logs?limit=200');
            if (res.ok) {
                const data = await res.json();
                const nextLogs = data.logs || [];
                const startToday = new Date();
                startToday.setHours(0, 0, 0, 0);

                setLogs(nextLogs);
                setDeliveryStats({
                    sentToday: nextLogs.filter((log: any) => log.status === 'SENT' && new Date(log.created_at) >= startToday).length,
                    failedToday: nextLogs.filter((log: any) => log.status === 'FAILED' && new Date(log.created_at) >= startToday).length,
                    queuedToday: nextLogs.filter((log: any) => log.status === 'QUEUED' && new Date(log.created_at) >= startToday).length,
                });
            }
        } catch (err) {
            console.error('Error fetching logs:', err);
        }
    };

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

    const handleConnect = async () => {
        setConnecting(true);
        setError(null);
        try {
            const res = await fetch('/api/whatsapp/connect', { method: 'POST' });
            const data = await res.json();
            if (data.success) await fetchStatus();
            else setError(data.error || 'Failed to connect');
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
        if (!confirm('Yakin ingin reset session WhatsApp? Anda harus scan QR code ulang.')) return;
        setResetting(true);
        setError(null);
        setSuccessMsg(null);
        try {
            const res = await fetch('/api/whatsapp/reset', { method: 'POST' });
            const data = await res.json();
            if (data.success) { setSuccessMsg(data.message); await fetchStatus(); }
            else setError(data.message || 'Reset gagal');
        } catch (err) {
            setError('Reset error: ' + String(err));
        } finally {
            setResetting(false);
        }
    };

    const handleSettingChange = (field: string, value: any) => {
        setSettings(prev => ({ ...prev, [field]: value }));
    };

    const handleSaveSettings = async () => {
        setSavingSettings(true);
        setSettingsMsg(null);
        try {
            const res = await fetch('/api/invoices/settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(settings)
            });
            if (res.ok) setSettingsMsg({ type: 'success', text: 'Settings berhasil disimpan!' });
            else {
                const data = await res.json();
                setSettingsMsg({ type: 'error', text: data.error || 'Gagal menyimpan' });
            }
        } catch (err) {
            setSettingsMsg({ type: 'error', text: 'Error: ' + String(err) });
        } finally {
            setSavingSettings(false);
        }
    };

    const fetchTodayStudents = async () => {
        setLoadingStudents(true);
        try {
            const res = await fetch('/api/admin/sessions/today');
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
            const template = settings.class_reminder_message_template || '';
            const msg = template
                .replace('{parent_name}', testStudent.parent_name || 'Ayah/Bunda')
                .replace('{student_name}', testStudent.student_name)
                .replace('{time}', testStudent.time)
                .replace('{zoom_link}', testStudent.zoom_link);

            const res = await fetch('/api/whatsapp/test-reminder', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone: testPhone, message: msg, studentName: testStudent.student_name })
            });
            const data = await res.json();
            if (res.ok && data.success) setTestMsg({ type: 'success', text: 'Pesan tes terkirim!' });
            else setTestMsg({ type: 'error', text: data.error || 'Gagal mengirim pesan.' });
        } catch (err) {
            setTestMsg({ type: 'error', text: 'Error: ' + String(err) });
        } finally {
            setSendingTest(false);
        }
    };

    const formatDate = (dateStr: string) => new Date(dateStr).toLocaleString('id-ID');

    if (loading) return <div style={loadingStyle}>Loading...</div>;

    const tabs: { key: TabKey; label: string; icon: JSX.Element }[] = [
        { key: 'connection', label: 'Koneksi', icon: <ConnectionIcon /> },
        { key: 'class', label: 'Reminder Kelas', icon: <ClassIcon /> },
        { key: 'makeup', label: 'Reminder Susulan', icon: <MakeupIcon /> },
        { key: 'templates', label: 'Pesan Absen', icon: <TemplateIcon /> },
        { key: 'reports', label: 'Pesan Rapor', icon: <TemplateIcon /> },
        { key: 'logs', label: 'Log Pengiriman', icon: <LogIcon /> },
    ];

    return (
        <div style={containerStyle}>


            <div style={statsStripStyle}>
                <div style={statsCardStyle}>
                    <span style={statsLabelStyle}>Status Server</span>
                    <strong style={{ ...statsValueStyle, color: status?.isConnected ? '#15803d' : '#b91c1c', fontSize: '1.2rem' }}>
                        {status?.isConnected ? 'Terhubung' : 'Belum terhubung'}
                    </strong>
                </div>
                <div style={statsCardStyle}>
                    <span style={statsLabelStyle}>Terkirim Hari Ini</span>
                    <strong style={statsValueStyle}>{deliveryStats.sentToday}</strong>
                </div>
                <div style={statsCardStyle}>
                    <span style={statsLabelStyle}>Gagal Hari Ini</span>
                    <strong style={{ ...statsValueStyle, color: deliveryStats.failedToday > 0 ? '#dc2626' : 'var(--text)' }}>{deliveryStats.failedToday}</strong>
                </div>
                <div style={statsCardStyle}>
                    <span style={statsLabelStyle}>Queue Hari Ini</span>
                    <strong style={statsValueStyle}>{deliveryStats.queuedToday}</strong>
                </div>
            </div>

            {/* Tab Navigation */}
            <div style={tabContainerStyle}>
                {tabs.map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        style={activeTab === tab.key ? activeTabStyle : tabStyle}
                    >
                        {tab.icon}
                        <span>{tab.label}</span>
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            <div style={tabContentStyle}>
                {activeTab === 'connection' && (
                    <ConnectionTab
                        status={status}
                        connecting={connecting}
                        disconnecting={disconnecting}
                        resetting={resetting}
                        error={error}
                        successMsg={successMsg}
                        onConnect={handleConnect}
                        onDisconnect={handleDisconnect}
                        onReset={handleForceReset}
                        onRefresh={fetchStatus}
                    />
                )}

                {activeTab === 'class' && (
                    <ClassReminderTab
                        settings={settings}
                        settingsMsg={settingsMsg}
                        savingSettings={savingSettings}
                        onSettingChange={handleSettingChange}
                        onSave={handleSaveSettings}
                        onOpenTestModal={handleOpenTestModal}
                        serverTime={status?.serverTime}
                    />
                )}

                {activeTab === 'makeup' && (
                    <MakeupReminderTab
                        settings={settings}
                        settingsMsg={settingsMsg}
                        savingSettings={savingSettings}
                        onSettingChange={handleSettingChange}
                        onSave={handleSaveSettings}
                    />
                )}

                {activeTab === 'templates' && (
                    <WhatsAppTemplatesContent
                        settings={settings}
                        settingsMsg={settingsMsg}
                        savingSettings={savingSettings}
                        onSettingChange={handleSettingChange}
                        onSave={handleSaveSettings}
                    />
                )}

                {activeTab === 'reports' && (
                    <WhatsAppReportTemplates
                        settings={settings}
                        settingsMsg={settingsMsg}
                        savingSettings={savingSettings}
                        onSettingChange={handleSettingChange}
                        onSave={handleSaveSettings}
                    />
                )}

                {activeTab === 'logs' && (
                    <LogsTab logs={logs} onRefresh={fetchLogs} formatDate={formatDate} />
                )}
            </div>

            {/* Test Modal */}
            {showTestModal && (
                <div style={modalOverlayStyle}>
                    <div style={modalContentStyle}>
                        <h3 style={{ marginTop: 0 }}>Tes Kirim Reminder</h3>
                        {testMsg && <div style={testMsg.type === 'success' ? successStyle : errorStyle}>{testMsg.text}</div>}

                        <div style={formGroupStyle}>
                            <label style={labelStyle}>Nomor WhatsApp Tujuan</label>
                            <input type="text" value={testPhone} onChange={(e) => setTestPhone(e.target.value)} placeholder="0812xxx" style={inputStyle} />
                        </div>

                        <div style={formGroupStyle}>
                            <label style={labelStyle}>Sampel Siswa (sesi hari ini)</label>
                            {loadingStudents ? <p>Loading...</p> : availableStudents.length === 0 ? (
                                <p style={{ color: '#c62828' }}>Tidak ada sesi kelas hari ini.</p>
                            ) : (
                                <select style={inputStyle} onChange={(e) => setTestStudent(availableStudents.find(s => s.id === e.target.value))} value={testStudent?.id || ''}>
                                    <option value="">-- Pilih Siswa --</option>
                                    {availableStudents.map(s => <option key={s.id} value={s.id}>{s.student_name} ({s.time})</option>)}
                                </select>
                            )}
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                            <button onClick={() => setShowTestModal(false)} style={cancelButtonStyle}>Tutup</button>
                            <button onClick={handleSendTest} disabled={sendingTest || !testStudent} style={primaryButtonStyle}>
                                {sendingTest ? 'Mengirim...' : 'Kirim Pesan'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// =====================
// Tab Components
// =====================

function ConnectionTab({ status, connecting, disconnecting, resetting, error, successMsg, onConnect, onDisconnect, onReset, onRefresh }: any) {
    return (
        <div style={cardStyle}>
            <h2 style={sectionTitleStyle}>Status Koneksi Baileys</h2>

            <div style={statusContainerStyle}>
                <div style={statusIndicatorStyle(status?.isConnected || false)}>
                    <span style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: status?.isConnected ? '#22c55e' : '#ef4444' }} />
                    {status?.isConnected ? 'Connected' : 'Disconnected'}
                </div>

                {status?.connectedPhone && (
                    <p style={phoneInfoStyle}>Terhubung dengan: <strong>{status.connectedPhone}</strong></p>
                )}

                {error && <p style={errorTextStyle}>{error}</p>}
                {successMsg && <p style={successTextStyle}>{successMsg}</p>}
            </div>

            {/* QR Code */}
            {status?.qrCode && !status.isConnected && (
                <div style={qrContainerStyle}>
                    <p style={qrInstructionStyle}>Scan QR Code dengan WhatsApp:</p>
                    <img src={status.qrCode} alt="WhatsApp QR Code" style={qrImageStyle} />
                    <p style={qrHelpStyle}>Buka WhatsApp &gt; Menu &gt; Linked Devices &gt; Link a Device</p>
                </div>
            )}

            <div style={actionsStyle}>
                {!status?.isConnected ? (
                    <button onClick={onConnect} disabled={connecting} style={primaryButtonStyle}>
                        {connecting ? 'Connecting...' : 'Connect WhatsApp'}
                    </button>
                ) : (
                    <button onClick={onDisconnect} disabled={disconnecting} style={dangerButtonStyle}>
                        {disconnecting ? 'Disconnecting...' : 'Disconnect'}
                    </button>
                )}
                <button onClick={onRefresh} style={secondaryButtonStyle}>Refresh Status</button>
                <button onClick={onReset} disabled={resetting} style={warningButtonStyle}>
                    {resetting ? 'Resetting...' : 'Force Reset'}
                </button>
            </div>

            <div style={instructionsBoxStyle}>
                <h4 style={{ margin: '0 0 8px 0' }}>Petunjuk:</h4>
                <ol style={{ margin: 0, paddingLeft: 20 }}>
                    <li>Klik "Connect WhatsApp" untuk memulai.</li>
                    <li>QR Code akan muncul di layar.</li>
                    <li>Buka WhatsApp di HP &gt; Menu &gt; Linked Devices &gt; Link a Device.</li>
                    <li>Scan QR Code yang tampil.</li>
                </ol>
            </div>
        </div>
    );
}

function ClassReminderTab({ settings, settingsMsg, savingSettings, onSettingChange, onSave, onOpenTestModal, serverTime }: any) {
    return (
        <div style={cardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div>
                    <h2 style={{ ...sectionTitleStyle, marginBottom: 0 }}>Reminder Kelas Hari Ini</h2>
                    {serverTime && <span style={serverTimeStyle}>Server Time: {serverTime} (WIB)</span>}
                </div>
                <ToggleSwitch checked={settings.enable_class_reminder || false} onChange={(v) => onSettingChange('enable_class_reminder', v)} />
            </div>

            {settingsMsg && <div style={settingsMsg.type === 'success' ? successStyle : errorStyle}>{settingsMsg.text}</div>}

            <div style={formGroupStyle}>
                <label style={labelStyle}>Waktu Pengiriman</label>
                <input type="time" value={settings.class_reminder_time || '09:00'} onChange={(e) => onSettingChange('class_reminder_time', e.target.value)} style={inputStyle} />
                <p style={helpTextStyle}>Jam sistem mulai mengirim reminder (WIB)</p>
            </div>

            <div style={formRowStyle}>
                <div style={formGroupStyle}>
                    <label style={labelStyle}>Min Delay (detik)</label>
                    <input type="number" min={1} value={settings.class_reminder_delay_min || 5} onChange={(e) => onSettingChange('class_reminder_delay_min', parseInt(e.target.value))} style={inputStyle} />
                </div>
                <div style={formGroupStyle}>
                    <label style={labelStyle}>Max Delay (detik)</label>
                    <input type="number" min={1} value={settings.class_reminder_delay_max || 15} onChange={(e) => onSettingChange('class_reminder_delay_max', parseInt(e.target.value))} style={inputStyle} />
                </div>
            </div>

            <div style={formGroupStyle}>
                <label style={labelStyle}>Template Pesan</label>
                <textarea value={settings.class_reminder_message_template || ''} onChange={(e) => onSettingChange('class_reminder_message_template', e.target.value)} style={textareaStyle} rows={6} />
                <p style={helpTextStyle}>Variables: {'{parent_name}'}, {'{student_name}'}, {'{time}'}, {'{zoom_link}'}</p>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 20 }}>
                <button onClick={onOpenTestModal} style={secondaryButtonStyle}>Tes Kirim Pesan</button>
                <button onClick={onSave} disabled={savingSettings} style={primaryButtonStyle}>{savingSettings ? 'Menyimpan...' : 'Simpan Pengaturan'}</button>
            </div>
        </div>
    );
}

function MakeupReminderTab({ settings, settingsMsg, savingSettings, onSettingChange, onSave }: any) {
    return (
        <div style={cardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div>
                    <h2 style={{ ...sectionTitleStyle, marginBottom: 0 }}>Reminder Tugas Susulan</h2>
                    <p style={helpTextStyle}>Kirim pengingat ke orang tua sebelum deadline tugas susulan.</p>
                </div>
                <ToggleSwitch checked={settings.enable_makeup_reminder || false} onChange={(v) => onSettingChange('enable_makeup_reminder', v)} />
            </div>

            {settingsMsg && <div style={settingsMsg.type === 'success' ? successStyle : errorStyle}>{settingsMsg.text}</div>}

            <div style={formGroupStyle}>
                <label style={labelStyle}>Kirim Reminder Pada</label>
                <div style={{ display: 'flex', gap: 16 }}>
                    <label style={checkboxLabelStyle}>
                        <input type="checkbox" checked={settings.makeup_reminder_h3 || false} onChange={(e) => onSettingChange('makeup_reminder_h3', e.target.checked)} />
                        H-3 Deadline
                    </label>
                    <label style={checkboxLabelStyle}>
                        <input type="checkbox" checked={settings.makeup_reminder_h1 || false} onChange={(e) => onSettingChange('makeup_reminder_h1', e.target.checked)} />
                        H-1 Deadline
                    </label>
                </div>
            </div>

            <div style={formGroupStyle}>
                <label style={labelStyle}>Template Pesan Reminder Susulan</label>
                <textarea
                    value={settings.makeup_reminder_message_template || `Halo Ayah/Bunda {parent_name},\n\nIngat ya, tugas susulan untuk {student_name} akan berakhir pada {due_date}.\n\nLink tugas: {makeup_url}\n\nMohon dikerjakan sebelum deadline.\nTerima kasih! 🙏`}
                    onChange={(e) => onSettingChange('makeup_reminder_message_template', e.target.value)}
                    style={textareaStyle}
                    rows={6}
                />
                <p style={helpTextStyle}>Variables: {'{parent_name}'}, {'{student_name}'}, {'{due_date}'}, {'{makeup_url}'}</p>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
                <button onClick={onSave} disabled={savingSettings} style={primaryButtonStyle}>{savingSettings ? 'Menyimpan...' : 'Simpan Pengaturan'}</button>
            </div>
        </div>
    );
}

function LogsTab({ logs, onRefresh, formatDate }: any) {
    return (
        <div style={cardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h2 style={sectionTitleStyle}>Log Pengiriman Pesan</h2>
                <button onClick={onRefresh} style={smallButtonStyle}>Refresh</button>
            </div>

            {logs.length === 0 ? (
                <p style={{ color: '#64748b', textAlign: 'center', padding: 20 }}>Belum ada log pesan</p>
            ) : (
                <div style={{ overflowX: 'auto' }}>
                    <table style={tableStyle}>
                        <thead>
                            <tr>
                                <th style={thStyle}>Waktu</th>
                                <th style={thStyle}>Kategori</th>
                                <th style={thStyle}>Referensi</th>
                                <th style={thStyle}>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {logs.map((log: any) => {
                                const payloadType = log.payload?.type;
                                const isClassReminder = payloadType === 'CLASS_REMINDER';
                                const categoryDisplay = isClassReminder ? 'CLASS REMINDER' :
                                    log.category === 'PARENT_ABSENT' ? 'NOTIF ABSENT' : log.category.replace(/_/g, ' ');
                                const refText = isClassReminder ? `Kelas: ${log.payload?.student_name || '-'}` :
                                    log.category === 'PARENT_ABSENT' ? `Susulan: ${log.payload?.coderId?.slice(0, 8) || '-'}` :
                                        log.payload?.invoice_number || '-';

                                return (
                                    <tr key={log.id}>
                                        <td style={tdStyle}>{formatDate(log.created_at)}</td>
                                        <td style={tdStyle}><span style={getCategoryBadge(log.category, payloadType)}>{categoryDisplay}</span></td>
                                        <td style={tdStyle}>{refText}</td>
                                        <td style={tdStyle}><span style={getStatusBadge(log.status)}>{log.status}</span></td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

// =====================
// UI Components
// =====================

function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: checked ? '#22c55e' : '#94a3b8' }}>
                {checked ? 'AKTIF' : 'NON-AKTIF'}
            </span>
            <button
                onClick={() => onChange(!checked)}
                style={{
                    width: 48,
                    height: 26,
                    borderRadius: 13,
                    border: 'none',
                    backgroundColor: checked ? '#22c55e' : '#cbd5e1',
                    position: 'relative',
                    cursor: 'pointer',
                    transition: 'background-color 0.2s'
                }}
            >
                <span style={{
                    position: 'absolute',
                    top: 3,
                    left: checked ? 25 : 3,
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    backgroundColor: '#fff',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                    transition: 'left 0.2s'
                }} />
            </button>
        </div>
    );
}

// =====================
// Styles
// =====================

const containerStyle: CSSProperties = { width: '100%' };
const pageTitle: CSSProperties = { fontSize: 24, fontWeight: 700, marginBottom: 8, color: 'var(--text)' };
const pageDesc: CSSProperties = { color: 'var(--text-muted)', marginBottom: 24 };
const loadingStyle: CSSProperties = { padding: 40, textAlign: 'center', color: 'var(--text-muted)' };

const statsStripStyle: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 18 };
const statsCardStyle: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18, padding: '18px 20px', boxShadow: 'var(--shadow-sm)' };
const statsLabelStyle: CSSProperties = { display: 'block', marginBottom: 8, fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 700, color: 'var(--text-muted)' };
const statsValueStyle: CSSProperties = { fontSize: 24, lineHeight: 1, color: 'var(--text)', fontWeight: 800 };

const tabContainerStyle: CSSProperties = { display: 'flex', gap: 8, flexWrap: 'wrap', borderBottom: '1px solid var(--border)', marginBottom: 24, paddingBottom: 8 };
const tabStyle: CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, padding: '12px 18px', border: '1px solid var(--border)', borderRadius: 999, background: 'var(--surface)', color: 'var(--text-muted)', fontSize: 14, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' };
const activeTabStyle: CSSProperties = { ...tabStyle, color: '#ffffff', borderColor: 'transparent', background: 'linear-gradient(135deg, var(--c-navy), var(--c-green))' };
const tabContentStyle: CSSProperties = {};

const cardStyle: CSSProperties = { backgroundColor: 'var(--surface)', borderRadius: 18, border: '1px solid var(--border)', padding: 24, marginBottom: 20, boxShadow: 'var(--shadow-sm)' };
const sectionTitleStyle: CSSProperties = { fontSize: 18, fontWeight: 700, margin: '0 0 16px 0', color: 'var(--text)' };

const statusContainerStyle: CSSProperties = { marginBottom: 20 };
const statusIndicatorStyle = (connected: boolean): CSSProperties => ({ display: 'flex', alignItems: 'center', gap: 8, fontSize: 16, fontWeight: 600, color: connected ? '#22c55e' : '#ef4444' });
const phoneInfoStyle: CSSProperties = { marginTop: 8, color: 'var(--text-muted)', fontSize: 14 };
const errorTextStyle: CSSProperties = { color: '#dc2626', marginTop: 8 };
const successTextStyle: CSSProperties = { color: '#16a34a', marginTop: 8 };
const serverTimeStyle: CSSProperties = { fontSize: 12, color: 'var(--text-muted)', marginTop: 4, display: 'block' };

const qrContainerStyle: CSSProperties = { textAlign: 'center', padding: 20, backgroundColor: 'var(--surface-2)', borderRadius: 16, marginBottom: 20 };
const qrInstructionStyle: CSSProperties = { marginBottom: 16, fontWeight: 500 };
const qrImageStyle: CSSProperties = { maxWidth: 256, border: '4px solid #fff', borderRadius: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' };
const qrHelpStyle: CSSProperties = { marginTop: 16, color: 'var(--text-muted)', fontSize: 14 };

const actionsStyle: CSSProperties = { display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 };
const primaryButtonStyle: CSSProperties = { background: 'linear-gradient(135deg, var(--c-navy), var(--c-green))', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: 12, cursor: 'pointer', fontWeight: 600, fontSize: 14 };
const secondaryButtonStyle: CSSProperties = { backgroundColor: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)', padding: '10px 20px', borderRadius: 12, cursor: 'pointer', fontWeight: 500, fontSize: 14 };
const dangerButtonStyle: CSSProperties = { backgroundColor: '#ef4444', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: 12, cursor: 'pointer', fontWeight: 600, fontSize: 14 };
const warningButtonStyle: CSSProperties = { backgroundColor: '#f59e0b', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: 12, cursor: 'pointer', fontWeight: 600, fontSize: 14 };
const smallButtonStyle: CSSProperties = { backgroundColor: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)', padding: '6px 12px', borderRadius: 10, cursor: 'pointer', fontSize: 12 };
const cancelButtonStyle: CSSProperties = { backgroundColor: 'var(--surface-2)', color: 'var(--text-muted)', border: 'none', padding: '10px 20px', borderRadius: 12, cursor: 'pointer', fontWeight: 500 };

const instructionsBoxStyle: CSSProperties = { backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: 16, fontSize: 14, color: '#166534' };

const formGroupStyle: CSSProperties = { marginBottom: 16 };
const formRowStyle: CSSProperties = { display: 'flex', gap: 16 };
const labelStyle: CSSProperties = { display: 'block', marginBottom: 6, fontSize: 14, fontWeight: 500, color: 'var(--text)' };
const inputStyle: CSSProperties = { width: '100%', padding: '10px 12px', borderRadius: 12, border: '1px solid var(--border)', fontSize: 14, boxSizing: 'border-box', background: 'var(--surface-2)', color: 'var(--text)' };
const textareaStyle: CSSProperties = { ...inputStyle, resize: 'vertical', fontFamily: 'inherit' };
const helpTextStyle: CSSProperties = { fontSize: 12, color: 'var(--text-muted)', marginTop: 4 };
const checkboxLabelStyle: CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, cursor: 'pointer' };

const successStyle: CSSProperties = { backgroundColor: '#dcfce7', color: '#166534', padding: '12px 16px', borderRadius: 8, marginBottom: 16 };
const errorStyle: CSSProperties = { backgroundColor: '#fee2e2', color: '#dc2626', padding: '12px 16px', borderRadius: 8, marginBottom: 16 };

const modalOverlayStyle: CSSProperties = { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 };
const modalContentStyle: CSSProperties = { backgroundColor: 'var(--surface)', borderRadius: 18, padding: 24, width: '90%', maxWidth: 400 };

const tableStyle: CSSProperties = { width: '100%', borderCollapse: 'collapse' };
const thStyle: CSSProperties = { textAlign: 'left', padding: '10px 12px', backgroundColor: 'var(--surface-2)', borderBottom: '1px solid var(--border)', fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' };
const tdStyle: CSSProperties = { padding: '10px 12px', borderBottom: '1px solid var(--border)', fontSize: 13, color: 'var(--text)' };

const getCategoryBadge = (category: string, payloadType?: string): CSSProperties => {
    const isClassReminder = payloadType === 'CLASS_REMINDER';
    let bg = '#e2e8f0', color = '#475569';
    if (isClassReminder) { bg = '#dbeafe'; color = '#1d4ed8'; }
    else if (category === 'PARENT_ABSENT') { bg = '#fef3c7'; color = '#92400e'; }
    else if (category === 'REMINDER') { bg = '#e0e7ff'; color = '#4338ca'; }
    return { backgroundColor: bg, color, padding: '4px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600 };
};

const getStatusBadge = (status: string): CSSProperties => {
    let bg = '#e2e8f0', color = '#475569';
    if (status === 'SENT') { bg = '#dcfce7'; color = '#166534'; }
    else if (status === 'FAILED') { bg = '#fee2e2'; color = '#dc2626'; }
    else if (status === 'QUEUED') { bg = '#fef3c7'; color = '#92400e'; }
    return { backgroundColor: bg, color, padding: '4px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600 };
};
