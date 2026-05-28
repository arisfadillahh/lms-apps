'use client';

import { useState, useTransition, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles, ArchiveRestore, Loader2, Send, ChevronDown } from 'lucide-react';

export type ReportDescriptionItem = {
  criteriaId: string;
  criteriaName: string;
  criteriaDescription: string;
  score: number;
  description: string;
};

const getGrade = (score: number) => {
  if (score >= 8.5) return 'A';
  if (score >= 7.0) return 'B';
  if (score >= 5.5) return 'C';
  return 'D';
};

const getBarColor = (idx: number) => {
  const colors = ['#10b981', '#6366f1', '#3b82f6', '#f59e0b', '#f43f5e'];
  return colors[idx % colors.length];
};

const CRITERIA_COLORS = [
  { bg: 'bg-emerald-100', text: 'text-emerald-600' },
  { bg: 'bg-indigo-100', text: 'text-indigo-600' },
  { bg: 'bg-blue-100', text: 'text-blue-600' },
  { bg: 'bg-amber-100', text: 'text-amber-600' },
  { bg: 'bg-rose-100', text: 'text-rose-600' },
];

const getErrorMessage = (err: unknown) => err instanceof Error ? err.message : 'Terjadi kesalahan.';

const getInitials = (name: string) => {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const initials = words.slice(0, 2).map((word) => word[0]?.toUpperCase()).join('');
  return initials || '?';
};

