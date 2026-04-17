'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getSupabaseBrowser } from '@/lib/supabaseBrowser';
import { GraduationCap, Sparkles, ChevronRight } from 'lucide-react';

type BlockEvaluationCardProps = {
  classId: string;
  userId: string;
};

export default function BlockEvaluationCard({ classId, userId }: BlockEvaluationCardProps) {
  const [activeSession, setActiveSession] = useState<any>(null);
  const supabase = getSupabaseBrowser();

  useEffect(() => {
    if (!classId) return;

    // Initial fetch
    const fetchActiveEval = async () => {
      if (!userId) return;

      const { data } = await (supabase as any)
        .from('block_evaluation_sessions')
        .select('*')
        .eq('class_id', classId)
        .in('status', ['in_progress', 'completed'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data) {
        // Use the API endpoint since direct Supabase queries might be blocked by RLS
        const res = await fetch(`/api/coder/block-evaluations?blockId=${data.block_id}`);
        let alreadySubmitted = false;
        
        if (res.ok) {
           const json = await res.json();
           alreadySubmitted = json.submitted;
        }

        if (alreadySubmitted) {
          // Already completed — don't show the card anymore
          setActiveSession(null);
        } else {
          setActiveSession(data);
        }
      } else {
        setActiveSession(null);
      }
    };

    fetchActiveEval();

    // Subscribe to changes
    const channel = supabase
      .channel(`eval_sessions_${classId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'block_evaluation_sessions',
          filter: `class_id=eq.${classId}`
        },
        (payload: any) => {
          if (payload.new && (payload.new.status === 'in_progress' || payload.new.status === 'completed')) {
            // Re-fetch to ensure we check 'alreadySubmitted' before showing it
            fetchActiveEval();
          } else {
            setActiveSession(null);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [classId, userId, supabase]);

  // Remove unused import if we don't need it (supabase is still used. Wait, supabase is used for realtime channel)
  if (!activeSession) return null;

  return (
    <div className="relative bg-gradient-to-br from-violet-600 to-indigo-700 rounded-3xl p-6 mb-6 overflow-hidden shadow-xl shadow-violet-500/20 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Decorative blur */}
      <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl" />
      <div className="absolute bottom-0 left-0 w-32 h-32 bg-indigo-500/20 rounded-full -ml-10 -mb-10 blur-2xl" />

      <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center gap-5">
        {/* Icon */}
        <div className="shrink-0 w-14 h-14 bg-white/15 rounded-2xl flex items-center justify-center border border-white/20 backdrop-blur-sm">
          <GraduationCap className="text-white" size={28} />
        </div>

        {/* Text */}
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 bg-white/20 text-white text-[10px] font-black rounded-full uppercase tracking-widest border border-white/20">
              Sesi Evaluasi
            </span>
            <Sparkles className="text-yellow-300 animate-pulse" size={14} />
          </div>
          <h4 className="text-white font-black text-lg leading-tight mb-1">
            {activeSession.status === 'completed' ? 'Evaluasi Telah Tersedia!' : 'Coach Telah Membuka Sesi Evaluasi!'}
          </h4>
          <p className="text-violet-200 text-sm font-medium leading-snug">
            {activeSession.status === 'completed' ? 'Yuk selesaikan evaluasi ini secara mandiri.' : 'Yuk masuk sekarang. Coach sedang menunggumu di ruangan evaluasi.'}
          </p>
        </div>

        {/* CTA */}
        <Link
          href={`/coder/evaluation/${classId}/${activeSession.block_id}/${activeSession.session_id}?evalSessionId=${activeSession.id}`}
          className="shrink-0 w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-white text-violet-700 font-black rounded-2xl hover:bg-violet-50 transition-all shadow-lg active:scale-95 animate-bounce"
        >
          Masuk Evaluasi <ChevronRight size={18} />
        </Link>
      </div>
    </div>
  );
}

