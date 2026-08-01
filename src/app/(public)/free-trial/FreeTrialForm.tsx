'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { CalendarDays, CheckCircle2, LoaderCircle, MapPin, Monitor, Send } from 'lucide-react';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  OFFLINE_TRIAL_ADDRESS,
  OFFLINE_TRIAL_SCHEDULE,
  trialClassSchema,
  type TrialClassFormValues,
} from '@/lib/validation/trialClass';

type FormFieldProps = {
  id: keyof TrialClassFormValues;
  label: string;
  error?: string;
  children: ReactNode;
  className?: string;
};

function FormField({ id, label, error, children, className }: FormFieldProps) {
  return (
    <div className={`flex min-w-0 flex-col gap-2${className ? ` ${className}` : ''}`}>
      <label htmlFor={id} className="text-sm font-bold text-slate-700">
        {label}
      </label>
      {children}
      {error ? (
        <p className="text-xs font-medium text-red-600" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export default function FreeTrialForm() {
  const [submitted, setSubmitted] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<TrialClassFormValues>({
    resolver: zodResolver(trialClassSchema),
    defaultValues: {
      studentName: '',
      studentGrade: '',
      schoolName: '',
      parentName: '',
      phone: '',
      email: '',
      trialMode: 'ONLINE',
      notes: '',
      website: '',
    },
  });
  const trialMode = watch('trialMode');

  async function submit(values: TrialClassFormValues) {
    setServerError(null);

    try {
      const response = await fetch('/api/free-trial', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(values),
      });
      const result = (await response.json().catch(() => null)) as { ok?: boolean; message?: string } | null;

      if (!response.ok || !result?.ok) {
        throw new Error(result?.message || 'Data belum berhasil disimpan. Silakan coba lagi.');
      }

      reset();
      setSubmitted(true);
    } catch (error) {
      setServerError(error instanceof Error ? error.message : 'Data belum berhasil disimpan. Silakan coba lagi.');
    }
  }

  if (submitted) {
    return (
      <div className="flex min-h-[420px] flex-col items-start justify-center gap-5 rounded-2xl border border-white/80 bg-white/90 p-7 shadow-xl backdrop-blur-sm sm:p-10">
        <div className="flex size-14 items-center justify-center rounded-full bg-green-100 text-green-700">
          <CheckCircle2 aria-hidden="true" />
        </div>
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-black text-slate-900 sm:text-3xl">Pendaftaran sudah diterima</h1>
          <p className="max-w-lg text-sm leading-6 text-slate-600 sm:text-base">
            Tim Clevio akan menghubungi orang tua untuk menyesuaikan jadwal free trial.
          </p>
          <p className="max-w-lg text-sm leading-6 text-slate-600 sm:text-base">
            Pastikan peserta menyiapkan laptop dan koneksi internet yang stabil saat mengikuti trial class.
          </p>
        </div>
        <Button type="button" variant="outline" onClick={() => setSubmitted(false)}>
          Isi pendaftaran lain
        </Button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl">
      <div className="mb-6 flex flex-col gap-2">
        <h1 className="text-3xl font-black leading-tight text-slate-900 sm:text-4xl">Daftar Free Trial Class</h1>
        <p className="max-w-xl text-sm leading-6 text-slate-600 sm:text-base">
          Pilih trial online atau offline, lalu isi data anak. Tim Clevio akan menghubungi Ayah/Bunda untuk konfirmasi kelas.
        </p>
      </div>

      <form
        className="rounded-2xl border border-white/80 bg-white/90 p-5 shadow-xl backdrop-blur-sm sm:p-7"
        onSubmit={handleSubmit(submit)}
        noValidate
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField id="studentName" label="Nama anak" error={errors.studentName?.message}>
            <Input
              id="studentName"
              autoComplete="name"
              placeholder="Nama lengkap anak"
              aria-invalid={Boolean(errors.studentName)}
              {...register('studentName')}
            />
          </FormField>

          <FormField id="studentGrade" label="Kelas" error={errors.studentGrade?.message}>
            <Input
              id="studentGrade"
              placeholder="Contoh: 4 SD"
              aria-invalid={Boolean(errors.studentGrade)}
              {...register('studentGrade')}
            />
          </FormField>

          <FormField id="schoolName" label="Sekolah" error={errors.schoolName?.message}>
            <Input
              id="schoolName"
              autoComplete="organization"
              placeholder="Nama sekolah"
              aria-invalid={Boolean(errors.schoolName)}
              {...register('schoolName')}
            />
          </FormField>

          <FormField id="parentName" label="Nama orang tua" error={errors.parentName?.message}>
            <Input
              id="parentName"
              autoComplete="name"
              placeholder="Nama Ayah/Bunda"
              aria-invalid={Boolean(errors.parentName)}
              {...register('parentName')}
            />
          </FormField>

          <FormField id="phone" label="Nomor telepon" error={errors.phone?.message}>
            <Input
              id="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="0812 3456 7890"
              aria-invalid={Boolean(errors.phone)}
              {...register('phone')}
            />
          </FormField>

          <FormField id="email" label="Email" error={errors.email?.message}>
            <Input
              id="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="nama@email.com"
              aria-invalid={Boolean(errors.email)}
              {...register('email')}
            />
          </FormField>

          <fieldset className="flex min-w-0 flex-col gap-2 sm:col-span-2">
            <legend className="text-sm font-bold text-slate-700">Jenis trial</legend>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <label
                className={`flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 transition-colors ${
                  trialMode === 'ONLINE'
                    ? 'border-sky-500 bg-sky-50 text-sky-950'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                }`}
              >
                <input className="sr-only" type="radio" value="ONLINE" {...register('trialMode')} />
                <Monitor className="size-5 shrink-0 text-sky-600" aria-hidden="true" />
                <span className="flex min-w-0 flex-col">
                  <strong className="text-sm">Online</strong>
                  <span className="text-xs text-slate-500">Jadwal menyesuaikan ketersediaan</span>
                </span>
              </label>
              <label
                className={`flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 transition-colors ${
                  trialMode === 'OFFLINE'
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-950'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                }`}
              >
                <input className="sr-only" type="radio" value="OFFLINE" {...register('trialMode')} />
                <MapPin className="size-5 shrink-0 text-emerald-600" aria-hidden="true" />
                <span className="flex min-w-0 flex-col">
                  <strong className="text-sm">Offline</strong>
                  <span className="text-xs text-slate-500">Hanya tersedia setiap Sabtu</span>
                </span>
              </label>
            </div>
            {errors.trialMode ? (
              <p className="text-xs font-medium text-red-600" role="alert">{errors.trialMode.message}</p>
            ) : null}
          </fieldset>

          {trialMode === 'OFFLINE' ? (
            <div className="flex gap-3 border-l-4 border-emerald-500 bg-emerald-50 px-4 py-3 text-sm text-emerald-950 sm:col-span-2">
              <CalendarDays className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
              <div className="flex min-w-0 flex-col gap-1">
                <strong>{OFFLINE_TRIAL_SCHEDULE}</strong>
                <span className="leading-5">{OFFLINE_TRIAL_ADDRESS}</span>
              </div>
            </div>
          ) : null}

          <FormField
            id="notes"
            label={trialMode === 'OFFLINE' ? 'Catatan tambahan' : 'Preferensi jadwal'}
            error={errors.notes?.message}
            className="sm:col-span-2"
          >
            <Textarea
              id="notes"
              rows={4}
              placeholder={
                trialMode === 'OFFLINE'
                  ? 'Contoh: ingin hadir Sabtu tanggal tertentu'
                  : 'Tulis preferensi hari dan jam untuk jadwal trial'
              }
              aria-invalid={Boolean(errors.notes)}
              {...register('notes')}
            />
          </FormField>

          <div className="flex gap-3 rounded-lg border border-sky-100 bg-sky-50 px-4 py-3 text-sm text-sky-950 sm:col-span-2">
            <Monitor className="mt-0.5 size-5 shrink-0 text-sky-600" aria-hidden="true" />
            <p className="min-w-0 leading-5">
              <strong>Catatan:</strong> Pastikan peserta menyiapkan laptop dan koneksi internet yang stabil saat mengikuti trial class.
            </p>
          </div>
        </div>

        <div className="absolute -left-[9999px]" aria-hidden="true">
          <label htmlFor="website">Website</label>
          <input id="website" tabIndex={-1} autoComplete="off" {...register('website')} />
        </div>

        {serverError ? (
          <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-700" role="alert">
            {serverError}
          </p>
        ) : null}

        <div className="mt-5 flex flex-col gap-3">
          <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? <LoaderCircle data-icon="inline-start" className="animate-spin" /> : <Send data-icon="inline-start" />}
            {isSubmitting ? 'Mengirim data...' : 'Daftar Free Trial'}
          </Button>
          <p className="text-center text-xs leading-5 text-slate-500">
            Data ini hanya digunakan untuk mengatur kelas trial dan menghubungi orang tua.
          </p>
        </div>
      </form>
    </div>
  );
}
