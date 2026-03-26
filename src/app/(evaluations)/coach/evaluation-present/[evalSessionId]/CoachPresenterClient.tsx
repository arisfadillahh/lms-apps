'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseBrowser } from '@/lib/supabaseBrowser';
import { CheckCircle2, UserCircle2, ArrowRight } from 'lucide-react';

interface Coder {
  id: string;
  full_name: string;
}

interface Question {
  id: string;
  question: string;
  hint: string;
}

interface CoachPresenterClientProps {
  evalSessionId: string;
  initialIndex: number;
  initialStatus: string;
  questions: Question[];
  coders: Coder[];
  coachName: string;
}

export default function CoachPresenterClient({
  evalSessionId,
  initialIndex,
  initialStatus,
  questions,
  coders,
  coachName
}: CoachPresenterClientProps) {
  const router = useRouter();
  const supabase = getSupabaseBrowser();
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [status, setStatus] = useState(initialStatus);
  const [answeredMap, setAnsweredMap] = useState<Record<string, boolean>>({});
  const [isAdvancing, setIsAdvancing] = useState(false);

  // Initialize answered state empty for current question
  useEffect(() => {
    // Every time we move to a new question, fetch who has answered it *so far*
    const fetchAnswers = async () => {
      if (status === 'completed') return;
      const currentQId = currentIndex === -1 ? 'ready' : questions[currentIndex]?.id;
      if (!currentQId) return;

      const { data } = await (supabase as any)
        .from('block_evaluation_answers')
        .select('coder_id')
        .eq('eval_session_id', evalSessionId)
        .eq('question_id', currentQId);

      const map: Record<string, boolean> = {};
      data?.forEach((row: any) => {
        map[row.coder_id] = true;
      });
      setAnsweredMap(map);
    };
    
    fetchAnswers();
  }, [currentIndex, evalSessionId, questions, status, supabase]);

  // Subscribe to new answers for the CURRENT question
  useEffect(() => {
    if (status === 'completed') return;

    const channel = supabase
      .channel(`answers:${evalSessionId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'block_evaluation_answers',
          filter: `eval_session_id=eq.${evalSessionId}`
        },
        (payload: any) => {
          const newAnswer = payload.new as any;
          // Only mark as answered if it's for the current question
          if (newAnswer.question_index === currentIndex) {
            setAnsweredMap(prev => ({ ...prev, [newAnswer.coder_id]: true }));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [evalSessionId, currentIndex, status, supabase]);

  const handleNext = async () => {
    setIsAdvancing(true);
    try {
      const res = await fetch('/api/coach/block-evaluations/advance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ evalSessionId, totalQuestions: questions.length })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      
      setCurrentIndex(data.current_question_index);
      setStatus(data.status);
    } catch (err: any) {
      alert(err.message || 'Terjadi kesalahan sistem');
    } finally {
      setIsAdvancing(false);
    }
  };

  const answeredCount = Object.keys(answeredMap).length;
  const totalCount = coders.length;
  const isFinishedForCurrent = totalCount > 0 && answeredCount >= totalCount;

  if (status === 'completed') {
    return (
      <div className="min-h-screen bg-[#162b46] flex flex-col items-center justify-center p-6 text-center text-white">
        <CheckCircle2 size={64} className="text-clevio-green mb-4" />
        <h2 className="text-3xl font-bold mb-2">Evaluasi Selesai!</h2>
        <p className="text-white/60 mb-8 max-w-md">
          Semua pertanyaan evaluasi telah selesai dijawab oleh Coder. Anda dapat kembali ke dashboard atau menutup tab ini.
        </p>
        <button
          onClick={() => router.push('/coach/dashboard')}
          className="bg-white text-clevio-navy px-6 py-3 rounded-xl font-bold hover:bg-slate-100 transition-colors"
        >
          Kembali ke Dashboard
        </button>
      </div>
    );
  }

  const currentQ = questions[currentIndex];
  const progressPct = currentIndex === -1 ? 0 : ((currentIndex + 1) / questions.length) * 100;

  return (
    <div className="min-h-screen font-sans text-white overflow-x-hidden bg-[#162b46] flex flex-col">
      {/* HEADER */}
      <header className="flex-none border-b border-white/5 bg-[#162b46]/95 backdrop-blur-sm z-50">
        <div className="h-[4px] bg-white/10 w-full relative">
          <div
            className="h-full bg-clevio-green transition-all duration-500 ease-in-out absolute left-0 top-0"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <div className="py-4 px-6 md:px-10 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img alt="Clevio Logo" className="h-6" src="/images/clevio-logo.png.png" />
            <div className="h-6 w-px bg-white/20 mx-2" />
            <span className="text-sm font-semibold text-white/60 uppercase tracking-widest hidden sm:block">Presenter Mode</span>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-right">
              <span className="block text-[10px] font-bold text-sunshine uppercase tracking-widest">Question {currentIndex + 1} of {questions.length}</span>
              <span className="block text-xs font-medium text-white/50">{answeredCount}/{totalCount} Coder Menjawab</span>
            </div>
            <button
              onClick={handleNext}
              disabled={isAdvancing}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-full font-bold text-sm transition-all duration-300 ${isFinishedForCurrent ? 'bg-sunshine text-clevio-navy hover:scale-105' : 'bg-white/10 text-white hover:bg-white/20'}`}
            >
              {currentIndex === -1 ? 'Mulai Pertanyaan Pertama' : currentIndex === questions.length - 1 ? 'Selesaikan Evaluasi' : 'Lanjut Pertanyaan Berikutnya'}
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </header>

      {/* MAIN LAYOUT: Split 2/3 Question, 1/3 Coders */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        
        {/* LEFT COLUMN: The slide */}
        <div className="flex-1 p-8 md:p-12 flex items-center justify-center relative overflow-y-auto w-full md:w-2/3 md:border-r border-white/5">
          {currentIndex === -1 ? (
             <div className="max-w-3xl w-full mx-auto relative z-10 text-center">
               <div className="bg-gradient-to-br from-[#ffffff] to-[#f8fafc] rounded-[2.5rem] p-10 md:p-16 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.5)] border border-white/10 text-clevio-navy relative overflow-hidden flex flex-col items-center justify-center">
                 {/* Decals */}
                 <div className="absolute top-0 right-0 w-64 h-64 bg-sunshine/10 rounded-full blur-2xl pointer-events-none"></div>
                 <div className="absolute bottom-0 left-0 w-64 h-64 bg-clevio-green/10 rounded-full blur-2xl pointer-events-none"></div>
                 
                 <div className="w-20 h-20 bg-sunshine/20 rounded-full flex items-center justify-center mb-6 text-sunshine">
                   <UserCircle2 size={40} />
                 </div>
                 
                 <h2 className="text-3xl md:text-5xl font-black mb-4 leading-tight tracking-tight">
                   Ruang Tunggu Kelas
                 </h2>
                 
                 <p className="text-clevio-navy/60 text-lg mb-8 max-w-lg">
                   Halo Coach! Minta anak-anak untuk membuka Coder Dashboard mereka dan klik tombol "Saya Siap!" sebelum evaluasi dimulai ya.
                 </p>

                 <div className="flex flex-col items-center p-6 bg-slate-50 border border-slate-200 rounded-3xl w-full max-w-md shadow-inner">
                   <div className="text-4xl font-black text-clevio-navy mb-1">{answeredCount}<span className="text-2xl text-slate-400">/{totalCount}</span></div>
                   <div className="text-sm font-bold text-slate-500 uppercase tracking-widest">Coder Siap</div>
                   {isFinishedForCurrent && (
                     <div className="mt-4 px-4 py-2 bg-clevio-green/10 text-clevio-green rounded-full font-bold text-sm flex items-center gap-2">
                       <CheckCircle2 size={16} /> Semua Coder Sudah Siap!
                     </div>
                   )}
                 </div>
               </div>
             </div>
          ) : (
             <div className="max-w-3xl w-full mx-auto relative z-10">
               <div className="bg-gradient-to-br from-[#ffffff] to-[#f8fafc] rounded-[2.5rem] p-8 md:p-12 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.5)] border border-white/10 text-clevio-navy relative overflow-hidden">
                 {/* Decals */}
                 <div className="absolute top-0 right-0 w-48 h-48 bg-sunshine/10 rounded-full -mr-24 -mt-24 pointer-events-none"></div>
                 
                 <div className="flex items-center gap-4 mb-8">
                   <span className="w-14 h-14 bg-sunshine text-clevio-navy rounded-2xl flex items-center justify-center text-3xl font-black rotate-3 shadow-lg shrink-0">
                     {currentIndex + 1}
                   </span>
                   <p className="text-xs font-bold uppercase tracking-widest text-[#22367b]/50">Pertanyaan Evaluasi</p>
                 </div>
                 
                 <h2 className="text-2xl md:text-4xl font-black mb-4 leading-tight">
                   {currentQ?.question}
                 </h2>
                 
                 <p className="text-clevio-navy/60 text-base md:text-lg mb-8 bg-[#22367b]/5 p-4 rounded-xl border border-[#22367b]/10 italic">
                   "{currentQ?.hint}"
                 </p>
  
                 <div className="flex items-center gap-3 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-2xl text-yellow-600 font-medium">
                   <div className={`w-3 h-3 rounded-full ${isFinishedForCurrent ? 'bg-green-500' : 'bg-yellow-500 animate-pulse'}`}></div>
                   {isFinishedForCurrent 
                    ? 'Semua coder telah mengirim jawaban. Silakan lanjut ke soal berikutnya.'
                    : 'Menunggu Coder mengirimkan jawaban...'}
                 </div>
               </div>
             </div>
          )}

           {/* Background gigantic deco */}
           <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[40rem] font-black text-white/[0.02] pointer-events-none select-none z-0 rotate-12">
             {currentIndex === -1 ? '!' : '?'}
           </div>
        </div>

        {/* RIGHT COLUMN: The audience/coders list */}
        <div className="w-full md:w-1/3 min-w-[300px] bg-[#1a3352] p-6 md:p-8 flex flex-col overflow-y-auto">
          <div className="flex items-center justify-between mb-8">
            <h3 className="font-bold text-lg text-white">Live Progress</h3>
            <span className="px-3 py-1 bg-white/10 rounded-full text-xs font-bold text-sunshine">
              {answeredCount}/{totalCount}
            </span>
          </div>

          <div className="flex-1 flex flex-col gap-3">
            {coders.map(coder => {
              const hasAnswered = !!answeredMap[coder.id];
              return (
                <div 
                  key={coder.id} 
                  className={`flex items-center justify-between p-4 rounded-2xl transition-all duration-300 border ${
                    hasAnswered 
                      ? 'bg-clevio-green/20 border-clevio-green/30 shadow-[0_4px_20px_-5px_rgba(16,185,129,0.3)]' 
                      : 'bg-white/5 border-white/5 border-dashed'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${hasAnswered ? 'bg-clevio-green/30 text-emerald-400' : 'bg-white/10 text-white/30'}`}>
                      {hasAnswered ? <CheckCircle2 size={20} /> : <UserCircle2 size={20} />}
                    </div>
                    <span className={`font-semibold text-sm ${hasAnswered ? 'text-white' : 'text-white/60'}`}>
                      {coder.full_name}
                    </span>
                  </div>
                  {!hasAnswered && (
                    <span className="text-[10px] font-bold text-white/30 uppercase tracking-widest">
                      {currentIndex === -1 ? 'Belum Join' : 'Belum Submit'}
                    </span>
                  )}
                </div>
              );
            })}

            {coders.length === 0 && (
              <div className="text-center py-10 opacity-50">
                <UserCircle2 size={40} className="mx-auto mb-3 opacity-50" />
                <p className="text-sm">Tidak ada coder terdaftar di kelas ini.</p>
              </div>
            )}
          </div>
          
          <div className="mt-8 text-center border-t border-white/10 pt-6">
             <p className="text-xs text-white/40 mb-1">Presenter</p>
             <p className="text-sm font-bold text-sunshine">Coach {coachName}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
