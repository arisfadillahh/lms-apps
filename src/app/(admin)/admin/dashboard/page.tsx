import type { CSSProperties } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';

import { classesDao, sessionsDao, usersDao, makeUpTasksDao, rubricsDao } from '@/lib/dao';

export default async function AdminDashboardPage() {
  const [classes, coaches, coders, submissions] = await Promise.all([
    classesDao.listClasses(),
    usersDao.listUsersByRole('COACH'),
    usersDao.listUsersByRole('CODER'),
    rubricsDao.listSubmissionsWithReports(10),
  ]);

  const upcomingSessions = (await Promise.all(
    classes.map((klass) => sessionsDao.listSessionsByClass(klass.id)),
  ))
    .flat()
    .filter((session) => new Date(session.date_time) >= new Date())
    .sort((a, b) => new Date(a.date_time).getTime() - new Date(b.date_time).getTime())
    .slice(0, 6);

  // Calculate active coders (enrolled in at least one class)
  const activeCoders = coders.filter(c => c.is_active).length;
  const activeCoaches = coaches.filter(c => c.is_active).length;

  // Pending reports count
  const pendingReports = submissions.filter(s => !s.report?.pdf_url).length;

  return (
    <div style={containerStyle}>
      {/* Welcome Section */}
      <div style={welcomeCardStyle}>
        <div>
          <h1 style={welcomeTitleStyle}>Selamat Datang, Admin! 👋</h1>
          <p style={welcomeSubtitleStyle}>
            Kelola LMS Anda dengan mudah. Berikut ringkasan aktivitas hari ini.
          </p>
        </div>
        <div style={dateBoxStyle}>
          <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Hari ini</span>
          <span style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1e3a5f' }}>
            {format(new Date(), 'EEEE, d MMM yyyy', { locale: id })}
          </span>
        </div>
      </div>

      {/* Stats Grid */}
      <div style={statsGridStyle}>
        <Link href="/admin/classes" style={{ textDecoration: 'none' }}>
          <div style={{ ...statCardStyle, background: '#fef9c3' }}>
            <div style={statIconStyle}>🏫</div>
            <div>
              <p style={statValueStyle}>{classes.length}</p>
              <p style={statLabelStyle}>Total Kelas</p>
            </div>
          </div>
        </Link>

        <Link href="/admin/users" style={{ textDecoration: 'none' }}>
          <div style={{ ...statCardStyle, background: '#fce7f3' }}>
            <div style={statIconStyle}>👨‍🏫</div>
            <div>
              <p style={statValueStyle}>{activeCoaches}</p>
              <p style={statLabelStyle}>Coach Aktif</p>
            </div>
          </div>
        </Link>

        <Link href="/admin/users" style={{ textDecoration: 'none' }}>
          <div style={{ ...statCardStyle, background: '#dbeafe' }}>
            <div style={statIconStyle}>👦</div>
            <div>
              <p style={statValueStyle}>{activeCoders}</p>
              <p style={statLabelStyle}>Coder Aktif</p>
            </div>
          </div>
        </Link>

        <Link href="/admin/reports" style={{ textDecoration: 'none' }}>
          <div style={{ ...statCardStyle, background: pendingReports > 0 ? '#fed7aa' : '#f1f5f9' }}>
            <div style={statIconStyle}>📋</div>
            <div>
              <p style={statValueStyle}>{pendingReports}</p>
              <p style={statLabelStyle}>Rapor Pending</p>
            </div>
          </div>
        </Link>
      </div>

      {/* Main Content Grid */}
      <div style={mainGridStyle}>
        {/* Left Column - Upcoming Sessions */}
        <div style={sectionCardStyle}>
          <div style={sectionHeaderStyle}>
            <h2 style={sectionTitleStyle}>📅 Sesi Mendatang</h2>
            <Link href="/admin/classes" style={viewAllLinkStyle}>Lihat Semua →</Link>
          </div>

          {upcomingSessions.length === 0 ? (
            <div style={emptyStateStyle}>
              <span style={{ fontSize: '2rem' }}>📭</span>
              <p>Belum ada sesi terjadwal</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {upcomingSessions.map((session) => {
                const classData = classes.find((k) => k.id === session.class_id);
                return (
                  <div key={session.id} style={sessionItemStyle}>
                    <div style={sessionDateBoxStyle}>
                      <span style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase' }}>
                        {format(new Date(session.date_time), 'EEE', { locale: id })}
                      </span>
                      <span style={{ fontSize: '1.25rem', fontWeight: 700, color: '#1e3a5f' }}>
                        {format(new Date(session.date_time), 'd')}
                      </span>
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ margin: 0, fontWeight: 600, color: '#1e293b' }}>{classData?.name ?? 'Kelas'}</p>
                      <p style={{ margin: '0.15rem 0 0', fontSize: '0.85rem', color: '#64748b' }}>
                        {format(new Date(session.date_time), 'HH:mm')} WIB
                      </p>
                    </div>
                    <span style={{
                      ...statusBadgeStyle,
                      background: session.status === 'SCHEDULED' ? '#dbeafe' : '#dcfce7',
                      color: session.status === 'SCHEDULED' ? '#1e3a5f' : '#166534',
                    }}>
                      {session.status === 'SCHEDULED' ? 'Terjadwal' : session.status}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column - Quick Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Quick Actions */}
          <div style={sectionCardStyle}>
            <h2 style={sectionTitleStyle}>⚡ Aksi Cepat</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginTop: '1rem' }}>
              <Link href="/admin/users" style={quickActionStyle}>
                <span>👤</span> Tambah User
              </Link>
              <Link href="/admin/classes" style={quickActionStyle}>
                <span>🏫</span> Buat Kelas
              </Link>
              <Link href="/admin/broadcast" style={quickActionStyle}>
                <span>📢</span> Broadcast
              </Link>
              <Link href="/admin/payments" style={quickActionStyle}>
                <span>💳</span> Pembayaran
              </Link>
              <Link href="/admin/reports" style={quickActionStyle}>
                <span>📋</span> Rapor
              </Link>
              <Link href="/admin/whatsapp" style={quickActionStyle}>
                <span>💬</span> WhatsApp
              </Link>
            </div>
          </div>

          {/* Recent Activity */}
          <div style={sectionCardStyle}>
            <h2 style={sectionTitleStyle}>📊 Statistik Rapor</h2>
            <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
              <div style={miniStatStyle}>
                <span style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1e3a5f' }}>{submissions.length}</span>
                <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Total</span>
              </div>
              <div style={miniStatStyle}>
                <span style={{ fontSize: '1.5rem', fontWeight: 700, color: '#16a34a' }}>
                  {submissions.filter(s => s.report?.pdf_url).length}
                </span>
                <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Selesai</span>
              </div>
              <div style={miniStatStyle}>
                <span style={{ fontSize: '1.5rem', fontWeight: 700, color: '#ea580c' }}>{pendingReports}</span>
                <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Pending</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Styles - Modern Design with Navy Blue as Primary
const containerStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '1.5rem',
  paddingBottom: '2rem',
};

const welcomeCardStyle: CSSProperties = {
  background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
  borderRadius: '1.25rem',
  padding: '1.5rem 2rem',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: '1rem',
};

const welcomeTitleStyle: CSSProperties = {
  fontSize: '1.5rem',
  fontWeight: 700,
  color: '#1e3a5f',
  margin: 0,
};

const welcomeSubtitleStyle: CSSProperties = {
  fontSize: '0.95rem',
  color: '#64748b',
  margin: '0.5rem 0 0',
};

const dateBoxStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-end',
};

const statsGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
  gap: '1rem',
};

