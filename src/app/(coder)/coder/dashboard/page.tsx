import React from 'react';
import { promises as fs } from 'fs';
import path from 'path';
import Link from 'next/link';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { BookOpen, Flame, Pencil, ChevronRight, ListChecks, Zap, Play, Dumbbell, Lock, Rocket, Palette, Star, Download, Map, Hand, Monitor, Brush, Gamepad2, Cat, Package, Palmtree } from 'lucide-react';

import { getSessionOrThrow } from '@/lib/auth';
import { getCoderProgress } from '@/lib/services/coder';

import JourneyModal from './JourneyModal';
import UpcomingLessonsModal from './UpcomingLessonsModal';
import SoftwareDetailModal from './SoftwareDetailModal';
import BannerCarousel from '@/components/coder/BannerCarousel';
import ClassDetailTrigger from './ClassDetailTrigger';
import CoderHeader from './CoderHeader';

type Banner = {
  id: string;
  imagePath: string;
  linkUrl: string;
  title: string;
  order: number;
  isActive: boolean;
};

async function getBanners(): Promise<Banner[]> {
  try {
    const filePath = path.join(process.cwd(), 'public', 'banners', 'banners.json');
    const data = await fs.readFile(filePath, 'utf-8');
    const json = JSON.parse(data);
    return json.banners || [];
  } catch {
    return [];
  }
}

