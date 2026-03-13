'use client';

import { useState, useTransition, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, Save, AlertTriangle, ArrowRight, ArrowLeft, FileText } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { EvaluationCriteriaRecord } from '@/lib/dao/reportsDao';

type EvaluationFormClientProps = {
  sessionId: string;
  students: { id: string; full_name: string }[];
  criteriaList: EvaluationCriteriaRecord[];
  lessonTitle: string;
  blockName: string;
};

export default function EvaluationFormClient({ sessionId, students, criteriaList, lessonTitle, blockName }: EvaluationFormClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isExiting, setIsExiting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  // state: coderId -> criteriaId -> score (string integer)
  const [scores, setScores] = useState<Record<string, Record<string, string>>>(() => {
    const initial: Record<string, Record<string, string>> = {};
    students.forEach(s => {
      initial[s.id] = {};
      criteriaList.forEach(c => {
        initial[s.id][c.id] = ''; // Start empty
      });
    });
    return initial;
  });

  const [errorMessage, setErrorMessage] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState(0);

  // Auto-scroll to top when student changes
  useEffect(() => {
    const scrollContainer = document.querySelector('.custom-scrollbar');
    if (scrollContainer) {
      scrollContainer.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [currentIndex]);

  const handleScoreChange = (coderId: string, criteriaId: string, val: string) => {
    setScores(prev => ({
      ...prev,
      [coderId]: {
        ...prev[coderId],
        [criteriaId]: val
      }
    }));
  };

  const currentStudent = students[currentIndex];
  
  const calculateProgress = () => {
    let filledStudents = 0;
    students.forEach(s => {
      const isComplete = criteriaList.every(c => scores[s.id][c.id] !== '');
      if (isComplete) filledStudents++;
    });
    return filledStudents;
  };
  
  const filledStudentsCount = calculateProgress();
  const progressPercentage = (filledStudentsCount / students.length) * 100;
  const isSubmissionReady = filledStudentsCount === students.length;

  const handleNext = () => {
    if (currentIndex < students.length - 1) {
      setDirection(1);
      setCurrentIndex(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setDirection(-1);
      setCurrentIndex(prev => prev - 1);
    }
  };

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(() => {
        router.push('/coach/rubrics');
    }, 400);
  };

  const handleSubmit = () => {
    setErrorMessage('');
    if (!isSubmissionReady) {
      setErrorMessage('Mohon lengkapi semua nilai untuk seluruh murid.');
      return;
    }

    startTransition(async () => {
      try {
        const res = await fetch(`/api/coach/evaluations`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId, scores })
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Gagal menyimpan nilai.');
        }

        // Close immediately on success as requested
        setIsExiting(true);
        setTimeout(() => {
            router.push('/coach/rubrics');
            router.refresh();
        }, 300);
      } catch (err: any) {
        setErrorMessage(err.message);
      }
    });
  };

  if (!students.length) return <div>No students found.</div>;

  const variants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 100 : -100,
      opacity: 0
    }),
    center: {
      zIndex: 1,
      x: 0,
      opacity: 1
    },
    exit: (direction: number) => ({
      zIndex: 0,
      x: direction < 0 ? 100 : -100,
      opacity: 0
    })
  };

  return (
    <AnimatePresence>
      {!isExiting && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 md:p-8 font-['Public_Sans',sans-serif]">
          {/* Backdrop */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-md cursor-pointer"
            onClick={handleClose}
          />

          {/* Modal */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="relative z-10 w-full max-w-3xl max-h-[90vh] bg-white rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden"
          >
            
            <AnimatePresence>
                {showSuccess && (
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 z-[100] bg-white flex flex-col items-center justify-center space-y-4"
                    >
                        <motion.div 
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: "spring", bounce: 0.6 }}
                            className="w-24 h-24 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-500"
                        >
                            <Save className="w-12 h-12" />
                        </motion.div>
                        <h2 className="text-2xl font-black text-slate-800">Nilai Tersimpan!</h2>
                        <p className="text-slate-500 font-medium">Mengalihkan ke dashboard...</p>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Header */}
            <header className="shrink-0 bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between">
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
                onClick={handleClose}
                className="w-10 h-10 rounded-full border border-slate-100 flex items-center justify-center text-slate-400 hover:bg-slate-50 hover:rotate-90 transition-all duration-300"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>close</span>
              </button>
            </header>

            {/* Content Container */}
            <div className="flex-1 overflow-y-auto custom-scrollbar relative">
              <AnimatePresence initial={false} custom={direction} mode="popLayout">
                <motion.div
                  key={currentStudent.id}
                  custom={direction}
                  variants={variants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{
                    x: { type: "spring", stiffness: 300, damping: 30 },
                    opacity: { duration: 0.2 }
                  }}
                  className="p-6 md:p-10 space-y-10"
                >
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
                      
                      <div className="flex justify-center gap-1.5">
                          {students.map((s, idx) => {
                              const isFilled = criteriaList.every(c => scores[s.id][c.id] !== '');
                              const isActive = idx === currentIndex;
                              return (
                                  <motion.div 
                                      key={s.id}
                                      animate={{ 
                                          width: isActive ? 32 : 12,
                                          backgroundColor: isActive ? '#ec5b13' : isFilled ? '#34d399' : '#f1f5f9' 
                                      }}
                                      className="h-1.5 rounded-full"
                                  />
                              );
                          })}
                      </div>
                  </div>

                  <div className="space-y-12">
                    {criteriaList.map((criteria, cidx) => (
                      <div key={criteria.id} className="group space-y-5">
                        <div className="space-y-1">
                          <h5 className="font-black text-slate-900 text-lg tracking-tight flex items-center gap-2">
                             <div className="w-1.5 h-6 bg-[#ec5b13] rounded-full"></div>
                             {criteria.name}
                          </h5>
                          <p className="text-xs text-slate-500 font-medium leading-relaxed">{criteria.description}</p>
                        </div>
                        
                        <div className="grid grid-cols-5 md:grid-cols-10 gap-2">
                          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(num => {
                            const isSelected = scores[currentStudent.id][criteria.id] === String(num);
                            return (
                                <button 
                                  key={num}
                                  onClick={() => handleScoreChange(currentStudent.id, criteria.id, String(num))}
                                  className={`
                                    h-10 md:h-12 rounded-xl flex items-center justify-center text-sm font-black transition-all duration-300
                                    ${isSelected 
                                      ? 'bg-[#ec5b13] text-white shadow-lg shadow-orange-500/30 scale-105 rotate-2' 
                                      : 'bg-slate-50 text-slate-400 hover:bg-white hover:border-[#ec5b13] hover:text-[#ec5b13] hover:shadow-md border border-transparent'}
                                  `}
                                >
                                  {num}
                                </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="py-6 border-t border-dashed border-slate-100 text-center">
                      {currentIndex < students.length - 1 ? (
                        <button 
                          onClick={handleNext}
                          className="inline-flex items-center gap-3 px-8 py-3.5 bg-slate-900 text-white font-black rounded-2xl shadow-xl hover:bg-[#ec5b13] hover:-translate-y-1 active:scale-95 transition-all text-sm"
                        >
                          Lanjut ke Murid Berikutnya
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      ) : (
                        <p className="text-[10px] font-black text-slate-400 tracking-widest uppercase mb-4">
                           AKHIR ANTREAN MURID ✨
                        </p>
                      )}
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Footer */}
            <footer className="shrink-0 bg-slate-50 border-t border-slate-100 px-8 py-5 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button 
                   onClick={handlePrev}
                   disabled={currentIndex === 0}
                   className="w-10 h-10 rounded-xl border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-900 hover:bg-white disabled:opacity-0 transition-all shadow-sm"
                >
                   <ChevronLeft className="w-5 h-5" />
                </button>
                <div className="flex flex-col items-center">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">murid</span>
                    <span className="text-sm font-black text-slate-900 leading-none mt-1">{currentIndex + 1} / {students.length}</span>
                </div>
                <button 
                   onClick={handleNext}
                   disabled={currentIndex === students.length - 1}
                   className="w-10 h-10 rounded-xl border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-900 hover:bg-white disabled:opacity-0 transition-all shadow-sm"
                >
                   <ChevronRight className="w-5 h-5" />
                </button>
              </div>

              <button 
                onClick={handleSubmit}
                disabled={!isSubmissionReady || isPending}
                className={`
                   group flex items-center gap-2 px-8 py-3.5 font-black rounded-2xl transition-all shadow-xl text-sm
                   ${isSubmissionReady 
                       ? 'bg-emerald-500 text-white hover:bg-emerald-600 hover:scale-105 active:scale-95' 
                       : 'bg-slate-200 text-slate-400 cursor-not-allowed'}
                `}
              >
                {isPending ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                ) : (
                    <motion.div
                        animate={{ rotate: isSubmissionReady ? [0, 10, -10, 0] : 0 }}
                        transition={{ repeat: Infinity, duration: 2 }}
                    >
                        <Save className="w-4 h-4" />
                    </motion.div>
                )}
                {isPending ? 'Simpan...' : 'SIMPAN SEMUA NILAI'}
              </button>
            </footer>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
