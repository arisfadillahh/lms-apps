'use client';

import { useState } from 'react';
import type React from 'react';
import { ExternalLink } from 'lucide-react';
import MarkSessionCompleteButton from '@/app/(coach)/coach/classes/[id]/MarkSessionCompleteButton';

type SessionActionsProps = {
  sessionId: string;
  zoomLink: string;
  canComplete: boolean;
  slideUrl?: string | null;
  slideTitle?: string | null;
};

export default function SessionActions({
  sessionId,
  zoomLink,
  canComplete,
  slideUrl,
  slideTitle,
}: SessionActionsProps) {
  const [showSlides, setShowSlides] = useState(false);

  const handleOpenSlides = () => {
    if (!slideUrl) return;
    setShowSlides(true);
  };

  return (
    <>
      {/* Fixed Action Strip */}
      <div className="fixed bottom-0 right-0 left-0 lg:left-64 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 px-4 sm:px-6 py-3 sm:py-4 flex flex-col sm:flex-row items-center justify-between z-30 shadow-[0_-4px_20px_-5px_rgba(0,0,0,0.1)] gap-3 sm:gap-0">

        {/* Left Side: Auto-save info or Primary Tools */}
        <div className="flex items-center gap-3 w-full sm:w-auto overflow-x-auto no-scrollbar pb-1 sm:pb-0">
          <a
            href={zoomLink}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 bg-blue-50 hover:bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 dark:text-blue-400 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-colors whitespace-nowrap border border-blue-200 dark:border-blue-800/50"
          >
            <span className="material-symbols-outlined text-[18px]">videocam</span>
            Buka Zoom
          </a>

          <button
            type="button"
            onClick={handleOpenSlides}
            disabled={!slideUrl}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap border ${slideUrl
                ? 'bg-purple-50 hover:bg-purple-100 text-purple-600 border-purple-200 dark:bg-purple-900/30 dark:border-purple-800/50 dark:text-purple-400'
                : 'bg-slate-50 text-slate-400 border-slate-200 cursor-not-allowed dark:bg-slate-800 dark:border-slate-700'
              }`}
          >
            <span className="material-symbols-outlined text-[18px]">menu_book</span>
            Lihat Slide
          </button>
        </div>

        {/* Right Side: Actions */}
        <div className="flex items-center gap-3 w-full sm:w-auto overflow-x-auto no-scrollbar pb-1 sm:pb-0">
          <div className="flex items-center gap-1.5 mr-2 opacity-70">
            <span className="material-symbols-outlined text-emerald-500 text-sm">cloud_done</span>
            <span className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 font-medium whitespace-nowrap tracking-wide uppercase">Auto-Saved</span>
          </div>

          {canComplete && (
            <div className="scale-90 origin-right shrink-0">
              <MarkSessionCompleteButton sessionId={sessionId} />
            </div>
          )}

          <button className="bg-emerald-500 hover:bg-emerald-600 text-white px-5 sm:px-6 py-2.5 rounded-xl font-bold text-xs sm:text-sm shadow-md shadow-emerald-500/25 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-2 whitespace-nowrap shrink-0 border border-emerald-400">
            Selesai Absen
            <span className="material-symbols-outlined text-base">task_alt</span>
          </button>
        </div>
      </div>

      {/* Slide Modal */}
      {showSlides && slideUrl && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 z-[1000]" role="dialog" aria-modal="true">
          <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-5xl h-[85vh] shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)] flex flex-col overflow-hidden animate-slide-up border border-slate-200 dark:border-slate-800">
            <header className="flex justify-between items-center p-4 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 relative z-10">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white leading-tight">
                  Slide Pembelajaran
                </h3>
                {slideTitle && (
                  <p className="text-sm text-slate-500 truncate max-w-sm sm:max-w-xl">{slideTitle}</p>
                )}
              </div>
              <div className="flex items-center gap-3">
                <a
                  href={slideUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="hidden sm:flex items-center gap-2 text-blue-600 hover:text-blue-700 dark:text-blue-400 font-semibold text-sm bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 px-3 py-1.5 rounded-lg transition-colors border border-blue-200 dark:border-blue-800/50"
                  title="Buka di Tab Baru"
                >
                  <ExternalLink size={16} /> Buka Tab
                </a>
                <button
                  type="button"
                  onClick={() => setShowSlides(false)}
                  className="p-2 sm:px-4 sm:py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-semibold transition-colors flex items-center justify-center"
                >
                  <span className="material-symbols-outlined sm:hidden text-lg">close</span>
                  <span className="hidden sm:inline text-sm">Tutup</span>
                </button>
              </div>
            </header>
            <div className="flex-1 bg-black p-0 border-t border-slate-800 relative z-0">
              <iframe
                title={slideTitle ?? 'Slide pembelajaran'}
                src={slideUrl.replace('/pub?', '/embed?')}
                className="w-full h-full border-none"
                allow="fullscreen"
                allowFullScreen
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
