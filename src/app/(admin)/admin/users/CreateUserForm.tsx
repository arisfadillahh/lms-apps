'use client';

import type { CSSProperties } from 'react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { z } from 'zod';
import { UserPlus } from 'lucide-react';

import { createUserSchema, roleEnum } from '@/lib/validation/admin';

const formSchema = createUserSchema.extend({
  isActive: z.boolean(),
});

type FormValues = z.infer<typeof formSchema>;

export default function CreateUserForm() {
  const router = useRouter();
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      username: '',
      password: '',
      role: 'COACH',
      fullName: '',
      parentContactPhone: undefined,
      isActive: true,
    },
  });

  const selectedRole = watch('role');

  const onSubmit = async (values: FormValues) => {
    setStatusMessage(null);
    setErrorMessage(null);

    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        setErrorMessage(payload.error ?? 'Failed to create user');
        return;
      }

      setStatusMessage('User created successfully');
      reset({ username: '', password: '', role: values.role, fullName: '', parentContactPhone: undefined, isActive: true });
      router.refresh();
      // Auto-hide success message
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (error) {
      console.error('Failed to create user', error);
      setErrorMessage('Unexpected error. Please try again.');
    }
  };

  return (
    <section style={{
      background: '#ffffff',
      borderRadius: '16px',
      border: '1px solid #e2e8f0',
      padding: '2rem',
      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
      marginBottom: '1rem'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
        <div style={{
          width: '40px', height: '40px', borderRadius: '10px', background: '#eff6ff',
          display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3b82f6'
        }}>
          <UserPlus size={22} />
        </div>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#1e293b', margin: 0 }}>Tambah Pengguna Baru</h2>
          <p style={{ fontSize: '0.875rem', color: '#64748b', margin: '0.25rem 0 0' }}>Buat akun baru untuk Admin, Coach, atau Coder</p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem 2rem' }}>
        <div style={fieldStyle}>
          <label style={labelStyle}>Nama Lengkap</label>
          <input style={inputStyle} type="text" placeholder="Contoh: Aris Fadillah" {...register('fullName')} />
          {errors.fullName ? <span style={errorStyle}>{errors.fullName.message}</span> : null}
        </div>

        <div style={fieldStyle}>
          <label style={labelStyle}>Username</label>
          <input style={inputStyle} type="text" placeholder="Contoh: aris.co" {...register('username')} />
          {errors.username ? <span style={errorStyle}>{errors.username.message}</span> : null}
        </div>

        <div style={fieldStyle}>
          <label style={labelStyle}>Password Sementara</label>
          <input style={inputStyle} type="password" placeholder="••••••••" {...register('password')} />
          {errors.password ? <span style={errorStyle}>{errors.password.message}</span> : null}
        </div>

        <div style={fieldStyle}>
          <label style={labelStyle}>Role</label>
          <div style={{ position: 'relative' }}>
            <select style={{ ...inputStyle, appearance: 'none', cursor: 'pointer' }} {...register('role')}>
              {roleEnum.options.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
            <div style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#64748b' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
            </div>
          </div>
          {errors.role ? <span style={errorStyle}>{errors.role.message}</span> : null}
        </div>

        {selectedRole === 'CODER' && (
          <div style={fieldStyle}>
            <label style={labelStyle}>Nomor WhatsApp Orang Tua</label>
            <input style={inputStyle} type="text" placeholder="Contoh: +628123456789" {...register('parentContactPhone')} />
            {errors.parentContactPhone ? <span style={errorStyle}>{errors.parentContactPhone.message}</span> : null}
          </div>
        )}

        <div style={{ gridColumn: '1 / -1', borderTop: '1px solid #f1f5f9', paddingTop: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', fontSize: '0.9rem', color: '#334155', fontWeight: 500, cursor: 'pointer' }}>
            <input type="checkbox" {...register('isActive')} defaultChecked style={{ width: '1rem', height: '1rem', accentColor: '#3b82f6' }} />
            Status Aktif
          </label>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            {(statusMessage || errorMessage) && (
              <span style={{
                fontSize: '0.9rem',
                fontWeight: 500,
                color: statusMessage ? '#059669' : '#dc2626',
                background: statusMessage ? '#ecfdf5' : '#fef2f2',
                padding: '0.5rem 1rem',
                borderRadius: '8px'
              }}>
                {statusMessage || errorMessage}
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
                  <UserPlus size={18} />
                  Simpan User
                </>
              )}
            </button>
          </div>
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
