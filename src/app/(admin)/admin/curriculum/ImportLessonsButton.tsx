'use client';

import { useState, useRef, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import * as Dialog from '@radix-ui/react-dialog';
import { X, Upload, FileSpreadsheet, Info, CheckCircle2, AlertCircle } from 'lucide-react';

type ImportLessonsButtonProps = {
    blockId: string;
    currentLessonCount: number;
};

interface ParsedLesson {
    title: string;
    summary: string;
    estimatedMeetingCount: number;
    slideUrl?: string;
    makeUpInstructions?: string;
}

export default function ImportLessonsButton({ blockId, currentLessonCount }: ImportLessonsButtonProps) {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [showInstructions, setShowInstructions] = useState(true);
    const [file, setFile] = useState<File | null>(null);
    const [parsedLessons, setParsedLessons] = useState<ParsedLesson[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [importing, setImporting] = useState(false);
    const [result, setResult] = useState<{ success: number; failed: number } | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        setError(null);
        setResult(null);
        const selected = e.target.files?.[0];
        if (!selected) return;

        if (!selected.name.endsWith('.csv')) {
            setError('Format file harus CSV');
            return;
        }

        setFile(selected);
        setShowInstructions(false);

        // Parse CSV
        try {
            const text = await selected.text();
            const lines = text.split('\n').filter(line => line.trim());

            if (lines.length < 2) {
                setError('File CSV kosong atau tidak memiliki data');
                return;
            }

            // Skip header row
            const dataRows = lines.slice(1);
            const parsed: ParsedLesson[] = [];

            for (const row of dataRows) {
                // Parse CSV properly (handle commas in quoted strings)
                const columns = parseCSVLine(row);

                if (columns.length < 2) continue; // Skip invalid rows

                parsed.push({
                    title: columns[0]?.trim() || '',
                    summary: columns[1]?.trim() || '',
                    estimatedMeetingCount: parseInt(columns[2]) || 1,
                    slideUrl: columns[3]?.trim() || undefined,
                    makeUpInstructions: columns[4]?.trim() || undefined,
                });
            }

            if (parsed.length === 0) {
                setError('Tidak ada data lesson yang valid di file');
                return;
            }

            setParsedLessons(parsed);
        } catch (err) {
            setError('Gagal membaca file: ' + String(err));
        }
    };

    const parseCSVLine = (line: string): string[] => {
        const result: string[] = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];

            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                result.push(current);
                current = '';
            } else {
                current += char;
            }
        }
        result.push(current);
        return result;
    };

    const handleImport = async () => {
        if (parsedLessons.length === 0) return;

        setImporting(true);
        setError(null);

        let success = 0;
        let failed = 0;

        try {
            for (let i = 0; i < parsedLessons.length; i++) {
                const lesson = parsedLessons[i];
                const orderIndex = currentLessonCount + i + 1;

                try {
                    const res = await fetch(`/api/admin/curriculum/blocks/${blockId}/lessons`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            title: lesson.title,
                            summary: lesson.summary,
                            orderIndex,
                            estimatedMeetingCount: lesson.estimatedMeetingCount,
                            slideUrl: lesson.slideUrl || undefined,
                            makeUpInstructions: lesson.makeUpInstructions || undefined,
                        }),
                    });

                    if (res.ok) {
                        success++;
                    } else {
                        failed++;
                    }
                } catch {
                    failed++;
                }
            }

            setResult({ success, failed });

            if (success > 0) {
                router.refresh();
            }
        } catch (err) {
            setError('Import gagal: ' + String(err));
        } finally {
            setImporting(false);
        }
    };

    const handleClose = () => {
        setOpen(false);
        setTimeout(() => {
            setFile(null);
            setParsedLessons([]);
            setError(null);
            setResult(null);
            setShowInstructions(true);
        }, 300);
    };

    return (
        <Dialog.Root open={open} onOpenChange={(val) => !val && handleClose()}>
            <Dialog.Trigger asChild>
                <button type="button" style={secondaryButtonStyle} onClick={() => setOpen(true)}>
                    <FileSpreadsheet size={16} />
                    <span>Import dari CSV</span>
                </button>
            </Dialog.Trigger>
            <Dialog.Portal>
                <Dialog.Overlay style={overlayStyle} />
                <Dialog.Content style={contentStyle}>
                    <div style={headerStyle}>
                        <Dialog.Title style={{ fontSize: '1.2rem', fontWeight: 600, color: '#0f172a' }}>
                            📥 Import Lessons dari CSV
                        </Dialog.Title>
                        <Dialog.Close asChild>
                            <button style={closeButtonStyle}>
                                <X size={20} />
                            </button>
                        </Dialog.Close>
                    </div>

                    {/* Instructions */}
                    {showInstructions && (
                        <div style={instructionsBoxStyle}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                                <Info size={18} color="#3b82f6" />
                                <strong style={{ color: '#1e40af' }}>Format CSV yang Dibutuhkan:</strong>
                            </div>
                            <p style={{ fontSize: '0.9rem', color: '#334155', marginBottom: '0.75rem' }}>
                                Buat file CSV dengan kolom berikut (baris pertama = header):
                            </p>
                            <div style={codeBlockStyle}>
                                <code>title,summary,meetings,slide_url,makeup_instructions</code>
                            </div>
                            <table style={sampleTableStyle}>
                                <thead>
                                    <tr>
                                        <th style={sampleThStyle}>Kolom</th>
                                        <th style={sampleThStyle}>Wajib</th>
                                        <th style={sampleThStyle}>Keterangan</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr><td style={sampleTdStyle}>title</td><td style={sampleTdStyle}>✓</td><td style={sampleTdStyle}>Judul lesson</td></tr>
                                    <tr><td style={sampleTdStyle}>summary</td><td style={sampleTdStyle}>-</td><td style={sampleTdStyle}>Ringkasan/deskripsi</td></tr>
                                    <tr><td style={sampleTdStyle}>meetings</td><td style={sampleTdStyle}>-</td><td style={sampleTdStyle}>Jumlah pertemuan (default: 1)</td></tr>
                                    <tr><td style={sampleTdStyle}>slide_url</td><td style={sampleTdStyle}>-</td><td style={sampleTdStyle}>URL slide presentasi</td></tr>
                                    <tr><td style={sampleTdStyle}>makeup_instructions</td><td style={sampleTdStyle}>-</td><td style={sampleTdStyle}>Instruksi make-up class</td></tr>
                                </tbody>
                            </table>
                            <p style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '0.75rem' }}>
                                💡 Tip: Gunakan Google Sheets lalu export sebagai CSV
                            </p>
                        </div>
                    )}

                    {/* File Upload */}
                    <div style={{ marginTop: '1rem' }}>
                        <input
                            type="file"
                            ref={fileInputRef}
                            accept=".csv"
                            style={{ display: 'none' }}
                            onChange={handleFileChange}
                        />
                        <button
                            type="button"
                            style={uploadButtonStyle}
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <Upload size={18} />
                            {file ? 'Ganti File' : 'Pilih File CSV'}
                        </button>
                        {file && (
                            <span style={{ marginLeft: '0.75rem', color: '#475569', fontSize: '0.9rem' }}>
                                📄 {file.name}
                            </span>
                        )}
                    </div>

                    {/* Error */}
                    {error && (
                        <div style={errorBoxStyle}>
                            <AlertCircle size={16} />
                            {error}
                        </div>
                    )}

                    {/* Preview */}
                    {parsedLessons.length > 0 && !result && (
                        <div style={{ marginTop: '1rem' }}>
                            <h4 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '0.5rem' }}>
                                Preview ({parsedLessons.length} lessons):
                            </h4>
                            <div style={previewContainerStyle}>
                                <table style={previewTableStyle}>
                                    <thead>
                                        <tr>
                                            <th style={previewThStyle}>#</th>
                                            <th style={previewThStyle}>Title</th>
                                            <th style={previewThStyle}>Meetings</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {parsedLessons.slice(0, 10).map((lesson, idx) => (
                                            <tr key={idx}>
                                                <td style={previewTdStyle}>{currentLessonCount + idx + 1}</td>
                                                <td style={previewTdStyle}>{lesson.title}</td>
                                                <td style={previewTdStyle}>{lesson.estimatedMeetingCount}</td>
                                            </tr>
                                        ))}
                                        {parsedLessons.length > 10 && (
                                            <tr>
                                                <td colSpan={3} style={{ ...previewTdStyle, textAlign: 'center', color: '#64748b' }}>
                                                    ...dan {parsedLessons.length - 10} lainnya
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Result */}
                    {result && (
                        <div style={resultBoxStyle}>
                            <CheckCircle2 size={20} color="#16a34a" />
                            <span>
                                Import selesai! <strong>{result.success}</strong> berhasil
                                {result.failed > 0 && <>, <span style={{ color: '#dc2626' }}>{result.failed} gagal</span></>}
                            </span>
                        </div>
                    )}

                    {/* Actions */}
                    <div style={footerStyle}>
                        {!result ? (
                            <>
                                <button type="button" style={cancelButtonStyle} onClick={handleClose}>
                                    Batal
                                </button>
                                <button
                                    type="button"
                                    style={primaryButtonStyle}
                                    disabled={parsedLessons.length === 0 || importing}
                                    onClick={handleImport}
                                >
                                    {importing ? 'Mengimport...' : `Import ${parsedLessons.length} Lesson`}
                                </button>
                            </>
                        ) : (
                            <button type="button" style={primaryButtonStyle} onClick={handleClose}>
                                Selesai
                            </button>
                        )}
                    </div>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
}

