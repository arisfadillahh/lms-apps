'use client';

import { useState, useTransition, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getSupabaseBrowser } from '@/lib/supabaseBrowser';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';

// Custom SVGs (lucide-react not installed)
const ArrowLeftIcon = ({ size = 24 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>
);
const ArrowRightIcon = ({ className = "" }: { className?: string }) => (
  <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
);
const CheckCircle2 = ({ className = "", size = 24 }: { className?: string, size?: number }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
);
const UserIcon = ({ className = "", size = 24 }: { className?: string, size?: number }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
);
const Lightbulb = ({ className = "", size = 24 }: { className?: string, size?: number }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/></svg>
);
const Edit3 = ({ size = 24 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
);

interface Props {
  classId: string;
  blockId: string;
  sessionId: string;
  coachName: string;
  blockName: string;
  levelName: string | null;
  questions: any[];
  templateId: string | null;
  evalSessionId?: string;
}

export default function BlockEvaluationClient({
  classId, blockId, sessionId,
  coachName, blockName, levelName,
  questions: initialQuestions,
  templateId,
  evalSessionId
}: Props) {
  const router = useRouter();
  const supabase = getSupabaseBrowser();
  const [isPending, startTransition] = useTransition();
  const [questions] = useState<any[]>(initialQuestions);
  const [answers, setAnswers] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    initialQuestions.forEach((q: any) => { init[q.id] = ''; });
    return init;
  });
  const [currentStep, setCurrentStep] = useState(evalSessionId ? -1 : 0);
  const [isAnswerSubmitted, setIsAnswerSubmitted] = useState(false);
  const [coachStep, setCoachStep] = useState(evalSessionId ? -1 : 0);
  const [isCompletedScreen, setIsCompletedScreen] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const fireConfetti = () => {
    const duration = 3 * 1000;
    const end = Date.now() + duration;

    const frame = () => {
      confetti({ particleCount: 5, angle: 60, spread: 55, origin: { x: 0 }, colors: ['#4EB875', '#FFD166', '#FFFFFF'] });
      confetti({ particleCount: 5, angle: 120, spread: 55, origin: { x: 1 }, colors: ['#4EB875', '#FFD166', '#FFFFFF'] });
      if (Date.now() < end) requestAnimationFrame(frame);
    };
    frame();
  };

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.max(200, textareaRef.current.scrollHeight)}px`;
    }
  }, [answers, currentStep]);


  // Realtime sync with Coach
  useEffect(() => {
    if (!evalSessionId) return;

    // Fetch initial status in case we joined late
    const fetchInitial = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await (supabase as any)
        .from('block_evaluation_sessions')
        .select('current_question_index, status')
        .eq('id', evalSessionId)
        .single();
        
      if (error) console.error('fetchInitial eval session err:', error);
      
      const { data: pastAnswers } = await (supabase as any)
        .from('block_evaluation_answers')
        .select('question_index, answer')
        .eq('eval_session_id', evalSessionId)
        .eq('coder_id', user.id);

      let maxAnsweredIndex = -2;
      if (pastAnswers) {
        const tempAnswers: Record<string, string> = {};
        pastAnswers.forEach((row: any) => {
          if (row.question_index !== -1) {
            const qId = questions[row.question_index]?.id;
            if (qId) tempAnswers[qId] = row.answer;
          }
          if (row.question_index > maxAnsweredIndex) {
            maxAnsweredIndex = row.question_index;
          }
        });
        setAnswers(prev => ({ ...prev, ...tempAnswers }));
      }

      if (data) {
        let currentCoachStep = data.current_question_index;
        if (data.status === 'completed') {
          currentCoachStep = questions.length;
        }
        setCoachStep(currentCoachStep);

        if (maxAnsweredIndex >= -1) {
           const nextStep = maxAnsweredIndex + 1;
           if (nextStep >= questions.length) {
              setCurrentStep(questions.length - 1);
              setIsAnswerSubmitted(true);
           } else if (nextStep > currentCoachStep) {
              setCurrentStep(maxAnsweredIndex);
              setIsAnswerSubmitted(true);
           } else {
              setCurrentStep(nextStep);
              setIsAnswerSubmitted(false);
           }
        } else {
           if (currentCoachStep >= 0) {
             setCurrentStep(0);
           } else {
             setCurrentStep(-1);
           }
        }
      } else {
         setCurrentStep(-1);
      }
    };
    fetchInitial();

    // Poll for coach's current question every 3 seconds
    // (Supabase realtime requires table replication to be enabled;
    //  polling is the safe fallback to ensure coder always sees updates)
    const pollInterval = setInterval(async () => {
      const { data: pollData } = await (supabase as any)
        .from('block_evaluation_sessions')
        .select('current_question_index, status')
        .eq('id', evalSessionId)
        .single();
      if (pollData) {
        if (pollData.status === 'completed') {
          setCoachStep(questions.length);
        } else if (pollData.current_question_index !== undefined) {
          setCoachStep(pollData.current_question_index);
        }
      }
    }, 3000);

    // Also try realtime subscription as a bonus (works when replication is enabled)
    const channel = supabase
      .channel(`eval_sessions_${evalSessionId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'block_evaluation_sessions', filter: `id=eq.${evalSessionId}` },
        (payload) => {
          const newDoc = payload.new as any;
          if (newDoc) {
            if (newDoc.status === 'completed') setCoachStep(questions.length);
            else if (newDoc.current_question_index !== undefined) setCoachStep(newDoc.current_question_index);
          }
        }
      )
      .subscribe();

    return () => {
      clearInterval(pollInterval);
      supabase.removeChannel(channel);
    };
  }, [evalSessionId, supabase]);

  // Automatically advance Coder if Coach moves to next question while Coder is waiting.
  useEffect(() => {
    // Only auto-advance if Coder has submittted their answer AND the Coach has moved past their current question.
    if (isAnswerSubmitted && coachStep > currentStep) {
      if (currentStep < questions.length - 1) {
        setCurrentStep(prev => prev + 1);
        setIsAnswerSubmitted(false);
      } else if (currentStep === questions.length - 1 && coachStep === questions.length) {
        handleSubmit(false);
      }
    }
  }, [coachStep, currentStep, isAnswerSubmitted]);

  // Submit Answer to DB per question
  const submitAnswerForQuestion = useCallback(async (qIndex: number, answerText: string) => {
    if (!evalSessionId) return;
    
    // For lobby (qIndex === -1), use a dummy questionId
    const qId = qIndex === -1 ? 'ready' : questions[qIndex].id;
    
    try {
      await fetch('/api/coder/block-evaluations/answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          evalSessionId,
          questionId: qId,
          questionIndex: qIndex,
          answer: answerText
        })
      });
    } catch (e) {
      console.warn('Failed to sync answer to presenter loop', e);
    }
  }, [evalSessionId, questions]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (currentStep < 0) return;
    const qId = questions[currentStep].id;
    const val = e.target.value;
    setAnswers(prev => ({ ...prev, [qId]: val }));
  };

  const handleExplicitSubmit = () => {
    if (currentStep < 0) return;
    const qId = questions[currentStep].id;
    const val = answers[qId];
    if (!val || !val.trim()) {
       alert("Lengkapi jawabanmu terlebih dahulu ya!");
       return;
    }
    
    // Fire and forget answer submission so there's no UI wait
    submitAnswerForQuestion(currentStep, val);
    
    if (coachStep > currentStep) {
        // Coach is already ahead (or session is completed). Move coder immediately without showing the "wait" screen.
        if (currentStep < questions.length - 1) {
            setCurrentStep(prev => prev + 1);
            // Ensure they don't see the wait screen on the next question
            setIsAnswerSubmitted(false); 
        } else {
            handleSubmit(false);
        }
    } else {
        // Coach is on the same question, show the "Menunggu aba-aba" screen.
        setIsAnswerSubmitted(true);
    }
  };
  
  const handleLobbyReady = () => {
    submitAnswerForQuestion(-1, 'true');
    if (coachStep >= 0) {
        // Coach already started — skip waiting room immediately
        setIsAnswerSubmitted(false);
        setCurrentStep(0);
    } else {
        // Coach hasn't started yet — wait in ready state
        setIsAnswerSubmitted(true);
    }
  };

  // Safety net: if we're stuck at lobby (-1) with isAnswerSubmitted=true
  // and the coach has since advanced, push coder forward.
  useEffect(() => {
    if (isAnswerSubmitted && currentStep === -1 && coachStep >= 0) {
      setIsAnswerSubmitted(false);
      setCurrentStep(0);
    }
  }, [isAnswerSubmitted, currentStep, coachStep]);

  const handleNext = () => {
    if (evalSessionId) return; // if synced with coach, disable manual next
    
    if (currentStep < questions.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      handleSubmit(false);
    }
  };

  const handlePrev = () => {
    if (evalSessionId) return; // disable manual prev if synced
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleSubmit = async (force: boolean = false) => {
    if (isPending && !force) return;
    startTransition(async () => {
      try {
        const res = await fetch('/api/coder/block-evaluations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            classId,
            blockId,
            sessionId,
            templateId,
            answers
          })
        });

        if (!res.ok) throw new Error('Gagal menyimpan evaluasi');

        setIsCompletedScreen(true);
        fireConfetti();
        setTimeout(() => {
          router.push('/coder/dashboard');
          router.refresh();
        }, 4000);
      } catch (err: any) {
        alert(err.message || 'Terjadi kesalahan sistem');
      }
    });
  };

  if (isCompletedScreen) {
    return (
      <div className="min-h-screen bg-[#162b46] flex flex-col items-center justify-center p-6 text-center font-sans tracking-tight">
        <motion.div 
           initial={{ scale: 0.5, opacity: 0 }} 
           animate={{ scale: 1, opacity: 1 }} 
           transition={{ type: 'spring', bounce: 0.5 }}
           className="w-24 h-24 bg-clevio-green rounded-full flex items-center justify-center mb-6 shadow-[0_0_40px_rgba(78,184,117,0.5)]"
        >
          <CheckCircle2 className="text-clevio-navy" size={48} />
        </motion.div>
        <motion.h1 
           initial={{ y: 20, opacity: 0 }} 
           animate={{ y: 0, opacity: 1 }} 
           transition={{ delay: 0.2 }}
           className="text-white text-4xl md:text-5xl font-black mb-4"
        >
           Luar Biasa! 🎉
        </motion.h1>
        <motion.p 
           initial={{ y: 20, opacity: 0 }} 
           animate={{ y: 0, opacity: 1 }} 
           transition={{ delay: 0.4 }}
           className="text-white/70 text-lg max-w-md"
        >
           Evaluasi block kamu sudah tersimpan. Coach sangat bangga dengan progress belajarmu hari ini.
        </motion.p>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="min-h-screen bg-[#162b46] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-8 h-8 rounded-full border-4 border-sunshine border-t-transparent animate-spin mb-4"></div>
        <h2 className="text-white text-xl font-bold mb-2">Memuat Pertanyaan...</h2>
        <p className="text-white/60">Jika layar ini tidak berubah, silakan refresh halaman.</p>
      </div>
    );
  }

  if (currentStep === -1) {
    return (
      <div className="min-h-screen bg-[#162b46] font-sans flex flex-col items-center justify-center p-6 text-center text-white relative overflow-hidden">
        {/* Decorative background */}
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-sunshine/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-clevio-green/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center mb-6 z-10">
          <img alt="Clevio Logo" className="h-8" src="/images/clevio-logo.png.png" />
        </div>
        
        <h1 className="text-3xl md:text-5xl font-black mb-4 z-10 tracking-tight">Ruang Tunggu Evaluasi</h1>
        <p className="text-lg text-white/70 max-w-lg mb-12 z-10">
          Coach kamu akan segera memulai sesi evaluasi. Pastikan kamu sudah siap untuk menjawab ya!
        </p>

        {!isAnswerSubmitted ? (
          <button 
            onClick={handleLobbyReady}
            className="group relative z-10 bg-sunshine text-clevio-navy px-10 py-4 rounded-full text-xl font-black shadow-[0_6px_0_0_#e6b85c] hover:-translate-y-0.5 active:translate-y-1 active:shadow-none transition-all flex items-center justify-center gap-3"
          >
            Saya Siap! <CheckCircle2 className="font-bold group-hover:scale-110 transition-transform" />
          </button>
        ) : (
          <div className="z-10 bg-white/10 backdrop-blur-md px-8 py-6 rounded-3xl border border-white/20 flex flex-col items-center animate-fade-in-up">
            <div className="w-12 h-12 bg-clevio-green text-clevio-navy rounded-full flex items-center justify-center mb-4">
              <CheckCircle2 size={24} className="font-bold" />
            </div>
            <h3 className="text-xl font-bold mb-2">Mantap! Kamu sudah siap.</h3>
            <div className="flex items-center justify-center gap-2 mt-2">
              <div className="w-2 h-2 rounded-full bg-sunshine animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-2 h-2 rounded-full bg-sunshine animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-2 h-2 rounded-full bg-sunshine animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
            <p className="text-sm font-medium text-sunshine mt-2 opacity-80 uppercase tracking-widest">Menunggu Coach Memulai</p>
          </div>
        )}
      </div>
    );
  }

  const currentQ = questions[currentStep];
  const progressPct = ((currentStep + 1) / questions.length) * 100;
  const isLastStep = currentStep === questions.length - 1;

  return (
    <div className="min-h-screen font-sans text-clevio-navy selection:bg-sunshine/20 overflow-x-hidden bg-[#162b46]">
      {/* HEADER */}
      <header className="fixed top-0 left-0 right-0 z-50">
        <div className="h-[6px] bg-white/10 w-full relative">
          <div
            className="h-full bg-clevio-green transition-all duration-500 ease-in-out absolute left-0 top-0"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <nav className="bg-[#162b46]/95 backdrop-blur-sm border-b border-white/5 py-4 px-6 md:px-10 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/coder/dashboard" className="p-2 hover:bg-white/10 rounded-full transition-colors text-white">
              <ArrowLeftIcon size={24} />
            </Link>
            <div className="hidden sm:block">
              <img alt="Clevio Logo" className="h-7" src="/images/clevio-logo.png.png" />
            </div>
          </div>
          <div className="flex flex-col items-center">
            <h1 className="text-white text-lg md:text-xl font-bold flex items-center gap-2">
              Evaluasi Akhir Block
              <CheckCircle2 className="text-clevio-green" size={20} />
            </h1>
            <p className="text-white/60 text-xs hidden md:block">Refleksikan perjalanan belajarmu hari ini</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden md:flex flex-col items-end">
              <span className="text-xs font-bold text-sunshine uppercase tracking-widest">Step {currentStep + 1} of {questions.length}</span>
              <span className="text-[10px] text-white/40">Keep it up!</span>
            </div>
            <div className="w-10 h-10 rounded-full border-2 border-sunshine/30 flex items-center justify-center">
              <span className="text-sunshine font-bold text-sm">{currentStep + 1}/{questions.length}</span>
            </div>
          </div>
        </nav>
      </header>

      {/* MAIN CONTENT */}
      <main className="pt-32 pb-40 px-4 flex justify-center items-center min-h-[90vh]">
        <div className="max-w-3xl w-full">
          {/* Progress dots */}
          <div className="flex justify-center mb-8 gap-2">
            {questions.map((_, idx) => (
              <div
                key={idx}
                className={`h-1.5 w-12 rounded-full transition-all duration-300 ${idx < currentStep ? 'bg-clevio-green' :
                  idx === currentStep ? 'bg-sunshine shadow-[0_0_10px_rgba(255,209,102,0.5)]' :
                    'bg-white/10'
                  }`}
              />
            ))}
          </div>

          <AnimatePresence mode="wait">
            <motion.section 
              key={currentStep}
              initial={{ x: 30, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -30, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="bg-gradient-to-br from-[#ffffff] to-[#f8fafc] rounded-[2.5rem] p-8 md:p-12 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.3)] relative overflow-hidden border border-white/20"
            >
              {/* Decals */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-sunshine/10 rounded-full -mr-16 -mt-16 pointer-events-none"></div>
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-clevio-green/10 rounded-full -ml-12 -mb-12 pointer-events-none"></div>

              <div className="relative z-10">
                <div className="flex items-center gap-4 mb-8">
                  <span className="w-14 h-14 bg-sunshine text-clevio-navy rounded-2xl flex items-center justify-center text-2xl font-black rotate-3 shadow-lg shrink-0">
                    {currentStep + 1}
                  </span>
                  <div>
                    <span className="text-sky font-extrabold text-xs tracking-[0.2em] uppercase">Refleksi</span>
                    <h2 className="text-xl md:text-3xl font-extrabold leading-tight mt-1 text-clevio-navy">
                      {currentQ.question}
                    </h2>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="relative group">
                    <textarea
                      ref={textareaRef}
                      value={answers[currentQ.id]}
                      onChange={handleChange}
                      readOnly={isAnswerSubmitted}
                      className={`w-full rounded-3xl border-slate-200 p-6 md:p-8 text-lg text-clevio-navy placeholder:text-slate-300 focus:ring-sunshine focus:border-sunshine min-h-[200px] shadow-inner resize-none overflow-hidden transition-all ${
                        isAnswerSubmitted 
                          ? 'bg-slate-100 opacity-70 cursor-not-allowed' 
                          : 'bg-white/50 backdrop-blur-sm focus:shadow-[0_0_0_4px_rgba(255,209,102,0.2)]'
                      }`}
                      placeholder={currentQ.placeholder || "Ceritakan di sini..."}
                    />
                    {!isAnswerSubmitted && (
                      <div className="absolute bottom-4 right-6 flex items-center gap-2 text-slate-400 pointer-events-none">
                        <Edit3 size={16} />
                        <span className="text-xs font-medium">Jangan lupa dikirim ya!</span>
                      </div>
                    )}
                  </div>

                  {currentQ.hint && (
                    <div className="flex items-start gap-3 bg-pastel-blue/50 p-4 rounded-2xl border border-sky/10">
                      <Lightbulb className="text-sky shrink-0 mt-0.5" size={20} />
                      <p className="text-sm md:text-base text-slate-500 italic">
                        Hint: {currentQ.hint}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </motion.section>
          </AnimatePresence>

          {/* Context Footer */}
          <div className="mt-8 flex flex-col md:flex-row items-center justify-between gap-4 px-4">
            <div className="flex items-center flex-wrap justify-center gap-4">
              <div className="bg-white/5 px-4 py-2 rounded-full border border-white/10 flex items-center gap-2">
                <span className="w-2 h-2 bg-clevio-green rounded-full animate-pulse shrink-0"></span>
                <span className="text-xs font-bold text-white/70 uppercase truncate max-w-[150px] sm:max-w-none">{blockName}</span>
              </div>
              <div className="bg-white/5 px-4 py-2 rounded-full border border-white/10 flex items-center gap-2">
                <UserIcon size={14} className="text-sunshine shrink-0" />
                <span className="text-xs font-bold text-white/70 truncate max-w-[120px] sm:max-w-none">Coach {coachName}</span>
              </div>
              {levelName && (
                <div className="bg-white/5 px-4 py-2 rounded-full border border-white/10 flex items-center gap-2">
                  <span className="text-xs font-bold text-white/70 truncate max-w-[120px] sm:max-w-none">Level: {levelName}</span>
                </div>
              )}
            </div>

            {!evalSessionId && currentStep > 0 && (
              <button
                onClick={handlePrev}
                className="text-white/40 hover:text-white transition-colors text-sm font-bold flex items-center gap-2"
              >
                <ArrowLeftIcon size={16} /> Previous Step
              </button>
            )}
          </div>
        </div>
      </main>

      {/* FOOTER CTA (Hide next button if in synced mode) */}
      {!evalSessionId && (
        <footer className="fixed bottom-0 left-0 right-0 p-6 md:p-10 z-50 pointer-events-none">
          <div className="max-w-4xl mx-auto flex justify-center md:justify-end pointer-events-auto">
            <button
              onClick={handleNext}
              disabled={isPending}
              className="group w-full md:w-auto bg-clevio-green text-clevio-navy px-12 py-5 rounded-full text-xl font-black shadow-[0_6px_0_0_#4EB875] hover:-translate-y-0.5 active:translate-y-1 active:shadow-none transition-all flex items-center justify-center gap-4 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isPending
                ? 'Menyimpan...'
                : isLastStep ? 'Kirim Evaluasi' : 'Next Question'
              }
              {!isPending && (
                isLastStep ? <CheckCircle2 className="font-bold group-hover:scale-110 transition-transform" /> : <ArrowRightIcon className="font-bold group-hover:translate-x-1 transition-transform" />
              )}
            </button>
          </div>
        </footer>
      )}
      {evalSessionId && !isAnswerSubmitted && (
        <footer className="fixed bottom-0 left-0 right-0 p-6 md:p-10 z-50 pointer-events-none">
          <div className="max-w-4xl mx-auto flex justify-center md:justify-end pointer-events-auto">
            <button
              onClick={handleExplicitSubmit}
              disabled={isPending}
              className="group w-full md:w-auto bg-sunshine text-clevio-navy px-12 py-5 rounded-full text-xl font-black shadow-[0_6px_0_0_#e6b85c] hover:-translate-y-0.5 active:translate-y-1 active:shadow-none transition-all flex items-center justify-center gap-4 disabled:opacity-50"
            >
              {isPending ? 'Menyimpan...' : (coachStep > currentStep ? 'Kirim & Lanjut 🚀' : 'Kirim Jawaban')}
              <ArrowRightIcon className="font-bold group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </footer>
      )}
      {evalSessionId && isAnswerSubmitted && (
        <footer className="fixed bottom-0 left-0 right-0 p-6 z-50 pointer-events-none">
           <div className="max-w-3xl mx-auto pointer-events-auto">
             <div className="bg-gradient-to-r from-violet-600 to-indigo-700 p-4 lg:p-6 rounded-2xl flex items-center justify-between shadow-lg shadow-violet-500/20 border border-white/10">
               <div className="flex items-center gap-4">
                 <div className="w-12 h-12 rounded-full bg-clevio-green flex items-center justify-center text-clevio-navy shrink-0">
                   <CheckCircle2 size={24} className="font-bold" />
                 </div>
                 <div>
                   <h4 className="text-white text-base font-bold leading-tight">Jawaban Berhasil Terkirim!</h4>
                   <p className="text-indigo-200 text-sm mt-1">Tunggu aba-aba Coach untuk pindah ke soal selanjutnya ya.</p>
                 </div>
               </div>
               <div className="hidden md:flex items-center gap-2">
                 <div className="w-2.5 h-2.5 rounded-full bg-white animate-bounce" style={{ animationDelay: '0ms' }} />
                 <div className="w-2.5 h-2.5 rounded-full bg-white animate-bounce" style={{ animationDelay: '150ms' }} />
                 <div className="w-2.5 h-2.5 rounded-full bg-white animate-bounce" style={{ animationDelay: '300ms' }} />
               </div>
             </div>
           </div>
        </footer>
      )}
    </div>
  );
}
