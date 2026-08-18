'use client';

import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { ArrowLeft, Check, Send } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState, useTransition } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { TrialClassSubmission } from '@/lib/dao/trialClassDao';
import type { TrialAssessmentRecord } from '@/lib/dao/trialAssessmentsDao';
import {
  QUICK_OBSERVATION_OPTIONS,
  RECOMMENDATION_TAG_OPTIONS,
  TRIAL_COMPETENCIES,
  buildTrialParentReportContent,
  isCompleteTrialRubric,
  parseTrialRubric,
  type TrialCompetencyKey,
  type TrialRubric,
} from '@/lib/services/trialAssessmentContent';
import {
  readTrialAvailability,
  TRIAL_AVAILABILITY_DAY_OPTIONS,
  TRIAL_AVAILABILITY_TIME_OPTIONS,
} from '@/lib/services/trialAvailability';
import { trialAssessmentSubmissionSchema } from '@/lib/services/trialAssessmentSubmission';

export type LevelOption = { id: string; name: string; order_index: number };

type Props = {
  trial: TrialClassSubmission;
  assessment: TrialAssessmentRecord;
  levels: LevelOption[];
};

const STATUS_LABELS: Record<TrialAssessmentRecord['status'], string> = {
  DRAFT: 'Draft',
  PENDING_ADMIN_REVIEW: 'Menunggu review admin',
  APPROVED: 'Disetujui',
  PUBLISHED: 'Report sudah dikirim',
  REGISTRATION_STARTED: 'Pendaftaran dimulai',
  INVOICE_CREATED: 'Invoice dibuat',
  PAYMENT_PENDING: 'Menunggu pembayaran',
  PAID: 'Sudah dibayar',
  CONVERTED: 'Sudah menjadi weekly',
};

function formatSchedule(value: string | null) {
  if (!value) return '-';
  return format(new Date(value), 'EEEE, d MMMM yyyy HH.mm', { locale: localeId });
}

