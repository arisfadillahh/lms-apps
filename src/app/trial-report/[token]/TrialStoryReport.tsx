'use client';

import { ArrowLeft, ArrowRight, Check, ChevronLeft, ChevronRight, Eye, Rocket, Sparkles, X } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useMemo, useState, useTransition } from 'react';

import { REPORT_STORY_CSS } from '@/app/report/[id]/ReportStoryExperience.styles';
import { REPORT_STORY_LAYOUT_FIX } from '@/app/report/ReportStoryExperience.layoutFix';
import type { TrialAssessmentStatus } from '@/lib/dao/trialAssessmentsDao';
import type { TrialParentReportContent } from '@/lib/services/trialAssessmentContent';

type Props = {
  token: string;
  status: TrialAssessmentStatus;
  studentName: string;
  parentName: string;
  coachName: string;
  trialMode: 'ONLINE' | 'OFFLINE';
  trialDate: string | null;
  recommendedLevel: string;
  basePrice: number | null;
  finalPrice: number | null;
  discountLabel: string | null;
  discountAmount: number;
  invoiceUrl: string | null;
  content: TrialParentReportContent;
};

function formatDate(value: string | null) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'long',
    timeZone: 'Asia/Jakarta',
  }).format(new Date(value));
}

function formatTrialDate(value: string | null) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: 'Asia/Jakarta',
  }).format(new Date(value));
}

function formatCurrency(value: number | null) {
  if (value === null || Number.isNaN(value)) return '-';
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value);
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

const STORY_CSS_OVERRIDE = `
.trial-story .progress{grid-template-columns:repeat(5,1fr)}
.trial-story .metric-score{font-size:13px;max-width:120px;text-align:right;color:var(--green-bright)}
.trial-story .metric-track span{width:100%!important}
.trial-story .skill-node{min-height:132px}
.trial-story .skill-badge{color:var(--cyan)}
.trial-story .overview-score{display:none}
.trial-story .coach-layout{grid-template-columns:minmax(0,1fr);gap:26px;align-content:center}
.trial-story .coach-copy{min-width:0;max-width:1120px}
.trial-story .coach-quote{max-width:none;margin-top:16px;overflow:visible;padding-right:0;white-space:pre-wrap;overflow-wrap:anywhere;font-size:clamp(14px,1.1vw,16px);line-height:1.38}
.trial-story .coach-columns{align-self:auto;align-items:start}
.trial-story .coach-card{height:auto;min-height:180px;padding:22px;overflow:visible}
.trial-story .coach-card h3{font-size:17px;margin-bottom:14px}
.trial-story .coach-card ul{gap:12px}
.trial-story .coach-card ul{min-width:0}
@media (max-width:640px){.trial-story .coach-layout{gap:14px}.trial-story .coach-quote{font-size:13px;line-height:1.4}.trial-story .coach-card{min-height:0;padding:18px}.trial-story .coach-card h3{font-size:16px}}
.trial-story .app,.trial-story .stage{overflow:hidden}
.trial-story .slide-inner{max-height:none;overflow:hidden;scrollbar-width:none;padding:16px 3px}
.trial-story .slide-inner::-webkit-scrollbar{display:none}
.trial-story .skills-layout{gap:clamp(24px,4vw,56px)}
.trial-story .skill-path{grid-template-columns:repeat(4,minmax(0,1fr));gap:18px 12px;padding:24px 6px}
.trial-story .skill-node{min-width:0;min-height:126px;padding:0 4px}
.trial-story .skill-node:nth-child(n+5){transform:none}
.trial-story .skill-badge{width:72px;height:72px;border-radius:22px}
.trial-story .skill-node strong{max-width:128px;font-size:12px;line-height:1.3}
@media (max-width:640px){.trial-story .skills-layout{gap:12px}.trial-story .skill-path{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;padding:14px 0}.trial-story .skill-node{min-height:116px}.trial-story .skill-node strong{max-width:130px;font-size:12px}}
.trial-story .skill-path{grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;padding:0}
.trial-story .skill-path::before{display:none}
.trial-story .skill-node{min-height:148px;align-content:center;justify-items:start;text-align:left;padding:20px;border:1px solid rgba(255,255,255,.12);border-radius:22px;background:linear-gradient(145deg,rgba(255,255,255,.09),rgba(255,255,255,.025));box-shadow:0 20px 50px rgba(0,0,0,.16)}
.trial-story .skill-node:nth-child(n+5){transform:none}
.trial-story .skill-badge{width:56px;height:56px;border-radius:17px}
.trial-story .skill-badge svg{width:27px;height:27px}
.trial-story .skill-node strong{max-width:none;margin-top:12px;font-size:14px;line-height:1.3}
@media (max-width:640px){.trial-story .skill-path{gap:10px}.trial-story .skill-node{min-height:108px;padding:14px;border-radius:18px}.trial-story .skill-badge{width:46px;height:46px;border-radius:14px}.trial-story .skill-badge svg{width:23px;height:23px}.trial-story .skill-node strong{margin-top:8px;font-size:12px}}
.trial-story .coach-layout{gap:16px;align-content:stretch;grid-template-rows:minmax(0,1fr) auto;min-height:0}
.trial-story .coach-copy{max-width:1180px;min-height:0;display:flex;flex-direction:column;justify-content:center}
.trial-story .coach-copy .display.medium{max-width:900px;font-size:clamp(34px,3.8vw,56px);line-height:.98;text-wrap:balance}
.trial-story .coach-copy .eyebrow{margin-bottom:10px}
.trial-story .coach-quote{margin-top:10px;max-width:1160px;font-size:clamp(12px,.86vw,14px);line-height:1.32}
.trial-story .coach-signature{margin-top:10px;font-size:14px}
.trial-story .coach-columns{grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;align-items:stretch}
.trial-story .coach-card{min-height:0;padding:16px;border-radius:20px}
.trial-story .coach-card.growth{transform:none}
.trial-story .coach-card h3{font-size:15px;margin-bottom:8px}
.trial-story .coach-card ul{gap:6px}
.trial-story .coach-card li{padding-left:17px;font-size:12px;line-height:1.3}
.trial-story .coach-card li::before{width:8px;height:8px}
@media (max-width:640px){.trial-story .coach-layout{gap:10px}.trial-story .coach-copy .display.medium{font-size:clamp(28px,8vw,40px)}.trial-story .coach-quote{font-size:11px;line-height:1.32}.trial-story .coach-signature{font-size:12px}.trial-story .coach-columns{gap:8px}.trial-story .coach-card{padding:12px;border-radius:16px}.trial-story .coach-card h3{font-size:13px}.trial-story .coach-card li{font-size:11px}}
`;

