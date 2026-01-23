'use client';

import { useState, type CSSProperties } from 'react';
import type { InvoiceSettings } from '@/lib/types/invoice';

interface Props {
    initialSettings: InvoiceSettings | null;
}

export default function InvoiceSettingsForm({ initialSettings }: Props) {
    const [settings, setSettings] = useState({
        generate_day: initialSettings?.generate_day || 15,
        due_days: initialSettings?.due_days || 10,
        bank_name: initialSettings?.bank_name || '',
        bank_account_number: initialSettings?.bank_account_number || '',
        bank_account_holder: initialSettings?.bank_account_holder || '',
        admin_whatsapp_number: initialSettings?.admin_whatsapp_number || '',
        base_url: initialSettings?.base_url || 'http://localhost:3000',
        invoice_message_template: initialSettings?.invoice_message_template || '',
        payment_confirmation_template: initialSettings?.payment_confirmation_template || '',
        seasonal_invoice_message_template: initialSettings?.seasonal_invoice_message_template || '',
        whatsapp_delay_min: initialSettings?.whatsapp_delay_min || 10,
        whatsapp_delay_max: initialSettings?.whatsapp_delay_max || 30
    });

    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const handleChange = (field: string, value: string | number) => {
        setSettings(prev => ({ ...prev, [field]: value }));
    };

    const handleSave = async () => {
        setSaving(true);
        setMessage(null);

        try {
            const res = await fetch('/api/invoices/settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(settings)
            });

            if (res.ok) {
                setMessage({ type: 'success', text: 'Settings saved successfully!' });
            } else {
                const data = await res.json();
                setMessage({ type: 'error', text: data.error || 'Failed to save settings' });
            }
        } catch (error) {
            setMessage({ type: 'error', text: 'Error: ' + String(error) });
        } finally {
            setSaving(false);
        }
    };

    return (
        <div style={containerStyle}>
            {message && (
                <div style={message.type === 'success' ? successStyle : errorStyle}>
                    {message.text}
                </div>
            )}

            <div style={cardStyle}>
                <h2 style={sectionTitleStyle}>📅 Jadwal Invoice</h2>

                <div style={formRowStyle}>
                    <div style={formGroupStyle}>
                        <label style={labelStyle}>Tanggal Generate Invoice</label>
                        <input
                            type="number"
                            min={1}
                            max={28}
                            value={settings.generate_day}
                            onChange={(e) => handleChange('generate_day', parseInt(e.target.value))}
                            style={inputStyle}
                        />
                        <p style={helpTextStyle}>Tanggal 1-28. Invoice di-generate pada tanggal ini setiap bulan.</p>
                    </div>
                    <div style={formGroupStyle}>
                        <label style={labelStyle}>Jatuh Tempo (hari)</label>
                        <input
                            type="number"
                            min={1}
                            value={settings.due_days}
                            onChange={(e) => handleChange('due_days', parseInt(e.target.value))}
                            style={inputStyle}
                        />
                        <p style={helpTextStyle}>Jumlah hari setelah tanggal generate untuk jatuh tempo.</p>
                    </div>
                </div>
            </div>

            <div style={cardStyle}>
                <h2 style={sectionTitleStyle}>🏦 Informasi Bank</h2>

                <div style={formGroupStyle}>
                    <label style={labelStyle}>Nama Bank</label>
                    <input
                        type="text"
                        value={settings.bank_name}
                        onChange={(e) => handleChange('bank_name', e.target.value)}
                        placeholder="BCA"
                        style={inputStyle}
                    />
                </div>

                <div style={formGroupStyle}>
                    <label style={labelStyle}>Nomor Rekening</label>
                    <input
                        type="text"
                        value={settings.bank_account_number}
                        onChange={(e) => handleChange('bank_account_number', e.target.value)}
                        placeholder="7140132971"
                        style={inputStyle}
                    />
                </div>

                <div style={formGroupStyle}>
                    <label style={labelStyle}>Nama Pemilik Rekening</label>
                    <input
                        type="text"
                        value={settings.bank_account_holder}
                        onChange={(e) => handleChange('bank_account_holder', e.target.value)}
                        placeholder="SAN ARANGGI SOEMARDJAN/FRANSISKA OETAMI"
                        style={inputStyle}
                    />
                </div>
            </div>

            <div style={cardStyle}>
                <h2 style={sectionTitleStyle}>📱 Kontak Admin</h2>

                <div style={formGroupStyle}>
                    <label style={labelStyle}>Nomor WhatsApp Admin</label>
                    <input
                        type="text"
                        value={settings.admin_whatsapp_number}
                        onChange={(e) => handleChange('admin_whatsapp_number', e.target.value)}
                        placeholder="0812-4124-3883"
                        style={inputStyle}
                    />
                    <p style={helpTextStyle}>Nomor ini akan digunakan untuk tombol &quot;Hubungi Admin&quot; di invoice.</p>
                </div>

                <div style={formRowStyle}>
                    <div style={formGroupStyle}>
                        <label style={labelStyle}>Min Delay WhatsApp (detik)</label>
                        <input
                            type="number"
                            min={1}
                            value={settings.whatsapp_delay_min}
                            onChange={(e) => handleChange('whatsapp_delay_min', parseInt(e.target.value))}
                            style={inputStyle}
                        />
                        <p style={helpTextStyle}>Jeda minimum antar pesan.</p>
                    </div>
                    <div style={formGroupStyle}>
                        <label style={labelStyle}>Max Delay WhatsApp (detik)</label>
                        <input
                            type="number"
                            min={1}
                            value={settings.whatsapp_delay_max}
                            onChange={(e) => handleChange('whatsapp_delay_max', parseInt(e.target.value))}
                            style={inputStyle}
                        />
                        <p style={helpTextStyle}>Jeda maksimum antar pesan.</p>
                    </div>
                </div>

                <div style={formGroupStyle}>
                    <label style={labelStyle}>Base URL</label>
                    <input
                        type="text"
                        value={settings.base_url}
                        onChange={(e) => handleChange('base_url', e.target.value)}
                        placeholder="https://lms.clevio.id"
                        style={inputStyle}
                    />
                    <p style={helpTextStyle}>URL dasar untuk link invoice. Contoh: https://lms.clevio.id</p>
                </div>
            </div>

            <div style={cardStyle}>
                <h2 style={sectionTitleStyle}>💬 Template Pesan WhatsApp</h2>

                <div style={formGroupStyle}>
                    <label style={labelStyle}>Template Pesan Reminder</label>
                    <textarea
                        value={settings.invoice_message_template}
                        onChange={(e) => handleChange('invoice_message_template', e.target.value)}
                        style={textareaStyle}
                        rows={8}
                    />
                    <p style={helpTextStyle}>
                        Variables: {'{parent_name}'}, {'{invoice_number}'}, {'{total_amount}'}, {'{due_date}'}, {'{invoice_url}'}, {'{period_month_year}'}, {'{student_list}'}
                    </p>
                </div>

                <div style={formGroupStyle}>
                    <label style={labelStyle}>Template Konfirmasi Pembayaran</label>
                    <textarea
                        value={settings.payment_confirmation_template}
                        onChange={(e) => handleChange('payment_confirmation_template', e.target.value)}
                        style={textareaStyle}
                        rows={8}
                    />
                    <p style={helpTextStyle}>
                        Variables: {'{parent_name}'}, {'{invoice_number}'}, {'{amount}'}, {'{paid_date}'}, {'{invoice_url}'}
                    </p>
                </div>

                <div style={formGroupStyle}>
                    <label style={labelStyle}>Template Message - Seasonal Invoices</label>
                    <textarea
                        value={settings.seasonal_invoice_message_template}
                        onChange={(e) => handleChange('seasonal_invoice_message_template', e.target.value)}
                        style={textareaStyle}
                        rows={8}
                    />
                    <p style={helpTextStyle}>
                        Variables: {'{student_name}'}, {'{program_name}'}, {'{invoice_number}'}, {'{invoice_url}'}
                    </p>
                </div>
            </div>

            <button onClick={handleSave} disabled={saving} style={saveButtonStyle}>
                {saving ? 'Saving...' : '💾 Simpan Settings'}
            </button>
        </div>
    );
}

