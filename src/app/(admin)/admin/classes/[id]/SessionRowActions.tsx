'use client';

import type { CSSProperties } from 'react';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import type { UserRecord } from '@/lib/dao/usersDao';

type SessionStatus = 'SCHEDULED' | 'COMPLETED' | 'CANCELLED';

interface SessionRowActionsProps {
    sessionId: string;
    coaches: UserRecord[];
    currentSubstituteId: string | null;
    currentStatus: SessionStatus;
    showDropdownOnly?: boolean;
    showButtonsOnly?: boolean;
}

export default function SessionRowActions({
    sessionId,
    coaches,
    currentSubstituteId,
    currentStatus,
    showDropdownOnly,
    showButtonsOnly,
}: SessionRowActionsProps) {
    const router = useRouter();
    const [substituteValue, setSubstituteValue] = useState<string>(currentSubstituteId ?? '');
    const [isSaving, startSaveTransition] = useTransition();
    const [isCancelling, startCancelTransition] = useTransition();
    const [saveMessage, setSaveMessage] = useState<string | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const handleSave = () => {
        setSaveMessage(null);
        setErrorMessage(null);
        startSaveTransition(async () => {
            try {
                const response = await fetch(`/api/admin/sessions/${sessionId}/substitute`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ substituteCoachId: substituteValue || null }),
                });
                if (!response.ok) {
                    const payload = await response.json().catch(() => ({}));
                    setErrorMessage(payload.error ?? 'Failed');
                    return;
                }
                setSaveMessage('Saved');
                router.refresh();
                setTimeout(() => setSaveMessage(null), 2000);
            } catch {
                setErrorMessage('Error');
            }
        });
    };

    const isCancelled = currentStatus === 'CANCELLED';
    const cancelLabel = isCancelled ? 'Pulihkan' : 'Batalkan Sesi';
    const targetStatus: SessionStatus = isCancelled ? 'SCHEDULED' : 'CANCELLED';

    const handleCancel = () => {
        if (!isCancelled && !window.confirm('Batalkan sesi ini?')) return;
        setErrorMessage(null);
        startCancelTransition(async () => {
            try {
                const response = await fetch(`/api/admin/sessions/${sessionId}/status`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ status: targetStatus }),
                });
                if (!response.ok) {
                    const payload = await response.json().catch(() => ({}));
                    setErrorMessage(payload.error ?? 'Failed');
                    return;
                }
                router.refresh();
            } catch {
                setErrorMessage('Error');
            }
        });
    };

    const isPending = isSaving || isCancelling;

    // Show only dropdown
    if (showDropdownOnly) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <select
                    value={substituteValue}
                    onChange={(e) => setSubstituteValue(e.target.value)}
                    style={selectStyle}
                    disabled={isPending}
                >
                    <option value="">None</option>
                    {coaches.map((coach) => (
                        <option key={coach.id} value={coach.id}>{coach.full_name}</option>
                    ))}
                </select>
            </div>
        );
    }

    // Show only buttons
    if (showButtonsOnly) {
        return (
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                <button
                    type="button"
                    onClick={handleCancel}
                    disabled={isCancelling}
                    style={{ ...buttonStyle, ...cancelButtonStyle, opacity: isCancelling ? 0.6 : 1 }}
                >
                    {isCancelling ? '...' : cancelLabel}
                </button>
                <button
                    type="button"
                    onClick={handleSave}
                    disabled={isSaving}
                    style={{ ...buttonStyle, ...saveButtonStyle, opacity: isSaving ? 0.6 : 1 }}
                >
                    {isSaving ? 'Saving…' : 'Save'}
                </button>
                {saveMessage ? <span style={{ color: '#15803d', fontSize: '0.75rem' }}>{saveMessage}</span> : null}
                {errorMessage ? <span style={{ color: '#b91c1c', fontSize: '0.75rem' }}>{errorMessage}</span> : null}
            </div>
        );
    }

    // Default: show both
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', justifyContent: 'flex-end' }}>
            {/* Dropdown */}
            <select
                value={substituteValue}
                onChange={(e) => setSubstituteValue(e.target.value)}
                style={selectStyle}
                disabled={isPending}
            >
                <option value="">None</option>
                {coaches.map((coach) => (
                    <option key={coach.id} value={coach.id}>{coach.full_name}</option>
                ))}
            </select>

            {/* Action buttons with equal width */}
            <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                    type="button"
                    onClick={handleCancel}
                    disabled={isCancelling}
                    style={{ ...buttonStyle, ...cancelButtonStyle, opacity: isCancelling ? 0.6 : 1 }}
                >
                    {isCancelling ? '...' : cancelLabel}
                </button>
                <button
                    type="button"
                    onClick={handleSave}
                    disabled={isSaving}
                    style={{ ...buttonStyle, ...saveButtonStyle, opacity: isSaving ? 0.6 : 1 }}
                >
                    {isSaving ? 'Saving…' : 'Save'}
                </button>
            </div>

            {saveMessage ? <span style={{ color: '#15803d', fontSize: '0.75rem' }}>{saveMessage}</span> : null}
            {errorMessage ? <span style={{ color: '#b91c1c', fontSize: '0.75rem' }}>{errorMessage}</span> : null}
        </div>
    );
}

const selectStyle: CSSProperties = {
    padding: '0.5rem 0.75rem',
    borderRadius: '0.5rem',
    border: '1px solid #cbd5e1',
    fontSize: '0.9rem',
};

const buttonStyle: CSSProperties = {
    padding: '0.45rem 0.85rem',
    borderRadius: '0.5rem',
    fontSize: '0.85rem',
    cursor: 'pointer',
    minWidth: '110px',
    textAlign: 'center',
};

const saveButtonStyle: CSSProperties = {
    border: 'none',
    background: '#2563eb',
    color: '#fff',
};

const cancelButtonStyle: CSSProperties = {
    border: '1px solid #e2e8f0',
    background: '#f8fafc',
    color: '#0f172a',
};
