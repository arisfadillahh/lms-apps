'use client';

import { useState, useEffect, type CSSProperties } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X, Award, CheckCircle2, AlertCircle } from 'lucide-react';

type Level = { id: string; name: string };
type Block = { id: string; name: string; order_index: number };

interface ProgressOverrideButtonProps {
    coderId: string;
    coderName: string;
}

export default function ProgressOverrideButton({ coderId, coderName }: ProgressOverrideButtonProps) {
    const [open, setOpen] = useState(false);
    const [levels, setLevels] = useState<Level[]>([]);
    const [blocks, setBlocks] = useState<Block[]>([]);
    const [selectedLevel, setSelectedLevel] = useState('');
    const [selectedBlock, setSelectedBlock] = useState('');
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

    // Fetch levels on mount
    useEffect(() => {
        if (!open) return;

        const fetchLevels = async () => {
            try {
                const res = await fetch('/api/admin/curriculum/levels');
                if (res.ok) {
                    const data = await res.json();
                    setLevels(data.levels || []);
                }
            } catch (error) {
                console.error('Error fetching levels:', error);
            }
        };
        fetchLevels();
    }, [open]);

    // Fetch blocks when level changes
    useEffect(() => {
        if (!selectedLevel) {
            setBlocks([]);
            setSelectedBlock('');
            return;
        }

        const fetchBlocks = async () => {
            setLoading(true);
            try {
                const res = await fetch(`/api/admin/curriculum/levels/${selectedLevel}/blocks`);
                if (res.ok) {
                    const data = await res.json();
                    setBlocks(data.blocks || []);
                }
            } catch (error) {
                console.error('Error fetching blocks:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchBlocks();
    }, [selectedLevel]);

    const handleSubmit = async () => {
        if (!selectedBlock) return;

        setSubmitting(true);
        setResult(null);

        try {
            const res = await fetch(`/api/admin/coders/${coderId}/progress`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    blockId: selectedBlock,
                    action: 'complete'
                }),
            });

            const data = await res.json();

            if (res.ok) {
                setResult({ success: true, message: data.message || 'Block berhasil ditandai selesai!' });
            } else {
                setResult({ success: false, message: data.error || 'Gagal mengupdate progress' });
            }
        } catch (error) {
            setResult({ success: false, message: 'Error: ' + String(error) });
        } finally {
            setSubmitting(false);
        }
    };

    const handleClose = () => {
        setOpen(false);
        setTimeout(() => {
            setSelectedLevel('');
            setSelectedBlock('');
            setBlocks([]);
            setResult(null);
        }, 300);
    };

    return (
        <Dialog.Root open={open} onOpenChange={(val) => !val && handleClose()}>
            <Dialog.Trigger asChild>
                <button
                    style={triggerButtonStyle}
                    onClick={() => setOpen(true)}
                    title="Override Progress"
                >
                    <Award size={14} />
                </button>
            </Dialog.Trigger>
            <Dialog.Portal>
                <Dialog.Overlay style={overlayStyle} />
                <Dialog.Content style={contentStyle}>
                    <div style={headerStyle}>
                        <Dialog.Title style={{ fontSize: '1.1rem', fontWeight: 600, color: '#0f172a', margin: 0 }}>
                            🎯 Override Progress
                        </Dialog.Title>
                        <Dialog.Close asChild>
                            <button style={closeButtonStyle}>
                                <X size={18} />
                            </button>
                        </Dialog.Close>
                    </div>

                    <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '1rem' }}>
                        Tandai <strong>{coderName}</strong> sudah menyelesaikan block tertentu.
                        <br />
                        <span style={{ fontSize: '0.8rem' }}>Digunakan untuk migrasi coder lama ke LMS.</span>
                    </p>

                    {/* Level Dropdown */}
                    <div style={fieldStyle}>
                        <label style={labelStyle}>Pilih Level</label>
                        <select
                            style={selectStyle}
                            value={selectedLevel}
                            onChange={(e) => setSelectedLevel(e.target.value)}
                        >
                            <option value="">-- Pilih Level --</option>
                            {levels.map((level) => (
                                <option key={level.id} value={level.id}>
                                    {level.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Block Dropdown */}
                    {selectedLevel && (
                        <div style={fieldStyle}>
                            <label style={labelStyle}>Pilih Block yang Sudah Selesai</label>
                            {loading ? (
                                <div style={{ color: '#94a3b8', fontSize: '0.9rem' }}>Loading blocks...</div>
                            ) : (
                                <select
                                    style={selectStyle}
                                    value={selectedBlock}
                                    onChange={(e) => setSelectedBlock(e.target.value)}
                                >
                                    <option value="">-- Pilih Block --</option>
                                    {blocks.map((block) => (
                                        <option key={block.id} value={block.id}>
                                            {block.order_index}. {block.name}
                                        </option>
                                    ))}
                                </select>
                            )}
                        </div>
                    )}

                    {/* Result Message */}
                    {result && (
                        <div style={result.success ? successBoxStyle : errorBoxStyle}>
                            {result.success ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                            {result.message}
                        </div>
                    )}

                    {/* Actions */}
                    <div style={footerStyle}>
                        <button style={cancelButtonStyle} onClick={handleClose}>
                            {result?.success ? 'Selesai' : 'Batal'}
                        </button>
                        {!result?.success && (
                            <button
                                style={submitButtonStyle}
                                disabled={!selectedBlock || submitting}
                                onClick={handleSubmit}
                            >
                                {submitting ? 'Menyimpan...' : 'Tandai Selesai'}
                            </button>
                        )}
                    </div>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
}

// Styles
const triggerButtonStyle: CSSProperties = {
    padding: '6px',
    backgroundColor: '#fef3c7',
    color: '#d97706',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
};

const overlayStyle: CSSProperties = {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    position: 'fixed',
    inset: 0,
    zIndex: 50,
};

const contentStyle: CSSProperties = {
    backgroundColor: 'white',
    borderRadius: '12px',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
    position: 'fixed',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: '90%',
    maxWidth: '420px',
    padding: '1.5rem',
    zIndex: 51,
};

const headerStyle: CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '1rem',
};

const closeButtonStyle: CSSProperties = {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: '#64748b',
};

const fieldStyle: CSSProperties = {
    marginBottom: '1rem',
};

const labelStyle: CSSProperties = {
    display: 'block',
    fontSize: '0.85rem',
    fontWeight: 500,
    color: '#475569',
    marginBottom: '0.5rem',
};

const selectStyle: CSSProperties = {
    width: '100%',
    padding: '0.75rem',
    borderRadius: '8px',
    border: '1px solid #e2e8f0',
    fontSize: '0.9rem',
    color: '#1e293b',
    backgroundColor: '#f8fafc',
};

const successBoxStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.75rem',
    background: '#f0fdf4',
    border: '1px solid #bbf7d0',
    borderRadius: '8px',
    color: '#166534',
    fontSize: '0.9rem',
    marginBottom: '1rem',
};

const errorBoxStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.75rem',
    background: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: '8px',
    color: '#dc2626',
    fontSize: '0.9rem',
    marginBottom: '1rem',
};

const footerStyle: CSSProperties = {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '0.75rem',
    marginTop: '1rem',
    paddingTop: '1rem',
    borderTop: '1px solid #f1f5f9',
};

const cancelButtonStyle: CSSProperties = {
    padding: '0.5rem 1rem',
    backgroundColor: '#f1f5f9',
    color: '#475569',
    border: 'none',
    borderRadius: '8px',
    fontSize: '0.9rem',
    cursor: 'pointer',
};

const submitButtonStyle: CSSProperties = {
    padding: '0.5rem 1.25rem',
    backgroundColor: '#f59e0b',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '0.9rem',
    fontWeight: 500,
    cursor: 'pointer',
};
