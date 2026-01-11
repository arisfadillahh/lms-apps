'use client';

import type { CSSProperties } from 'react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { z } from 'zod';

const schema = z.object({
  name: z.string().min(3, 'Minimal 3 karakter'),
  summary: z
    .string()
    .max(500, 'Maksimal 500 karakter')
    .optional()
    .or(z.literal('').transform(() => undefined)),
  orderIndex: z.coerce.number().int().min(0, 'Urutan harus >= 0'),
});

type FormValues = z.infer<typeof schema>;

type CreateBlockFormProps = {
  levelId: string;
  suggestedOrderIndex: number;
};

export default function CreateBlockForm({ levelId, suggestedOrderIndex }: CreateBlockFormProps) {
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
      name: '',
      summary: '',
      orderIndex: suggestedOrderIndex,
    },
  });

  const onSubmit = async (values: FormValues) => {
    setStatusMessage(null);

    const payload = {
      levelId,
      name: values.name,
      summary: values.summary,
      orderIndex: values.orderIndex,
    };

    const response = await fetch('/api/admin/curriculum/blocks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      window.alert(data.error ?? 'Gagal membuat block');
      return;
    }

    setStatusMessage('Block tersimpan');
    reset({
      name: '',
      summary: '',
      orderIndex: payload.orderIndex + 1,
    });
    router.refresh();
    setTimeout(() => setStatusMessage(null), 3000);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} style={formStyle}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
        <label style={labelStyle}>Nama Block</label>
        <input type="text" style={inputStyle} {...register('name')} />
        {errors.name ? <span style={errorStyle}>{errors.name.message}</span> : null}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
        <label style={labelStyle}>Ringkasan</label>
        <textarea rows={2} style={{ ...inputStyle, resize: 'vertical' }} {...register('summary')} />
        {errors.summary ? <span style={errorStyle}>{errors.summary.message}</span> : null}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', maxWidth: '200px' }}>
        <label style={labelStyle}>Urutan</label>
        <input type="number" style={inputStyle} {...register('orderIndex')} />
        {errors.orderIndex ? <span style={errorStyle}>{errors.orderIndex.message}</span> : null}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <button
          type="submit"
          style={{
            padding: '0.55rem 1rem',
            borderRadius: '0.5rem',
            border: 'none',
            background: '#2563eb',
            color: '#fff',
            fontWeight: 600,
            cursor: 'pointer',
            opacity: isSubmitting ? 0.6 : 1,
          }}
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Menyimpan…' : 'Tambah Block'}
        </button>
        {statusMessage ? <span style={{ fontSize: '0.8rem', color: 'var(--color-success)' }}>{statusMessage}</span> : null}
      </div>
    </form>
  );
}

const formStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-end',
  gap: '1rem',
  padding: '0.75rem 1rem',
  borderRadius: 'var(--radius-lg)',
  border: `1px solid var(--color-border)`,
  background: 'var(--color-bg-surface)',
  boxShadow: 'var(--shadow-medium)',
};

const labelStyle: CSSProperties = {
  fontSize: '0.85rem',
  color: '#334155', // Slate-700
  fontWeight: 500,
};

const inputStyle: CSSProperties = {
  padding: '0.55rem 0.75rem',
  borderRadius: '0.5rem',
  border: `1px solid #cbd5e1`,
  fontSize: '0.9rem',
  color: '#0f172a',
  background: '#ffffff',
};

const errorStyle: CSSProperties = {
  fontSize: '0.75rem',
  color: '#ef4444', // Red-500
};
