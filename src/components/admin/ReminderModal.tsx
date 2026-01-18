'use client';

import { type CSSProperties } from 'react';
import { useReminder } from '@/contexts/ReminderContext';
import { X, Minus, Square, RotateCcw, Send } from 'lucide-react';

export default function ReminderModal() {
    const {
        queue,
        isProcessing,
        isStopped,
        isMinimized,
        isVisible,
        setMinimized,
        closeReminder,
        stopReminder,
        retryFailed,
        getProgress
    } = useReminder();

    if (!isVisible || isMinimized) return null;

    const { sent, failed, total, percentage } = getProgress();
    const hasFailedOrStopped = queue.some(i => i.status === 'error' || i.status === 'stopped');
    const isComplete = !isProcessing && queue.every(i => i.status !== 'pending');

    return (
        <div style={overlayStyle}>
            <div style={modalStyle}>
                {/* Header */}
                <div style={headerStyle}>
                    <div style={headerLeftStyle}>
                        <div style={iconContainerStyle}>
                            <Send size={20} color="#fff" />
                        </div>
                        <div>
                            <h2 style={titleStyle}>Kirim Reminder WhatsApp</h2>
                            <p style={subtitleStyle}>
                                {isProcessing ? 'Sedang mengirim...' : isComplete ? 'Selesai' : 'Siap kirim'}
                            </p>
                        </div>
                    </div>
                    <div style={headerActionsStyle}>
                        <button
                            onClick={() => setMinimized(true)}
                            style={headerBtnStyle}
                            title="Minimize"
                        >
                            <Minus size={16} />
                        </button>
                        {!isProcessing && (
                            <button
                                onClick={closeReminder}
                                style={headerBtnStyle}
                                title="Tutup"
                            >
                                <X size={16} />
                            </button>
                        )}
                    </div>
                </div>

                {/* Progress Bar */}
                <div style={progressContainerStyle}>
                    <div style={progressBarBgStyle}>
                        <div style={{
                            ...progressBarFillStyle,
                            width: `${percentage}%`
                        }} />
                    </div>
                    <div style={progressTextStyle}>
                        <span>{sent} terkirim</span>
                        {failed > 0 && <span style={{ color: '#ef4444' }}> • {failed} gagal</span>}
                        <span style={{ marginLeft: 'auto' }}>{percentage}%</span>
                    </div>
                </div>

                {/* Queue List */}
                <div style={listContainerStyle}>
                    <table style={tableStyle}>
                        <thead>
                            <tr style={theadRowStyle}>
                                <th style={thStyle}>Invoice</th>
                                <th style={thStyle}>Orang Tua</th>
                                <th style={{ ...thStyle, textAlign: 'center' }}>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {queue.map((item) => (
                                <tr key={item.id} style={rowStyle}>
                                    <td style={tdStyle}>
                                        <span style={invoiceCodeStyle}>{item.invoice_number}</span>
                                    </td>
                                    <td style={tdStyle}>{item.parent_name}</td>
                                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                                        {item.status === 'pending' && (
                                            <span style={statusPendingStyle}>⏳ Menunggu</span>
                                        )}
                                        {item.status === 'sending' && (
                                            <span style={statusSendingStyle}>
                                                <span style={pulseStyle}>●</span> Mengirim
                                            </span>
                                        )}
                                        {item.status === 'success' && (
                                            <span style={statusSuccessStyle}>✓ Terkirim</span>
                                        )}
                                        {item.status === 'error' && (
                                            <span style={statusErrorStyle} title={item.error}>
                                                ✕ Gagal
                                            </span>
                                        )}
                                        {item.status === 'stopped' && (
                                            <span style={statusStoppedStyle}>⏸ Dihentikan</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Footer Actions */}
                <div style={footerStyle}>
                    {isProcessing && (
                        <button
                            onClick={stopReminder}
                            style={isStopped ? stoppingBtnStyle : stopBtnStyle}
                            disabled={isStopped}
                        >
                            {isStopped ? (
                                <>
                                    <span style={spinnerStyle}>●</span>
                                    Menghentikan...
                                </>
                            ) : (
                                <>
                                    <Square size={14} />
                                    Berhenti
                                </>
                            )}
                        </button>
                    )}

                    {!isProcessing && hasFailedOrStopped && (
                        <button onClick={retryFailed} style={retryBtnStyle}>
                            <RotateCcw size={14} />
                            Kirim Ulang Gagal ({queue.filter(i => i.status === 'error' || i.status === 'stopped').length})
                        </button>
                    )}

                    {!isProcessing && isComplete && !hasFailedOrStopped && (
                        <div style={completeMsgStyle}>
                            ✓ Semua reminder berhasil dikirim
                        </div>
                    )}
                </div>
            </div>

            <style>{`
                @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.4; }
                }
            `}</style>
        </div>
    );
}

// Styles
const overlayStyle: CSSProperties = {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    backdropFilter: 'blur(4px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    padding: '1rem'
};

const modalStyle: CSSProperties = {
    backgroundColor: '#fff',
    borderRadius: '16px',
    width: '100%',
    maxWidth: '560px',
    maxHeight: '80vh',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
    overflow: 'hidden'
};

const headerStyle: CSSProperties = {
    background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
    padding: '1.25rem 1.5rem',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
};

const headerLeftStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '0.875rem'
};

const iconContainerStyle: CSSProperties = {
    width: '44px',
    height: '44px',
    borderRadius: '12px',
    background: 'rgba(255, 255, 255, 0.2)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
};

const titleStyle: CSSProperties = {
    color: '#fff',
    fontSize: '1.125rem',
    fontWeight: 700,
    margin: 0
};

const subtitleStyle: CSSProperties = {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: '0.8rem',
    margin: '0.125rem 0 0'
};

const headerActionsStyle: CSSProperties = {
    display: 'flex',
    gap: '0.5rem'
};

const headerBtnStyle: CSSProperties = {
    width: '32px',
    height: '32px',
    borderRadius: '8px',
    background: 'rgba(255, 255, 255, 0.15)',
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
    transition: 'background 0.2s'
};

const progressContainerStyle: CSSProperties = {
    padding: '1rem 1.5rem'
};

const progressBarBgStyle: CSSProperties = {
    height: '8px',
    backgroundColor: '#e2e8f0',
    borderRadius: '4px',
    overflow: 'hidden'
};

const progressBarFillStyle: CSSProperties = {
    height: '100%',
    background: 'linear-gradient(90deg, #3b82f6 0%, #10b981 100%)',
    borderRadius: '4px',
    transition: 'width 0.3s ease-out'
};

const progressTextStyle: CSSProperties = {
    display: 'flex',
    fontSize: '0.8rem',
    color: '#64748b',
    marginTop: '0.5rem'
};

const listContainerStyle: CSSProperties = {
    flex: 1,
    overflowY: 'auto',
    margin: '0 1.5rem',
    border: '1px solid #e2e8f0',
    borderRadius: '10px',
    maxHeight: '280px'
};

const tableStyle: CSSProperties = {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '0.875rem'
};

const theadRowStyle: CSSProperties = {
    backgroundColor: '#f8fafc',
    position: 'sticky',
    top: 0
};

const thStyle: CSSProperties = {
    padding: '0.625rem 0.75rem',
    textAlign: 'left',
    fontSize: '0.7rem',
    fontWeight: 600,
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: '0.05em'
};

const rowStyle: CSSProperties = {
    borderBottom: '1px solid #f1f5f9'
};

const tdStyle: CSSProperties = {
    padding: '0.625rem 0.75rem',
    color: '#334155'
};

const invoiceCodeStyle: CSSProperties = {
    fontFamily: 'monospace',
    fontWeight: 600,
    color: '#3b82f6'
};

const statusPendingStyle: CSSProperties = {
    color: '#94a3b8',
    fontSize: '0.8rem'
};

const statusSendingStyle: CSSProperties = {
    color: '#f59e0b',
    fontSize: '0.8rem',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.25rem'
};

const pulseStyle: CSSProperties = {
    animation: 'pulse 1s infinite'
};

const statusSuccessStyle: CSSProperties = {
    color: '#10b981',
    fontSize: '0.8rem',
    fontWeight: 500
};

const statusErrorStyle: CSSProperties = {
    color: '#ef4444',
    fontSize: '0.8rem',
    fontWeight: 500,
    cursor: 'help'
};

const statusStoppedStyle: CSSProperties = {
    color: '#64748b',
    fontSize: '0.8rem'
};

const footerStyle: CSSProperties = {
    padding: '1rem 1.5rem',
    borderTop: '1px solid #f1f5f9',
    display: 'flex',
    justifyContent: 'center',
    gap: '0.75rem'
};

const stopBtnStyle: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.375rem',
    padding: '0.625rem 1.25rem',
    backgroundColor: '#fee2e2',
    color: '#dc2626',
    border: 'none',
    borderRadius: '8px',
    fontWeight: 600,
    fontSize: '0.875rem',
    cursor: 'pointer'
};

const stoppingBtnStyle: CSSProperties = {
    ...stopBtnStyle,
    backgroundColor: '#fef3c7',
    color: '#d97706',
    cursor: 'wait',
    opacity: 0.9
};

const spinnerStyle: CSSProperties = {
    animation: 'pulse 0.8s infinite'
};

const retryBtnStyle: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.375rem',
    padding: '0.625rem 1.25rem',
    backgroundColor: '#fef3c7',
    color: '#d97706',
    border: 'none',
    borderRadius: '8px',
    fontWeight: 600,
    fontSize: '0.875rem',
    cursor: 'pointer'
};

const completeMsgStyle: CSSProperties = {
    color: '#10b981',
    fontWeight: 600,
    fontSize: '0.9rem'
};
