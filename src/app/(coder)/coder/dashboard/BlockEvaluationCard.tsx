'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { GraduationCap, Sparkles, ChevronRight, PanelsTopLeft } from 'lucide-react';
import {
  resolveCoderEvaluationDashboardMode,
  type CoderEvaluationDashboardMode,
} from '@/lib/coderEvaluationDashboard';
import styles from './blockEvaluationCard.module.css';

type BlockEvaluationCardProps = {
  classId: string;
  userId: string;
};

type ActiveEvaluationSession = {
  id: string;
  block_id: string;
  session_id: string;
  status: string;
  created_at: string;
  selfPaced: boolean;
  submitted: boolean;
};

export default function BlockEvaluationCard({ classId, userId }: BlockEvaluationCardProps) {
  const [card, setCard] = useState<{
    activeSession: ActiveEvaluationSession;
    mode: Exclude<CoderEvaluationDashboardMode, 'HIDDEN'>;
  } | null>(null);

  useEffect(() => {
    if (!classId || !userId) return;

    const lifetime = new AbortController();
    let timer: number | undefined;
    const params = new URLSearchParams({ mode: 'active', classId });

    const refreshCard = async () => {
      const signal = typeof AbortSignal.timeout === 'function' && typeof AbortSignal.any === 'function'
        ? AbortSignal.any([lifetime.signal, AbortSignal.timeout(10_000)])
        : lifetime.signal;

      try {
        const response = await fetch(`/api/coder/block-evaluations?${params}`, { cache: 'no-store', signal });
        if (!response.ok) throw new Error('Gagal memeriksa sesi evaluasi.');

        const { activeSession, serverTime } = await response.json() as {
          activeSession: ActiveEvaluationSession | null;
          serverTime: string;
        };
        if (lifetime.signal.aborted) return;
        if (!activeSession || typeof activeSession.submitted !== 'boolean') {
          setCard(null);
          return;
        }

        const mode = resolveCoderEvaluationDashboardMode({
          status: activeSession.status,
          createdAt: activeSession.created_at,
          now: new Date(serverTime),
          evaluationSubmitted: activeSession.submitted,
          portfolioStarted: false,
        });

        if (mode === 'PORTFOLIO') {
          const portfolioResponse = await fetch(
            `/api/coder/portfolios?evaluationSessionId=${encodeURIComponent(activeSession.id)}`,
            { cache: 'no-store', signal },
          );
          if (!portfolioResponse.ok) throw new Error('Gagal memeriksa portofolio evaluasi.');
          const { portfolios } = await portfolioResponse.json();
          if (lifetime.signal.aborted) return;
          const alreadyStarted = (portfolios ?? []).some(
            (portfolio: { evaluation_session_id?: string | null }) => portfolio.evaluation_session_id === activeSession.id,
          );
          setCard(alreadyStarted ? null : { activeSession, mode });
          return;
        }

        setCard(mode === 'HIDDEN' ? null : { activeSession, mode });
      } catch {
        if (!lifetime.signal.aborted) setCard(null);
      } finally {
        if (!lifetime.signal.aborted) timer = window.setTimeout(refreshCard, 5000);
      }
    };

    void refreshCard();
    return () => {
      lifetime.abort();
      window.clearTimeout(timer);
    };
  }, [classId, userId]);

  if (!card) return null;
  const { activeSession, mode } = card;

  return (
    <div className={`${styles.card} relative rounded-3xl p-6 mb-6 overflow-hidden shadow-xl animate-in fade-in slide-in-from-bottom-4 duration-500`}>
      {/* Decorative blur */}
      <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl" />
      <div className="absolute bottom-0 left-0 w-32 h-32 bg-indigo-500/20 rounded-full -ml-10 -mb-10 blur-2xl" />

      <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center gap-5">
        {/* Icon */}
        <div className={`${styles.icon} shrink-0 w-14 h-14 rounded-2xl flex items-center justify-center border border-white/20 backdrop-blur-sm`}>
          <GraduationCap className="text-white" size={28} />
        </div>

        {/* Text */}
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className={`${styles.badge} px-2.5 py-0.5 text-white text-[10px] font-black rounded-full uppercase tracking-widest border border-white/20`}>
              {activeSession.selfPaced && mode === 'EVALUATION' ? 'Refleksi Sebelumnya' : 'Sesi Evaluasi'}
            </span>
            <Sparkles className="text-yellow-300 animate-pulse" size={14} />
          </div>
          <h4 className="text-white font-black text-lg leading-tight mb-1">
            {mode === 'PORTFOLIO'
              ? 'Refleksi selesai, waktunya simpan karya!'
              : activeSession.selfPaced || activeSession.status === 'completed'
                ? 'Evaluasi Telah Tersedia!'
                : 'Coach Telah Membuka Sesi Evaluasi!'}
          </h4>
          <p className="text-violet-200 text-sm font-medium leading-snug">
            {mode === 'PORTFOLIO'
              ? 'Buat portofolio dari project di block ini. Kamu juga bisa melanjutkannya nanti dari menu Rapor & Portofolio.'
              : activeSession.selfPaced || activeSession.status === 'completed'
                ? 'Refleksi sebelumnya belum selesai. Kamu bisa mengisinya sendiri tanpa menunggu coach.'
                : 'Coach sedang memandu refleksi. Selesaikan evaluasimu terlebih dahulu.'}
          </p>
        </div>

        {/* CTA */}
        <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto">
          {mode === 'EVALUATION' && <Link
            href={`/coder/evaluation/${classId}/${activeSession.block_id}/${activeSession.session_id}?evalSessionId=${activeSession.id}`}
            className={`${styles.action} flex w-full items-center justify-center gap-2 rounded-2xl px-6 py-3 font-black shadow-lg transition-all active:scale-95 sm:w-auto`}
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
