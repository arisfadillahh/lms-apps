'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { z } from 'zod';
import * as Dialog from '@radix-ui/react-dialog';
import { X, Plus } from 'lucide-react';
import type { CSSProperties } from 'react';

// Schema generator to accept dynamic max value
const createSchema = (maxOrder: number) => z.object({
    title: z.string().min(3, 'Minimal 3 karakter'),
    summary: z.string().optional(),
    orderIndex: z.number().int().min(1, 'Urutan minimal 1').max(maxOrder, `Urutan maksimal ${maxOrder}`),
    estimatedMeetingCount: z.number().int().min(0).optional().or(z.nan().transform(() => undefined)),
    slideUrl: z.string().url('URL tidak valid').optional().or(z.literal('')),
    exampleUrl: z.string().url('URL tidak valid').optional().or(z.literal('')),
    makeUpInstructions: z.string().optional(),
});

type FormValues = {
    title: string;
    summary?: string;
    orderIndex: number;
    estimatedMeetingCount?: number;
    slideUrl?: string;
    exampleUrl?: string;
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
            orderIndex: suggestedOrderIndex + 1,
            estimatedMeetingCount: 1,
            slideUrl: '',
            exampleUrl: '',
            makeUpInstructions: '',
        },
    });

    const onSubmit = async (values: FormValues) => {
        setErrorV(null);

        const payload = {
            title: values.title,
            summary: values.summary,
            orderIndex: values.orderIndex,
            estimatedMeetingCount: values.estimatedMeetingCount,
            slideUrl: values.slideUrl || undefined,
            exampleUrl: values.exampleUrl || undefined,
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
                estimatedMeetingCount: 1,
                slideUrl: '',
                exampleUrl: '',
                makeUpInstructions: '',
            });
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
                                <input type="number" style={inputStyle} {...register('orderIndex', { valueAsNumber: true })} />
                                {errors.orderIndex ? <span style={errorStyle}>{errors.orderIndex.message}</span> : null}
                            </div>
                            <div style={fieldGroupStyle}>
                                <label style={labelStyle}>Jumlah Pertemuan (Sesi)</label>
                                <input type="number" style={inputStyle} {...register('estimatedMeetingCount', { valueAsNumber: true })} min={1} defaultValue={1} />
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

                        <div style={fieldGroupStyle}>
                            <label style={labelStyle}>URL Contoh Game (Opsional)</label>
                            <input
                                type="url"
                                style={inputStyle}
                                {...register('exampleUrl')}
                                placeholder="https://scratch.mit.edu/projects/..."
                            />
                            {errors.exampleUrl ? <span style={errorStyle}>{errors.exampleUrl.message}</span> : null}
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
    backgroundColor: '#1e3a5f',
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
