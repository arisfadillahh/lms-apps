import type { CSSProperties } from 'react';
import React from 'react';
import { promises as fs } from 'fs';
import path from 'path';
import Link from 'next/link';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { ChevronRight, BookOpen, FileText, Calendar } from 'lucide-react';

import { getSessionOrThrow } from '@/lib/auth';
import { getCoderProgress } from '@/lib/services/coder';

import JourneyModal from './JourneyModal';
import SoftwareDetailModal from './SoftwareDetailModal';
import BannerCarousel from '@/components/coder/BannerCarousel';

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
      journeyBlocks: item.journeyBlocks
    }));

  const journeyProgress = progress.filter((item) => item.journeyBlocks.length > 0);
  const activeBanners = banners.filter(b => b.isActive);
  const userName = session.user.fullName?.split(' ')[0] || 'Coder';
  const todayDate = format(new Date(), 'EEEE, d MMMM', { locale: id });

  // Calculate overall progress
  const totalCompleted = progress.reduce((acc, p) => acc + p.completedBlocks, 0);
  const totalBlocks = progress.reduce((acc, p) => acc + (p.totalBlocks || p.journeyBlocks.length), 0);
  const progressPercent = totalBlocks > 0 ? Math.round((totalCompleted / totalBlocks) * 100) : 0;

  return (
    <div style={containerStyle}>
      {/* Main Content - 2 Column Layout */}
      <div style={mainGridStyle}>
        {/* Left Column - Main Content */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

          {/* Welcome Banner */}
          <div style={welcomeBannerStyle}>
            <div style={{ position: 'relative', zIndex: 1 }}>
              <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.8)', marginBottom: '0.25rem' }}>
                {todayDate}
              </p>
              <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: '#fff', margin: '0 0 0.5rem 0' }}>
                Selamat datang, {userName}! 👋
              </h1>
              <p style={{ fontSize: '0.95rem', color: 'rgba(255,255,255,0.85)', margin: 0 }}>
                Kamu sudah menyelesaikan <strong>{progressPercent}%</strong> dari target mingguan!
              </p>
            </div>
            <div style={{ position: 'absolute', right: '2rem', bottom: 0, fontSize: '5rem', opacity: 0.2 }}>
              🎓
            </div>
          </div>

          {/* Banner Carousel */}
          {activeBanners.length > 0 && (
            <BannerCarousel banners={activeBanners} />
          )}

          {/* My Courses Section */}
          <section>
            <div style={sectionHeaderStyle}>
              <h2 style={sectionTitleStyle}>Kelas Saya</h2>
              {journeyProgress.length > 0 && (
                <JourneyModal courses={upcomingBlocks.map(b => ({
                  classId: b.classId,
                  name: b.className,
                  classType: b.classType,
                  completedBlocks: journeyProgress.find(p => p.classId === b.classId)?.completedBlocks || 0,
                  totalBlocks: journeyProgress.find(p => p.classId === b.classId)?.totalBlocks || null,
                  journeyBlocks: b.journeyBlocks
                }))} />
              )}
            </div>

            {upcomingBlocks.length > 0 ? (
              <div style={coursesGridStyle}>
                {upcomingBlocks.map(({ classId, className, classType, block }) => {
                  const progressPct = Math.round(Math.random() * 60 + 20); // Placeholder
                  const bgColors = ['#fef9c3', '#dbeafe', '#fce7f3', '#dcfce7'];
                  const bgColor = bgColors[upcomingBlocks.indexOf({ classId, className, classType, block, journeyBlocks: [] }) % bgColors.length] || '#dbeafe';

                  return (
                    <div key={`${classId}-${block.blockId}`} style={{ ...courseCardStyle, background: bgColor }}>
                      <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>
                        {classType === 'EKSKUL' ? '🎨' : '💻'}
                      </div>
                      <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#1e293b', margin: '0 0 0.25rem 0' }}>
                        {classType === 'EKSKUL' ? block.name : className}
                      </h3>
                      <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '0 0 1rem 0' }}>
                        {block.nextLesson?.title || 'Menunggu jadwal'}
                      </p>

                      {/* Progress bar */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                        <span style={{ fontSize: '0.7rem', color: '#64748b' }}>Lessons: {block.estimatedSessions || 0}</span>
                        <span style={{ flex: 1 }} />
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#3b82f6' }}>{progressPct}%</span>
                      </div>
                      <div style={{ height: '6px', background: 'rgba(0,0,0,0.1)', borderRadius: '999px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${progressPct}%`, background: '#3b82f6', borderRadius: '999px' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={emptyCardStyle}>
                <p>Belum ada kelas aktif</p>
              </div>
            )}
          </section>

          {/* Software Section */}
          {upcomingBlocks.some(b => b.block.software && b.block.software.length > 0) && (
            <section>
              <h2 style={sectionTitleStyle}>📦 Software</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '1rem' }}>
                {upcomingBlocks.flatMap(b => b.block.software || []).slice(0, 4).map(sw => (
                  <div key={sw.id} style={softwareCardStyle}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <h4 style={{ fontSize: '1rem', fontWeight: 600, color: '#1e293b', margin: 0 }}>{sw.name}</h4>
                        {sw.version && <span style={{ fontSize: '0.75rem', color: '#64748b' }}>v{sw.version}</span>}
                      </div>
                      <SoftwareDetailModal software={sw} />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Right Column - Sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

          {/* Quick Stats */}
          <div style={sideCardStyle}>
            <h3 style={sideCardTitleStyle}>📊 Statistik</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
              <div style={quickStatStyle}>
                <span style={{ fontSize: '1.5rem', fontWeight: 700, color: '#3b82f6' }}>{progress.length}</span>
                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Kelas Aktif</span>
              </div>
              <div style={quickStatStyle}>
                <span style={{ fontSize: '1.5rem', fontWeight: 700, color: '#10b981' }}>{totalCompleted}</span>
                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Block Selesai</span>
              </div>
            </div>
          </div>

          {/* Upcoming Tasks */}
          <div style={sideCardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={sideCardTitleStyle}>📋 Materi Mendatang</h3>
              <Link href="/coder/materials" style={{ fontSize: '0.8rem', color: '#3b82f6', textDecoration: 'none', fontWeight: 500 }}>
                Lihat Semua
              </Link>
            </div>
            <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {upcomingBlocks.slice(0, 3).map(({ classId, className, block }) => (
                <div key={classId} style={taskItemStyle}>
                  <div style={taskIconStyle}>
                    <BookOpen size={14} color="#3b82f6" />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: '0.85rem', fontWeight: 600, color: '#1e293b', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {block.nextLesson?.title || block.name}
                    </p>
                    <p style={{ fontSize: '0.75rem', color: '#64748b', margin: '0.15rem 0 0' }}>{className}</p>
                  </div>
                  <ChevronRight size={16} color="#94a3b8" />
                </div>
              ))}
              {upcomingBlocks.length === 0 && (
                <p style={{ fontSize: '0.85rem', color: '#94a3b8', textAlign: 'center', padding: '1rem 0' }}>
                  Tidak ada materi mendatang
                </p>
              )}
            </div>
          </div>

          {/* Quick Links */}
          <div style={sideCardStyle}>
            <h3 style={sideCardTitleStyle}>🔗 Akses Cepat</h3>
            <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <Link href="/coder/materials" style={quickLinkStyle}>
                <BookOpen size={16} /> Lihat Materi
              </Link>
              <Link href="/coder/reports" style={quickLinkStyle}>
                <FileText size={16} /> Lihat Rapor
              </Link>
              <Link href="/coder/makeup" style={quickLinkStyle}>
                <Calendar size={16} /> Tugas Susulan
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Styles - Modern Blue Theme
const containerStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '1.5rem',
  paddingBottom: '2rem',
};

const mainGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 320px',
  gap: '1.5rem',
};

const welcomeBannerStyle: CSSProperties = {
  background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
  borderRadius: '20px',
  padding: '2rem',
  position: 'relative',
  overflow: 'hidden',
  minHeight: '140px',
};

const sectionHeaderStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: '1rem',
};

const sectionTitleStyle: CSSProperties = {
  fontSize: '1.15rem',
  fontWeight: 700,
  color: '#1e293b',
  margin: 0,
};

const coursesGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
  gap: '1rem',
};

const courseCardStyle: CSSProperties = {
  borderRadius: '16px',
  padding: '1.25rem',
  transition: 'transform 0.2s, box-shadow 0.2s',
};

const emptyCardStyle: CSSProperties = {
  background: '#f8fafc',
  borderRadius: '16px',
  padding: '2rem',
  textAlign: 'center',
  color: '#94a3b8',
};

const softwareCardStyle: CSSProperties = {
  background: '#fff',
  borderRadius: '12px',
  padding: '1rem',
  border: '1px solid #e2e8f0',
};

const sideCardStyle: CSSProperties = {
  background: '#fff',
  borderRadius: '16px',
  padding: '1.25rem',
  boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
  border: '1px solid #f1f5f9',
};

const sideCardTitleStyle: CSSProperties = {
  fontSize: '0.95rem',
  fontWeight: 700,
  color: '#1e293b',
  margin: 0,
};

const quickStatStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  padding: '0.75rem',
  background: '#f8fafc',
  borderRadius: '12px',
};

const taskItemStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.75rem',
  padding: '0.75rem',
  background: '#f8fafc',
  borderRadius: '12px',
};

const taskIconStyle: CSSProperties = {
  width: '32px',
  height: '32px',
  borderRadius: '8px',
  background: '#eff6ff',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const quickLinkStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  padding: '0.65rem 0.75rem',
  background: '#f8fafc',
  borderRadius: '10px',
  color: '#475569',
  fontSize: '0.85rem',
  fontWeight: 500,
  textDecoration: 'none',
  transition: 'background 0.2s',
};
