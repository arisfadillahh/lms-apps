
'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import * as Dialog from '@radix-ui/react-dialog'; // Assuming Radix UI is available (seen in CalendarModal)
import { format } from 'date-fns'; // if available, or native

type Props = {
    sessionId: string;
    currentDate: string | Date;
    isOpen: boolean;
    onClose: () => void;
};

export default function EditSessionDateModal({ sessionId, currentDate, isOpen, onClose }: Props) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [dateValue, setDateValue] = useState(() => {
        const d = new Date(currentDate);
        // Format for datetime-local: YYYY-MM-DDTHH:mm
        const pad = (n: number) => n.toString().padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    });
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        startTransition(async () => {
            try {
                const res = await fetch(`/api/admin/sessions/${sessionId}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ date_time: new Date(dateValue).toISOString() }),
                });

                if (!res.ok) {
                    const payload = await res.json().catch(() => ({}));
                    console.error('[EditSession] Failed', res.status, payload);
                    throw new Error(payload.error || `Failed to update: ${res.status}`);
                }

                router.refresh();
                onClose();
            } catch (err) {
                console.error(err);
                setError(err instanceof Error ? err.message : 'Gagal mengubah jadwal sesi');
            }
        });
    };

    if (!isOpen) return null;

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.5)'
        }}>
            <div style={{ background: 'white', padding: '1.5rem', borderRadius: '0.5rem', width: '400px', maxWidth: '90%' }}>
                <h2 style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: '1rem' }}>Reschedule Session</h2>

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.9rem', fontWeight: 500 }}>
                            New Date & Time
                        </label>
                        <input
                            type="datetime-local"
                            value={dateValue}
                            onChange={(e) => setDateValue(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '0.5rem',
                                borderRadius: '0.375rem',
                                border: '1px solid #d1d5db',
                                color: '#1f2937',
                                colorScheme: 'light'
                            }}
                            required
                        />
                    </div>

                    {error && <p style={{ color: 'red', fontSize: '0.85rem' }}>{error}</p>}

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isPending}
                            style={{
                                padding: '0.5rem 1rem', borderRadius: '0.375rem', border: '1px solid #d1d5db',
                                background: 'white', color: '#374151', cursor: 'pointer'
                            }}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isPending}
                            style={{
                                padding: '0.5rem 1rem', borderRadius: '0.375rem', border: 'none',
                                background: '#1e3a5f', color: 'white', cursor: 'pointer', opacity: isPending ? 0.7 : 1
                            }}
                        >
                            {isPending ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