export default function TrialAssessmentForm({ trial, assessment, levels }: Props) {
  const initialRubric = parseTrialRubric(assessment.rubric);
  const [rubric, setRubric] = useState<Partial<TrialRubric>>(initialRubric);
  const [quickObservations, setQuickObservations] = useState<string[]>(assessment.quick_observations ?? []);
  const [personalizedObservation, setPersonalizedObservation] = useState(assessment.personalized_observation ?? '');
  const [internalNotes, setInternalNotes] = useState(assessment.internal_notes ?? '');
  const [recommendedLevelId, setRecommendedLevelId] = useState(assessment.recommended_level_id ?? '');
  const [recommendationTags, setRecommendationTags] = useState<string[]>(assessment.recommendation_tags ?? []);
  const initialAvailability = readTrialAvailability(assessment.rubric);
  const [availableDays, setAvailableDays] = useState<string[]>(initialAvailability.days);
  const [availableTimeSlots, setAvailableTimeSlots] = useState<string[]>(initialAvailability.timeSlots);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  const canEdit = assessment.status === 'DRAFT';
  const completeRubric = isCompleteTrialRubric(rubric);

  const preview = useMemo(() => {
    if (!completeRubric) return null;
    return buildTrialParentReportContent({
      rubric,
      quickObservations,
      personalizedObservation: personalizedObservation.trim() || 'Coach melihat Ananda punya potensi untuk berkembang melalui project coding bertahap.',
      recommendationTags,
    });
  }, [completeRubric, personalizedObservation, quickObservations, recommendationTags, rubric]);

  function setRating(key: TrialCompetencyKey, value: number) {
    if (!canEdit) return;
    setRubric((current) => ({ ...current, [key]: value as TrialRubric[TrialCompetencyKey] }));
  }

  function toggleQuickObservation(value: string) {
    if (!canEdit) return;
    setQuickObservations((current) => {
      if (current.includes(value)) return current.filter((item) => item !== value);
      if (current.length >= 3) return current;
      return [...current, value];
    });
  }

  function toggleRecommendationTag(value: string) {
    if (!canEdit) return;
    setRecommendationTags((current) => {
      if (current.includes(value)) return current.filter((item) => item !== value);
      if (current.length >= 6) return current;
      return [...current, value];
    });
  }

  function toggleAvailabilityValue(value: string, setter: (update: (current: string[]) => string[]) => void) {
    if (!canEdit) return;
    setter((current) => current.includes(value) ? current.filter((item) => item !== value) : [...current, value]);
  }

  function submit() {
    setError(null);
    setSuccess(false);

    if (!completeRubric) {
      setError('Lengkapi semua rubrik 1-4 dulu.');
      return;
    }
    if (quickObservations.length === 0 || quickObservations.length > 3) {
      setError('Pilih 1 sampai 3 observasi cepat.');
      return;
    }
    if (personalizedObservation.trim().length < 20) {
      setError('Observasi personal wajib diisi minimal 20 karakter.');
      return;
    }
    if (!recommendedLevelId) {
      setError('Pilih level weekly yang direkomendasikan dulu.');
      return;
    }
    if (availableDays.length === 0 || availableTimeSlots.length === 0) {
      setError('Pilih minimal satu hari dan satu jam anak bisa mengikuti kelas.');
      return;
    }

    startTransition(async () => {
      const submission = trialAssessmentSubmissionSchema.safeParse({
        rubric,
        quickObservations,
        personalizedObservation: personalizedObservation.trim(),
        internalNotes: internalNotes.trim() || null,
        recommendedLevelId,
        recommendationTags,
        availableDays,
        availableTimeSlots,
      });
      if (!submission.success) {
        setError('Data assessment belum lengkap atau tidak valid. Periksa kembali pilihan dan isi penilaian.');
        return;
      }

      const response = await fetch(`/api/coach/trials/${trial.id}/assessment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...submission.data,
        }),
      });
      const payload = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) {
        setError(payload?.error || 'Gagal menyimpan assessment trial.');
        return;
      }
      setSuccess(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader className="border-b">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle>Data Trial</CardTitle>
                <CardDescription>Jadwal dan konteks peserta trial.</CardDescription>
              </div>
              <Badge variant={assessment.status === 'DRAFT' ? 'outline' : 'secondary'}>
                {STATUS_LABELS[assessment.status]}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 pt-6 sm:grid-cols-2">
            <Info label="Anak" value={trial.student_name} />
            <Info label="Jadwal" value={`${formatSchedule(trial.scheduled_at)} WIB`} />
            <Info label="Sekolah" value={trial.school_name} />
            <Info label="Orang tua" value={`${trial.parent_name} · ${trial.phone}`} />
            {trial.notes ? <Info className="sm:col-span-2" label="Catatan" value={trial.notes} /> : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Rubrik Internal Coach</CardTitle>
            <CardDescription>Nilai setiap aspek berdasarkan pengamatan selama trial.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            {TRIAL_COMPETENCIES.map((competency) => (
              <div key={competency.key} className="rounded-2xl border bg-white p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="font-bold text-slate-900">{competency.name}</h3>
                    <p className="mt-1 max-w-xl text-xs leading-5 text-slate-500">{competency.coachDescription}</p>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {[1, 2, 3, 4].map((value) => (
                      <button
                        key={value}
                        type="button"
                        disabled={!canEdit}
                        onClick={() => setRating(competency.key, value)}
                        className={`size-10 rounded-xl border text-sm font-black transition ${
                          rubric[competency.key] === value
                            ? 'border-sky-500 bg-sky-500 text-white'
                            : 'border-slate-200 bg-white text-slate-600 hover:border-sky-300'
                        } disabled:cursor-not-allowed disabled:opacity-60`}
                        aria-label={`${competency.name} ${value}`}
                      >
                        {value}
                      </button>
                    ))}
                  </div>
                </div>
                {rubric[competency.key] ? (
                  <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">
                    {competency.internalLevels[rubric[competency.key] as 1 | 2 | 3 | 4]}
                  </p>
                ) : null}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Observasi & Rekomendasi</CardTitle>
            <CardDescription>Catat hal yang paling terlihat dan pilih level lanjutan yang sesuai untuk anak.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5">
            <div className="grid gap-2">
              <Label>Observasi cepat (maksimal 3)</Label>
              <div className="flex flex-wrap gap-2">
                {QUICK_OBSERVATION_OPTIONS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    disabled={!canEdit}
                    onClick={() => toggleQuickObservation(option)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                      quickObservations.includes(option)
                        ? 'border-sky-500 bg-sky-50 text-sky-700'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-sky-300'
                    } disabled:cursor-not-allowed disabled:opacity-60`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="personalized-observation">Observasi personal coach</Label>
              <Textarea
                id="personalized-observation"
                disabled={!canEdit}
                value={personalizedObservation}
                onChange={(event) => setPersonalizedObservation(event.target.value)}
                placeholder="Contoh: Saat trial, Ananda terlihat antusias mencoba fitur baru dan mulai berani bertanya ketika project tidak berjalan sesuai harapan."
                rows={5}
              />
            </div>

            <div className="grid gap-2">
              <Label>Rekomendasi level</Label>
              <p className="text-xs leading-5 text-slate-500">
                Pilih level weekly yang paling sesuai. Kelas dan tanggal mulai akan ditentukan oleh admin.
              </p>
              <Select value={recommendedLevelId} onValueChange={setRecommendedLevelId} disabled={!canEdit}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Pilih level yang direkomendasikan" />
                </SelectTrigger>
                <SelectContent>
                  {levels.map((level) => (
                    <SelectItem key={level.id} value={level.id}>{level.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-4 rounded-2xl border border-sky-100 bg-sky-50/60 p-4">
              <div>
                <Label>Hari anak bisa ikut kelas</Label>
                <p className="mt-1 text-xs leading-5 text-slate-500">Pilih semua hari yang memungkinkan. Bisa pilih lebih dari satu.</p>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {TRIAL_AVAILABILITY_DAY_OPTIONS.map((option) => {
                  const active = availableDays.includes(option.value);
                  return (
                    <button
                      key={option.value}
                      type="button"
                      disabled={!canEdit}
                      onClick={() => toggleAvailabilityValue(option.value, setAvailableDays)}
                      className={`min-h-10 rounded-xl border px-3 text-sm font-bold transition ${active ? 'border-sky-500 bg-sky-500 text-white' : 'border-slate-200 bg-white text-slate-700 hover:border-sky-300'} disabled:cursor-not-allowed disabled:opacity-60`}
                      aria-pressed={active}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
              <div>
                <Label>Jam mulai yang memungkinkan</Label>
                <p className="mt-1 text-xs leading-5 text-slate-500">Pilih semua jam yang masih nyaman untuk anak.</p>
              </div>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                {TRIAL_AVAILABILITY_TIME_OPTIONS.map((option) => {
                  const active = availableTimeSlots.includes(option.value);
                  return (
                    <button
                      key={option.value}
                      type="button"
                      disabled={!canEdit}
                      onClick={() => toggleAvailabilityValue(option.value, setAvailableTimeSlots)}
                      className={`min-h-10 rounded-xl border px-2 text-sm font-bold transition ${active ? 'border-sky-500 bg-sky-500 text-white' : 'border-slate-200 bg-white text-slate-700 hover:border-sky-300'} disabled:cursor-not-allowed disabled:opacity-60`}
                      aria-pressed={active}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Alasan rekomendasi</Label>
              <div className="flex flex-wrap gap-2">
                {RECOMMENDATION_TAG_OPTIONS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    disabled={!canEdit}
                    onClick={() => toggleRecommendationTag(option)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                      recommendationTags.includes(option)
                        ? 'border-lime-500 bg-lime-50 text-lime-700'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-lime-300'
                    } disabled:cursor-not-allowed disabled:opacity-60`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="internal-notes">Catatan internal (opsional)</Label>
              <Textarea
                id="internal-notes"
                disabled={!canEdit}
                value={internalNotes}
                onChange={(event) => setInternalNotes(event.target.value)}
                placeholder="Tidak tampil ke orang tua. Pakai untuk konteks sales/admin."
                rows={3}
              />
            </div>

            {error ? <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p> : null}
            {success ? <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">Assessment terkirim ke admin untuk direview.</p> : null}

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
              <Button asChild variant="outline">
                <Link href="/coach/dashboard"><ArrowLeft /> Kembali</Link>
              </Button>
              <Button onClick={submit} disabled={!canEdit || isPending}>
                <Send /> {isPending ? 'Mengirim...' : 'Kirim ke Admin'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <aside className="lg:sticky lg:top-6 lg:self-start">
        <Card>
          <CardHeader>
            <CardTitle>Preview Parent Report</CardTitle>
            <CardDescription>Ringkasan naratif yang akan dipoles admin sebelum dikirim.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {preview ? (
              <>
                <PreviewList title="Potensi terlihat" items={preview.potential.slice(0, 3).map((item) => `${item.name}: ${item.status}`)} />
                <PreviewList title="Yang dicoba" items={preview.triedToday} />
                <PreviewList title="Highlight" items={preview.highlights} />
                <div className="rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-700">
                  {preview.coachMessage}
                </div>
              </>
            ) : (
              <div className="rounded-2xl border border-dashed p-5 text-sm leading-6 text-slate-500">
                Preview muncul setelah semua rubrik 1-4 terisi.
              </div>
            )}
            {!canEdit ? (
              <div className="flex items-start gap-2 rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-800">
                <Check className="mt-0.5 size-4 shrink-0" />
                Assessment sudah terkirim. Perubahan berikutnya dilakukan oleh admin saat review.
              </div>
            ) : null}
          </CardContent>
        </Card>
      </aside>
    </div>
  );
}

function Info({ label, value, className = '' }: { label: string; value: string; className?: string }) {
  return (
    <div className={`rounded-2xl bg-slate-50 p-4 ${className}`}>
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 break-words text-sm font-bold text-slate-900">{value}</p>
    </div>
  );
}

function PreviewList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <p className="mb-2 text-xs font-black uppercase tracking-wide text-slate-500">{title}</p>
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item} className="rounded-xl bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
