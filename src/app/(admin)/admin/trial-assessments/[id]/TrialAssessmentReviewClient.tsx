'use client';

import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { Check, Eye, FileText, Laptop, MapPin, Pencil, Save, Send, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState, useTransition } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import {
  TRIAL_COMPETENCIES,
  buildTrialParentReportContent,
  parseTrialRubric,
  type TrialParentReportContent,
  type TrialRubric,
} from '@/lib/services/trialAssessmentContent';
import type { TrialAssessmentWithRelations } from '@/lib/dao/trialAssessmentsDao';
import type { TablesRow } from '@/types/supabase';
import { formatTrialAvailability } from '@/lib/services/trialAvailability';
import { DEFAULT_TRIAL_REGISTRATION_FEE } from '@/lib/services/trialPricing';

type ReviewLevel = Pick<TablesRow<'levels'>, 'id' | 'name' | 'order_index'>;
type ReviewPricing = Pick<TablesRow<'pricing'>, 'id' | 'level_id' | 'mode' | 'base_price_monthly'>;
type ReviewPaymentPlan = Pick<TablesRow<'payment_plans'>, 'id' | 'name' | 'duration_months' | 'discount_percent'>;

type Props = {
  assessment: TrialAssessmentWithRelations;
  levels: ReviewLevel[];
  pricing: ReviewPricing[];
  paymentPlans: ReviewPaymentPlan[];
};

const STATUS_LABELS: Record<TrialAssessmentWithRelations['status'], string> = {
  DRAFT: 'Draft coach',
  PENDING_ADMIN_REVIEW: 'Perlu review',
  APPROVED: 'Disetujui',
  PUBLISHED: 'Report terkirim',
  REGISTRATION_STARTED: 'Daftar dimulai',
  INVOICE_CREATED: 'Invoice dibuat',
  PAYMENT_PENDING: 'Menunggu bayar',
  PAID: 'Lunas',
  CONVERTED: 'Converted',
};

function formatDateTime(value: string | null) {
  if (!value) return '-';
  return format(new Date(value), 'EEEE, d MMMM yyyy HH.mm', { locale: localeId });
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value);
}

function asParentContent(value: unknown, fallback: TrialParentReportContent): TrialParentReportContent {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fallback;
  const source = value as Partial<TrialParentReportContent>;
  const recommendationReasons = Array.isArray(source.recommendationReasons)
    ? source.recommendationReasons.filter(
      (item): item is string => typeof item === 'string' && item.trim().toLowerCase() !== 'sesuai kemampuan saat ini',
    )
    : fallback.recommendationReasons;
  return {
    highlights: Array.isArray(source.highlights) ? source.highlights : fallback.highlights,
    potential: Array.isArray(source.potential) ? source.potential : fallback.potential,
    triedToday: Array.isArray(source.triedToday) ? source.triedToday : fallback.triedToday,
    strengths: Array.isArray(source.strengths) ? source.strengths : fallback.strengths,
    growthOpportunities: Array.isArray(source.growthOpportunities) ? source.growthOpportunities : fallback.growthOpportunities,
    coachMessage: typeof source.coachMessage === 'string' ? source.coachMessage : fallback.coachMessage,
    recommendationReasons,
  };
}

