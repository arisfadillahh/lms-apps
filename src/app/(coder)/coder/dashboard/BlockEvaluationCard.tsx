'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { GraduationCap, Sparkles, ChevronRight, PanelsTopLeft } from 'lucide-react';
import {
  resolveCoderEvaluationDashboardMode,
  type CoderEvaluationDashboardMode,
} from '@/lib/coderEvaluationDashboard';

type BlockEvaluationCardProps = {
  classId: string;
  userId: string;
};

type ActiveEvaluationSession = {
  id: string;
  block_id: string;
  session_id: string | null;
  status: 'in_progress' | 'completed' | string;
  created_at: string;
};

export default function BlockEvaluationCard({ classId, userId }: BlockEvaluationCardProps) {
  const [activeSession, setActiveSession] = useState<ActiveEvaluationSession | null>(null);
  const [mode, setMode] = useState<CoderEvaluationDashboardMode>('HIDDEN');

  useEffect(() => {
    if (!classId) return;

    // Initial fetch
    const fetchActiveEval = async () => {
      if (!userId) return;

      const activeResponse = await fetch(`/api/coder/block-evaluations?mode=active&classId=${encodeURIComponent(classId)}`, { cache: 'no-store' });
      if (!activeResponse.ok) return;
      const activePayload = await activeResponse.json();
      const data = activePayload.activeSession as ActiveEvaluationSession | null;

      if (data?.session_id) {
        // Use the API endpoint since direct Supabase queries might be blocked by RLS
        const params = new URLSearchParams({
          classId,
          blockId: data.block_id,
          sessionId: data.session_id,
        });
        let alreadySubmitted = false;
        let checkedAt = new Date();

        try {
          const res = await fetch(`/api/coder/block-evaluations?${params.toString()}`);
          if (res.ok) {
            const json = await res.json();
            alreadySubmitted = json.submitted;
            const serverTime = Date.parse(json.serverTime);
            if (Number.isFinite(serverTime)) checkedAt = new Date(serverTime);
          }
        } catch {
          // Keep the evaluation action available when its status check is temporarily unavailable.
        }

        if (!alreadySubmitted) {
          setMode('EVALUATION');
          setActiveSession(data);
          return;
        }

        const recentMode = resolveCoderEvaluationDashboardMode({
          status: data.status,
          createdAt: data.created_at,
          now: checkedAt,
          evaluationSubmitted: true,
          portfolioStarted: false,
        });

        if (recentMode !== 'PORTFOLIO') {
          setMode('HIDDEN');
          setActiveSession(null);
          return;
        }

        let alreadyStartedPortfolio = false;
        try {
          const portfolioResponse = await fetch(`/api/coder/portfolios?evaluationSessionId=${data.id}`);
          const portfolioBody = portfolioResponse.ok ? await portfolioResponse.json() : { portfolios: [] };
          alreadyStartedPortfolio = (portfolioBody.portfolios || []).some(
            (portfolio: { evaluation_session_id?: string | null }) => portfolio.evaluation_session_id === data.id,
          );
        } catch {
          // A temporary portfolio API failure must not affect the completed evaluation state.
        }

        const nextMode = resolveCoderEvaluationDashboardMode({
          status: data.status,
          createdAt: data.created_at,
          now: checkedAt,
          evaluationSubmitted: true,
          portfolioStarted: alreadyStartedPortfolio,
        });
        setMode(nextMode);
        setActiveSession(nextMode === 'HIDDEN' ? null : data);
      } else {
        setMode('HIDDEN');
        setActiveSession(null);
      }
    };

    fetchActiveEval();
    const timer = window.setInterval(fetchActiveEval, 5000);

    return () => {
      window.clearInterval(timer);
    };
  }, [classId, userId]);

  if (!activeSession || mode === 'HIDDEN') return null;

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
            {mode === 'PORTFOLIO'
              ? 'Refleksi selesai, waktunya simpan karya!'
              : activeSession.status === 'completed'
                ? 'Evaluasi Telah Tersedia!'
                : 'Coach Telah Membuka Sesi Evaluasi!'}
          </h4>
          <p className="text-violet-200 text-sm font-medium leading-snug">
            {mode === 'PORTFOLIO'
              ? 'Buat portofolio dari project di block ini. Kamu juga bisa melanjutkannya nanti dari menu Rapor & Portofolio.'
              : activeSession.status === 'completed'
                ? 'Selesaikan refleksimu terlebih dahulu sebelum mengisi portofolio.'
                : 'Coach sedang memandu refleksi. Selesaikan evaluasimu terlebih dahulu.'}
          </p>
        </div>

        {/* CTA */}
        <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto">
          {mode === 'EVALUATION' && <Link
            href={`/coder/evaluation/${classId}/${activeSession.block_id}/${activeSession.session_id}?evalSessionId=${activeSession.id}`}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-6 py-3 font-black text-violet-700 shadow-lg transition-all hover:bg-violet-50 active:scale-95 sm:w-auto"
          >
            Masuk Evaluasi <ChevronRight size={18} />
          </Link>}
          {mode === 'PORTFOLIO' && <Link
            href={`/coder/reports/portfolio/new?classId=${classId}&blockId=${activeSession.block_id}&evaluationSessionId=${activeSession.id}`}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-lime-300 px-6 py-3 font-black text-violet-950 shadow-lg transition-all hover:bg-lime-200 active:scale-95 sm:w-auto"
          >
            <PanelsTopLeft size={18} /> Isi Portofolio
          </Link>}
        </div>
      </div>
    </div>
  );
}
