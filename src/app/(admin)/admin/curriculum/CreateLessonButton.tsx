'use client';

import { useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { z } from 'zod';
import * as Dialog from '@radix-ui/react-dialog';
import { X, Plus, Upload } from 'lucide-react';
import type { CSSProperties } from 'react';

// Schema generator to accept dynamic max value
const createSchema = (maxOrder: number) => z.object({
    title: z.string().min(3, 'Minimal 3 karakter'),
    summary: z.string().optional(),
    orderIndex: z.coerce.number().int().min(1, 'Urutan minimal 1').max(maxOrder, `Urutan maksimal ${maxOrder}`),
    durationMinutes: z.coerce.number().int().min(0).optional(),
    slideUrl: z.string().url('URL tidak valid').optional().or(z.literal('')),
    makeUpInstructions: z.string().optional(),
    // File validation manually handled or via distinct field if using react-hook-form for files
});

type FormValues = {
    title: string;
    summary?: string;
    orderIndex: number;
    durationMinutes?: number;
    slideUrl?: string;
    makeUpInstructions?: string;
};

type CreateLessonButtonProps = {
    blockId: string;
    suggestedOrderIndex: number; // This is essentially the current lesson count
};

export default function CreateLessonButton({ blockId, suggestedOrderIndex }: CreateLessonButtonProps) {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [errorV, setErrorV] = useState<string | null>(null);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Suggested (default) is count + 1 (1-based), which is technically index=count in 0-based.
    // Validation Max is count + 1. 
    // e.g. 10 lessons. max valid input is 11.
    const maxOrder = suggestedOrderIndex + 1;
    const Schema = createSchema(maxOrder);

    const {
        register,
        handleSubmit,
        reset,
        formState: { errors, isSubmitting },
    } = useForm<FormValues>({
        resolver: zodResolver(Schema),
        defaultValues: {
            title: '',
            summary: '',
            orderIndex: suggestedOrderIndex + 1, // Display 1-based default (next available)
            durationMinutes: 60,
            slideUrl: '',
            makeUpInstructions: '',
        },
    });

    const onSubmit = async (values: FormValues) => {
        setErrorV(null);

        // 1. Create Lesson
        // Convert 1-based UI index to 0-based DB index
        const dbOrderIndex = values.orderIndex > 0 ? values.orderIndex - 1 : 0;

        const payload = {
            title: values.title,
            summary: values.summary,
            orderIndex: dbOrderIndex,
            durationMinutes: values.durationMinutes || 60,
            slideUrl: values.slideUrl || undefined,
            makeUpInstructions: values.makeUpInstructions || undefined,
        };

        try {
            const response = await fetch(`/api/admin/curriculum/blocks/${blockId}/lessons`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                throw new Error(data.error ?? 'Gagal membuat lesson');
            }

            const { lesson } = await response.json();

            // 2. Upload Example Game (if selected)
            if (selectedFile && lesson?.id) {
                const formData = new FormData();
                formData.append('file', selectedFile);

                const uploadRes = await fetch(`/api/admin/curriculum/lessons/${lesson.id}/example`, {
                    method: 'POST',
                    body: formData,
                });

                if (!uploadRes.ok) {
                    // Non-blocking error, just warn? Or show error?
                    // User expects it to work. If upload fails, maybe alert?
                    console.error("Upload failed");
                    // We don't stop the whole success flow, but maybe show a toast?
                    // For now, let's treat it as partial success.
                }
            }

            handleClose();
            router.refresh();

        } catch (err: any) {
            setErrorV(err.message);
        }
    };

    const handleClose = () => {
        setOpen(false);
        setTimeout(() => {
            reset({
                title: '',
                summary: '',
                orderIndex: suggestedOrderIndex + 1,
                durationMinutes: 60,
                slideUrl: '',
                makeUpInstructions: '',
            });
            setSelectedFile(null);
            setErrorV(null);
        }, 300);
    };

    return (
        <Dialog.Root open={open} onOpenChange={(val) => !val && handleClose()} >
            <Dialog.Trigger asChild>
                <button type="button" style={primaryButtonStyle} onClick={() => setOpen(true)}>
                    <Plus size={16} />
                    <span>Tambah Lesson</span>
                </button>
            </Dialog.Trigger>
            <Dialog.Portal>
                <Dialog.Overlay style={overlayStyle} />
                <Dialog.Content style={contentStyle}>
                    <div style={headerStyle}>
                        <Dialog.Title style={{ fontSize: '1.2rem', fontWeight: 600, color: '#0f172a' }}>
                            Tambah Lesson Baru
                        </Dialog.Title>
                        <Dialog.Close asChild>
                            <button style={closeButtonStyle}>
                                <X size={20} />
                            </button>
                        </Dialog.Close>
                    </div>

                    <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div style={fieldGroupStyle}>
                            <label style={labelStyle}>Judul Lesson</label>
                            <input type="text" style={inputStyle} {...register('title')} placeholder="Contoh: Intro to Algorithm" />
                            {errors.title ? <span style={errorStyle}>{errors.title.message}</span> : null}
                        </div>

                        <div style={{ display: 'flex', gap: '1rem' }}>
                            <div style={fieldGroupStyle}>
                                <label style={labelStyle}>Urutan (Max {maxOrder})</label>
                                <input type="number" style={inputStyle} {...register('orderIndex')} />
                                {errors.orderIndex ? <span style={errorStyle}>{errors.orderIndex.message}</span> : null}
                            </div>
                            <div style={fieldGroupStyle}>
                                <label style={labelStyle}>Durasi (menit)</label>
                                <input type="number" style={inputStyle} {...register('durationMinutes')} />
                            </div>
                        </div>

                        <div style={fieldGroupStyle}>
                            <label style={labelStyle}>Ringkasan</label>
                            <textarea style={textareaStyle} rows={3} {...register('summary')} placeholder="Deskripsi singkat..." />
                        </div>

                        <div style={fieldGroupStyle}>
                            <label style={labelStyle}>URL Slide</label>
                            <input type="url" style={inputStyle} {...register('slideUrl')} placeholder="https://..." />
                            {errors.slideUrl ? <span style={errorStyle}>{errors.slideUrl.message}</span> : null}
                        </div>

                        {/* Upload Section Inline */}
                        <div style={fieldGroupStyle}>
                            <label style={labelStyle}>Upload Contoh Game (Opsional)</label>
                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    style={{ display: 'none' }}
                                    accept=".zip,.rar,.7z"
                                    onChange={(e) => {
                                        if (e.target.files?.[0]) setSelectedFile(e.target.files[0]);
                                    }}
                                />
                                <button
                                    type="button"
                                    style={secondaryButtonStyle}
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    <Upload size={16} />
                                    {selectedFile ? 'Ganti File' : 'Pilih File'}
                                </button>
                                <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
                                    {selectedFile ? selectedFile.name : 'Belum ada file'}
                                </span>
                            </div>
                        </div>

                        <div style={fieldGroupStyle}>
                            <label style={labelStyle}>Instruksi Make-Up</label>
                            <textarea style={textareaStyle} rows={2} {...register('makeUpInstructions')} placeholder="Instruksi tambahan..." />
                        </div>

                        {errorV ? <div style={{ color: '#ef4444', fontSize: '0.85rem' }}>{errorV}</div> : null}

                        <div style={footerStyle}>
                            <button
                                type="submit"
                                style={primaryButtonStyle}
                                disabled={isSubmitting}
                            >
                                {isSubmitting ? 'Menyimpan...' : 'Buat Lesson'}
                            </button>
                        </div>
                    </form>
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
    borderRadius: '0.5rem',
    boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
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
    marginBottom: '1.5rem',
};

const closeButtonStyle: CSSProperties = {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: '#64748b',
};

const fieldGroupStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem',
    flex: 1,
};

const labelStyle: CSSProperties = {
    fontSize: '0.875rem',
    fontWeight: 500,
    color: '#334155', // Slate 700
};

const inputStyle: CSSProperties = {
    padding: '0.5rem 0.75rem',
    border: '1px solid #cbd5e1',
    borderRadius: '0.375rem',
    fontSize: '0.9rem',
    color: '#0f172a', // Slate 900
};

const textareaStyle: CSSProperties = {
    padding: '0.5rem 0.75rem',
    border: '1px solid #cbd5e1',
    borderRadius: '0.375rem',
    fontSize: '0.9rem',
    fontFamily: 'inherit',
    resize: 'vertical',
    color: '#0f172a', // Slate 900
};

const errorStyle: CSSProperties = {
    color: '#ef4444',
    fontSize: '0.75rem',
};

const footerStyle: CSSProperties = {
    display: 'flex',
    justifyContent: 'flex-end',
    marginTop: '1rem',
};

const primaryButtonStyle: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.5rem',
    backgroundColor: '#2563eb',
    color: 'white',
    border: 'none',
    padding: '0.5rem 1rem',
    borderRadius: '0.375rem',
    fontSize: '0.9rem',
    fontWeight: 500,
    cursor: 'pointer',
};

const secondaryButtonStyle: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.5rem',
    backgroundColor: '#fff',
    color: '#334155',
    border: '1px solid #cbd5e1',
    padding: '0.4rem 0.8rem',
    borderRadius: '0.375rem',
    fontSize: '0.85rem',
    cursor: 'pointer',
};
