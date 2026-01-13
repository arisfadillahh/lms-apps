'use client';

import type { CSSProperties } from 'react';
import { useState, useTransition } from 'react';
import { Bell } from 'lucide-react';

type Props = {
    mode?: 'BATCH' | 'THRESHOLD';
};

export default function SendRemindersButton({ mode = 'THRESHOLD' }: Props) {
    const [isPending, startTransition] = useTransition();
    const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

    const handleSendReminders = () => {
        setResult(null);
        startTransition(async () => {
            try {
                const response = await fetch(`/api/admin/payments/send-reminders?mode=${mode}`, {
                    method: 'POST',
                });

                const data = await response.json();

                if (data.success) {
                    setResult({
                        success: true,
                        message: `✅ Expired: ${data.expiredMarked}, Sent: ${data.remindersSent}, Failed: ${data.remindersFailed}`,
                    });
                } else {
                    setResult({
                        success: false,
                        message: data.error || 'Gagal mengirim reminder',
                    });
                }
            } catch (err) {
                setResult({
                    success: false,
                    message: 'Terjadi kesalahan',
                });
            }
        });
    };

    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button onClick={handleSendReminders} style={buttonStyle} disabled={isPending}>
                <Bell size={16} />
                {isPending ? 'Mengirim...' : 'Kirim Reminder'}
            </button>
            {result && (
                <span style={{
                    fontSize: '0.85rem',
                    color: result.success ? '#16a34a' : '#dc2626',
                }}>
                    {result.message}
                </span>
            )}
        </div>
    );
}

const buttonStyle: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.6rem 1.2rem',
    borderRadius: '0.5rem',
    border: 'none',
    background: '#f59e0b',
    color: '#fff',
    fontSize: '0.9rem',
    fontWeight: 600,
    cursor: 'pointer',
};
