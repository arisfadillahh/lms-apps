"use client";

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldAlert, MessageCircle, Mail, Lock, AtSign } from 'lucide-react';

import { getRoleDashboardPath } from '@/lib/routing';
import type { Role } from '@/types/supabase';

const schema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
});

type FormValues = z.infer<typeof schema>;

const AUTH_ERROR_MESSAGES_ID: Record<string, string> = {
  CredentialsSignin: 'Username atau password salah.',
  AccessDenied: 'Akun tidak diizinkan untuk masuk.',
};

const AUTH_ERROR_MESSAGES_EN: Record<string, string> = {
  CredentialsSignin: 'Invalid username or password.',
  AccessDenied: 'Account is not allowed to sign in.',
};

function resolveAuthErrorMessage(lang: 'id' | 'en', code?: string | null): string {
  const dict = lang === 'en' ? AUTH_ERROR_MESSAGES_EN : AUTH_ERROR_MESSAGES_ID;
  if (!code) return dict.CredentialsSignin;
  return dict[code] ?? code;
}

export default function LoginForm({ lang = 'id' }: { lang?: 'id' | 'en' }) {
  const isEng = lang === 'en';
  
  const t = {
    welcome: isEng ? 'WELCOME BACK' : 'SELAMAT DATANG',
    title: isEng ? 'Log into your account' : 'Masuk ke akun Anda',
    subtitle: isEng ? 'Enter your credentials to access the dashboard' : 'Masukkan kata sandi dan email untuk lanjut',
    username: isEng ? 'Username' : 'Username',
    password: isEng ? 'Password' : 'Password',
    forgot: isEng ? 'Forgot password?' : 'Lupa password?',
    auth: isEng ? 'Authenticating...' : 'Sedang masuk...',
    login: isEng ? 'Login' : 'Masuk',
    recoveryTitle: isEng ? 'Recovery Password' : 'Pemulihan Password',
    recoveryP1_1: isEng ? 'To maintain ' : 'Untuk menjaga ',
    recoveryP1_2: isEng ? 'data and account security' : 'keamanan data dan akun',
    recoveryP1_3: isEng ? ', LMS password recovery cannot be done independently.' : ' Anda, pemulihan password LMS tidak dapat dilakukan secara otomatis.',
    recoveryP2_title: isEng ? 'Contact Clevio Admin' : 'Hubungi Admin Clevio',
    recoveryP2_desc: isEng ? 'Please contact our admin team via WhatsApp or email for password reset assistance.' : 'Silakan hubungi tim admin melalui WhatsApp atau email untuk bantuan ganti password.',
    recoveryBtn: isEng ? 'Understood' : 'Mengerti'
  };

  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showForgotModal, setShowForgotModal] = useState(false);

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
        setErrorMessage(resolveAuthErrorMessage(lang, result?.error));
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
        {/* Title Area */}
        <div style={{ marginBottom: '2.5rem' }}>
            <p style={{
                fontSize: '0.75rem',
                fontWeight: 800,
                color: '#64748B', // slate-500
                letterSpacing: '1px',
                textTransform: 'uppercase',
                marginBottom: '0.5rem'
            }}>
                {t.welcome}
            </p>
            <h1 style={{
                fontSize: '3rem',
                fontWeight: 800,
                color: 'var(--color-clevio-navy, #22367b)',
                letterSpacing: '-1.5px',
                marginBottom: '1rem',
                lineHeight: 1.1
            }}>
                {t.title}<span style={{ color: '#00b0d7'}}>.</span>
            </h1>
            <p style={{
                color: '#64748B',
                fontSize: '1rem',
                fontWeight: 600
            }}>
                {t.subtitle}
            </p>
        </div>

      <form
        onSubmit={handleSubmit(onSubmit)}
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '1.2rem',
        }}
      >
        {errorMessage && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.1)',
            color: '#f87171',
            padding: '1rem',
            borderRadius: '12px',
            fontSize: '0.9rem',
            textAlign: 'center',
            fontWeight: 500,
            border: '1px solid rgba(239, 68, 68, 0.2)'
          }}>
            {errorMessage}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
          {/* Username Input */}
          <div 
             style={{ position: 'relative', background: '#ffffff', borderRadius: '16px', padding: '0.7rem 1.2rem', border: '2px solid #e2e8f0', transition: 'all 0.2s', display: 'flex', flexDirection: 'column', justifyContent: 'center', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.02)' }}
             onFocus={(e) => { e.currentTarget.style.borderColor = '#00b0d7'; }}
             onBlur={(e) => { e.currentTarget.style.borderColor = '#e2e8f0'; }}
          >
             <p style={{ fontSize: '0.7rem', color: '#64748B', margin: '0 0 0.2rem 0', fontWeight: 700 }}>
                {t.username}
             </p>
             <div style={{ display: 'flex', alignItems: 'center' }}>
                <input
                  type="text"
                  autoComplete="username"
                  placeholder="cleviocoder"
                  {...register('username')}
                  style={{
                    width: '100%', padding: '0', border: 'none', fontSize: '1.05rem', background: 'transparent',
                    outline: 'none', color: '#1e293b', fontWeight: 700
                  }}
                />
             </div>
             <div style={{ position: 'absolute', right: '1.2rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none' }}>
                <AtSign size={18} strokeWidth={3} />
             </div>
             {errors.username && <span style={{ color: '#ef4444', fontSize: '0.85rem', margin: '0.25rem 0 0 0', display: 'block' }}>{errors.username.message}</span>}
          </div>

          {/* Password Input */}
          <div 
            style={{ position: 'relative', background: '#FAFAFD', borderRadius: '16px', padding: '0.7rem 1.2rem', border: '2px solid #00b0d7', boxShadow: '0 0 0 2px rgba(0, 176, 215, 0.1)', transition: 'all 0.2s', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}
            // Active state
          >
             <p style={{ fontSize: '0.7rem', color: '#00b0d7', margin: '0 0 0.2rem 0', fontWeight: 700 }}>
                {t.password}
             </p>
             <div style={{ display: 'flex', alignItems: 'center' }}>
                <input
                  type="password"
                  autoComplete="current-password"
                  placeholder="........"
                  {...register('password')}
                  style={{
                    width: '100%', padding: '0', border: 'none', fontSize: '1.2rem', background: 'transparent',
                    outline: 'none', color: '#1e293b', fontWeight: 800, letterSpacing: '4px'
                  }}
                />
             </div>
             <div style={{ position: 'absolute', right: '1.2rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
             </div>
             {errors.password && <span style={{ color: '#ef4444', fontSize: '0.85rem', margin: '0.25rem 0 0 0', display: 'block' }}>{errors.password.message}</span>}
          </div>
        </div>

        {/* Buttons Row exactly like screenshot */}
        <div style={{ display: 'flex', gap: '1.5rem', marginTop: '1.5rem' }}>
            <button
                type="button"
                onClick={() => setShowForgotModal(true)}
                style={{
                    flex: '1', padding: '1.2rem', borderRadius: '24px',
                    background: '#f1f5f9', color: '#475569', fontSize: '1.05rem', fontWeight: 800, border: 'none',
                    cursor: 'pointer', transition: 'all 0.2s', textAlign: 'center', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)'
                }}
                onMouseOver={(e) => e.currentTarget.style.background = '#e2e8f0'}
                onMouseOut={(e) => e.currentTarget.style.background = '#f1f5f9'}
            >
                {t.forgot}
            </button>

            <button
              type="submit"
              disabled={submitting}
              style={{
                flex: '1.2', padding: '1.2rem', borderRadius: '24px',
                background: '#00b0d7', color: '#ffffff', fontSize: '1.05rem', fontWeight: 600, border: 'none',
                cursor: submitting ? 'not-allowed' : 'pointer', transition: 'all 0.2s',
                opacity: submitting ? 0.7 : 1, boxShadow: '0 8px 24px rgba(0, 176, 215, 0.25)'
              }}
              onMouseOver={(e) => { if(!submitting) e.currentTarget.style.filter = 'brightness(1.1)'; }}
              onMouseOut={(e) => e.currentTarget.style.filter = 'brightness(1)'}
            >
              {submitting ? t.auth : t.login}
            </button>
        </div>
      </form>

      {/* Forgot Password Modal */}
      <AnimatePresence>
        {showForgotModal && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setShowForgotModal(false)}
              style={{
                position: 'fixed', inset: 0, background: 'rgba(5, 5, 10, 0.8)',
                zIndex: 1000, backdropFilter: 'blur(4px)'
              }}
            />
            {/* Modal Content */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              style={{
                position: 'fixed', inset: 0, zIndex: 1001,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                pointerEvents: 'none'
              }}
            >
              <div style={{
                background: '#1A1D24', borderRadius: '20px', width: '90%', maxWidth: '420px',
                boxShadow: '0 25px 60px rgba(0, 0, 0, 0.5)', overflow: 'hidden',
                pointerEvents: 'auto', border: '1px solid #334155'
              }}>
                {/* Header */}
                <div style={{
                  background: 'linear-gradient(135deg, var(--color-clevio-navy) 0%, rgba(34, 54, 123, 0.8) 100%)',
                  padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem',
                  position: 'relative'
                }}>
                  <div style={{
                    width: '56px', height: '56px', borderRadius: '16px',
                    background: 'rgba(255, 255, 255, 0.1)', display: 'flex',
                    alignItems: 'center', justifyContent: 'center'
                  }}>
                    <ShieldAlert size={28} color="#fff" />
                  </div>
                  <div>
                    <h2 style={{ color: '#fff', fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>
                      {t.recoveryTitle}
                    </h2>
                  </div>
                </div>

                {/* Body Content */}
                <div style={{ padding: '1.5rem' }}>
                  <p style={{
                    color: '#94a3b8', fontSize: '0.95rem', lineHeight: 1.7, margin: '0 0 1.5rem 0'
                  }}>
                    {t.recoveryP1_1}<strong>{t.recoveryP1_2}</strong>{t.recoveryP1_3}
                  </p>

                  <div style={{
                    background: '#262a38', borderRadius: '12px', padding: '1rem',
                    border: '1px solid #3f3f46', marginBottom: '1.5rem'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                      <MessageCircle size={20} color="var(--color-clevio-cyan)" style={{ marginTop: '2px', flexShrink: 0 }} />
                      <div>
                        <p style={{ color: '#e2e8f0', fontSize: '0.9rem', fontWeight: 600, margin: '0 0 0.25rem 0' }}>
                          {t.recoveryP2_title}
                        </p>
                        <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: 0, lineHeight: 1.5 }}>
                          {t.recoveryP2_desc}
                        </p>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => setShowForgotModal(false)}
                    style={{
                      width: '100%', padding: '0.875rem 1rem', borderRadius: '12px',
                      background: '#334155', color: '#fff', fontSize: '0.95rem', fontWeight: 600,
                      border: 'none', cursor: 'pointer', transition: 'all 0.2s',
                    }}
                    onMouseOver={(e) => e.currentTarget.style.background = '#475569'}
                    onMouseOut={(e) => e.currentTarget.style.background = '#334155'}
                  >
                    {t.recoveryBtn}
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
