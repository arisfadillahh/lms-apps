'use client';

import { useState, useTransition, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  Calendar, Users, Zap, FileText, ArrowRight, Flag, PartyPopper, 
  GraduationCap, LayoutGrid, ChevronLeft, ChevronRight, Save, X
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

type PendingLesson = {
  sessionId: string;
  className: string;
  blockName: string | null;
  lessonTitle: string;
  sessionDates: string[];
  studentsCount: number;
};

type DraftReport = {
  reportId: string;
  coderName: string;
  className: string;
  blockName: string | null;
  averageScore?: string | number | null;
  createdAt: string;
};

type EvaluationData = {
  students: { id: string; full_name: string }[];
  criteriaList: { id: string; name: string; description?: string }[];
  lessonTitle: string;
  blockName: string;
  sessionId: string;
};

type RubricPageClientProps = {
  pendingLessons: PendingLesson[];
  draftReports: DraftReport[];
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatDates(values: string[]): string {
  if (!values || values.length === 0) return '—';
  if (values.length === 1) return formatDate(values[0]);
  const dates = values.map(v => new Date(v));
  const firstDate = dates[0];
  const lastDate = dates[dates.length - 1];
  if (firstDate.getMonth() === lastDate.getMonth() && firstDate.getFullYear() === lastDate.getFullYear()) {
    const days = dates.map(d => d.getDate()).join(', ');
    return `${days} ${firstDate.toLocaleDateString('id-ID', { month: 'short', year: 'numeric' })}`;
  }
  return dates.map(d => d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })).join(', ') + ' ' + lastDate.getFullYear();
}

function getGradeLetter(score: number) {
  if (score >= 8.5) return 'A';
  if (score >= 7.0) return 'B';
  if (score >= 5.5) return 'C';
  return 'D';
}

// ─── Evaluation Modal ─────────────────────────────────────────────────────────

