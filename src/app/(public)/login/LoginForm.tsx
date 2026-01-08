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
  const [resetting, setResetting] = useState(false);
  const [resetPassword, setResetPassword] = useState('admin123');
  const [resetStatus, setResetStatus] = useState<{ message: string; isError?: boolean } | null>(null);

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

  const handleAdminReset = async () => {
    setResetting(true);
    setResetStatus(null);

    try {
      const response = await fetch('/api/dev/reset-admin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          newPassword: resetPassword.trim() || undefined,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error ?? 'Failed to reset admin password');
      }

      const passwordUsed = payload?.password ?? resetPassword;
      setResetPassword(passwordUsed);
      setResetStatus({
        message: `Admin password direset. Username: ${payload?.username ?? 'admin'}, Password: ${passwordUsed}`,
        isError: false,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Tidak bisa reset password saat ini.';
      setResetStatus({ message, isError: true });
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className={styles.container}>
      <form className={styles.card} onSubmit={handleSubmit(onSubmit)}>
        <h1 className={styles.title}>Clevio LMS Login</h1>
        {errorMessage ? <p className={styles.error}>{errorMessage}</p> : null}
        <label className={styles.label}>
          Username
          <input
            type="text"
            autoComplete="username"
            className={styles.input}
            {...register('username')}
          />
          {errors.username ? <span className={styles.errorText}>{errors.username.message}</span> : null}
        </label>
        <label className={styles.label}>
          Password
          <input
            type="password"
            autoComplete="current-password"
            className={styles.input}
            {...register('password')}
          />
          {errors.password ? <span className={styles.errorText}>{errors.password.message}</span> : null}
        </label>
        <button type="submit" className={styles.button} disabled={submitting}>
          {submitting ? 'Signing in…' : 'Sign In'}
        </button>

        <div className={styles.divider} aria-hidden />

        <div className={styles.devReset}>
          <div className={styles.devResetHeader}>
            <p className={styles.devResetTitle}>Reset Admin cuy(testing)</p>
            <span className={styles.devResetBadge}>Dev only</span>
          </div>
          <p className={styles.helperText}>Gunakan jika lupa password admin saat testing. Nonaktif di production.</p>
          <label className={styles.label}>
            Password baru (opsional)
            <input
              type="text"
              className={styles.input}
              value={resetPassword}
              onChange={(event) => setResetPassword(event.target.value)}
            />
          </label>
          {resetStatus ? (
            <p className={resetStatus.isError ? styles.errorText : styles.successText}>{resetStatus.message}</p>
          ) : null}
          <button type="button" className={styles.secondaryButton} onClick={handleAdminReset} disabled={resetting}>
            {resetting ? 'Resetting…' : 'Reset Admin Password'}
          </button>
        </div>
      </form>
    </div>
  );
}