export default function TrialAssessmentReviewClient({ assessment, levels, pricing, paymentPlans }: Props) {
  const initialClassMode = pricing.find((item) => item.id === assessment.pricing_id)?.mode ?? assessment.trial!.trial_mode;
  const [selectedClassMode, setSelectedClassMode] = useState<'ONLINE' | 'OFFLINE'>(initialClassMode);
  const [selectedLevelId, setSelectedLevelId] = useState(assessment.recommended_level_id ?? '');
  const [paymentPlanId, setPaymentPlanId] = useState(assessment.payment_plan_id ?? paymentPlans[0]?.id ?? '');
  const [discountLabel, setDiscountLabel] = useState(assessment.discount_label ?? '');
  const [discountAmount, setDiscountAmount] = useState(String(assessment.discount_amount ?? 0));
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const trial = assessment.trial!;
  const availability = formatTrialAvailability(assessment.rubric);
  const rubric = parseTrialRubric(assessment.rubric) as TrialRubric;
  const selectedLevel = levels.find((item) => item.id === selectedLevelId);
  const selectedPlan = paymentPlans.find((item) => item.id === paymentPlanId) ?? paymentPlans[0];
  const selectedPricing = pricing.find((item) => item.level_id === selectedLevelId && item.mode === selectedClassMode);

  const pricePreview = useMemo(() => {
    const monthly = Number(selectedPricing?.base_price_monthly ?? 0);
    const duration = selectedPlan?.duration_months ?? 1;
    const planDiscount = Math.round((monthly * duration * Number(selectedPlan?.discount_percent ?? 0)) / 100);
    const base = Math.max(0, monthly * duration - planDiscount);
    const discount = Math.max(0, Math.round(Number(discountAmount) || 0));
    const registrationFee = DEFAULT_TRIAL_REGISTRATION_FEE;
    return { base, registrationFee, discount, final: Math.max(0, base + registrationFee - discount) };
  }, [discountAmount, selectedPlan?.discount_percent, selectedPlan?.duration_months, selectedPricing?.base_price_monthly]);

  const fallbackContent = buildTrialParentReportContent({
    rubric,
    quickObservations: assessment.quick_observations ?? [],
    personalizedObservation: assessment.personalized_observation,
    recommendationTags: assessment.recommendation_tags ?? [],
  });
  const parentContent = asParentContent(assessment.parent_report_content, fallbackContent);
  const [coachMessage, setCoachMessage] = useState(parentContent.coachMessage);
  const [isEditingInsight, setIsEditingInsight] = useState(false);
  const [isFixingTypo, setIsFixingTypo] = useState(false);
  const [isSavingInsight, setIsSavingInsight] = useState(false);
  const [insightError, setInsightError] = useState<string | null>(null);
  const [insightSuccess, setInsightSuccess] = useState<string | null>(null);
  const canPublish = ['PENDING_ADMIN_REVIEW', 'APPROVED', 'PUBLISHED'].includes(assessment.status);
  const reportUrl = `/trial-report/${assessment.public_token}?preview=1`;

  function publish() {
    setError(null);
    setSuccess(null);

    if (!selectedLevelId || !selectedPricing?.id || !paymentPlanId) {
      setError('Level rekomendasi, pricing, atau paket pembayaran belum lengkap.');
      return;
    }
    startTransition(async () => {
      const response = await fetch(`/api/admin/trial-assessments/${assessment.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recommendedLevelId: selectedLevelId,
          classMode: selectedClassMode,
          paymentPlanId,
          discountLabel: discountLabel.trim() || null,
          discountAmount: Math.max(0, Math.round(Number(discountAmount) || 0)),
          coachMessage,
        }),
      });
      const payload = await response.json().catch(() => null) as { error?: string; reportUrl?: string } | null;
      if (!response.ok) {
        setError(payload?.error || 'Gagal publish trial report.');
        return;
      }
      setSuccess('Report trial berhasil dipublish. Link sudah dikirim ke orang tua bila WhatsApp aktif.');
    });
  }

  async function fixCoachInsightTypos() {
    setInsightError(null);
    setInsightSuccess(null);
    setIsFixingTypo(true);
    try {
      const response = await fetch(`/api/admin/trial-assessments/${assessment.id}/fix-typos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: coachMessage }),
      });
      const payload = await response.json().catch(() => null) as { error?: string; text?: string; changes?: number } | null;
      if (!response.ok || typeof payload?.text !== 'string') {
        setInsightError(payload?.error || 'Gagal memperbaiki typo.');
        return;
      }
      setCoachMessage(payload.text);
      setInsightSuccess(payload.changes ? `${payload.changes} typo diperbaiki. Periksa kembali sebelum disimpan.` : 'Tidak ada typo yang perlu diperbaiki.');
    } catch {
      setInsightError('Gagal terhubung ke layanan koreksi typo.');
    } finally {
      setIsFixingTypo(false);
    }
  }

  async function saveCoachInsight() {
    setInsightError(null);
    setInsightSuccess(null);
    setIsSavingInsight(true);
    try {
      const response = await fetch(`/api/admin/trial-assessments/${assessment.id}/content`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coachMessage }),
      });
      const payload = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) {
        setInsightError(payload?.error || 'Gagal menyimpan Coach insight.');
        return;
      }
      setInsightSuccess('Coach insight berhasil disimpan.');
      setIsEditingInsight(false);
    } catch {
      setInsightError('Gagal menyimpan Coach insight.');
    } finally {
      setIsSavingInsight(false);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_390px]">
      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader className="border-b">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle>{trial.student_name}</CardTitle>
                <CardDescription>
                  {trial.parent_name} · {trial.phone} · {trial.trial_mode === 'ONLINE' ? 'Online' : 'Offline'}
                </CardDescription>
              </div>
              <Badge variant="outline">{STATUS_LABELS[assessment.status]}</Badge>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 pt-6 md:grid-cols-2">
            <Info label="Jadwal trial" value={`${formatDateTime(trial.scheduled_at)} WIB`} />
            <Info label="Coach" value={assessment.coach?.full_name ?? '-'} />
            <Info label="Sekolah" value={`${trial.school_name} · ${trial.student_grade}`} />
            <Info label="Submit coach" value={`${formatDateTime(assessment.submitted_at)} WIB`} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Ketersediaan kelas</CardTitle>
            <CardDescription>Preferensi waktu yang diisi Coach untuk membantu pencocokan jadwal mulai.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <Info label="Hari yang tersedia" value={availability.days.length ? availability.days.join(', ') : 'Belum diisi coach'} />
            <Info label="Jam mulai yang tersedia" value={availability.times.length ? availability.times.join(', ') : 'Belum diisi coach'} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Rubrik Internal</CardTitle>
            <CardDescription>Skor ini tidak tampil di report parent.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            {TRIAL_COMPETENCIES.map((competency) => {
              const rating = rubric[competency.key];
              return (
                <div key={competency.key} className="rounded-2xl border bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-bold text-slate-900">{competency.name}</h3>
                      <p className="mt-1 text-xs text-slate-500">{rating ? competency.internalLevels[rating] : '-'}</p>
                    </div>
                    <span className="grid size-10 place-items-center rounded-xl bg-sky-50 text-lg font-black text-sky-700">
                      {rating ?? '-'}
                    </span>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Isi Report Parent</CardTitle>
            <CardDescription>Preview narasi yang akan dibuka orang tua.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <PreviewSection title="Potensi yang terlihat" items={parentContent.potential.map((item) => `${item.name}: ${item.status}`)} />
            <PreviewSection title="Yang dicoba hari ini" items={parentContent.triedToday} />
            <div className="rounded-2xl border bg-white p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h3 className="text-sm font-black text-slate-900">Coach insight</h3>
                <Button type="button" variant="outline" size="sm" onClick={() => {
                  setInsightError(null);
                  setInsightSuccess(null);
                  setIsEditingInsight((value) => !value);
                }}>
                  <Pencil /> {isEditingInsight ? 'Tutup edit' : 'Edit insight'}
                </Button>
              </div>
              {isEditingInsight ? (
                <div className="mt-3 grid gap-3">
                  <Textarea
                    value={coachMessage}
                    onChange={(event) => setCoachMessage(event.target.value)}
                    rows={7}
                    maxLength={4000}
                    aria-label="Coach insight"
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" onClick={fixCoachInsightTypos} disabled={isFixingTypo || isSavingInsight}>
                      <Sparkles /> {isFixingTypo ? 'Memeriksa typo...' : 'Perbaiki typo dengan AI'}
                    </Button>
                    <Button type="button" onClick={saveCoachInsight} disabled={isFixingTypo || isSavingInsight}>
                      <Save /> {isSavingInsight ? 'Menyimpan...' : 'Simpan perubahan'}
                    </Button>
                  </div>
                  <p className="text-xs leading-5 text-slate-500">Koreksi AI hanya mengganti potongan typo yang tervalidasi. Perubahan manual tetap bisa dilakukan sebelum disimpan.</p>
                  {insightError ? <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">{insightError}</p> : null}
                  {insightSuccess ? <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700"><Check className="mr-1 inline size-3.5" />{insightSuccess}</p> : null}
                </div>
              ) : (
                <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-600">{coachMessage}</p>
              )}
            </div>
            {parentContent.recommendationReasons.length ? (
              <PreviewSection title="Catatan rekomendasi" items={parentContent.recommendationReasons} />
            ) : null}
          </CardContent>
        </Card>
      </div>

      <aside className="xl:sticky xl:top-6 xl:self-start">
        <Card>
          <CardHeader>
            <CardTitle>Finalisasi Weekly</CardTitle>
            <CardDescription>Tentukan rekomendasi dan data pendaftaran lanjutan.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5">
            <div className="grid gap-2">
              <Label>Tipe kelas</Label>
              <div className="grid grid-cols-2 gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1">
                {([
                  { value: 'ONLINE', label: 'Online', icon: Laptop },
                  { value: 'OFFLINE', label: 'Offline', icon: MapPin },
                ] as const).map((option) => {
                  const Icon = option.icon;
                  const active = selectedClassMode === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setSelectedClassMode(option.value)}
                      className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-3 text-sm font-bold transition-colors ${
                        active
                          ? 'bg-[#22367b] text-white shadow-sm'
                          : 'text-slate-600 hover:bg-white hover:text-[#22367b]'
                      }`}
                      aria-pressed={active}
                    >
                      <Icon className="size-4" />
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Level rekomendasi</Label>
              <Select
                value={selectedLevelId}
                onValueChange={setSelectedLevelId}
              >
                <SelectTrigger className="w-full"><SelectValue placeholder="Pilih level" /></SelectTrigger>
                <SelectContent>
                  {levels.map((level) => (
                    <SelectItem key={level.id} value={level.id}>{level.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label>Paket pembayaran</Label>
              <Select value={paymentPlanId} onValueChange={setPaymentPlanId}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Pilih paket" /></SelectTrigger>
                <SelectContent>
                  {paymentPlans.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.name} · {item.duration_months} bulan · diskon {item.discount_percent}%
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="discount-label">Label diskon (opsional)</Label>
              <Input
                id="discount-label"
                value={discountLabel}
                onChange={(event) => setDiscountLabel(event.target.value)}
                placeholder="Contoh: Benefit alumni trial"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="discount-amount">Nominal diskon</Label>
              <Input
                id="discount-amount"
                inputMode="numeric"
                value={discountAmount}
                onChange={(event) => setDiscountAmount(event.target.value.replace(/\D/g, ''))}
              />
            </div>

            <Separator />

            <div className="grid gap-2 rounded-2xl bg-slate-50 p-4 text-sm">
              <Row label="Level" value={selectedLevel?.name ?? '-'} />
              <Row label="Pricing" value={selectedPricing ? `${selectedClassMode} · ${formatCurrency(selectedPricing.base_price_monthly)}/bulan` : 'Belum ada'} />
              <Row label="Subtotal" value={formatCurrency(pricePreview.base)} />
              <Row label="Biaya pendaftaran" value={formatCurrency(pricePreview.registrationFee)} />
              <Row label="Diskon" value={formatCurrency(pricePreview.discount)} />
              <Row label="Total invoice" value={formatCurrency(pricePreview.final)} strong />
            </div>

            {error ? <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p> : null}
            {success ? <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">{success}</p> : null}

            <div className="grid gap-2">
              <Button onClick={publish} disabled={!canPublish || isPending}>
                <Send /> {isPending ? 'Publishing...' : 'Approve & Publish'}
              </Button>
              <Button asChild variant="outline">
                <Link href={reportUrl} target="_blank" rel="noreferrer"><Eye /> Preview parent report</Link>
              </Button>
              {assessment.invoice ? (
                <Button asChild variant="outline">
                  <Link href={`/invoice/${assessment.invoice.invoice_number}`} target="_blank" rel="noreferrer">
                    <FileText /> Buka invoice
                  </Link>
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </aside>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 break-words text-sm font-bold text-slate-900">{value}</p>
    </div>
  );
}

function PreviewSection({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-2xl border bg-white p-4">
      <h3 className="mb-3 text-sm font-black text-slate-900">{title}</h3>
      <ul className="space-y-2">
        {items.map((item, index) => (
          <li key={`${title}-${index}`} className="text-sm leading-6 text-slate-600">{item}</li>
        ))}
      </ul>
    </div>
  );
}

function Row({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-slate-500">{label}</span>
      <span className={strong ? 'text-lg font-black text-slate-950' : 'font-bold text-slate-800'}>{value}</span>
    </div>
  );
}
