'use client';

import type { CSSProperties } from 'react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { z } from 'zod';

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
    } catch (error) {
      console.error('Failed to create user', error);
      setErrorMessage('Unexpected error. Please try again.');
    }
  };

  return (
    <section style={{ background: '#ffffff', borderRadius: '0.75rem', border: '1px solid #e5e7eb', padding: '1.5rem' }}>
      <h2 style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: '1rem' }}>Create New User</h2>
      <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem 1.25rem' }}>
        <div style={fieldStyle}>
          <label style={labelStyle}>Full Name</label>
          <input style={inputStyle} type="text" {...register('fullName')} />
          {errors.fullName ? <span style={errorStyle}>{errors.fullName.message}</span> : null}
        </div>
        <div style={fieldStyle}>
          <label style={labelStyle}>Username</label>
          <input style={inputStyle} type="text" {...register('username')} />
          {errors.username ? <span style={errorStyle}>{errors.username.message}</span> : null}
        </div>
        <div style={fieldStyle}>
          <label style={labelStyle}>Temporary Password</label>
          <input style={inputStyle} type="password" {...register('password')} />
          {errors.password ? <span style={errorStyle}>{errors.password.message}</span> : null}
        </div>
        <div style={fieldStyle}>
          <label style={labelStyle}>Role</label>
          <select style={inputStyle} {...register('role')}>
            {roleEnum.options.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
          {errors.role ? <span style={errorStyle}>{errors.role.message}</span> : null}
        </div>
        {selectedRole === 'CODER' ? (
          <div style={fieldStyle}>
            <label style={labelStyle}>Parent Contact Phone</label>
            <input style={inputStyle} type="text" placeholder="e.g. +62..." {...register('parentContactPhone')} />
            {errors.parentContactPhone ? <span style={errorStyle}>{errors.parentContactPhone.message}</span> : null}
          </div>
        ) : null}
        <div style={{ alignSelf: 'end' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', color: '#1f2937' }}>
            <input type="checkbox" {...register('isActive')} defaultChecked /> Active
          </label>
        </div>
        <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '0.5rem' }}>
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
            {isSubmitting ? 'Creating...' : 'Create User'}
          </button>
          {statusMessage ? <span style={{ color: '#15803d', fontSize: '0.9rem' }}>{statusMessage}</span> : null}
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
