'use client';

import { useState, type CSSProperties } from 'react';
import { CalendarDays, Landmark, MessageSquareText, Phone, Save, ShieldCheck } from 'lucide-react';
import type { InvoiceSettings } from '@/lib/types/invoice';
import { DEFAULT_CHECKOUT_MESSAGE } from '@/lib/invoiceCheckout';
import styles from './invoice-settings.module.css';

interface Props {
    initialSettings: InvoiceSettings | null;
    checkoutEnabled?: boolean;
}

export default function InvoiceSettingsForm({ initialSettings, checkoutEnabled = false }: Props) {
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
        weekly_invoice_message_template: initialSettings?.weekly_invoice_message_template || '',
        whatsapp_delay_min: initialSettings?.whatsapp_delay_min || 10,
        whatsapp_delay_max: initialSettings?.whatsapp_delay_max || 30
    });

    const [saving, setSaving] = useState(false);
    const [checkoutTemplate, setCheckoutTemplate] = useState(initialSettings?.selected_invoices_message_template || DEFAULT_CHECKOUT_MESSAGE);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const handleChange = (field: string, value: string | number | boolean) => {
        setSettings(prev => ({ ...prev, [field]: value }));
    };

    const handleSave = async () => {
        setSaving(true);
        setMessage(null);

        try {
            const res = await fetch('/api/invoices/settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...settings, ...(checkoutEnabled ? { selected_invoices_message_template: checkoutTemplate } : {}) })
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
        <div style={containerStyle} className={styles.form}>
            {message && (
                <div role="status" style={message.type === 'success' ? successStyle : errorStyle}>
                    {message.text}
                </div>
            )}



            <div style={cardStyle}>
                <h2 style={sectionTitleStyle}><CalendarDays size={19} aria-hidden="true" /> Jadwal Invoice</h2>

                <div style={formRowStyle}>
                    <div style={formGroupStyle}>
                        <label style={labelStyle} htmlFor="invoice-generate-day">Tanggal Generate Invoice</label>
                        <input
                            id="invoice-generate-day"
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
                        <label style={labelStyle} htmlFor="invoice-due-days">Jatuh Tempo (hari)</label>
                        <input
                            id="invoice-due-days"
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
                <h2 style={sectionTitleStyle}><Landmark size={19} aria-hidden="true" /> Informasi Bank</h2>

                <div style={formGroupStyle}>
                    <label style={labelStyle} htmlFor="invoice-bank-name">Nama Bank</label>
                    <input
                        id="invoice-bank-name"
                        type="text"
                        value={settings.bank_name}
                        onChange={(e) => handleChange('bank_name', e.target.value)}
                        placeholder="BCA"
                        style={inputStyle}
                    />
                </div>

                <div style={formGroupStyle}>
                    <label style={labelStyle} htmlFor="invoice-bank-account">Nomor Rekening</label>
                    <input
                        id="invoice-bank-account"
                        type="text"
                        value={settings.bank_account_number}
                        onChange={(e) => handleChange('bank_account_number', e.target.value)}
                        placeholder="7140132971"
                        style={inputStyle}
                    />
                </div>

                <div style={formGroupStyle}>
                    <label style={labelStyle} htmlFor="invoice-bank-holder">Nama Pemilik Rekening</label>
                    <input
                        id="invoice-bank-holder"
                        type="text"
                        value={settings.bank_account_holder}
                        onChange={(e) => handleChange('bank_account_holder', e.target.value)}
                        placeholder="SAN ARANGGI SOEMARDJAN/FRANSISKA OETAMI"
                        style={inputStyle}
                    />
                </div>
            </div>

            <div style={cardStyle}>
                <h2 style={sectionTitleStyle}><Phone size={19} aria-hidden="true" /> Kontak Admin</h2>

                <div style={formGroupStyle}>
                    <label style={labelStyle} htmlFor="invoice-admin-phone">Nomor WhatsApp Admin</label>
                    <input
                        id="invoice-admin-phone"
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
                        <label style={labelStyle} htmlFor="invoice-delay-min">Min Delay WhatsApp (detik)</label>
                        <input
                            id="invoice-delay-min"
                            type="number"
                            min={1}
                            value={settings.whatsapp_delay_min}
                            onChange={(e) => handleChange('whatsapp_delay_min', parseInt(e.target.value))}
                            style={inputStyle}
                        />
                        <p style={helpTextStyle}>Jeda minimum antar pesan.</p>
                    </div>
                    <div style={formGroupStyle}>
                        <label style={labelStyle} htmlFor="invoice-delay-max">Max Delay WhatsApp (detik)</label>
                        <input
                            id="invoice-delay-max"
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
                    <label style={labelStyle} htmlFor="invoice-base-url">Base URL</label>
                    <input
                        id="invoice-base-url"
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
                <h2 style={sectionTitleStyle}><MessageSquareText size={19} aria-hidden="true" /> Template Pesan WhatsApp</h2>
                <p style={helpTextStyle}>Sesuaikan pesan sesuai kebutuhan. Variabel di bawah akan diisi oleh sistem saat pesan disiapkan.</p>
                {checkoutEnabled && <div className={styles.checkoutTemplate}>
                    <label style={labelStyle} htmlFor="checkout-template">Pembayaran beberapa tagihan</label>
                    <textarea id="checkout-template" rows={10} value={checkoutTemplate} onChange={e => setCheckoutTemplate(e.target.value)} style={textareaStyle} />
                    <p style={helpTextStyle}>Wajib: {'{invoice_list}'} dan {'{payment_url}'}. Opsional: {'{parent_name}'}, {'{total_unpaid}'}. Tidak dikirim otomatis ketika link dibuat.</p>
                </div>}

                <div style={formGroupStyle}>
                    <label style={labelStyle} htmlFor="invoice-reminder-template">Template Pesan Reminder</label>
                    <textarea
                        id="invoice-reminder-template"
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
                    <label style={labelStyle} htmlFor="invoice-confirmation-template">Template Konfirmasi Pembayaran</label>
                    <textarea
                        id="invoice-confirmation-template"
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
                    <label style={labelStyle} htmlFor="invoice-seasonal-template">Template Message - Seasonal Invoices</label>
                    <textarea
                        id="invoice-seasonal-template"
                        value={settings.seasonal_invoice_message_template}
                        onChange={(e) => handleChange('seasonal_invoice_message_template', e.target.value)}
                        style={textareaStyle}
                        rows={8}
                    />
                    <p style={helpTextStyle}>
                        Variables: {'{student_name}'}, {'{program_name}'}, {'{invoice_number}'}, {'{invoice_url}'}
                    </p>
                </div>

                <div style={formGroupStyle}>
                    <label style={labelStyle} htmlFor="invoice-registration-template">Template Message - Weekly Registration (REG)</label>
                    <textarea
                        id="invoice-registration-template"
                        value={settings.weekly_invoice_message_template}
                        onChange={(e) => handleChange('weekly_invoice_message_template', e.target.value)}
                        style={textareaStyle}
                        rows={8}
                    />
                    <p style={helpTextStyle}>
                        Template pesan WhatsApp untuk tagihan pendaftaran mingguan (REG).
                        Gunakan <code>{'{invoice_number}'}</code>, <code>{'{student_name}'}</code>, <code>{'{parent_name}'}</code>, <code>{'{invoice_url}'}</code>, dan <code>{'{due_date}'}</code> sebagai variabel.
                    </p>
                </div>
            </div>

            <div className={styles.savePanel}>
                <p><ShieldCheck size={17} aria-hidden="true" /> Menyimpan template tidak mengirim pesan WhatsApp.</p>
                <button type="button" onClick={handleSave} disabled={saving} className="btn btn-primary">
                    <Save size={17} aria-hidden="true" /> {saving ? 'Menyimpan…' : 'Simpan Pengaturan'}
                </button>
            </div>
        </div>
    );
}

// Styles
const containerStyle: CSSProperties = { maxWidth: '960px', minWidth: 0 };
const cardStyle: CSSProperties = { backgroundColor: 'var(--surface, #fff)', padding: 'clamp(18px, 3vw, 24px)', border: '1px solid var(--border, #dde2f0)', borderRadius: 'var(--radius-lg, 18px)', marginBottom: '20px', boxShadow: 'var(--shadow)' };
const sectionTitleStyle: CSSProperties = { display: 'flex', alignItems: 'center', gap: '10px', fontSize: '17px', fontWeight: 800, marginBottom: '20px', color: 'var(--text, #1b2550)' };
const formRowStyle: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))', gap: '20px' };
const formGroupStyle: CSSProperties = { marginBottom: '16px' };
const labelStyle: CSSProperties = { display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: 700, color: 'var(--text, #1b2550)' };
const inputStyle: CSSProperties = { width: '100%', minWidth: 0, minHeight: '44px', padding: '11px 12px', borderRadius: 'var(--radius-sm, 10px)', border: '1px solid var(--border-strong, #c2cae0)', backgroundColor: 'var(--surface-2, #eef1fa)', color: 'var(--text, #1b2550)', font: 'inherit', fontSize: '13px', boxSizing: 'border-box' };
const textareaStyle: CSSProperties = { ...inputStyle, fontFamily: 'var(--font-mono, monospace)', fontSize: '12px', lineHeight: 1.8, resize: 'vertical' };
const helpTextStyle: CSSProperties = { fontSize: '12px', lineHeight: 1.7, color: 'var(--text-muted, #5e6a8b)', marginTop: '6px', marginBottom: '12px', overflowWrap: 'anywhere' };
const successStyle: CSSProperties = { backgroundColor: '#e8f5e9', color: '#2e7d32', padding: '12px 16px', borderRadius: '8px', marginBottom: '20px' };
const errorStyle: CSSProperties = { backgroundColor: '#ffebee', color: '#c62828', padding: '12px 16px', borderRadius: '8px', marginBottom: '20px' };