export default async function CoderDashboardPage() {
  const session = await getSessionOrThrow();
  const [progress, banners] = await Promise.all([
    getCoderProgress(session.user.id),
    getBanners(),
  ]);

  const upcomingBlocks = progress
    .filter((item) => item.upNext)
    .map((item) => ({
      classId: item.classId,
      className: item.name,
      classType: item.type,
      block: item.upNext!,
      coach: item.coach,
      schedule: item.schedule,
      journeyBlocks: item.journeyBlocks
    }));

  const journeyProgress = progress.filter((item) => item.journeyBlocks.length > 0);
  const activeBanners = banners.filter(b => b.isActive);
  const userName = session.user.fullName?.split(' ')[0] || 'Coder';
  const todayDate = format(new Date(), 'EEEE, d MMMM yyyy', { locale: id });

  // Calculate overall progress
  const totalCompleted = progress.reduce((acc, p) => acc + p.completedBlocks, 0);
  const totalBlocks = progress.reduce((acc, p) => acc + (p.totalBlocks || p.journeyBlocks.length), 0);
  const progressPercent = totalBlocks > 0 ? Math.round((totalCompleted / totalBlocks) * 100) : 0;

  // Get the first active block
  const activeBlock = upcomingBlocks[0] || null;
  const nextLesson = activeBlock?.block.lessons?.find((l: any) => l.status === 'NEXT');
  const completedLessons = activeBlock?.block.lessons?.filter((l: any) => l.status === 'COMPLETED').length || 0;
  const totalLessons = activeBlock?.block.lessons?.length || 1;
  const activeProgressPct = Math.round((completedLessons / totalLessons) * 100);

  // Upcoming lessons for the timeline — flat list of all next sessions across all classes
  const allUpcomingLessons = upcomingBlocks
    .flatMap(b =>
      (b.block.lessons || [])
        .filter((l: any) => l.status === 'NEXT' || l.status === 'UPCOMING' || l.status === 'LOCKED')
        .map((l: any) => ({ ...l, className: b.className }))
    )
    .sort((a: any, b: any) => {
      const dateA = a.scheduledAt?.[0] ? new Date(a.scheduledAt[0]).getTime() : Infinity;
      const dateB = b.scheduledAt?.[0] ? new Date(b.scheduledAt[0]).getTime() : Infinity;
      return dateA - dateB;
    });

  const upcomingLessons = allUpcomingLessons;

  // Software list
  const softwareList = upcomingBlocks.flatMap(b => b.block.software || []).slice(0, 4);

  // Journey courses for the modal
  const journeyCourses = journeyProgress.map((item) => ({
    classId: item.classId,
    name: item.name,
    classType: item.type,
    journeyBlocks: item.journeyBlocks,
    completedBlocks: item.completedBlocks,
    totalBlocks: item.totalBlocks || item.journeyBlocks.length,
  }));

  return (
    <>
      {/* ===== HEADER (Client Component) ===== */}
      <CoderHeader
        userName={userName}
        fullName={session.user.fullName || 'Coder'}
        todayDate={todayDate}
        avatarPath={(session.user as any).avatarPath}
        role={session.user.role}
        username={(session.user as any).username}
        adminPermissions={(session.user as any).adminPermissions}
      />

      {/* ===== CONTENT ===== */}
      <div className="flex-1 p-8 space-y-10 overflow-y-auto">

        {/* ===== BANNER SECTION ===== */}
        <section>
          {activeBanners.length > 0 ? (
            <div className="w-full rounded-[2.5rem] overflow-hidden shadow-2xl shadow-sky/20 relative">
              <BannerCarousel banners={activeBanners} />
            </div>
          ) : (
            <div className="w-full bg-gradient-to-br from-clevio-navy via-[#2A5082] to-[#1A2F4F] rounded-[2.5rem] overflow-hidden shadow-2xl shadow-clevio-navy/20 relative flex items-center min-h-[280px]">
              <div className="p-8 md:p-12 z-10 w-full md:w-3/5">
                <span className="inline-block px-4 py-1.5 bg-clevio-green/30 text-white rounded-full text-xs font-black uppercase tracking-widest mb-6 backdrop-blur-md">Pengumuman Seru!</span>
                <h3 className="text-3xl md:text-4xl font-black text-white leading-[1.1] mb-4">Beasiswa Clevio 2026!</h3>
                <p className="text-blue-100 text-base mb-6 max-w-md font-semibold opacity-90">Ayo daftar sekarang dan raih mimpimu jadi jagoan IT masa depan!</p>
                <button className="bg-clevio-green text-white px-8 py-3 rounded-2xl font-black text-sm shadow-[0_4px_0_0_#5A9832] hover:translate-y-1 hover:shadow-[0_2px_0_0_#5A9832] transition-all active:translate-y-1">
                  Daftar Sekarang
                </button>
              </div>
            </div>
          )}
        </section>

        {/* ===== MAIN GRID ===== */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">

          {/* ===== LEFT COLUMN ===== */}
          <div className="lg:col-span-8 space-y-10">

            {/* ===== LANJUTKAN BELAJARMU ===== */}
            <section>
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="text-xl font-black text-clevio-navy flex items-center gap-3">
                    <span className="bg-orange-100 text-orange-600 p-2 rounded-xl"><Flame size={20} strokeWidth={3} /></span>
                    Lanjutkan Belajarmu
                  </h3>
                  <p className="text-slate-400 font-bold text-sm">Petualanganmu sedang berlangsung!</p>
                </div>
                {/* Journey Button */}
                {journeyCourses.length > 0 && (
                  <JourneyModal courses={journeyCourses} />
                )}
              </div>

              {activeBlock ? (
                <div className="group bg-white rounded-[3rem] p-1 shadow-[0_20px_50px_rgba(0,0,0,0.04)] border-2 border-white/50 overflow-hidden">
                  <div className="bg-pastel-blue/30 p-6 md:p-10 rounded-[2.5rem] relative overflow-hidden">
                    {/* Ongoing Indicator */}
                    <div className="absolute top-6 md:top-8 right-6 md:right-8 flex items-center gap-2.5 px-3 py-1.5 md:px-4 md:py-2 bg-white/90 backdrop-blur-md rounded-full shadow-sm z-20 border-2 border-clevio-green/20">
                      <span className="relative flex size-2.5 md:size-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-clevio-green opacity-75"></span>
                        <span className="relative inline-flex rounded-full size-full bg-clevio-green"></span>
                      </span>
                      <span className="text-[9px] md:text-[10px] font-black text-clevio-green uppercase tracking-widest mt-[1px]">On Going</span>
                    </div>

                    <div className="flex flex-col gap-8 relative z-10">

                      {/* Top: Header Info */}
                      <div className="flex-1 w-full space-y-6">
                        <div className="space-y-3">
                          <div className="flex flex-wrap items-center gap-3 pr-32">
                            <span className="px-4 py-1.5 bg-pastel-blue text-clevio-navy text-[10px] font-black rounded-full uppercase tracking-widest border-2 border-sky/40 shadow-sm shadow-sky/20">
                              BEGINNER LEVEL
                            </span>
                          </div>
                          <h4 className="text-4xl font-black text-clevio-navy pt-2 pr-12">{activeBlock.className}</h4>
                          <p className="text-xl font-medium text-slate-600 flex items-center gap-3">
                            <BookOpen className="text-orange-600" size={24} strokeWidth={2.5} />
                            {activeBlock.block.name}
                          </p>
                        </div>
                      </div>

                      {/* Middle: Lesson Summary & Slide Access */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-8 border-t-2 border-dashed border-sky/20">
                        <div className="space-y-4">
                          <h5 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                            <ListChecks className="text-sky" size={18} />
                            Ringkasan Materi Sebelumnya
                          </h5>
                          {nextLesson?.summary ? (
                            <p className="text-sm font-bold text-slate-600 leading-relaxed">{nextLesson.summary}</p>
                          ) : (
                            <p className="text-sm font-bold text-slate-400 italic">Belum ada ringkasan untuk materi ini.</p>
                          )}
                        </div>
                        <div className="space-y-4">
                          <h5 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                            <Zap className="text-orange-600" size={18} />
                            Akses Slide Sesi Sebelumnya
                          </h5>
                          {nextLesson?.slideUrl ? (
                            <a
                              href={nextLesson.slideUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="flex items-center justify-between p-4 bg-pastel-blue hover:bg-sky hover:text-white rounded-2xl border-2 border-sky/20 transition-all group/link"
                            >
                              <div className="flex items-center gap-3">
                                <Play className="text-sky group-hover/link:text-white" size={20} />
                                <span className="text-sm font-black text-clevio-navy group-hover/link:text-white">Buka Slide Presentasi</span>
                              </div>
                              <ChevronRight className="text-sky group-hover/link:text-white group-hover/link:translate-x-1 transition-transform" size={18} />
                            </a>
                          ) : (
                            <p className="text-sm font-bold text-slate-400 italic p-4 bg-slate-50 rounded-2xl">Slide belum tersedia untuk materi ini.</p>
                          )}
                        </div>
                      </div>

                      {/* Bottom: Progress + CTA */}
                      <div className="flex flex-col md:flex-row items-center justify-between gap-6 pt-6">
                        <div className="w-full md:w-1/2 space-y-2">
                          <div className="flex justify-between items-center text-xs font-black text-slate-400 uppercase tracking-widest">
                            <span>Current Progress</span>
                            <span className="text-orange-600 text-base">{activeProgressPct}%</span>
                          </div>
                          <div className="w-full bg-white rounded-full h-3 p-1 shadow-inner">
                            <div className="bg-gradient-to-r from-sky to-clevio-green h-full rounded-full transition-all duration-1000" style={{ width: `${activeProgressPct}%` }}></div>
                          </div>
                        </div>
                        <ClassDetailTrigger
                          classInfo={{
                            classId: activeBlock.classId,
                            className: activeBlock.className,
                            classType: activeBlock.classType,
                            block: activeBlock.block,
                            progressPct: activeProgressPct,
                            bgColor: '',
                            coach: activeBlock.coach,
                            schedule: activeBlock.schedule
                          }}
                          customTrigger={
                            <button className="w-full md:w-auto bg-coral text-white px-8 py-3 rounded-xl font-black text-base shadow-[0_6px_0_0_#E86E7E] hover:translate-y-1 hover:shadow-[0_2px_0_0_#E86E7E] active:translate-y-1.5 active:shadow-none transition-all">
                              Lanjut Belajar
                            </button>
                          }
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-[3rem] p-12 text-center border-4 border-dashed border-pastel-pink/30">
                  <Palmtree size={48} className="text-sky/30 mx-auto mb-4" />
                  <h4 className="text-xl font-black text-slate-700">Belum Ada Kelas Aktif</h4>
                  <p className="text-sm font-bold text-slate-400 mt-2">Santai dulu! Nanti jadwal kelas barumu akan muncul di sini.</p>
                </div>
              )}
            </section>

            {/* ===== PERALATAN TEMPUR ===== */}
            {softwareList.length > 0 && (
              <section>
                <h3 className="text-xl font-black text-clevio-navy mb-4 flex items-center gap-3">
                  <span className="bg-amber-100 text-amber-600 p-2 rounded-xl"><Pencil size={20} strokeWidth={3} /></span>
                  Peralatan Tempur
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {softwareList.map((sw, idx) => {
                    const themes = [
                      { border: 'border-pastel-blue/60', iconBg: 'bg-pastel-blue', hoverBg: 'hover:bg-pastel-blue/10', hoverBtn: 'hover:bg-sky hover:text-white', rotate: 'group-hover:rotate-6' },
                      { border: 'border-pastel-yellow/60', iconBg: 'bg-pastel-yellow', hoverBg: 'hover:bg-pastel-yellow/10', hoverBtn: 'hover:bg-sunshine hover:text-white', rotate: 'group-hover:-rotate-6' },
                      { border: 'border-pastel-pink/60', iconBg: 'bg-pastel-pink', hoverBg: 'hover:bg-pastel-pink/10', hoverBtn: 'hover:bg-coral hover:text-white', rotate: 'group-hover:rotate-6' },
                      { border: 'border-pastel-green/60', iconBg: 'bg-pastel-green', hoverBg: 'hover:bg-pastel-green/10', hoverBtn: 'hover:bg-clevio-green hover:text-white', rotate: 'group-hover:-rotate-6' },
                    ];
                    const theme = themes[idx % 4];

                    const nameLower = sw.name.toLowerCase();
                    const swIcon = nameLower.includes('vs code') || nameLower.includes('vscode') ? <Monitor size={28} /> :
                      nameLower.includes('figma') ? <Brush size={28} /> :
                        nameLower.includes('roblox') ? <Gamepad2 size={28} /> :
                          nameLower.includes('scratch') ? <Cat size={28} /> :
                            <Package size={28} />;

                    const subtitle = nameLower.includes('vs code') || nameLower.includes('vscode') ? 'Markas Coding' :
                      nameLower.includes('figma') ? 'Kanvas Desain' :
                        nameLower.includes('roblox') ? 'Game Studio' :
                          nameLower.includes('scratch') ? 'Playground Coding' :
                            sw.version ? `Versi ${sw.version}` : 'Aplikasi Required';

                    return (
                      <div key={`${sw.id}-${idx}`} className={`bg-white border-4 ${theme.border} rounded-3xl p-5 flex items-center gap-4 shadow-[0_10px_0_0_rgba(0,0,0,0.05)] group ${theme.hoverBg} transition-colors`}>
                        <div className={`size-14 ${theme.iconBg} rounded-2xl flex items-center justify-center shadow-inner ${theme.rotate} transition-transform`}>
                          <span className="text-clevio-navy">{swIcon}</span>
                        </div>
                        <div className="flex-1">
                          <h5 className="font-black text-clevio-navy text-base">{sw.name}</h5>
                          <p className="text-xs font-bold text-slate-400">{subtitle}</p>
                        </div>
                        <SoftwareDetailModal software={sw} customTrigger={
                          <button className={`size-12 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center ${theme.hoverBtn} transition-all shadow-sm`}>
                            <Download size={20} strokeWidth={2.5} />
                          </button>
                        } />
                      </div>
                    );
                  })}
                </div>
              </section>
            )}
          </div>

          {/* ===== RIGHT COLUMN - TIMELINE ===== */}
          <div className="lg:col-span-4">
            <div className="bg-white rounded-[2.5rem] border-4 border-dashed border-pastel-blue/30 p-6">
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-xl font-black text-clevio-navy">Materi Mendatang</h3>
                <Star className="text-amber-500" size={20} />
              </div>

              <div className="space-y-6 relative mt-6">
                {upcomingLessons.length > 0 ? (
                  upcomingLessons.slice(0, 3).map((lesson, idx) => {
                    const isNext = lesson.status === 'NEXT';
                    const dateObj = lesson.scheduledAt ? new Date(lesson.scheduledAt[0]) : null;
                    const dateString = dateObj ? format(dateObj, 'dd MMM • HH:mm', { locale: id }) : 'Akan Datang';

                    const schemes = [
                      { border: 'border-sky', text: 'text-sky', icon: <Rocket className="text-sky" size={20} strokeWidth={2.5} /> },
                      { border: 'border-amber-400', text: 'text-amber-600', icon: <Palette className="text-amber-500" size={20} strokeWidth={2.5} /> },
                      { border: 'border-coral', text: 'text-orange-600', icon: <Star className="text-orange-600" size={20} strokeWidth={2.5} /> },
                    ];
                    const scheme = schemes[idx % 3];

                    return (
                      <div className="relative flex items-center gap-6" key={`${lesson.title}-${idx}`}>
                        {/* Icon Badge */}
                        <div className={`shrink-0 size-14 bg-white border-4 ${scheme.border} rounded-2xl z-10 flex items-center justify-center shadow-lg -rotate-6`}>
                          {scheme.icon}
                        </div>

                        {/* Content Card */}
                        <div className={`flex-1 bg-slate-50 p-5 rounded-3xl border-2 border-slate-100/60 ${isNext ? 'cursor-pointer bg-white border-slate-200 shadow-sm' : 'opacity-80'} transition-all group`}>
                          <div className="flex items-center gap-2 mb-2">
                            <span className={`text-[11px] font-black ${scheme.text} uppercase tracking-wider`}>{dateString}</span>
                          </div>
                          <h5 className="font-black text-clevio-navy text-lg leading-tight">{lesson.title || 'Materi Belum Berjudul'}</h5>
                          {isNext && (
                            <p className="text-sm font-bold text-slate-500 mt-2">Interaksi langsung bareng Mentor!</p>
                          )}
                          {!isNext && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-black text-slate-400 mt-3">
                              <Lock size={14} /> TERKUNCI
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-sm font-bold text-slate-400">Belum ada daftar materi</p>
                )}
              </div>

              <div className="mt-8 px-4 relative z-20">
                <UpcomingLessonsModal lessons={allUpcomingLessons} />
              </div>
            </div>
          </div>

        </div >
      </div >
    </>
  );
}
