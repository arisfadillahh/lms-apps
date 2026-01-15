'use client';

import type { CSSProperties } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { GraduationCap } from 'lucide-react';

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

      setSuccessMessage('Kelas berhasil dibuat');
      reset({ ...values, name: '', zoomLink: '', startDate: '', initialBlockId: '' });
      router.refresh();
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (error) {
      console.error('Create class error', error);
      setErrorMessage('Terjadi kesalahan saat membuat kelas');
    }
  };

  return (
    <section style={{
      background: '#ffffff',
      borderRadius: '16px',
      border: '1px solid #e2e8f0',
      padding: '2rem',
      marginBottom: '1rem',
      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
        <div style={{
          width: '40px', height: '40px', borderRadius: '10px', background: '#eff6ff',
          display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3b82f6'
        }}>
          <GraduationCap size={22} />
        </div>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#1e293b', margin: 0 }}>Buat Kelas Baru</h2>
          <p style={{ fontSize: '0.875rem', color: '#64748b', margin: '0.25rem 0 0' }}>Jadwalkan kelas baru untuk Weekly atau Ekskul</p>
        </div>
      </div>

      <form
        onSubmit={handleSubmit(onSubmit)}
        style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem 2rem' }}
      >
        <div style={fieldStyle}>
          <label style={labelStyle}>Nama Kelas</label>
          <input style={inputStyle} type="text" placeholder="Contoh: Python L1 - Senin 16.00" {...register('name')} />
          {errors.name ? <span style={errorStyle}>{errors.name.message}</span> : null}
        </div>

        <div style={fieldStyle}>
          <label style={labelStyle}>Tipe Kelas</label>
          <select style={inputStyle} {...register('type')}>
            <option value="WEEKLY">Weekly (Reguler)</option>
            <option value="EKSKUL">Ekskul</option>
          </select>
          {errors.type ? <span style={errorStyle}>{errors.type.message}</span> : null}
        </div>

        <div style={fieldStyle}>
          <label style={labelStyle}>Coach Utama</label>
          <select style={inputStyle} {...register('coachId')}>
            <option value="">Pilih Coach</option>
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
              <option value="">Pilih Level</option>
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
            <label style={labelStyle}>Mulai dari Block (Opsional)</label>
            {selectedLevelId ? (
              <select style={inputStyle} {...register('initialBlockId')}>
                <option value="">Gunakan block pertama level ini</option>
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
          <label style={labelStyle}>Jam Jadwal</label>
          <input style={inputStyle} type="time" {...register('scheduleTime')} />
          {errors.scheduleTime ? <span style={errorStyle}>{errors.scheduleTime.message}</span> : null}
        </div>

        <div style={fieldStyle}>
          <label style={labelStyle}>Link Zoom</label>
          <input style={{ ...inputStyle, color: '#3b82f6' }} type="url" placeholder="https://zoom.us/..." {...register('zoomLink')} />
          {errors.zoomLink ? <span style={errorStyle}>{errors.zoomLink.message}</span> : null}
        </div>

        <div style={fieldStyle}>
          <label style={labelStyle}>Tanggal Mulai</label>
          <input style={inputStyle} type="date" {...register('startDate')} />
          {errors.startDate ? <span style={errorStyle}>{errors.startDate.message}</span> : null}
        </div>

        <div style={{ gridColumn: '1 / -1', borderTop: '1px solid #f1f5f9', paddingTop: '1.5rem', display: 'flex', justifyContent: 'flex-end', gap: '1rem', alignItems: 'center' }}>
          {(successMessage || errorMessage) && (
            <span style={{
              fontSize: '0.9rem',
              fontWeight: 500,
              color: successMessage ? '#059669' : '#dc2626',
              background: successMessage ? '#ecfdf5' : '#fef2f2',
              padding: '0.5rem 1rem',
              borderRadius: '8px'
            }}>
              {successMessage || errorMessage}
            </span>
          )}

          <button
            type="submit"
            style={{
              padding: '0.75rem 1.5rem',
              borderRadius: '12px',
              background: '#3b82f6',
              color: '#fff',
              fontWeight: 600,
              fontSize: '0.95rem',
              border: 'none',
              cursor: 'pointer',
              opacity: isSubmitting ? 0.7 : 1,
              boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
            disabled={isSubmitting}
            onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-1px)'}
            onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
          >
            {isSubmitting ? 'Menyimpan...' : (
              <>
                <GraduationCap size={18} />
                Buat Kelas
              </>
            )}
          </button>
        </div>
      </form>
    </section>
  );
}

const fieldStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.5rem',
};

const labelStyle: CSSProperties = {
  fontSize: '0.85rem',
  color: '#475569',
  fontWeight: 600,
  marginLeft: '0.25rem'
};

const inputStyle: CSSProperties = {
  padding: '0.75rem 1rem',
  borderRadius: '12px',
  border: '1px solid #e2e8f0',
  fontSize: '0.95rem',
  background: '#f8fafc',
  color: '#1e293b',
  outline: 'none',
  width: '100%',
  transition: 'all 0.2s',
};

const errorStyle: CSSProperties = {
  fontSize: '0.8rem',
  color: '#dc2626',
  marginTop: '0.25rem',
  marginLeft: '0.25rem'
};
