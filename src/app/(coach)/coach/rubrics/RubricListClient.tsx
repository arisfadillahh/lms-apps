'use client';

import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { Calendar, Users, Zap, FileText, ArrowRight, Flag, PartyPopper, GraduationCap, LayoutGrid } from 'lucide-react';

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

type RubricListClientProps = {
  pendingLessons: PendingLesson[];
  draftReports: DraftReport[];
};

function formatDate(value: string | null): string {
    if (!value) return '—';
    return new Date(value).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
}
  
function formatDates(values: string[]): string {
    if (!values || values.length === 0) return '—';
    if (values.length === 1) return formatDate(values[0]);
    
    const dates = values.map(v => new Date(v));
    const firstDate = dates[0];
    const lastDate = dates[dates.length - 1];
    
    if (firstDate.getMonth() === lastDate.getMonth() && firstDate.getFullYear() === lastDate.getFullYear()) {
      const days = dates.map(d => d.getDate()).join(', ');
      const monthYear = firstDate.toLocaleDateString('id-ID', { month: 'short', year: 'numeric' });
      return `${days} ${monthYear}`;
    }
    
    return dates.map(d => d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })).join(', ') + ' ' + lastDate.getFullYear();
}
  
function getGradeLetter(score: number) {
    if (score >= 8.5) return 'A';
    if (score >= 7.0) return 'B';
    if (score >= 5.5) return 'C';
    return 'D';
}

export default function RubricListClient({ 
  pendingLessons, 
  draftReports
}: RubricListClientProps) {
  
  const hasItems = pendingLessons.length > 0 || draftReports.length > 0;

  return (
    <div className="relative space-y-12">
      {/* Journey Line */}
      <div className="absolute left-[27px] top-6 bottom-0 w-[2px] z-0" 
           style={{ background: 'linear-gradient(to bottom, #cbd5e1 0%, #cbd5e1 100%)', backgroundSize: '2px 10px' }} />

      <AnimatePresence mode="popLayout" initial={false}>
          {/* Pending Lessons */}
          {pendingLessons.map((item) => (
            <motion.div 
                key={item.sessionId}
                layout
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
                className="relative pl-16 group"
            >
                <div className="absolute left-0 top-6 w-14 h-14 bg-amber-100 rounded-full border-4 border-[#f8fafc] flex items-center justify-center z-10 shadow-md">
                  <Zap className="text-amber-600" size={24} strokeWidth={3} />
                </div>
                
                <div className="bg-white rounded-2xl border border-slate-200 shadow-xl shadow-slate-200/40 overflow-hidden relative group-hover:border-amber-300 transition-all z-10">
                  <div className="absolute inset-0 opacity-10 pointer-events-none" 
                       style={{ backgroundImage: 'radial-gradient(#e2e8f0 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>
                  
                  <div className="p-6 md:p-8 relative z-20 flex flex-col md:flex-row gap-6 md:gap-8 items-center">
                    <div className="flex-1 space-y-4 text-center md:text-left w-full">
                      <div className="flex items-center justify-center md:justify-start gap-2">
                        <span className="bg-slate-900 text-[10px] text-white px-3 py-1 rounded-full font-bold tracking-wider">{item.className}</span>
                        {item.blockName && <span className="bg-sky-50 text-[10px] text-sky-600 px-3 py-1 rounded-full border border-sky-100 font-bold tracking-wider">{item.blockName}</span>}
                      </div>
                      
                      <h3 className="text-xl md:text-2xl font-bold text-slate-800 leading-tight">{item.lessonTitle}</h3>
                      
                      <div className="flex flex-wrap justify-center md:justify-start gap-4 md:gap-6 text-sm text-slate-500">
                        <div className="flex items-center gap-2">
                          <Calendar size={16} />
                          <span>{formatDates(item.sessionDates)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Users size={16} />
                          <span>{item.studentsCount} Siswa</span>
                        </div>
                      </div>
                      
                      <div className="space-y-2 pt-2">
                        <div className="flex justify-between items-center text-xs font-bold text-slate-400">
                          <span className="uppercase tracking-widest">Progress</span>
                          <span className="text-emerald-500">Siap Dinilai</span>
                        </div>
                        <div className="w-full bg-slate-100 h-2 md:h-3 rounded-full overflow-hidden p-[2px]">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: '100%' }}
                            transition={{ delay: 0.5, duration: 1 }}
                            className="bg-emerald-500 h-full rounded-full"
                          />
                        </div>
                      </div>
                    </div>
                    
                    <div className="shrink-0 w-full md:w-auto mt-4 md:mt-0">
                      <Link href={`/coach/rubrics/${item.sessionId}`} 
                            className="w-full md:w-auto px-8 py-4 bg-emerald-500 text-white font-bold rounded-xl flex items-center justify-center gap-3 hover:bg-emerald-600 hover:scale-105 transition-all shadow-lg shadow-emerald-200">
                        Beri Nilai <ArrowRight size={20} strokeWidth={3} />
                      </Link>
                    </div>
                  </div>
                </div>
            </motion.div>
          ))}

          {/* Draft Reports */}
          {draftReports.map((report) => {
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
                  <div className="absolute inset-0 pointer-events-none opacity-40"
                       style={{ background: 'radial-gradient(circle at 70% 30%, rgba(59, 130, 246, 0.05) 0%, transparent 50%), radial-gradient(circle at 30% 70%, rgba(16, 185, 129, 0.05) 0%, transparent 50%)' }}></div>
                  
                  <div className="p-6 md:p-8 relative z-20 flex flex-col md:flex-row gap-6 md:gap-8 items-center cursor-default">
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

          {!hasItems && (
            <motion.div 
                key="empty-state"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="relative pl-16"
            >
                <div className="absolute left-0 top-0 w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center border-2 border-emerald-200 shadow-md z-10">
                  <PartyPopper className="text-emerald-500" size={24} />
                </div>
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 text-center ml-2 z-10 relative">
                  <h3 className="text-xl font-bold text-slate-800 mb-2">Hore! Journey tuntas.</h3>
                  <p className="text-slate-500 max-w-sm mx-auto">
                    Semua antrean nilai dan draf rapor sudah diselesaikan. Ambil kopi dan bersantai sejenak, Coach!
                  </p>
                </div>
            </motion.div>
          )}

          {hasItems && (
             <motion.div 
                key="end-marker"
                layout
                className="relative pl-16"
             >
                <div className="absolute left-0 top-0 w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center border-2 border-dashed border-slate-300 z-10">
                  <Flag className="text-slate-400" size={20} />
                </div>
                <div className="pt-4 z-10 relative">
                  <p className="text-slate-400 font-semibold italic">Akhir antrean hari ini...</p>
                </div>
            </motion.div>
          )}
      </AnimatePresence>
    </div>
  );
}
