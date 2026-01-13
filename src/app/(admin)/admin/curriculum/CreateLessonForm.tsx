'use client';

import type { CSSProperties } from 'react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { z } from 'zod';

const schema = z.object({
  title: z.string().min(3, 'Minimal 3 karakter'),
  summary: z
    .string()
    .max(500, 'Maksimal 500 karakter')
    .optional()
    .or(z.literal('').transform(() => undefined)),
  orderIndex: z.number().int().min(0, 'Urutan harus >= 0'),
  slideUrl: z.string().url('URL slide harus valid'),
  estimatedMeetingCount: z
    .number()
    .int()
    .min(0, 'Jumlah pertemuan harus >= 0')
    .optional()
    .or(z.nan().transform(() => undefined)),
  makeUpInstructions: z
    .string()
    .max(500, 'Maksimal 500 karakter')
    .optional()
    .or(z.literal('').transform(() => undefined)),
});

type FormValues = z.infer<typeof schema>;

type CreateLessonFormProps = {
  blockId: string;
  suggestedOrderIndex: number;
};

export default function CreateLessonForm({ blockId, suggestedOrderIndex }: CreateLessonFormProps) {
  const router = useRouter();
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: '',
      summary: '',
      orderIndex: suggestedOrderIndex,
      slideUrl: '',
      estimatedMeetingCount: undefined,
      makeUpInstructions: '',
    },
  });

  const onSubmit = async (values: FormValues) => {
    setStatusMessage(null);

    const response = await fetch(`/api/admin/curriculum/blocks/${blockId}/lessons`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: values.title,
        summary: values.summary,
        slideUrl: values.slideUrl,
        orderIndex: values.orderIndex,
        estimatedMeetingCount: values.estimatedMeetingCount,
        makeUpInstructions: values.makeUpInstructions,
      }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      window.alert(data.error ?? 'Gagal menambah lesson');
      return;
    }

    setStatusMessage('Lesson ditambahkan');
    reset({
      title: '',
      summary: '',
      orderIndex: values.orderIndex + 1,
      slideUrl: '',
      estimatedMeetingCount: undefined,
      makeUpInstructions: '',
    });
    router.refresh();
    setTimeout(() => setStatusMessage(null), 3000);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} style={formStyle}>
      <div style={fieldStyle}>
        <label style={labelStyle}>Judul Lesson</label>
        <input type="text" style={inputStyle} {...register('title')} />
        {errors.title ? <span style={errorStyle}>{errors.title.message}</span> : null}
      </div>
      <div style={fieldStyle}>
        <label style={labelStyle}>Ringkasan</label>
        <textarea rows={2} style={{ ...inputStyle, resize: 'vertical' }} {...register('summary')} />
        {errors.summary ? <span style={errorStyle}>{errors.summary.message}</span> : null}
      </div>
      <div style={fieldStyle}>
        <label style={labelStyle}>Link Google Slides</label>
        <input type="url" placeholder="https://docs.google.com/presentation/..." style={inputStyle} {...register('slideUrl')} />
        {errors.slideUrl ? <span style={errorStyle}>{errors.slideUrl.message}</span> : null}
      </div>
      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={fieldStyle}>
          <label style={labelStyle}>Urutan</label>
          <input type="number" style={inputStyle} {...register('orderIndex', { valueAsNumber: true })} />
          {errors.orderIndex ? <span style={errorStyle}>{errors.orderIndex.message}</span> : null}
        </div>
        <div style={fieldStyle}>
          <label style={labelStyle}>Jumlah Pertemuan (Sesi)</label>
          <input type="number" style={inputStyle} {...register('estimatedMeetingCount', { valueAsNumber: true })} />
          {errors.estimatedMeetingCount ? <span style={errorStyle}>{errors.estimatedMeetingCount.message}</span> : null}
        </div>
      </div>
      <div style={fieldStyle}>
        <label style={labelStyle}>Instruksi Make-up</label>
        <textarea rows={2} style={{ ...inputStyle, resize: 'vertical' }} {...register('makeUpInstructions')} />
        {errors.makeUpInstructions ? <span style={errorStyle}>{errors.makeUpInstructions.message}</span> : null}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <button
          type="submit"
          style={buttonStyle}
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Menyimpan…' : 'Tambah Lesson'}
        </button>
        {statusMessage ? <span style={{ fontSize: '0.8rem', color: 'var(--color-success)' }}>{statusMessage}</span> : null}
      </div>
    </form>
  );
}

const formStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.75rem',
  padding: '0.85rem 1rem',
  borderRadius: 'var(--radius-lg)',
  border: `1px solid var(--color-border)`,
  background: 'var(--color-bg-surface)',
  boxShadow: 'var(--shadow-medium)',
};

const fieldStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.35rem',
};

const labelStyle: CSSProperties = {
  fontSize: '0.85rem',
  color: 'var(--color-text-secondary)',
  fontWeight: 500,
};

const inputStyle: CSSProperties = {
  padding: '0.5rem 0.65rem',
  borderRadius: '0.5rem',
  border: `1px solid var(--color-border)`,
  fontSize: '0.9rem',
  color: 'var(--color-text-primary)',
  background: 'var(--color-bg-surface)',
};

const errorStyle: CSSProperties = {
  fontSize: '0.75rem',
  color: 'var(--color-danger)',
};

const buttonStyle: CSSProperties = {
  padding: '0.5rem 1rem',
  borderRadius: '0.5rem',
  border: 'none',
  background: 'var(--color-accent)',
  color: '#fff',
  fontWeight: 600,
  cursor: 'pointer',
};