export default function TrialStoryReport({
  token,
  status,
  studentName,
  parentName,
  coachName,
  trialMode,
  trialDate,
  recommendedLevel,
  basePrice,
  finalPrice,
  discountLabel,
  discountAmount,
  invoiceUrl,
  content,
}: Props) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [storyOpen, setStoryOpen] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const potentialPreview = useMemo(() => content.potential.slice(0, 5), [content.potential]);
  const recommendationReasons = content.recommendationReasons.filter(
    (item) => item.trim().toLowerCase() !== 'sesuai kemampuan saat ini',
  );
  const recommendationItems = [
    `Lanjutkan ke level ${recommendedLevel}`,
    ...(recommendationReasons.length ? recommendationReasons : content.growthOpportunities),
  ].slice(0, 4);
  const canRegister = !invoiceUrl && status === 'PUBLISHED';

  useEffect(() => {
    if (!storyOpen) return;

    const html = document.documentElement;
    const previousHtmlOverflow = html.style.overflow;
    const previousHtmlOverscrollBehavior = html.style.overscrollBehavior;
    const previousBodyOverflow = document.body.style.overflow;
    const previousBodyOverscrollBehavior = document.body.style.overscrollBehavior;
    const previousBodyPosition = document.body.style.position;
    const previousBodyTop = document.body.style.top;
    const previousBodyWidth = document.body.style.width;
    const scrollY = window.scrollY;

    html.style.overflow = 'hidden';
    html.style.overscrollBehavior = 'none';
    document.body.style.overflow = 'hidden';
    document.body.style.overscrollBehavior = 'none';
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = '100%';

    return () => {
      html.style.overflow = previousHtmlOverflow;
      html.style.overscrollBehavior = previousHtmlOverscrollBehavior;
      document.body.style.overflow = previousBodyOverflow;
      document.body.style.overscrollBehavior = previousBodyOverscrollBehavior;
      document.body.style.position = previousBodyPosition;
      document.body.style.top = previousBodyTop;
      document.body.style.width = previousBodyWidth;
      window.scrollTo(0, scrollY);
    };
  }, [storyOpen]);

  const slides = [
    {
      key: 'discovery',
      render: () => (
        <div className="intro-layout">
          <div className="intro-copy">
            <p className="eyebrow">Trial Class Discovery</p>
            <h1 className="display medium slide-copy-safe">
              Perjalanan coding {studentName} <span className="accent">baru dimulai.</span>
            </h1>
            <p className="lead">
              Dari sesi trial {trialMode === 'ONLINE' ? 'online' : 'offline'}, Coach melihat beberapa potensi awal
              yang bisa dikembangkan lewat project bertahap.
            </p>
            <div className="intro-actions">
              <button type="button" className="primary-btn" onClick={() => setActiveIndex(1)}>
                Mulai lihat report <ArrowRight />
              </button>
              <button type="button" className="secondary-btn" onClick={() => setStoryOpen(false)}>
                Lihat ringkasan <Eye />
              </button>
            </div>
          </div>
          <div className="identity-orbit" aria-hidden="true">
            <div className="orbit-line" />
            <div className="orbit-line two" />
            <div className="identity-core">
              <div className="monogram">{initials(studentName)}</div>
            </div>
            <div className="identity-tag">
              <strong>Trial Class</strong>
              <span>{trialMode === 'ONLINE' ? 'Online' : 'Offline'} - {formatDate(trialDate)}</span>
            </div>
          </div>
        </div>
      ),
    },
    {
      key: 'potential',
      render: () => (
        <div className="stats-layout">
          <div>
            <p className="eyebrow">Potensi yang Terlihat</p>
            <h2 className="display medium slide-copy-safe">
              Sinyal awal yang <span className="accent">menonjol</span> saat trial.
            </h2>
            <p className="lead">
              Bagian ini merangkum kecenderungan belajar yang terlihat tanpa menampilkan skor internal.
            </p>
          </div>
          <div className="metric-list">
            {potentialPreview.map((item, index) => (
              <div key={item.key} className="metric-row">
                <div className="metric-icon"><Sparkles /></div>
                <div className="metric-copy">
                  <strong>{item.name}</strong>
                  <div className="metric-track" style={{ '--value': 100 } as React.CSSProperties}><span /></div>
                </div>
                <div className="metric-score">{item.status}</div>
              </div>
            ))}
          </div>
        </div>
      ),
    },
    {
      key: 'tried',
      render: () => (
        <div className="skills-layout">
          <div>
            <p className="eyebrow">Yang Dicoba Hari Ini</p>
            <h2 className="display medium slide-copy-safe">
              Beberapa aktivitas sudah <span className="accent">dikenalkan.</span>
            </h2>
            <p className="lead">
              Trial bukan tanda semua materi sudah dikuasai, tapi langkah awal untuk melihat minat dan cara belajar.
            </p>
            <span className="unlocked">Aktivitas trial selesai dicoba</span>
          </div>
          <div className="skill-path">
            {content.triedToday.slice(0, 4).map((item, index) => (
              <div key={item} className="skill-node" style={{ '--i': index } as React.CSSProperties}>
                <div className="skill-badge"><Check /></div>
                <strong>{item}</strong>
              </div>
            ))}
          </div>
        </div>
      ),
    },
    {
      key: 'coach',
      render: () => (
        <div className="coach-layout">
          <div className="coach-copy">
            <p className="eyebrow">Coach Insight</p>
            <h2 className="display medium slide-copy-safe">
              Catatan dari <span className="accent">{coachName}</span>
            </h2>
            <p className="coach-quote">“{content.coachMessage}”</p>
            <p className="coach-signature">{coachName}</p>
          </div>
          <div className="coach-columns">
            <div className="coach-card strength">
              <h3>Kekuatan utama</h3>
              <ul>
                {(content.strengths.length ? content.strengths : content.highlights).slice(0, 4).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <div className="coach-card growth">
              <h3>Arah belajar berikutnya</h3>
              <ul>
                {recommendationItems.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      ),
    },
    {
      key: 'journey',
      render: () => (
        <div className="final-layout">
          <div className="final-emblem"><Rocket /></div>
          <p className="eyebrow">Continue The Journey</p>
          <h2 className="display medium slide-copy-safe">
            Lanjutkan ke level <span className="accent">{recommendedLevel}</span>
          </h2>
          <p className="lead">
            Program ini direkomendasikan agar {studentName} bisa mengembangkan minat yang terlihat saat trial
            lewat pembelajaran weekly yang lebih konsisten.
          </p>
          {recommendedLevel && recommendedLevel !== 'Weekly Class' ? (
            <div className="mini-summary">
              <span>Level rekomendasi: <strong>{recommendedLevel}</strong></span>
            </div>
          ) : null}
          <div className="final-actions">
            <button type="button" className="primary-btn" onClick={startRegistration}>
              {invoiceUrl ? 'Buka Invoice' : 'Daftar Sekarang'} <ArrowRight />
            </button>
            <button type="button" className="secondary-btn" onClick={() => setStoryOpen(false)}>
              Lihat ringkasan <Eye />
            </button>
          </div>
        </div>
      ),
    },
  ];

  function next() {
    setActiveIndex((current) => Math.min(slides.length - 1, current + 1));
  }

  function previous() {
    setActiveIndex((current) => Math.max(0, current - 1));
  }

  function startRegistration() {
    setError(null);
    if (invoiceUrl) {
      window.location.href = invoiceUrl;
      return;
    }
    if (!canRegister) {
      setError('Pendaftaran belum bisa diproses dari report ini.');
      setStoryOpen(false);
      return;
    }

    startTransition(async () => {
      const response = await fetch(`/api/trial-reports/${token}/register`, { method: 'POST' });
      const payload = await response.json().catch(() => null) as { invoiceUrl?: string; error?: string } | null;
      if (!response.ok || !payload?.invoiceUrl) {
        setError(payload?.error || 'Gagal membuat invoice pendaftaran.');
        setStoryOpen(false);
        return;
      }
      window.location.href = payload.invoiceUrl;
    });
  }

  return (
    <>
        <style>{REPORT_STORY_CSS + STORY_CSS_OVERRIDE + REPORT_STORY_LAYOUT_FIX}</style>
      {storyOpen ? (
        <div className="clevio-story trial-story" role="dialog" aria-label="Trial report story">
          <div className="noise" />
          <div className="grid" />
          <div className="glow" />
          <div className="app">
            <header className="topbar">
              <div className="brand" aria-label="Clevio Innovator Camp">
                <Image className="brand-logo brand-logo-dark" src="/logo/innovator-camp-logo-light.png" alt="Clevio Innovator Camp" width={152} height={57} priority />
                <Image className="brand-logo brand-logo-light" src="/logo/innovator-camp-logo-dark.png" alt="Clevio Innovator Camp" width={152} height={57} priority />
              </div>
              <div className="progress" aria-label="Progress story">
                {slides.map((slide, index) => (
                  <button
                    key={slide.key}
                    type="button"
                    className={`progress-segment${index < activeIndex ? ' done' : ''}${index === activeIndex ? ' active' : ''}`}
                    onClick={() => setActiveIndex(index)}
                    aria-label={`Slide ${index + 1}`}
                  />
                ))}
              </div>
              <div className="top-actions">
                <button type="button" className="story-skip" onClick={() => setStoryOpen(false)}>
                  <span>Lewati</span> <X />
                </button>
              </div>
            </header>

            <main className="stage">
              {slides.map((slide, index) => (
                <section key={slide.key} className={`slide${index === activeIndex ? ' active' : ''}`}>
                  <div className="slide-inner">{slide.render()}</div>
                </section>
              ))}
            </main>

            <footer className="bottom-nav">
              <button type="button" className="nav-btn" onClick={previous} disabled={activeIndex === 0} aria-label="Slide sebelumnya">
                <ChevronLeft />
              </button>
              <div className="nav-hint">{activeIndex + 1} / {slides.length}</div>
              <button type="button" className="nav-btn" onClick={next} disabled={activeIndex === slides.length - 1} aria-label="Slide berikutnya">
                <ChevronRight />
              </button>
            </footer>
          </div>
        </div>
      ) : null}

      <main className="min-h-screen bg-[#f4f8ff] px-4 py-8 text-slate-900 sm:px-6 lg:px-10">
        <div className="mx-auto max-w-5xl space-y-6">
          <section className="overflow-hidden rounded-[32px] bg-white shadow-[0_24px_80px_rgba(34,54,123,.12)]">
            <div className="bg-gradient-to-br from-[#142769] via-[#2344a0] to-[#0fb7dd] px-6 py-10 text-white sm:px-10">
              <Image src="/logo/innovator-camp-logo-light.png" alt="Clevio Innovator Camp" width={150} height={56} />
              <p className="mt-8 text-sm font-black uppercase tracking-[0.22em] text-lime-200">Free Trial Report</p>
              <h1 className="mt-3 max-w-3xl text-4xl font-black tracking-tight sm:text-5xl">{studentName}</h1>
              <p className="mt-4 max-w-2xl text-lg text-blue-50">
                Halo Ayah/Bunda {parentName}, berikut ringkasan trial class dan rekomendasi Coach.
              </p>
            </div>
            <div className="grid gap-4 p-6 sm:grid-cols-2 sm:p-10">
              <Summary label="Coach" value={coachName} />
              <Summary label="Waktu trial" value={formatTrialDate(trialDate)} />
            </div>
          </section>

          <section className="grid gap-6 lg:grid-cols-2">
            <ReportBox title="Potensi yang terlihat" items={content.potential.map((item) => `${item.name}: ${item.status}. ${item.description}`)} />
            <ReportBox title="Yang dicoba hari ini" items={content.triedToday} />
            <ReportBox title="Kekuatan utama" items={content.strengths.length ? content.strengths : content.highlights} />
            <ReportBox
              title="Rekomendasi Coach"
              items={[
                `Level rekomendasi: ${recommendedLevel}`,
                ...(recommendationReasons.length ? recommendationReasons : content.growthOpportunities),
              ]}
            />
          </section>

          <section className="rounded-[28px] bg-white p-6 shadow-[0_18px_60px_rgba(34,54,123,.08)] sm:p-8">
            <h2 className="text-2xl font-black text-[#142769]">Coach Insight</h2>
            <p className="mt-4 text-lg leading-8 text-slate-600">“{content.coachMessage}”</p>
            <p className="mt-4 font-bold text-lime-700">{coachName}</p>
          </section>

          <section className="rounded-[28px] bg-[#142769] p-6 text-white shadow-[0_18px_60px_rgba(20,39,105,.18)] sm:p-8">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-2xl font-black">Lanjut ke Weekly Class</h2>
                <p className="mt-2 text-blue-100">Level {recommendedLevel}</p>
                <div className="mt-4 grid gap-1 text-sm text-blue-50">
                  <span>Subtotal: {formatCurrency(basePrice)}</span>
                  {discountAmount > 0 ? <span>{discountLabel || 'Diskon'}: -{formatCurrency(discountAmount)}</span> : null}
                  <strong className="text-lg text-lime-200">Total: {formatCurrency(finalPrice)}</strong>
                </div>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={startRegistration}
                  disabled={isPending}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-lime-300 px-6 font-black text-[#142769] transition hover:bg-lime-200 disabled:cursor-wait disabled:opacity-70"
                >
                  {isPending ? 'Memproses...' : invoiceUrl ? 'Buka Invoice' : 'Daftar Sekarang'} <ArrowRight className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setStoryOpen(true)}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-white/20 px-6 font-black text-white transition hover:bg-white/10"
                >
                  <ArrowLeft className="size-4" /> Lihat Story Lagi
                </button>
              </div>
            </div>
            {error ? <p className="mt-4 rounded-xl bg-red-500/15 px-4 py-3 text-sm font-bold text-red-100">{error}</p> : null}
            {invoiceUrl ? (
              <p className="mt-4 text-sm text-blue-100">
                Invoice sudah dibuat. <Link href={invoiceUrl} className="font-bold text-lime-200 underline">Buka invoice pembayaran</Link>.
              </p>
            ) : null}
          </section>
        </div>
      </main>
    </>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl bg-slate-50 p-5">
      <p className="text-xs font-black uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-base font-black text-[#142769]">{value}</p>
    </div>
  );
}

function ReportBox({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-[28px] bg-white p-6 shadow-[0_18px_60px_rgba(34,54,123,.08)]">
      <h2 className="text-xl font-black text-[#142769]">{title}</h2>
      <ul className="mt-4 space-y-3">
        {items.map((item, index) => (
          <li key={`${title}-${index}`} className="flex gap-3 text-sm leading-6 text-slate-600">
            <span className="mt-2 size-2 shrink-0 rounded-full bg-lime-400" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
