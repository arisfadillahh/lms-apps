'use client';

import type { CSSProperties } from 'react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { z } from 'zod';

import type { BlockRecord } from '@/lib/dao/blocksDao';

const schema = z.object({
  blockId: z.string().uuid('Pilih block'),
  startDate: z.string().min(1, 'Tanggal mulai wajib diisi'),
});

type FormValues = z.infer<typeof schema>;

type InstantiateBlockFormProps = {
  classId: string;
  availableBlocks: BlockRecord[];
  defaultStartDate: string;
  initialBlockId?: string;
};

export default function InstantiateBlockForm({
  classId,
  availableBlocks,
  defaultStartDate,
  initialBlockId,
}: InstantiateBlockFormProps) {
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
      blockId: initialBlockId ?? availableBlocks[0]?.id ?? '',
      startDate: defaultStartDate,
    },
  });

  if (availableBlocks.length === 0) {
    return (
      <section style={emptyStyle}>
        <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.35rem' }}>Class Blocks</h2>
        <p style={{ color: '#64748b', fontSize: '0.9rem' }}>
          Belum ada block published pada level ini. Silakan tambah melalui Curriculum Planner terlebih dahulu.
        </p>
      </section>
    );
  }

  const onSubmit = async (values: FormValues) => {
    setStatusMessage(null);
    const response = await fetch(`/api/admin/classes/${classId}/blocks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      window.alert(data.error ?? 'Gagal membuat class block');
      return;
    }

    setStatusMessage('Class block dibuat');
    reset({
      blockId: values.blockId,
      startDate: values.startDate,
    });
    router.refresh();
    setTimeout(() => setStatusMessage(null), 3000);
  };

  return (
    <section style={formContainerStyle}>
      <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.75rem' }}>Tambah Block ke Kelas</h2>
      <form onSubmit={handleSubmit(onSubmit)} style={formStyle}>
        <div style={fieldStyle}>
          <label style={labelStyle}>Block</label>
          <select style={inputStyle} {...register('blockId')}>
            <option value="">Pilih block</option>
            {availableBlocks
              .sort((a, b) => a.order_index - b.order_index)
              .map((block) => (
                <option key={block.id} value={block.id}>
                  {block.name} (Order {block.order_index})
                </option>
              ))}
          </select>
          {errors.blockId ? <span style={errorStyle}>{errors.blockId.message}</span> : null}
        </div>
        <div style={fieldStyle}>
          <label style={labelStyle}>Tanggal Mulai</label>
          <input type="date" style={inputStyle} {...register('startDate')} />
          {errors.startDate ? <span style={errorStyle}>{errors.startDate.message}</span> : null}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', gridColumn: '1 / -1' }}>
          <button
            type="submit"
            style={buttonStyle}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Menyimpan…' : 'Tambahkan Block'}
          </button>
          {statusMessage ? <span style={{ fontSize: '0.85rem', color: '#15803d' }}>{statusMessage}</span> : null}
        </div>
      </form>
    </section>
  );
}

const formContainerStyle: CSSProperties = {
  background: '#ffffff',
  borderRadius: '0.75rem',
  border: '1px solid #e5e7eb',
  padding: '1.25rem 1.5rem',
};

const formStyle: CSSProperties = {
  display: 'grid',
  gap: '1rem 1.25rem',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
};

const fieldStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.35rem',
};

const labelStyle: CSSProperties = {
  fontSize: '0.85rem',
  color: '#1f2937',
  fontWeight: 500,
};

const inputStyle: CSSProperties = {
  padding: '0.6rem 0.75rem',
  borderRadius: '0.5rem',
  border: '1px solid #cbd5f5',
  fontSize: '0.9rem',
};

const errorStyle: CSSProperties = {
  fontSize: '0.75rem',
  color: '#b91c1c',
};

const buttonStyle: CSSProperties = {
  padding: '0.6rem 1.2rem',
  borderRadius: '0.5rem',
  border: 'none',
  background: '#1e3a5f',
  color: '#fff',
  fontWeight: 600,
  cursor: 'pointer',
};

const emptyStyle: CSSProperties = {
  background: '#ffffff',
  borderRadius: '0.75rem',
  border: '1px solid #e5e7eb',
  padding: '1.25rem 1.5rem',
};
