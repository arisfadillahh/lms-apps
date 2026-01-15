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
    <div style={{ width: '100%', maxWidth: '420px' }}>
      <form
        onSubmit={handleSubmit(onSubmit)}
        style={{
          background: '#ffffff',
          borderRadius: '24px', // Large premium radius
          padding: '3rem 2.5rem',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.1)', // Soft drop shadow
          display: 'flex',
          flexDirection: 'column',
          gap: '1.5rem',
          border: '1px solid #f1f5f9'
        }}
      >
        {/* Header Section */}
        <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2rem', fontWeight: 700, fontSize: '1.2rem', color: '#0f172a' }}>
            {/* Logo Icon */}
            <img
              src="/favicon.ico"
              alt="Clevio LMS Logo"
              style={{ width: '40px', height: '40px', objectFit: 'contain' }}
            />
            Clevio LMS
          </div>

          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#1e293b', marginBottom: '0.5rem', letterSpacing: '-0.02em' }}>
            Welcome Back!
          </h1>
          <p style={{ color: '#64748b', fontSize: '0.95rem' }}>
            Please sign in to your account
          </p>
        </div>

        {errorMessage && (
          <div style={{ background: '#fef2f2', color: '#ef4444', padding: '0.75rem', borderRadius: '8px', fontSize: '0.9rem', textAlign: 'center', fontWeight: 500 }}>
            {errorMessage}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Username Input */}
          <div>
            <input
              type="text"
              placeholder="Username"
              autoComplete="username"
              {...register('username')}
              style={{
                width: '100%',
                padding: '0.85rem 1rem',
                borderRadius: '12px',
                border: '1px solid #e2e8f0',
                fontSize: '1rem',
                background: '#f8fafc',
                outline: 'none',
                transition: 'all 0.2s',
                color: '#334155'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#3b82f6';
                e.target.style.background = '#fff';
                e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#e2e8f0';
                e.target.style.background = '#f8fafc';
                e.target.style.boxShadow = 'none';
              }}
            />
            {errors.username && <span style={{ color: '#ef4444', fontSize: '0.85rem', marginTop: '0.25rem', display: 'block' }}>{errors.username.message}</span>}
          </div>

          {/* Password Input */}
          <div>
            <input
              type="password"
              placeholder="Password"
              autoComplete="current-password"
              {...register('password')}
              style={{
                width: '100%',
                padding: '0.85rem 1rem',
                borderRadius: '12px',
                border: '1px solid #e2e8f0',
                fontSize: '1rem',
                background: '#f8fafc',
                outline: 'none',
                transition: 'all 0.2s',
                color: '#334155'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#3b82f6';
                e.target.style.background = '#fff';
                e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.9rem' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', color: '#64748b' }}>
            <input type="checkbox" style={{ width: '16px', height: '16px', borderRadius: '4px', cursor: 'pointer' }} />
            Remember Me
          </label>
          <a href="#" style={{ color: '#64748b', textDecoration: 'none', fontWeight: 600 }}>
            Forgot Password?
          </a>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={submitting}
          style={{
            width: '100%',
            padding: '0.9rem',
            borderRadius: '12px',
            background: '#2563eb', // Brand Blue
            color: '#fff',
            fontSize: '1rem',
            fontWeight: 700,
            border: 'none',
            cursor: submitting ? 'not-allowed' : 'pointer',
            transition: 'transform 0.1s, background 0.2s',
            marginTop: '0.5rem',
            opacity: submitting ? 0.7 : 1
          }}
        >
          {submitting ? 'Signing in...' : 'Sign In'}
        </button>

        {/* No Sign Up Link - Removed per request */}

      </form>
    </div>
  );
}