// Styles
const containerStyle: CSSProperties = { maxWidth: '800px' };
const cardStyle: CSSProperties = { backgroundColor: '#fff', padding: '24px', borderRadius: '12px', marginBottom: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' };
const sectionTitleStyle: CSSProperties = { fontSize: '16px', fontWeight: 600, marginBottom: '16px', color: '#1e293b' };
const formRowStyle: CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' };
const formGroupStyle: CSSProperties = { marginBottom: '16px' };
const labelStyle: CSSProperties = { display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: 500, color: '#374151' };
const inputStyle: CSSProperties = { width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '14px', boxSizing: 'border-box' };
const textareaStyle: CSSProperties = { ...inputStyle, fontFamily: 'monospace', resize: 'vertical' };
const helpTextStyle: CSSProperties = { fontSize: '12px', color: '#94a3b8', marginTop: '4px' };
const saveButtonStyle: CSSProperties = { backgroundColor: '#00a8e8', color: '#fff', border: 'none', padding: '14px 28px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px' };
const successStyle: CSSProperties = { backgroundColor: '#e8f5e9', color: '#2e7d32', padding: '12px 16px', borderRadius: '8px', marginBottom: '20px' };
const errorStyle: CSSProperties = { backgroundColor: '#ffebee', color: '#c62828', padding: '12px 16px', borderRadius: '8px', marginBottom: '20px' };
