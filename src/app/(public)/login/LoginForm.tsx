"use client";

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { getRoleDashboardPath } from '@/lib/routing';
import type { Role } from '@/types/supabase';

import styles from './LoginForm.module.css';

const schema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
});

type FormValues = z.infer<typeof schema>;

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  CredentialsSignin: 'Username atau password salah.',
  AccessDenied: 'Akun tidak diizinkan untuk masuk.',
};

function resolveAuthErrorMessage(code?: string | null): string {
  if (!code) {
    return AUTH_ERROR_MESSAGES.CredentialsSignin;
  }
  return AUTH_ERROR_MESSAGES[code] ?? code;
}

export default function LoginForm() {
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      username: '',
      password: '',
    },
  });

  const onSubmit = async (values: FormValues) => {
    setSubmitting(true);
    setErrorMessage(null);

    try {
      const result = await signIn('credentials', {
        username: values.username,
        password: values.password,
        redirect: false,
      });

      if (!result || result.error) {
        setErrorMessage(resolveAuthErrorMessage(result?.error));
        return;
      }

      if (result.ok) {
        const sessionResponse = await fetch('/api/auth/session');
        if (sessionResponse.ok) {
          const session = await sessionResponse.json();
          const role = session?.user?.role as Role | undefined;
          if (role) {
            router.replace(getRoleDashboardPath(role));
            router.refresh();
            return;
          }
        }
        router.replace('/');
        router.refresh();
      }
    } catch (error) {
      console.error('Login error', error);
      setErrorMessage('Unable to sign in right now. Please try again later.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ width: '100%', maxWidth: '400px' }}>
      <form
        onSubmit={handleSubmit(onSubmit)}
        style={{
          background: '#ffffff',
          // Removed shadow/card style to match the "clean right side" look of the reference
          // It sits natively on the white background
          display: 'flex',
          flexDirection: 'column',
          gap: '1.5rem',
        }}
      >
        {/* Header Section */}
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          {/* Clevio Logo - Centered */}
          <div style={{
            display: 'inline-flex',
            justifyContent: 'center',
            marginBottom: '1.5rem',
            width: '64px',
            height: '64px',
            background: '#eff6ff', // Light Blue
            borderRadius: '16px',
            alignItems: 'center'
          }}>
            <img
              src="/favicon.ico"
              alt="Clevio"
              style={{ width: '32px', height: '32px' }}
            />
          </div>

          <h1 style={{
            fontSize: '1.875rem',
            fontWeight: 800,
            color: '#1e293b',
            marginBottom: '0.75rem',
            letterSpacing: '-0.025em'
          }}>
            Hello Again!
          </h1>
          <p style={{
            color: '#64748b',
            fontSize: '1rem',
            lineHeight: 1.5,
            maxWidth: '80%',
            margin: '0 auto'
          }}>
            Welcome back to Clevio LMS<br />
            Please sign in to continue
          </p>
        </div>

        {errorMessage && (
          <div style={{
            background: '#fef2f2',
            color: '#ef4444',
            padding: '1rem',
            borderRadius: '12px',
            fontSize: '0.9rem',
            textAlign: 'center',
            fontWeight: 500,
            border: '1px solid #fee2e2'
          }}>
            {errorMessage}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Username Input with Icon */}
          <div style={{ position: 'relative' }}>
            <div style={{
              position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)',
              color: '#94a3b8', pointerEvents: 'none'
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
            </div>
            <input
              type="text"
              placeholder="Username / Email"
              autoComplete="username"
              {...register('username')}
              style={{
                width: '100%',
                padding: '1rem 1rem 1rem 3rem', // Left padding for icon
                borderRadius: '12px',
                border: '1px solid #e2e8f0',
                fontSize: '1rem',
                background: '#f8fafc',
                outline: 'none',
                transition: 'all 0.2s',
                color: '#1e293b'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#2563eb';
                e.target.style.background = '#fff';
                e.target.style.boxShadow = '0 0 0 4px rgba(37, 99, 235, 0.1)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#e2e8f0';
                e.target.style.background = '#f8fafc';
                e.target.style.boxShadow = 'none';
              }}
            />
            {errors.username && <span style={{ color: '#ef4444', fontSize: '0.85rem', marginTop: '0.25rem', display: 'block' }}>{errors.username.message}</span>}
          </div>

          {/* Password Input with Icon */}
          <div style={{ position: 'relative' }}>
            <div style={{
              position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)',
              color: '#94a3b8', pointerEvents: 'none'
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
            </div>
            <input
              type="password"
              placeholder="Password"
              autoComplete="current-password"
              {...register('password')}
              style={{
                width: '100%',
                padding: '1rem 1rem 1rem 3rem',
                borderRadius: '12px',
                border: '1px solid #e2e8f0',
                fontSize: '1rem',
                background: '#f8fafc',
                outline: 'none',
                transition: 'all 0.2s',
                color: '#1e293b'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#2563eb';
                e.target.style.background = '#fff';
                e.target.style.boxShadow = '0 0 0 4px rgba(37, 99, 235, 0.1)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#e2e8f0';
                e.target.style.background = '#f8fafc';
                e.target.style.boxShadow = 'none';
              }}
            />
            {errors.password && <span style={{ color: '#ef4444', fontSize: '0.85rem', marginTop: '0.25rem', display: 'block' }}>{errors.password.message}</span>}
          </div>
        </div>

        {/* Options Row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.9rem', marginTop: '0.5rem' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', color: '#64748b', fontWeight: 500 }}>
            <input type="checkbox" style={{ width: '18px', height: '18px', borderRadius: '4px', cursor: 'pointer', accentColor: '#2563eb' }} />
            Remember Me
          </label>
          <button
            type="button"
            onClick={() => alert("Untuk menjaga keamanan data dan akun Anda, pemulihan password LMS tidak dapat dilakukan secara mandiri. Silakan menghubungi Admin Clevio agar dapat dibantu lebih lanjut.")}
            style={{ color: '#64748b', textDecoration: 'none', fontWeight: 600, background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: 'inherit' }}
          >
            Recovery Password
          </button>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={submitting}
          style={{
            width: '100%',
            padding: '1rem',
            borderRadius: '12px',
            background: '#2563eb', // Brand Blue
            color: '#fff',
            fontSize: '1rem',
            fontWeight: 700,
            border: 'none',
            cursor: submitting ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s',
            marginTop: '1rem',
            opacity: submitting ? 0.7 : 1,
            boxShadow: '0 4px 12px rgba(37, 99, 235, 0.2)'
          }}
          onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-1px)'}
          onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
        >
          {submitting ? 'Signing in...' : 'Login'}
        </button>
      </form>
    </div>
  );
}
