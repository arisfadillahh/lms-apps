'use client';

import { type CSSProperties } from 'react';
import { useReminder } from '@/contexts/ReminderContext';
import { Send, Maximize2 } from 'lucide-react';

export default function ReminderFloatingButton() {
    const { isVisible, isMinimized, isProcessing, setMinimized, getProgress, queue } = useReminder();

    if (!isVisible || !isMinimized) return null;

    const { sent, failed, total, percentage } = getProgress();
    const currentlySending = queue.find(i => i.status === 'sending');

    return (
        <button
            onClick={() => setMinimized(false)}
            style={buttonStyle}
            title="Klik untuk melihat detail"
        >
            <div style={iconWrapperStyle}>
                <Send size={16} color="#fff" />
            </div>

            <div style={contentStyle}>
                <div style={mainTextStyle}>
                    {isProcessing ? (
                        <>
                            <span style={pulseStyle}>●</span> Mengirim {sent}/{total}
                        </>
                    ) : (
                        <>✓ Selesai {sent}/{total}</>
                    )}
                </div>
                {currentlySending && (
                    <div style={subTextStyle}>
                        {currentlySending.parent_name}
                    </div>
                )}
            </div>

            <div style={expandIconStyle}>
                <Maximize2 size={14} />
            </div>

            {/* Progress indicator */}
            <div style={progressBgStyle}>
                <div style={{
                    ...progressFillStyle,
                    width: `${percentage}%`
                }} />
            </div>

            <style>{`
                @keyframes floatPulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.5; }
                }
            `}</style>
        </button>
    );
}

// Styles
const buttonStyle: CSSProperties = {
    position: 'fixed',
    bottom: '24px',
    right: '24px',
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '0.75rem 1rem',
    paddingBottom: '1rem',
    backgroundColor: '#1e293b',
    border: 'none',
    borderRadius: '14px',
    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3), 0 8px 10px -6px rgba(0, 0, 0, 0.2)',
    cursor: 'pointer',
    zIndex: 9998,
    minWidth: '200px',
    overflow: 'hidden',
    transition: 'transform 0.2s, box-shadow 0.2s'
};

const iconWrapperStyle: CSSProperties = {
    width: '36px',
    height: '36px',
    borderRadius: '10px',
    background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0
};

const contentStyle: CSSProperties = {
    flex: 1,
    textAlign: 'left'
};

const mainTextStyle: CSSProperties = {
    color: '#fff',
    fontSize: '0.875rem',
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    gap: '0.375rem'
};

const pulseStyle: CSSProperties = {
    color: '#10b981',
    animation: 'floatPulse 1s infinite'
};

const subTextStyle: CSSProperties = {
    color: '#94a3b8',
    fontSize: '0.75rem',
    marginTop: '0.125rem',
    maxWidth: '120px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
};

const expandIconStyle: CSSProperties = {
    color: '#64748b',
    flexShrink: 0
};

const progressBgStyle: CSSProperties = {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '4px',
    backgroundColor: 'rgba(255, 255, 255, 0.1)'
};

const progressFillStyle: CSSProperties = {
    height: '100%',
    background: 'linear-gradient(90deg, #3b82f6 0%, #10b981 100%)',
    transition: 'width 0.3s ease-out'
};
