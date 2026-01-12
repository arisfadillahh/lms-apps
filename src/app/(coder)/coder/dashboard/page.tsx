import type { CSSProperties } from 'react';
import React from 'react';
import { promises as fs } from 'fs';
import path from 'path';

import { getSessionOrThrow } from '@/lib/auth';
import { getCoderProgress } from '@/lib/services/coder';

import JourneyModal from './JourneyModal';
import SoftwareDetailModal from './SoftwareDetailModal';
import JourneyMap from './JourneyMap';
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
    .filter((item) => item.type === 'WEEKLY' && item.upNext)
    .map((item) => ({
      classId: item.classId,
      className: item.name,
      block: item.upNext!,
      journeyBlocks: item.journeyBlocks // Pass journey blocks for the modal
    }));

  const journeyProgress = progress
    .filter((item) => item.type === 'WEEKLY' && item.journeyBlocks.length > 0);

  const activeBanners = banners.filter(b => b.isActive);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', maxWidth: '1280px', margin: '0 auto', width: '100%' }}>
      {/* Banner Carousel */}
      {activeBanners.length > 0 && (
        <BannerCarousel banners={activeBanners} />
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <header>
          <h1 style={{ fontSize: 'clamp(1.5rem, 4vw, 2rem)', fontWeight: 700, marginBottom: '0.5rem', color: '#0f172a' }}>
            Halo, {session.user.fullName} 👋
          </h1>
          <p style={{ color: '#64748b', fontSize: 'clamp(0.9rem, 2.5vw, 1.1rem)' }}>
            Selamat datang kembali! Yuk cek progress dan persiapan kelasmu hari ini.
          </p>
        </header>

        {/* Learning Journey Button - Moved here */}
        <div style={{ flexShrink: 0 }}>
          {journeyProgress.length > 0 && <JourneyModal courses={upcomingBlocks.map(b => ({
            classId: b.classId,
            name: b.className,
            completedBlocks: journeyProgress.find(p => p.classId === b.classId)?.completedBlocks || 0,
            totalBlocks: journeyProgress.find(p => p.classId === b.classId)?.totalBlocks || null,
            journeyBlocks: b.journeyBlocks
          }))} />}
        </div>
      </div>

      {upcomingBlocks.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
          {upcomingBlocks.map(({ classId, className, block, journeyBlocks }) => {
            // Create a Course object matching JourneyCourse type for the modal
            // const journeyCourse = { // This is no longer needed here as the modal is moved
            //   classId,
            //   name: className,
            //   completedBlocks: journeyProgress.find(p => p.classId === classId)?.completedBlocks || 0,
            //   totalBlocks: journeyProgress.find(p => p.classId === classId)?.totalBlocks || null,
            //   journeyBlocks: journeyBlocks
            // };

            return (
              <div key={`${classId}-${block.blockId}`} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

                {/* 1. SECTION: BLOCK INFO (CARD UTAMA) */}
                <section style={cardStyle}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '1rem' }}>
                    <div>
                      <p style={{ fontSize: '0.8rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, marginBottom: '0.25rem' }}>
                        {className}
                      </p>
                      <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                        Block: {block.name}
                      </h2>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <span style={statusBadgeStyle(block.status)}>
                        {formatStatus(block.status)}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>

                    {/* Column 1: Info Dasar */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      <div>
                        <p style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600, marginBottom: '0.25rem' }}>📅 JADWAL BLOCK</p>
                        <p style={{ fontSize: '0.95rem', color: '#334155', fontWeight: 500 }}>
                          {new Date(block.startDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long' })} - {new Date(block.endDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </p>
                      </div>
                      <div>
                        <p style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600, marginBottom: '0.25rem' }}>⏱️ DURASI</p>
                        <p style={{ fontSize: '0.95rem', color: '#334155', fontWeight: 500 }}>
                          {block.estimatedSessions !== null ? `${block.estimatedSessions} Pertemuan` : '—'}
                        </p>
                      </div>

                      {/* Completed Lessons List */}

                    </div>

                    {/* Column 2: Next Lesson (Highlight) */}
                    {block.nextLesson ? (
                      <div style={{ background: '#eff6ff', borderRadius: '12px', padding: '1.25rem', border: '1px solid #dbeafe', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                        <p style={{ fontSize: '0.75rem', color: '#1d4ed8', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.5rem', letterSpacing: '0.05em' }}>
                          📚 Sesi Selanjutnya
                        </p>
                        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1e40af', lineHeight: '1.4', marginBottom: '0.5rem' }}>
                          {block.nextLesson.title}
                        </h3>
                        {block.nextLesson.summary && (
                          <p style={{ fontSize: '0.85rem', color: '#1e3a8a', lineHeight: '1.5', opacity: 0.9 }}>
                            {block.nextLesson.summary}
                          </p>
                        )}
                      </div>
                    ) : (
                      <div style={{ background: '#f8fafc', borderRadius: '12px', padding: '1.25rem', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontStyle: 'italic' }}>
                        Belum ada jadwal sesi berikutnya
                      </div>
                    )}

                  </div>
                </section>

                {/* 2. SECTION: SOFTWARE (CARD TERPISAH) */}
                {block.software && block.software.length > 0 && (
                  <section>
                    <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#0f172a', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      📦 Software
                    </h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
                      {block.software.map(sw => (
                        <div key={sw.id} style={softwareCardStyle}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                              <h4 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>{sw.name}</h4>
                              {sw.version && <span style={{ fontSize: '0.8rem', color: '#64748b', background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px', marginTop: '4px', display: 'inline-block' }}>v{sw.version}</span>}
                            </div>
                            <SoftwareDetailModal software={sw} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}
              </div>
            );
          })}
        </div>
      ) : null}

      {/* Progress Section (Keep as secondary info) */}
      <section style={cardStyle}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '1rem', color: '#0f172a' }}>📊 Ringkasan Progress</h2>

        {/* Desktop Table */}
        <div style={{ display: 'block', overflowX: 'auto' }} className="hidden-mobile">
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '600px' }}>
            <thead style={{ background: '#f8fafc', textAlign: 'left' }}>
              <tr>
                <th style={thStyle}>Kelas</th>
                <th style={thStyle}>Selesai</th>
                <th style={thStyle}>Total Block</th>
                <th style={thStyle}>Terakhir Hadir</th>
              </tr>
            </thead>
            <tbody>
              {progress.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ padding: '1rem', textAlign: 'center', color: '#6b7280' }}>
                    Kamu belum terdaftar di kelas manapun.
                  </td>
                </tr>
              ) : (
                progress.map((item) => (
                  <tr key={item.classId} style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={tdStyle}>
                      <span style={{ fontWeight: 600, color: '#334155' }}>{item.name}</span>
                    </td>
                    <td style={tdStyle}>
                      {item.completedBlocks} Block
                    </td>
                    <td style={tdStyle}>{item.totalBlocks ?? '—'}</td>
                    <td style={tdStyle}>{item.lastAttendanceAt ? new Date(item.lastAttendanceAt).toLocaleDateString() : '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Cards */}
        <div style={{ display: 'none' }} className="show-mobile">
          {progress.length === 0 ? (
            <p style={{ textAlign: 'center', color: '#6b7280', padding: '1rem' }}>Kamu belum terdaftar di kelas manapun.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {progress.map((item) => (
                <div key={item.classId} style={mobileCardStyle}>
                  <div style={{ fontWeight: 600, color: '#0f172a', marginBottom: '0.5rem' }}>{item.name}</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.35rem', fontSize: '0.8rem', color: '#475569' }}>
                    <span>Block Selesai:</span>
                    <span style={{ fontWeight: 500 }}>{item.completedBlocks}</span>
                    <span>Total Block:</span>
                    <span style={{ fontWeight: 500 }}>{item.totalBlocks ?? '—'}</span>
                    <span>Last seen:</span>
                    <span style={{ fontWeight: 500 }}>{item.lastAttendanceAt ? new Date(item.lastAttendanceAt).toLocaleDateString() : '—'}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Responsive CSS via style tag */}
      <style>{`
        @media (max-width: 768px) {
          .hidden-mobile { display: none !important; }
          .show-mobile { display: block !important; }
        }
        @media (min-width: 769px) {
          .hidden-mobile { display: block !important; }
          .show-mobile { display: none !important; }
        }
      `}</style>
    </div>
  );
}

function formatStatus(status: 'UPCOMING' | 'CURRENT' | 'COMPLETED'): string {
  switch (status) {
    case 'CURRENT':
      return 'Sedang berjalan';
    case 'COMPLETED':
      return 'Selesai';
    default:
      return 'Menunggu';
  }
}

function statusBadgeStyle(status: 'UPCOMING' | 'CURRENT' | 'COMPLETED'): CSSProperties {
  const base = {
    padding: '0.35rem 0.85rem',
    borderRadius: '999px',
    fontSize: '0.75rem',
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em'
  };

  if (status === 'CURRENT') {
    return {
      ...base,
      background: '#eff6ff',
      color: '#1d4ed8',
      border: '1px solid #dbeafe'
    };
  }
  if (status === 'COMPLETED') {
    return {
      ...base,
      background: '#f0fdf4',
      color: '#15803d',
      border: '1px solid #bbf7d0'
    };
  }
  return {
    ...base,
    background: '#f1f5f9',
    color: '#475569',
    border: '1px solid #e2e8f0'
  };
}

const cardStyle: CSSProperties = {
  background: '#ffffff',
  borderRadius: '1rem',
  border: '1px solid #e2e8f0',
  padding: '1.5rem',
  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
};

const softwareCardStyle: CSSProperties = {
  background: '#ffffff',
  borderRadius: '1rem',
  border: '1px solid #e2e8f0',
  padding: '1.5rem',
  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
  // display: 'flex', 
  // flexDirection: 'column', 
};

const mobileCardStyle: CSSProperties = {
  background: '#f8fafc',
  borderRadius: '0.85rem',
  border: '1px solid #e2e8f0',
  padding: '1rem',
};

const thStyle: CSSProperties = {
  padding: '0.75rem 1rem',
  fontSize: '0.8rem',
  color: '#475569',
  fontWeight: 600,
  borderBottom: '1px solid #e2e8f0',
  textTransform: 'uppercase',
  letterSpacing: '0.05em'
};

const tdStyle: CSSProperties = {
  padding: '0.75rem 1rem',
  fontSize: '0.9rem',
  color: '#1f2937',
};
