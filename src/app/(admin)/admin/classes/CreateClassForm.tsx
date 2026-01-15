'use client';

import type { CSSProperties } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import type { LevelRecord } from '@/lib/dao/levelsDao';
import type { UserRecord } from '@/lib/dao/usersDao';
import type { BlockRecord } from '@/lib/dao/blocksDao';
import { createClassSchema } from '@/lib/validation/admin';
import { useRouter } from 'next/navigation';
import { z } from 'zod';

const formSchema = createClassSchema;

type FormValues = z.infer<typeof formSchema>;

type CoachOption = Pick<UserRecord, 'id' | 'full_name' | 'is_active'>;

type EkskulPlan = {
  id: string;
  name: string;
  total_lessons?: number;
};

type CreateClassFormProps = {
  coaches: CoachOption[];
  levels: LevelRecord[];
  levelBlocks: Record<string, BlockRecord[]>;
  ekskulPlans?: EkskulPlan[];
};

export default function CreateClassForm({ coaches, levels, levelBlocks, ekskulPlans = [] }: CreateClassFormProps) {
  const router = useRouter();
  const activeCoaches = useMemo(() => coaches.filter((coach) => coach.is_active), [coaches]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
    reset,
    setValue,
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      type: 'WEEKLY',
      scheduleDay: 'MONDAY',
      scheduleTime: '16:00',
      initialBlockId: '',
      ekskulLessonPlanId: '',
    } as FormValues,
  });

  const selectedType = watch('type');
  const selectedLevelId = watch('levelId');

  const availableBlocks = useMemo(() => {
    if (selectedType !== 'WEEKLY' || !selectedLevelId) {
      return [];
    }
    return levelBlocks[selectedLevelId] ?? [];
  }, [levelBlocks, selectedLevelId, selectedType]);

  useEffect(() => {
    setValue('initialBlockId', '' as FormValues['initialBlockId']);
  }, [selectedLevelId, selectedType, setValue]);

  const onSubmit = async (values: FormValues) => {
    setErrorMessage(null);
    setSuccessMessage(null);

    if (values.type === 'WEEKLY' && !values.levelId) {
      setErrorMessage('Please select a level for weekly classes');
      return;
    }

    try {
      const response = await fetch('/api/admin/classes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        setErrorMessage(payload.error ?? 'Failed to create class');
        return;
      }

      setSuccessMessage('Class created');
      reset({ ...values, name: '', zoomLink: '', startDate: '', initialBlockId: '' });
      router.refresh();
    } catch (error) {
      console.error('Create class error', error);
      setErrorMessage('Unexpected error creating class');
    }
  };

  return (
    <section style={{ background: '#ffffff', borderRadius: '0.75rem', border: '1px solid #e5e7eb', padding: '1.5rem' }}>
      <h2 style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: '1rem' }}>Create New Class</h2>
      <form
        onSubmit={handleSubmit(onSubmit)}
        style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem 1.25rem' }}
      >
        <div style={fieldStyle}>
          <label style={labelStyle}>Class Name</label>
          <input style={inputStyle} type="text" {...register('name')} />
          {errors.name ? <span style={errorStyle}>{errors.name.message}</span> : null}
        </div>
        <div style={fieldStyle}>
          <label style={labelStyle}>Type</label>
          <select style={inputStyle} {...register('type')}>
            <option value="WEEKLY">Weekly</option>
            <option value="EKSKUL">Ekskul</option>
          </select>
          {errors.type ? <span style={errorStyle}>{errors.type.message}</span> : null}
        </div>
        <div style={fieldStyle}>
          <label style={labelStyle}>Primary Coach</label>
          <select style={inputStyle} {...register('coachId')}>
            <option value="">Select coach</option>
            {activeCoaches.map((coach) => (
              <option key={coach.id} value={coach.id}>
                {coach.full_name}
              </option>
            ))}
          </select>
          {errors.coachId ? <span style={errorStyle}>{errors.coachId.message}</span> : null}
        </div>
        {selectedType === 'WEEKLY' ? (
          <div style={fieldStyle}>
            <label style={labelStyle}>Level</label>
            <select style={inputStyle} {...register('levelId')}>
              <option value="">Select level</option>
              {levels.map((level) => (
                <option key={level.id} value={level.id}>
                  {level.name}
                </option>
              ))}
            </select>
            {errors.levelId ? <span style={errorStyle}>{errors.levelId.message}</span> : null}
          </div>
        ) : (
          <input type="hidden" value="" {...register('levelId')} />
        )}
        {selectedType === 'WEEKLY' ? (
          <div style={fieldStyle}>
            <label style={labelStyle}>Mulai dari Block</label>
            {selectedLevelId ? (
              <select style={inputStyle} {...register('initialBlockId')}>
                <option value="">Gunakan block pertama level</option>
                {(availableBlocks ?? []).map((block) => (
                  <option key={block.id} value={block.id}>
                    {block.name}
                  </option>
                ))}
              </select>
            ) : (
              <input type="hidden" value="" {...register('initialBlockId')} />
            )}
            {errors.initialBlockId ? <span style={errorStyle}>{errors.initialBlockId.message}</span> : null}
            {!selectedLevelId ? <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Pilih level untuk menentukan block awal.</span> : null}
          </div>
        ) : (
          <input type="hidden" value="" {...register('initialBlockId')} />
        )}
        {selectedType === 'EKSKUL' ? (
          <div style={fieldStyle}>
            <label style={labelStyle}>Lesson Plan Ekskul</label>
            <select style={inputStyle} {...register('ekskulLessonPlanId')}>
              <option value="">Pilih lesson plan</option>
              {ekskulPlans.map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.name} ({plan.total_lessons || 0} pertemuan)
                </option>
              ))}
            </select>
          </div>
        ) : (
          <input type="hidden" value="" {...register('ekskulLessonPlanId')} />
        )}
        <div style={fieldStyle}>
          <label style={labelStyle}>Hari Jadwal</label>
          <select style={inputStyle} {...register('scheduleDay')}>
            <option value="MONDAY">Senin</option>
            <option value="TUESDAY">Selasa</option>
            <option value="WEDNESDAY">Rabu</option>
            <option value="THURSDAY">Kamis</option>
            <option value="FRIDAY">Jumat</option>
            <option value="SATURDAY">Sabtu</option>
            <option value="SUNDAY">Minggu</option>
          </select>
          {errors.scheduleDay ? <span style={errorStyle}>{errors.scheduleDay.message}</span> : null}
        </div>
        <div style={fieldStyle}>
          <label style={labelStyle}>Schedule Time</label>
          <input style={inputStyle} type="time" {...register('scheduleTime')} />
          {errors.scheduleTime ? <span style={errorStyle}>{errors.scheduleTime.message}</span> : null}
        </div>
        <div style={fieldStyle}>
          <label style={labelStyle}>Zoom Link</label>
          <input style={inputStyle} type="url" {...register('zoomLink')} />
          {errors.zoomLink ? <span style={errorStyle}>{errors.zoomLink.message}</span> : null}
        </div>
        <div style={fieldStyle}>
          <label style={labelStyle}>Start Date</label>
          <input style={inputStyle} type="date" {...register('startDate')} />
          {errors.startDate ? <span style={errorStyle}>{errors.startDate.message}</span> : null}
        </div>
        <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '0.5rem' }}>
          <button
            type="submit"
            style={{
              padding: '0.65rem 1.2rem',
              borderRadius: '0.5rem',
              background: '#1e3a5f',
              color: '#fff',
              fontWeight: 600,
              border: 'none',
              cursor: 'pointer',
              opacity: isSubmitting ? 0.6 : 1,
            }}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Creating...' : 'Create Class'}
          </button>
          {successMessage ? <span style={{ color: '#15803d', fontSize: '0.9rem' }}>{successMessage}</span> : null}
          {errorMessage ? <span style={{ color: '#b91c1c', fontSize: '0.9rem' }}>{errorMessage}</span> : null}
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