function EvaluationModal({ 
  data, 
  onClose,
  onSaved
}: { 
  data: EvaluationData;
  onClose: () => void;
  onSaved: (sessionId: string) => void;
}) {
  const { students, criteriaList, lessonTitle, blockName, sessionId } = data;
  const [isPending, startTransition] = useTransition();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');
  const [scores, setScores] = useState<Record<string, Record<string, string>>>(() => {
    const initial: Record<string, Record<string, string>> = {};
    students.forEach(s => {
      initial[s.id] = {};
      criteriaList.forEach(c => { initial[s.id][c.id] = ''; });
    });
    return initial;
  });

  // Auto-scroll to top when student changes
  useEffect(() => {
    const el = document.querySelector('.eval-scroll');
    if (el) el.scrollTo({ top: 0, behavior: 'smooth' });
  }, [currentIndex]);

  const currentStudent = students[currentIndex];
  const filledStudents = students.filter(s => criteriaList.every(c => scores[s.id][c.id] !== '')).length;
  const isReady = filledStudents === students.length;

  const handleNext = () => {
    if (currentIndex < students.length - 1) {
      setDirection(1);
      setCurrentIndex(p => p + 1);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setDirection(-1);
      setCurrentIndex(p => p - 1);
    }
  };

  const handleSubmit = () => {
    setErrorMessage('');
    if (!isReady) { setErrorMessage('Lengkapi semua nilai dulu ya.'); return; }
    startTransition(async () => {
      try {
        const res = await fetch('/api/coach/evaluations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId, scores })
        });
        if (!res.ok) {
          const d = await res.json();
          throw new Error(d.error || 'Gagal menyimpan nilai.');
        }
        // Trigger vanish + close
        onSaved(sessionId);
        onClose();
      } catch (err: any) {
        setErrorMessage(err.message);
      }
    });
  };

  const slideVariants = {
    enter: (dir: number) => ({ x: dir > 0 ? 80 : -80, opacity: 0 }),
    center: { x: 0, opacity: 1, zIndex: 1 },
    exit: (dir: number) => ({ x: dir < 0 ? 80 : -80, opacity: 0, zIndex: 0 })
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 md:p-8"
      style={{ fontFamily: "'Public Sans', sans-serif" }}
    >
      {/* Backdrop — clicking it closes the modal */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-md cursor-pointer"
        onClick={onClose}
      />

      {/* Card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="relative z-10 w-full max-w-3xl max-h-[90vh] bg-white rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden"
      >
        {/* Header */}
        <header className="shrink-0 border-b border-slate-100 px-6 py-4 flex items-center justify-between bg-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-orange-50 flex items-center justify-center">
              <FileText className="w-5 h-5 text-[#ec5b13]" />
            </div>
            <div>
              <h4 className="text-sm font-black text-slate-900 leading-none">Penilaian</h4>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{blockName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full border border-slate-100 flex items-center justify-center text-slate-400 hover:bg-slate-50 hover:rotate-90 transition-all duration-300"
          >
            <X size={18} />
          </button>
        </header>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto eval-scroll relative">
          <AnimatePresence initial={false} custom={direction} mode="popLayout">
            <motion.div
              key={currentStudent.id}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ x: { type: 'spring', stiffness: 300, damping: 30 }, opacity: { duration: 0.15 } }}
              className="p-6 md:p-10 space-y-10"
            >
              {/* Lesson + Student header */}
              <div className="text-center space-y-4">
                <div className="inline-flex items-center gap-2 bg-slate-900 text-white text-[9px] font-black tracking-widest uppercase px-4 py-1.5 rounded-full">
                  <span className="opacity-50">LESSON:</span>
                  <span>{lessonTitle}</span>
                </div>
                <div className="flex flex-col items-center gap-4 py-4">
                  <div className="relative bg-white p-1 rounded-[2rem] shadow-xl border border-slate-50">
                    <div className="w-20 h-20 rounded-[1.75rem] bg-gradient-to-br from-[#ec5b13] to-[#ff8c42] flex items-center justify-center text-white text-2xl font-black shadow-lg">
                      {currentStudent.full_name.substring(0, 2).toUpperCase()}
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-emerald-500 text-white rounded-full shadow-lg flex items-center justify-center border-2 border-white">
                      <span className="text-[10px] font-black">{currentIndex + 1}</span>
                    </div>
                  </div>
                  <h3 className="text-xl font-black text-slate-900 tracking-tight">{currentStudent.full_name}</h3>
                </div>
                {/* Progress dots */}
                <div className="flex justify-center gap-1.5">
                  {students.map((s, idx) => {
                    const filled = criteriaList.every(c => scores[s.id][c.id] !== '');
                    const active = idx === currentIndex;
                    return (
                      <motion.div
                        key={s.id}
                        animate={{ width: active ? 32 : 12, backgroundColor: active ? '#ec5b13' : filled ? '#34d399' : '#f1f5f9' }}
                        className="h-1.5 rounded-full"
                      />
                    );
                  })}
                </div>
              </div>

              {/* Criteria scoring */}
              <div className="space-y-12">
                {criteriaList.map(criteria => (
                  <div key={criteria.id} className="space-y-5">
                    <div className="space-y-1">
                      <h5 className="font-black text-slate-900 text-lg tracking-tight flex items-center gap-2">
                        <div className="w-1.5 h-6 bg-[#ec5b13] rounded-full" />
                        {criteria.name}
                      </h5>
                      {criteria.description && <p className="text-xs text-slate-500 font-medium leading-relaxed">{criteria.description}</p>}
                    </div>
                    <div className="grid grid-cols-5 md:grid-cols-10 gap-2">
                      {[1,2,3,4,5,6,7,8,9,10].map(num => {
                        const selected = scores[currentStudent.id][criteria.id] === String(num);
                        return (
                          <button
                            key={num}
                            onClick={() => setScores(prev => ({ ...prev, [currentStudent.id]: { ...prev[currentStudent.id], [criteria.id]: String(num) } }))}
                            className={`h-10 md:h-12 rounded-xl flex items-center justify-center text-sm font-black transition-all duration-200 ${
                              selected
                                ? 'bg-[#ec5b13] text-white shadow-lg shadow-orange-500/30 scale-105 rotate-2'
                                : 'bg-slate-50 text-slate-400 hover:bg-white hover:border-[#ec5b13] hover:text-[#ec5b13] hover:shadow-md border border-transparent'
                            }`}
                          >
                            {num}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              {/* Next student button */}
              <div className="py-6 border-t border-dashed border-slate-100 text-center">
                {currentIndex < students.length - 1 ? (
                  <button
                    onClick={handleNext}
                    className="inline-flex items-center gap-3 px-8 py-3.5 bg-slate-900 text-white font-black rounded-2xl shadow-xl hover:bg-[#ec5b13] hover:-translate-y-1 active:scale-95 transition-all text-sm"
                  >
                    Murid Berikutnya <ChevronRight className="w-4 h-4" />
                  </button>
                ) : (
                  <p className="text-[10px] font-black text-slate-400 tracking-widest uppercase">AKHIR ANTREAN MURID ✨</p>
                )}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer */}
        <footer className="shrink-0 bg-slate-50 border-t border-slate-100 px-8 py-5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={handlePrev} disabled={currentIndex === 0}
              className="w-10 h-10 rounded-xl border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-900 hover:bg-white disabled:opacity-0 transition-all">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="flex flex-col items-center">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">murid</span>
              <span className="text-sm font-black text-slate-900 leading-none mt-1">{currentIndex + 1} / {students.length}</span>
            </div>
            <button onClick={handleNext} disabled={currentIndex === students.length - 1}
              className="w-10 h-10 rounded-xl border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-900 hover:bg-white disabled:opacity-0 transition-all">
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          <div className="flex flex-col items-end gap-1">
            {errorMessage && <p className="text-xs text-red-500 font-bold">{errorMessage}</p>}
            <button
              onClick={handleSubmit}
              disabled={!isReady || isPending}
              className={`flex items-center gap-2 px-8 py-3.5 font-black rounded-2xl transition-all shadow-xl text-sm ${
                isReady ? 'bg-emerald-500 text-white hover:bg-emerald-600 hover:scale-105 active:scale-95' : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
            >
              {isPending
                ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : <Save className="w-4 h-4" />
              }
              {isPending ? 'Menyimpan...' : 'SIMPAN NILAI'}
            </button>
          </div>
        </footer>
      </motion.div>
    </motion.div>
  );
}

// ─── Particle Vanish Overlay ─────────────────────────────────────────────────

const PARTICLE_COLORS = ['#ec5b13','#ff8c42','#34d399','#60a5fa','#f59e0b','#a78bfa'];
const NUM_PARTICLES = 24;

function ParticleVanish() {
  const particles = Array.from({ length: NUM_PARTICLES }, (_, i) => {
    const angle = (i / NUM_PARTICLES) * 2 * Math.PI;
    const dist = 60 + Math.random() * 80;
    return {
      id: i,
      color: PARTICLE_COLORS[i % PARTICLE_COLORS.length],
      x: Math.cos(angle) * dist,
      y: Math.sin(angle) * dist,
      size: 4 + Math.random() * 6,
    };
  });

  return (
    <div className="absolute inset-0 pointer-events-none z-50 flex items-center justify-center overflow-hidden rounded-2xl">
      {particles.map(p => (
        <motion.div
          key={p.id}
          initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
          animate={{ x: p.x, y: p.y, opacity: 0, scale: 0 }}
          transition={{ duration: 0.7, ease: 'easeOut', delay: Math.random() * 0.1 }}
          style={{
            position: 'absolute',
            width: p.size,
            height: p.size,
            borderRadius: '50%',
            backgroundColor: p.color,
          }}
        />
      ))}
    </div>
  );
}

// ─── Main Page Client ─────────────────────────────────────────────────────────

export default function RubricPageClient({ pendingLessons, draftReports }: RubricPageClientProps) {
  const router = useRouter();
  const [localPending, setLocalPending] = useState<PendingLesson[]>(pendingLessons);
  const [localDrafts, setLocalDrafts] = useState<DraftReport[]>(draftReports);
  const [openModal, setOpenModal] = useState<EvaluationData | null>(null);
  const [loadingSessionId, setLoadingSessionId] = useState<string | null>(null);
  const [vanishingId, setVanishingId] = useState<string | null>(null);

  // Sync state if props change (e.g. from router.refresh())
  useEffect(() => {
    setLocalPending(pendingLessons);
    setLocalDrafts(draftReports);
  }, [pendingLessons, draftReports]);

  const openEvaluation = useCallback(async (sessionId: string) => {
    setLoadingSessionId(sessionId);
    try {
      const res = await fetch(`/api/coach/evaluations/session-data?sessionId=${sessionId}`);
      if (!res.ok) throw new Error('Gagal memuat data penilaian.');
      const data = await res.json();
      setOpenModal(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingSessionId(null);
    }
  }, []);

  // Called by modal on successful save: close modal, then after its exit animation trigger vanish
  const handleSaved = useCallback((sessionId: string) => {
    // Start the vanish animation after the modal has fully closed (~400ms)
    setTimeout(() => {
      setVanishingId(sessionId);
      // Wait for vanish anim (~700ms) then remove card
      setTimeout(() => {
        setLocalPending(prev => prev.filter(l => l.sessionId !== sessionId));
        setVanishingId(null);
        // Ensure data is fresh
        router.refresh();
      }, 750);
    }, 400);
  }, [router]);

  const hasItems = localPending.length > 0 || localDrafts.length > 0;

  return (
    <div className="flex-1 font-sans text-slate-900">
      <header className="relative bg-gradient-to-r from-[#0f172a] to-[#1e293b] p-8 md:p-12 text-white overflow-hidden rounded-3xl mb-12">
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full -mr-32 -mt-32 blur-3xl"></div>
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="space-y-3">
            <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight">Journey Penilaian</h2>
            <p className="text-slate-300 font-normal text-lg md:text-xl max-w-xl">
              Nilai sesi mengajar yang sudah kamu selesaikan dan kirim draf rapor perkembangan coder.
            </p>
          </div>
          <div className="flex gap-4">
            <div 
              className="px-6 md:px-8 py-4 md:py-5 rounded-3xl flex flex-col items-center justify-center shadow-[0_10px_30px_rgba(245,158,11,0.2)]"
              style={{ background: 'rgba(245, 158, 11, 0.15)', backdropFilter: 'blur(8px)', border: '1px solid rgba(245, 158, 11, 0.3)' }}
            >
              <span className="text-4xl font-bold text-amber-400">{localPending.length}</span>
              <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-amber-200/90 mt-1">Pending</span>
            </div>
            <div 
              className="px-6 md:px-8 py-4 md:py-5 rounded-3xl flex flex-col items-center justify-center shadow-[0_10px_30px_rgba(59,130,246,0.2)]"
              style={{ background: 'rgba(59, 130, 246, 0.15)', backdropFilter: 'blur(8px)', border: '1px solid rgba(59, 130, 246, 0.3)' }}
            >
              <span className="text-4xl font-bold text-blue-400">{localDrafts.length}</span>
              <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-blue-200/90 mt-1">Draf Rapor</span>
            </div>
          </div>
        </div>
      </header>

      {/* ── Inline Modal Overlay ── */}
      <AnimatePresence>
        {openModal && (
          <EvaluationModal
            key={openModal.sessionId}
            data={openModal}
            onClose={() => setOpenModal(null)}
            onSaved={handleSaved}
          />
        )}
      </AnimatePresence>

      {/* ── Journey List ── */}
      <div className="relative space-y-12">
        {/* Journey line */}
        <div className="absolute left-[27px] top-6 bottom-0 w-[2px] z-0"
          style={{ background: 'linear-gradient(to bottom, #cbd5e1, #cbd5e1)' }} />

        <AnimatePresence mode="popLayout" initial={false}>
          {/* Pending Lessons */}
          {localPending.map(item => (
            <motion.div
              key={item.sessionId}
              layout
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, height: 0, marginBottom: 0, transition: { duration: 0.35 } }}
              className="relative pl-16 group"
            >
              <div className="absolute left-0 top-6 w-14 h-14 bg-amber-100 rounded-full border-4 border-[#f8fafc] flex items-center justify-center z-10 shadow-md">
                <Zap className="text-amber-600" size={24} strokeWidth={3} />
              </div>
              <div className={`bg-white rounded-2xl border border-slate-200 shadow-xl shadow-slate-200/40 overflow-hidden relative group-hover:border-amber-300 transition-all z-10 ${vanishingId === item.sessionId ? 'pointer-events-none' : ''}`}>
                {/* Particle vanish overlay */}
                <AnimatePresence>
                  {vanishingId === item.sessionId && <ParticleVanish />}
                </AnimatePresence>
                <motion.div
                  animate={vanishingId === item.sessionId ? { opacity: 0, scale: 0.92, filter: 'blur(2px)' } : { opacity: 1, scale: 1, filter: 'blur(0px)' }}
                  transition={{ duration: 0.5 }}
                >
                <div className="absolute inset-0 opacity-10 pointer-events-none"
                  style={{ backgroundImage: 'radial-gradient(#e2e8f0 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
                <div className="p-6 md:p-8 relative z-20 flex flex-col md:flex-row gap-6 md:gap-8 items-center">
                  <div className="flex-1 space-y-4 text-center md:text-left w-full">
                    <div className="flex items-center justify-center md:justify-start gap-2">
                      <span className="bg-slate-900 text-[10px] text-white px-3 py-1 rounded-full font-bold tracking-wider">{item.className}</span>
                      {item.blockName && <span className="bg-sky-50 text-[10px] text-sky-600 px-3 py-1 rounded-full border border-sky-100 font-bold tracking-wider">{item.blockName}</span>}
                    </div>
                    <h3 className="text-xl md:text-2xl font-bold text-slate-800 leading-tight">{item.lessonTitle}</h3>
                    <div className="flex flex-wrap justify-center md:justify-start gap-4 md:gap-6 text-sm text-slate-500">
                      <div className="flex items-center gap-2"><Calendar size={16} /><span>{formatDates(item.sessionDates)}</span></div>
                      <div className="flex items-center gap-2"><Users size={16} /><span>{item.studentsCount} Siswa</span></div>
                    </div>
                    <div className="space-y-2 pt-2">
                      <div className="flex justify-between items-center text-xs font-bold text-slate-400">
                        <span className="uppercase tracking-widest">Progress</span>
                        <span className="text-emerald-500">Siap Dinilai</span>
                      </div>
                      <div className="w-full bg-slate-100 h-2 md:h-3 rounded-full overflow-hidden p-[2px]">
                        <motion.div initial={{ width: 0 }} animate={{ width: '100%' }} transition={{ delay: 0.5, duration: 1 }} className="bg-emerald-500 h-full rounded-full" />
                      </div>
                    </div>
                  </div>
                  <div className="shrink-0 w-full md:w-auto mt-4 md:mt-0">
                    <button
                      onClick={() => openEvaluation(item.sessionId)}
                      disabled={loadingSessionId === item.sessionId}
                      className="w-full md:w-auto px-8 py-4 bg-emerald-500 text-white font-bold rounded-xl flex items-center justify-center gap-3 hover:bg-emerald-600 hover:scale-105 transition-all shadow-lg shadow-emerald-200 disabled:opacity-60"
                    >
                      {loadingSessionId === item.sessionId
                        ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        : <>Beri Nilai <ArrowRight size={20} strokeWidth={3} /></>
                      }
                    </button>
                  </div>
                </div>
                </motion.div>
              </div>
            </motion.div>
          ))}

          {/* Draft Reports */}
          {draftReports.map(report => {
            const gradeLetter = getGradeLetter(Number(report.averageScore || 0));
            return (
              <motion.div
                key={report.reportId}
                layout
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
                className="relative pl-16 group"
              >
                <div className="absolute left-0 top-6 w-14 h-14 bg-blue-100 rounded-full border-4 border-[#f8fafc] flex items-center justify-center z-10 shadow-md">
                  <FileText className="text-blue-600" size={24} strokeWidth={3} />
                </div>
                <div className="bg-white rounded-2xl border border-slate-200 shadow-xl shadow-slate-200/40 overflow-hidden relative group-hover:border-blue-300 transition-all z-10">
                  <div className="p-6 md:p-8 relative z-20 flex flex-col md:flex-row gap-6 md:gap-8 items-center">
                    <div className="shrink-0">
                      <div className="w-20 h-20 md:w-24 md:h-24 bg-slate-50 rounded-2xl flex items-center justify-center border-4 border-slate-100 shadow-inner group-hover:scale-110 transition-transform">
                        <span className="text-3xl md:text-4xl font-black text-slate-800">{gradeLetter}</span>
                      </div>
                    </div>
                    <div className="flex-1 space-y-2 text-center md:text-left">
                      <h3 className="text-xl md:text-2xl font-bold text-slate-800">{report.coderName}</h3>
                      <div className="flex flex-wrap justify-center md:justify-start gap-x-4 gap-y-2 text-sm text-slate-500">
                        <span className="flex items-center gap-1 font-medium"><GraduationCap size={16} className="text-blue-500" /> Class {report.className}</span>
                        <span className="flex items-center gap-1 font-medium"><LayoutGrid size={16} className="text-blue-500" /> Block {report.blockName}</span>
                      </div>
                      <p className="text-xs text-slate-400 font-medium italic mt-2">Dibuat: {formatDate(report.createdAt)}</p>
                    </div>
                    <div className="shrink-0 w-full md:w-auto mt-4 md:mt-0">
                      <Link href={`/coach/reports/${report.reportId}`}
                        className="w-full md:w-auto px-8 py-4 bg-amber-500 text-white font-bold rounded-xl flex items-center justify-center gap-3 hover:bg-amber-600 hover:scale-105 transition-all shadow-lg shadow-amber-200">
                        Review Draf <ArrowRight size={20} strokeWidth={3} />
                      </Link>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}

          {/* Empty State */}
          {!hasItems && (
            <motion.div key="empty" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="relative pl-16">
              <div className="absolute left-0 top-0 w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center border-2 border-emerald-200 shadow-md z-10">
                <PartyPopper className="text-emerald-500" size={24} />
              </div>
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 text-center ml-2 z-10 relative">
                <h3 className="text-xl font-bold text-slate-800 mb-2">Semua sesi udah kelar! 🎉</h3>
                <p className="text-slate-500 max-w-sm mx-auto">Semua penilaian untuk sesi mengajarmu sudah selesai. Mantap, Coach! Terus pertahankan!</p>
              </div>
            </motion.div>
          )}

          {/* End Marker */}
          {hasItems && (
            <motion.div key="end" layout className="relative pl-16">
              <div className="absolute left-0 top-0 w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center border-2 border-dashed border-slate-300 z-10">
                <Flag className="text-slate-400" size={20} />
              </div>
              <div className="pt-4 z-10 relative">
                <p className="text-slate-400 font-semibold italic">Itu semua antrean penilaianmu untuk sekarang.</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