// Styles
const overlayStyle: CSSProperties = {
    backgroundColor: 'rgba(0,0,0,0.5)',
    position: 'fixed',
    inset: 0,
    zIndex: 50,
};

const contentStyle: CSSProperties = {
    backgroundColor: 'white',
    borderRadius: '12px',
    boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
    position: 'fixed',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: '90%',
    maxWidth: '600px',
    maxHeight: '90vh',
    overflowY: 'auto',
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

const instructionsBoxStyle: CSSProperties = {
    background: '#eff6ff',
    border: '1px solid #bfdbfe',
    borderRadius: '8px',
    padding: '1rem',
};

const codeBlockStyle: CSSProperties = {
    background: '#1e293b',
    color: '#e2e8f0',
    padding: '0.5rem 0.75rem',
    borderRadius: '6px',
    fontSize: '0.8rem',
    fontFamily: 'monospace',
    overflowX: 'auto',
};

const sampleTableStyle: CSSProperties = {
    width: '100%',
    marginTop: '0.75rem',
    fontSize: '0.8rem',
    borderCollapse: 'collapse',
};

const sampleThStyle: CSSProperties = {
    textAlign: 'left',
    padding: '0.4rem',
    borderBottom: '1px solid #bfdbfe',
    color: '#1e40af',
};

const sampleTdStyle: CSSProperties = {
    padding: '0.4rem',
    borderBottom: '1px solid #dbeafe',
    color: '#334155',
};

const uploadButtonStyle: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.5rem',
    backgroundColor: '#f1f5f9',
    color: '#334155',
    border: '2px dashed #cbd5e1',
    padding: '0.75rem 1.25rem',
    borderRadius: '8px',
    fontSize: '0.9rem',
    fontWeight: 500,
    cursor: 'pointer',
};

const errorBoxStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    marginTop: '1rem',
    padding: '0.75rem',
    background: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: '6px',
    color: '#dc2626',
    fontSize: '0.9rem',
};

const previewContainerStyle: CSSProperties = {
    maxHeight: '200px',
    overflowY: 'auto',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
};

const previewTableStyle: CSSProperties = {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '0.85rem',
};

const previewThStyle: CSSProperties = {
    textAlign: 'left',
    padding: '0.5rem 0.75rem',
    background: '#f8fafc',
    borderBottom: '1px solid #e2e8f0',
    fontWeight: 600,
    color: '#64748b',
};

const previewTdStyle: CSSProperties = {
    padding: '0.5rem 0.75rem',
    borderBottom: '1px solid #f1f5f9',
    color: '#334155',
};

const resultBoxStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    marginTop: '1rem',
    padding: '1rem',
    background: '#f0fdf4',
    border: '1px solid #bbf7d0',
    borderRadius: '8px',
    color: '#166534',
    fontSize: '0.95rem',
};

const footerStyle: CSSProperties = {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '0.75rem',
    marginTop: '1.5rem',
    paddingTop: '1rem',
    borderTop: '1px solid #f1f5f9',
};

const secondaryButtonStyle: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.5rem',
    backgroundColor: '#fff',
    color: '#334155',
    border: '1px solid #cbd5e1',
    padding: '0.5rem 1rem',
    borderRadius: '0.375rem',
    fontSize: '0.9rem',
    cursor: 'pointer',
};

const cancelButtonStyle: CSSProperties = {
    padding: '0.5rem 1rem',
    backgroundColor: '#f1f5f9',
    color: '#475569',
    border: 'none',
    borderRadius: '6px',
    fontSize: '0.9rem',
    cursor: 'pointer',
};

const primaryButtonStyle: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.5rem',
    backgroundColor: '#1e3a5f',
    color: 'white',
    border: 'none',
    padding: '0.5rem 1.25rem',
    borderRadius: '6px',
    fontSize: '0.9rem',
    fontWeight: 500,
    cursor: 'pointer',
};
