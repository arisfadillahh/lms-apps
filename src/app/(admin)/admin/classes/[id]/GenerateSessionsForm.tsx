'use client';

import type { CSSProperties } from 'react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { generateSessionsSchema } from '@/lib/validation/admin';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';

const WEEK_DAYS = [
  { code: 'MO', label: 'Mon' },
  { code: 'TU', label: 'Tue' },
  { code: 'WE', label: 'Wed' },
  { code: 'TH', label: 'Thu' },
  { code: 'FR', label: 'Fri' },
  { code: 'SA', label: 'Sat' },
  { code: 'SU', label: 'Sun' },
] as const;

type FormValues = z.infer<typeof generateSessionsSchema>;

type GenerateSessionsFormProps = {
  classId: string;
};

export default function GenerateSessionsForm({ classId }: GenerateSessionsFormProps) {
  const [status, setStatus] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const router = useRouter();

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
    setValue,
  } = useForm<FormValues>({
    resolver: zodResolver(generateSessionsSchema),
    defaultValues: {
      startDate: '',
      endDate: '',
      byDay: ['MO'],
      time: '16:00',
      zoomLinkSnapshot: undefined,
    },
  });

  const selectedDays = watch('byDay') as FormValues['byDay'];

  const toggleDay = (code: FormValues['byDay'][number]) => {
    if (selectedDays.includes(code)) {
      const next = selectedDays.filter((day) => day !== code) as FormValues['byDay'];
      setValue('byDay', next);
    } else {
      const next = [...selectedDays, code] as FormValues['byDay'];
      setValue('byDay', next);
    }
  };

  const onSubmit = async (values: FormValues) => {
    setStatus(null);
    setErrorMessage(null);

    try {
      const response = await fetch(`/api/admin/classes/${classId}/sessions/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        setErrorMessage(payload.error ?? 'Failed to generate sessions');
        return;
      }

      setStatus('Sessions generated successfully');
      router.refresh();
    } catch (error) {
      console.error('Generate sessions error', error);
      setErrorMessage('Unexpected error generating sessions');
    }
  };

  return (
    <section style={{ background: '#ffffff', borderRadius: '0.75rem', border: '1px solid #e5e7eb', padding: '1.5rem' }}>
      <h2 style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: '1rem' }}>Generate Sessions</h2>
      <form
        onSubmit={handleSubmit(onSubmit)}
        style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem 1.25rem' }}
      >
        <div style={fieldStyle}>
          <label style={labelStyle}>Start Date</label>
          <input type="date" style={inputStyle} {...register('startDate')} />
          {errors.startDate ? <span style={errorStyle}>{errors.startDate.message}</span> : null}
        </div>
        <div style={fieldStyle}>
          <label style={labelStyle}>End Date</label>
          <input type="date" style={inputStyle} {...register('endDate')} />
          {errors.endDate ? <span style={errorStyle}>{errors.endDate.message}</span> : null}
        </div>
        <div style={fieldStyle}>
          <label style={labelStyle}>Time</label>
          <input type="time" style={inputStyle} {...register('time')} />
          {errors.time ? <span style={errorStyle}>{errors.time.message}</span> : null}
        </div>
        <div style={fieldStyle}>
          <label style={labelStyle}>Days</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {WEEK_DAYS.map((day) => {
              const selected = selectedDays.includes(day.code);
              return (
                <button
                  key={day.code}
                  type="button"
                  onClick={() => toggleDay(day.code)}
                  style={{
                    padding: '0.45rem 0.75rem',
                    borderRadius: '999px',
                    border: '1px solid',
                    borderColor: selected ? '#2563eb' : '#cbd5f5',
                    background: selected ? '#2563eb' : '#fff',
                    color: selected ? '#fff' : '#2563eb',
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                  }}
                >
                  {day.label}
                </button>
              );
            })}
          </div>
          {errors.byDay ? <span style={errorStyle}>{errors.byDay.message}</span> : null}
        </div>
        <div style={fieldStyle}>
          <label style={labelStyle}>Zoom Link Snapshot (optional)</label>
          <input type="url" style={inputStyle} {...register('zoomLinkSnapshot')} />
          {errors.zoomLinkSnapshot ? <span style={errorStyle}>{errors.zoomLinkSnapshot.message}</span> : null}
        </div>
        <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button
            type="submit"
            style={{
              padding: '0.65rem 1.2rem',
              borderRadius: '0.5rem',
              background: '#2563eb',
              color: '#fff',
              fontWeight: 600,
              border: 'none',
              cursor: 'pointer',
              opacity: isSubmitting ? 0.6 : 1,
            }}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Generating...' : 'Generate Sessions'}
          </button>
          {status ? <span style={{ color: 'var(--color-success)', fontSize: '0.9rem' }}>{status}</span> : null}
          {errorMessage ? <span style={{ color: 'var(--color-danger)', fontSize: '0.9rem' }}>{errorMessage}</span> : null}
        </div>
      </form>
    </section>
  );
}

const fieldStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.35rem',
};

const labelStyle: CSSProperties = {
  fontSize: '0.9rem',
  color: '#1f2937',
  fontWeight: 500,
};

const inputStyle: CSSProperties = {
  padding: '0.65rem 0.75rem',
  borderRadius: '0.5rem',
  border: '1px solid #cbd5f5',
  fontSize: '0.95rem',
};

const errorStyle: CSSProperties = {
  fontSize: '0.8rem',
  color: '#b91c1c',
};