const statCardStyle: CSSProperties = {
  borderRadius: '1rem',
  padding: '1.25rem',
  display: 'flex',
  alignItems: 'center',
  gap: '1rem',
  cursor: 'pointer',
  transition: 'transform 0.2s, box-shadow 0.2s',
  border: '1px solid transparent',
};

const statIconStyle: CSSProperties = {
  fontSize: '2rem',
};

const statValueStyle: CSSProperties = {
  fontSize: '1.75rem',
  fontWeight: 700,
  color: '#1e3a5f',
  margin: 0,
  lineHeight: 1,
};

const statLabelStyle: CSSProperties = {
  fontSize: '0.85rem',
  color: '#475569',
  margin: '0.25rem 0 0',
  fontWeight: 500,
};

const mainGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1.5fr 1fr',
  gap: '1.5rem',
};

const sectionCardStyle: CSSProperties = {
  background: '#ffffff',
  borderRadius: '1rem',
  padding: '1.5rem',
  border: '1px solid #e2e8f0',
};

const sectionHeaderStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: '1rem',
};

const sectionTitleStyle: CSSProperties = {
  fontSize: '1.05rem',
  fontWeight: 600,
  color: '#1e3a5f',
  margin: 0,
};

const viewAllLinkStyle: CSSProperties = {
  fontSize: '0.85rem',
  color: '#1e3a5f',
  fontWeight: 600,
  textDecoration: 'none',
};

const emptyStateStyle: CSSProperties = {
  padding: '2rem',
  textAlign: 'center',
  color: '#94a3b8',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '0.5rem',
};

const sessionItemStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '1rem',
  padding: '0.75rem',
  background: '#f8fafc',
  borderRadius: '0.75rem',
};

const sessionDateBoxStyle: CSSProperties = {
  width: '48px',
  textAlign: 'center',
  display: 'flex',
  flexDirection: 'column',
};

const statusBadgeStyle: CSSProperties = {
  padding: '0.35rem 0.75rem',
  borderRadius: '999px',
  fontSize: '0.75rem',
  fontWeight: 600,
};

const quickActionStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  padding: '0.85rem',
  background: '#f8fafc',
  borderRadius: '0.75rem',
  color: '#1e3a5f',
  fontWeight: 600,
  fontSize: '0.9rem',
  textDecoration: 'none',
  transition: 'background 0.2s',
};

const miniStatStyle: CSSProperties = {
  flex: 1,
  textAlign: 'center',
  padding: '1rem',
  background: '#f8fafc',
  borderRadius: '0.75rem',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.25rem',
};