// SVG Arc Grade Ring
function GradeRing({ score, grade }: { score: number; grade: string }) {
  const size = 120;
  const stroke = 9;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  // Full 360° ring: score 10 = full circle
  const pct = Math.min(Math.max(score / 10, 0), 1);
  const offset = circumference * (1 - pct);

  const colorMap: Record<string, string> = {
    A: '#10b981',
    B: '#6366f1',
    C: '#f59e0b',
    D: '#ef4444',
  };
  const color = colorMap[grade] ?? '#10b981';

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        {/* Track */}
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke="#f1f5f9" strokeWidth={stroke}
        />
        {/* Arc */}
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke={color} strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${circumference}`}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.8s ease, stroke 0.4s ease' }}
        />
      </svg>
      {/* Center text */}
      <div className="relative" style={{ marginTop: `-${size}px`, height: `${size}px`, width: `${size}px` }}>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-5xl font-black leading-none" style={{ color }}>{grade}</span>
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tight mt-0.5">
            Score: {Math.round(score * 10)}
          </span>
        </div>
      </div>
      <p className="mt-3 text-slate-500 text-sm font-medium">Final Assessment Grade</p>
    </div>
  );
}

// Auto-resize textarea
function AutoTextarea({
  value,
  onChange,
  disabled,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  const resize = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, []);

  useEffect(() => { resize(); }, [value, resize]);

  return (
    <textarea
      ref={ref}
      value={value}
      rows={3}
      disabled={disabled}
      placeholder={placeholder}
      onChange={(e) => { onChange(e.target.value); resize(); }}
      onInput={resize}
      className="w-full p-5 bg-[#fafafa] border-2 border-slate-100 rounded-xl focus:outline-none focus:border-indigo-400 transition-all text-slate-700 leading-relaxed resize-none text-sm disabled:opacity-60 overflow-hidden"
      style={{ minHeight: '100px' }}
    />
  );
}

type Props = {
  reportId: string;
  initialDescriptions: ReportDescriptionItem[];
  coderName: string;
  coderAvatarUrl?: string | null;
  className: string;
  blockName: string;
  grade: string | null;
  averageScore: number | null;
  status: string;
  evaluationAnswers: { question: string; answer: string }[];
};

export default function ReportReviewClient({
  reportId,
  initialDescriptions,
  coderName,
  coderAvatarUrl,
  className,
  blockName,
  grade,
  averageScore,
  status,
  evaluationAnswers,
}: Props) {
  const router = useRouter();
  const [descriptions, setDescriptions] = useState(initialDescriptions);
  const [isPending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState('');
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [avatarFailed, setAvatarFailed] = useState(false);
  // Accordion: only one open at a time
  const [openIndex, setOpenIndex] = useState<number>(0);

  const filledCount = descriptions.filter(d => d.description.trim().length > 0).length;
  const totalCount = descriptions.length;
  const avgScore = averageScore ?? 0;
  const displayGrade = grade || getGrade(avgScore);
  const shouldShowCoderAvatar = Boolean(coderAvatarUrl && !avatarFailed);
  const coderInitials = getInitials(coderName);

  useEffect(() => {
    setAvatarFailed(false);
  }, [coderAvatarUrl]);

  const handleRegenerateCriteria = async (criteriaId: string, criteriaName: string, score: number) => {
    try {
      setGeneratingId(criteriaId);
      setErrorMsg('');
      const res = await fetch(`/api/coach/reports/${reportId}/regenerate-criteria`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ criteriaId, criteriaName, score }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Gagal me-regenerate deskripsi.');
      }
      const { description } = await res.json();
      setDescriptions(prev => prev.map(p => p.criteriaId === criteriaId ? { ...p, description } : p));
    } catch (err: unknown) {
      setErrorMsg(getErrorMessage(err));
    } finally {
      setGeneratingId(null);
    }
  };

  const handlePublish = () => {
    const hasEmpty = descriptions.some(d => !d.description.trim());
    if (hasEmpty) {
      setErrorMsg('Semua kolom deskripsi kriteria tidak boleh kosong.');
      return;
    }
    startTransition(async () => {
      try {
        setErrorMsg('');
        const res = await fetch(`/api/coach/reports/${reportId}/publish`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ descriptions }),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Gagal mem-publish rapor.');
        }
        router.push('/coach/reports');
        router.refresh();
      } catch (err: unknown) {
        setErrorMsg(getErrorMessage(err));
      }
    });
  };

  const handleDelete = () => {
    if (!confirm('Apakah Anda yakin ingin menghapus draf rapor ini? Seluruh nilai dan antrean akan kembali ke Dashboard.')) return;
    startTransition(async () => {
      setIsDeleting(true);
      try {
        setErrorMsg('');
        const res = await fetch(`/api/coach/reports/${reportId}`, { method: 'DELETE' });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Gagal menghapus draf rapor.');
        }
        router.push('/coach/rubrics');
        router.refresh();
      } catch (err: unknown) {
        setErrorMsg(getErrorMessage(err));
        setIsDeleting(false);
      }
    });
  };

  return (
    <div className="flex h-screen overflow-hidden font-sans antialiased text-slate-900">

      {/* ── LEFT PANEL ── */}
      <aside className="w-full lg:w-[38%] bg-white border-r border-slate-200 flex flex-col sticky top-0 h-auto lg:h-full overflow-y-auto">
        <div className="flex flex-col items-center justify-between h-full p-8 space-y-7">

          {/* Identity */}
          <div className="text-center w-full">
            <div className="inline-block p-1 rounded-full border-2 border-slate-100 mb-4">
              {shouldShowCoderAvatar ? (
                <img
                  src={coderAvatarUrl ?? ''}
                  alt={coderName}
                  className="w-24 h-24 rounded-full object-cover"
                  onError={() => setAvatarFailed(true)}
                />
              ) : (
                <div className="w-24 h-24 rounded-full bg-slate-800 flex items-center justify-center text-white text-3xl font-bold select-none">
                  {coderInitials}
                </div>
              )}
            </div>
            <h2 className="text-2xl font-bold text-slate-900 leading-tight">{coderName}</h2>
            <div className="flex items-center justify-center gap-2 mt-2 flex-wrap">
              <span className="text-sm text-slate-500 font-medium px-3 py-1 bg-slate-100 rounded-full">{className}</span>
              <span className="text-sm text-slate-500 font-medium px-3 py-1 bg-slate-100 rounded-full">{blockName}</span>
            </div>
            <div className="mt-3">
              <span className="bg-amber-100 text-amber-700 text-xs font-bold px-3 py-1 rounded-full tracking-wider uppercase">
                {status === 'DRAFT' ? 'Draft' : status}
              </span>
            </div>
          </div>

          {/* Grade Ring — SVG arc proportional to score */}
          <GradeRing score={avgScore} grade={displayGrade} />

          {/* Competency bars */}
          <div className="w-full space-y-3 max-w-xs">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest text-center mb-1">
              Competency Overview
            </h4>
            {descriptions.map((desc, idx) => {
              const pct = Math.round((desc.score / 10) * 100);
              return (
                <div key={desc.criteriaId} className="space-y-1">
                  <div className="flex justify-between text-[10px] font-bold text-slate-600 uppercase">
                    <span className="truncate max-w-[160px]">{desc.criteriaName}</span>
                    <span>{pct}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${pct}%`, background: getBarColor(idx) }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Evaluation Answers (Refleksi Coder) */}
          {evaluationAnswers.length > 0 && (
            <div className="w-full">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest text-center mb-3">
                Refleksi Coder
              </h4>
              <div className="space-y-3">
                {evaluationAnswers.map((item, idx) => (
                  <div key={idx} className="bg-slate-50 border border-slate-100 rounded-xl p-3">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">{idx + 1}. {item.question}</p>
                    <p className="text-sm text-slate-700 font-medium leading-snug">{item.answer}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Delete button */}
          <button
            onClick={handleDelete}
            disabled={isPending || isDeleting}
            className="w-full text-sm text-red-500 hover:text-red-700 font-semibold flex items-center justify-center gap-1.5 transition-colors disabled:opacity-40 py-2"
          >
            {isDeleting
              ? <><Loader2 size={14} className="animate-spin" /> Menghapus...</>
              : <><ArchiveRestore size={14} /> Hapus &amp; Ulang Nilai</>}
          </button>

        </div>
      </aside>

      {/* ── RIGHT PANEL ── */}
      <section className="w-full lg:w-[62%] bg-slate-50 flex flex-col overflow-hidden min-h-0">

        {/* Sticky header with Publish button */}
        <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-20 shrink-0">
          <div>
            <h3 className="text-lg font-bold flex items-center gap-2">
              <Sparkles size={20} className="text-violet-500" /> Edit Narasi AI
            </h3>
            <p className="text-sm text-slate-500 mt-0.5 italic">
              Klik <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-xs font-semibold"><Sparkles size={10} className="text-violet-500" /> Regenerate</span> untuk regenerasi satu kriteria.
            </p>
          </div>

          <span className="text-xs font-medium text-slate-400 hidden sm:block">Autosave: On</span>
        </header>

        {/* Error banner */}
        {errorMsg && (
          <div className="mx-4 mt-4 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-semibold">
            {errorMsg}
          </div>
        )}

        {/* Scrollable criteria list */}
        <div
          className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3 pb-6"
          style={{ scrollbarWidth: 'thin', scrollbarColor: '#cbd5e1 #f1f5f9' }}
        >
          {descriptions.map((desc, index) => {
            const isFilled = desc.description.trim().length > 0;
            const isGenerating = generatingId === desc.criteriaId;
            const color = CRITERIA_COLORS[index % CRITERIA_COLORS.length];
            const isOpen = openIndex === index;

            return (
              <div
                key={desc.criteriaId}
                className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden"
              >
                {/* Summary row — clickable */}
                <button
                  type="button"
                  className="w-full flex items-center justify-between p-4 cursor-pointer hover:bg-slate-50 transition-colors text-left"
                  onClick={() => setOpenIndex(isOpen ? -1 : index)}
                >
                  <div className="flex items-center gap-4">
                    <span className={`w-8 h-8 rounded-lg ${color.bg} ${color.text} flex items-center justify-center text-sm font-bold shrink-0`}>
                      {index + 1}
                    </span>
                    <div>
                      <h4 className="font-bold text-slate-800 text-sm">{desc.criteriaName}</h4>
                      {desc.criteriaDescription && (
                        <p className="text-[11px] text-slate-400 font-medium leading-snug mt-0.5 max-w-[280px] truncate">
                          {desc.criteriaDescription}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    {/* AI Regenerate button with smooth animation */}
                    <div
                      className={`overflow-hidden transition-all duration-400 ease-[cubic-bezier(0.4,0,0.2,1)] ${
                        isOpen ? 'max-w-[120px] opacity-100 mr-2' : 'max-w-0 opacity-0 mr-0 pointer-events-none'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation(); // Prevent accordion toggle
                          handleRegenerateCriteria(desc.criteriaId, desc.criteriaName, desc.score);
                        }}
                        disabled={generatingId !== null || isPending || isDeleting}
                        className="flex items-center gap-1.5 px-2.5 py-1 w-max bg-white border border-slate-200 shadow-sm rounded-full text-[11px] font-bold text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
                      >
                        {isGenerating
                          ? <Loader2 size={12} className="animate-spin text-violet-500" />
                          : <Sparkles size={12} className="text-violet-500" />}
                        <span className="hidden sm:inline">Regenerate</span>
                      </button>
                    </div>
                    {!isFilled && (
                      <span className="w-2 h-2 rounded-full bg-amber-500" title="Belum Lengkap" />
                    )}
                    <ChevronDown
                      size={18}
                      className="text-slate-400 transition-transform duration-500"
                      style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
                    />
                  </div>
                </button>

                {/* Collapsible content — grid-rows trick for perfectly smooth animation */}
                <div
                  className="grid"
                  style={{
                    gridTemplateRows: isOpen ? '1fr' : '0fr',
                    transition: 'grid-template-rows 0.45s cubic-bezier(0.4, 0, 0.2, 1)',
                  }}
                >
                  <div className="overflow-hidden">
                    <div className="px-4 pb-4 pt-0">
                      <div className="relative">
                        {/* AI Regenerate button was moved to header */}

                        <AutoTextarea
                          value={desc.description}
                          onChange={(v) =>
                            setDescriptions(prev =>
                              prev.map((p, i) => i === index ? { ...p, description: v } : p)
                            )
                          }
                          disabled={isPending || isDeleting || isGenerating}
                          placeholder="Tulis narasi performa di sini..."
                        />

                        <div className="absolute bottom-3 right-5 text-[10px] font-bold text-slate-300 uppercase pointer-events-none">
                          {desc.description.length} kar
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}



          <div className="h-4" />
        </div>

        {/* Floating publish button — no chip */}
        <footer className="shrink-0 border-t border-slate-200 bg-white px-6 py-4 flex justify-center">
          <button
            onClick={handlePublish}
            disabled={isPending || isDeleting || filledCount < totalCount}
            className="w-full max-w-xs flex items-center justify-center gap-2 h-11 px-8 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded-full shadow-lg shadow-emerald-300/50 transition-all text-sm group"
          >
            {isPending && !isDeleting
              ? <><Loader2 size={15} className="animate-spin" /> Memproses...</>
              : <><Send size={15} className="group-hover:-translate-y-0.5 transition-transform" /> Publish Rapor</>}
          </button>
        </footer>


      </section>
    </div>
  );
}
