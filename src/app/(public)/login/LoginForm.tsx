"use client";

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldAlert, MessageCircle, AtSign, Loader2 } from 'lucide-react';

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
  const [showPassword, setShowPassword] = useState(false);

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
        <div className="mb-4 lg:mb-6">
            <p className="text-[10px] md:text-[11px] lg:text-xs font-extrabold text-slate-500 tracking-widest uppercase mb-1 text-left">
                {t.welcome}
            </p>
            <h1 className="text-2xl md:text-3xl lg:text-4xl xl:text-5xl font-extrabold text-[#22367b] tracking-tighter mb-1 lg:mb-2 leading-tight text-left">
                {t.title}<span className="text-[#00b0d7]">.</span>
            </h1>
            <p className="text-sm md:text-sm lg:text-base font-semibold text-slate-500 text-left">
                {t.subtitle}
            </p>
        </div>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="flex flex-col gap-3 lg:gap-4"
          aria-busy={submitting}
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

        <div className="flex flex-col gap-3 lg:gap-4">
          {/* Username Input */}
          <div 
             className="relative bg-white rounded-xl md:rounded-2xl py-1.5 md:py-2 lg:py-3 px-3 md:px-4 lg:px-5 border-2 border-slate-200 transition-all flex flex-col justify-center shadow-sm"
             onFocus={(e) => { e.currentTarget.style.borderColor = '#00b0d7'; }}
             onBlur={(e) => { e.currentTarget.style.borderColor = '#e2e8f0'; }}
          >
             <p className="text-[10px] md:text-[11px] lg:text-xs text-slate-500 mb-0 md:mb-1 font-bold text-left">
                {t.username}
             </p>
             <div className="flex items-center">
                <input
                  type="text"
                  autoComplete="username"
                  placeholder="cleviocoder"
                  disabled={submitting}
                  {...register('username')}
                  className="w-full p-0 border-none text-sm md:text-sm lg:text-base bg-transparent outline-none text-slate-800 font-bold disabled:cursor-not-allowed disabled:opacity-60"
                />
             </div>
             <div className="absolute right-3 md:right-5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                <AtSign size={16} strokeWidth={3} className="md:w-[18px] md:h-[18px]" />
             </div>
             {errors.username && <span className="text-red-500 text-xs mt-1 block text-left">{errors.username.message}</span>}
          </div>

          {/* Password Input */}
          <div 
             className="relative bg-[#FAFAFD] rounded-xl md:rounded-2xl py-1.5 md:py-2 lg:py-3 px-3 md:px-4 lg:px-5 border-2 border-[#00b0d7] transition-all flex flex-col justify-center"
             style={{ boxShadow: '0 0 0 2px rgba(0, 176, 215, 0.1)' }}
          >
             <p className="text-[10px] md:text-[11px] lg:text-xs text-[#00b0d7] mb-0 md:mb-1 font-bold text-left">
                {t.password}
             </p>
             <div className="flex items-center">
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="........"
                  disabled={submitting}
                  {...register('password')}
                  className="w-full p-0 pr-8 border-none text-base md:text-lg lg:text-xl bg-transparent outline-none text-slate-800 font-extrabold tracking-widest disabled:cursor-not-allowed disabled:opacity-60"
                />
             </div>
             <button
                type="button"
                disabled={submitting}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => setShowPassword((current) => !current)}
                className="absolute right-2 md:right-4 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 cursor-pointer items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#00b0d7]/25 disabled:cursor-not-allowed disabled:opacity-60"
                aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                aria-pressed={showPassword}
             >
                {showPassword ? (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-[16px] h-[16px] md:w-[18px] md:h-[18px]" aria-hidden="true">
                    <path d="M3 3l18 18" />
                    <path d="M10.6 10.6A2 2 0 0 0 12 14a2 2 0 0 0 1.4-.6" />
                    <path d="M9.5 5.2A10.5 10.5 0 0 1 12 5c7 0 11 7 11 7a18.1 18.1 0 0 1-3.1 3.9" />
                    <path d="M6.6 6.6C3 8.8 1 12 1 12s4 7 11 7c1.8 0 3.3-.4 4.7-1" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-[16px] h-[16px] md:w-[18px] md:h-[18px]" aria-hidden="true">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
             </button>
             {errors.password && <span className="text-red-500 text-xs mt-1 block text-left">{errors.password.message}</span>}
          </div>
        </div>

        {/* Buttons Row exactly like screenshot */}
        <div className="flex gap-2 md:gap-3 lg:gap-4 mt-2 lg:mt-4">
            <button
                type="button"
                onClick={() => setShowForgotModal(true)}
                disabled={submitting}
                className="flex-1 py-3 md:py-3 lg:py-4 rounded-xl md:rounded-2xl lg:rounded-[24px] bg-slate-100 text-slate-600 text-xs md:text-sm lg:text-base font-extrabold transition-all text-center shadow-sm hover:bg-slate-200 border-none cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
            >
                {t.forgot}
            </button>

            <button
              type="submit"
              disabled={submitting}
              className={`flex-[1.2] py-3 md:py-3 lg:py-4 rounded-xl md:rounded-2xl lg:rounded-[24px] bg-[#00b0d7] text-white text-xs md:text-sm lg:text-base font-bold transition-all border-none shadow-[0_8px_24px_rgba(0,176,215,0.25)] ${submitting ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer hover:brightness-110'}`}
            >
              <span className="inline-flex items-center justify-center gap-2">
                {submitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                {submitting ? t.auth : t.login}
              </span>
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
