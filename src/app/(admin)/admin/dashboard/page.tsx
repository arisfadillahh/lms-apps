import type { CSSProperties } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { ChevronRight, Users, GraduationCap, BookOpen, Calendar, FileText, Wallet, MessageCircle } from 'lucide-react';

import { classesDao, sessionsDao, usersDao, rubricsDao } from '@/lib/dao';

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
    .slice(0, 5);

  const activeCoders = coders.filter(c => c.is_active).length;
  const activeCoaches = coaches.filter(c => c.is_active).length;
  const pendingReports = submissions.filter(s => !s.report?.pdf_url).length;
  const todayDate = format(new Date(), 'EEEE, d MMMM yyyy', { locale: id });

  return (
    <div style={containerStyle}>
      {/* Responsive CSS for mobile dashboard */}
      <style>{`
        @media (max-width: 1024px) {
          .admin-dashboard-grid {
            grid-template-columns: 1fr !important;
          }
          .admin-stats-grid {
            grid-template-columns: repeat(2, 1fr) !important;
          }
        }
        @media (max-width: 768px) {
          .admin-stats-grid {
            grid-template-columns: 1fr 1fr !important;
            gap: 0.75rem !important;
          }
        }
        @media (max-width: 480px) {
          .admin-stats-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>

      {/* Main Grid */}
      <div className="admin-dashboard-grid" style={mainGridStyle}>
        {/* Left Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

          {/* Welcome Banner */}
          <div style={welcomeBannerStyle}>
            <div style={{ position: 'relative', zIndex: 1 }}>
              <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.8)', marginBottom: '0.25rem' }}>
                {todayDate}
              </p>
              <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: '#fff', margin: '0 0 0.5rem 0' }}>
                Dashboard Admin 👋
              </h1>
              <p style={{ fontSize: '0.95rem', color: 'rgba(255,255,255,0.85)', margin: 0 }}>
                Kelola LMS dengan mudah. Semua data tersedia di sini.
              </p>
            </div>
            <div style={{ position: 'absolute', right: '2rem', bottom: '-0.5rem', fontSize: '5rem', opacity: 0.2 }}>
              🎓
            </div>
          </div>

          {/* Stats Grid */}
          <div className="admin-stats-grid" style={statsGridStyle}>
            <Link href="/admin/classes" style={{ textDecoration: 'none' }}>
              <div style={{ ...statCardStyle, background: '#fef9c3' }}>
                <div style={statIconStyle}>
                  <GraduationCap size={24} color="#ca8a04" />
                </div>
                <div>
                  <p style={statValueStyle}>{classes.length}</p>
                  <p style={statLabelStyle}>Total Kelas</p>
                </div>
              </div>
            </Link>

            <Link href="/admin/users" style={{ textDecoration: 'none' }}>
              <div style={{ ...statCardStyle, background: '#dbeafe' }}>
                <div style={statIconStyle}>
                  <Users size={24} color="#2563eb" />
                </div>
                <div>
                  <p style={statValueStyle}>{activeCoaches}</p>
                  <p style={statLabelStyle}>Coach Aktif</p>
                </div>
              </div>
            </Link>

            <Link href="/admin/users" style={{ textDecoration: 'none' }}>
              <div style={{ ...statCardStyle, background: '#dcfce7' }}>
                <div style={statIconStyle}>
                  <Users size={24} color="#16a34a" />
                </div>
                <div>
                  <p style={statValueStyle}>{activeCoders}</p>
                  <p style={statLabelStyle}>Coder Aktif</p>
                </div>
              </div>
            </Link>

            <Link href="/admin/reports" style={{ textDecoration: 'none' }}>
              <div style={{ ...statCardStyle, background: pendingReports > 0 ? '#fce7f3' : '#f1f5f9' }}>
                <div style={statIconStyle}>
                  <FileText size={24} color={pendingReports > 0 ? '#db2777' : '#64748b'} />
                </div>
                <div>
                  <p style={statValueStyle}>{pendingReports}</p>
                  <p style={statLabelStyle}>Rapor Pending</p>
                </div>
              </div>
            </Link>
          </div>

          {/* Upcoming Sessions */}
          <div style={sectionCardStyle}>
            <div style={sectionHeaderStyle}>
              <h2 style={sectionTitleStyle}>📅 Sesi Mendatang</h2>
              <Link href="/admin/classes" style={viewAllStyle}>Lihat Semua →</Link>
            </div>

            {upcomingSessions.length === 0 ? (
              <div style={emptyStyle}>
                <p>Belum ada sesi terjadwal</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {upcomingSessions.map((session) => {
                  const classData = classes.find((k) => k.id === session.class_id);
                  return (
                    <div key={session.id} style={sessionItemStyle}>
                      <div style={sessionDateStyle}>
                        <span style={{ fontSize: '0.65rem', color: '#64748b', textTransform: 'uppercase' }}>
                          {format(new Date(session.date_time), 'EEE', { locale: id })}
                        </span>
                        <span style={{ fontSize: '1.25rem', fontWeight: 700, color: '#1e293b' }}>
                          {format(new Date(session.date_time), 'd')}
                        </span>
                      </div>
                      <div style={{ flex: 1 }}>
                        <p style={{ margin: 0, fontWeight: 600, color: '#1e293b', fontSize: '0.9rem' }}>{classData?.name ?? 'Kelas'}</p>
                        <p style={{ margin: '0.1rem 0 0', fontSize: '0.8rem', color: '#64748b' }}>
                          {format(new Date(session.date_time), 'HH:mm')} WIB
                        </p>
                      </div>
                      <span style={{
                        ...statusBadgeStyle,
                        background: session.status === 'SCHEDULED' ? '#dbeafe' : '#dcfce7',
                        color: session.status === 'SCHEDULED' ? '#1d4ed8' : '#166534',
                      }}>
                        {session.status === 'SCHEDULED' ? 'Terjadwal' : session.status}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Column - Sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

          {/* Quick Actions */}
          <div style={sideCardStyle}>
            <h3 style={sideCardTitleStyle}>⚡ Aksi Cepat</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1rem' }}>
              <Link href="/admin/users" style={quickActionStyle}>
                <Users size={16} /> Tambah User
                <ChevronRight size={14} style={{ marginLeft: 'auto' }} />
              </Link>
              <Link href="/admin/classes" style={quickActionStyle}>
                <GraduationCap size={16} /> Buat Kelas
                <ChevronRight size={14} style={{ marginLeft: 'auto' }} />
              </Link>
              <Link href="/admin/broadcast" style={quickActionStyle}>
                <MessageCircle size={16} /> Kirim Broadcast
                <ChevronRight size={14} style={{ marginLeft: 'auto' }} />
              </Link>
              <Link href="/admin/payments" style={quickActionStyle}>
                <Wallet size={16} /> Kelola Pembayaran
                <ChevronRight size={14} style={{ marginLeft: 'auto' }} />
              </Link>
            </div>
          </div>

          {/* Report Stats */}
          <div style={sideCardStyle}>
            <h3 style={sideCardTitleStyle}>📊 Statistik Rapor</h3>
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
              <div style={miniStatStyle}>
                <span style={{ fontSize: '1.5rem', fontWeight: 700, color: '#3b82f6' }}>{submissions.length}</span>
                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Total</span>
              </div>
              <div style={miniStatStyle}>
                <span style={{ fontSize: '1.5rem', fontWeight: 700, color: '#10b981' }}>
                  {submissions.filter(s => s.report?.pdf_url).length}
                </span>
                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Selesai</span>
              </div>
              <div style={miniStatStyle}>
                <span style={{ fontSize: '1.5rem', fontWeight: 700, color: '#f59e0b' }}>{pendingReports}</span>
                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Pending</span>
              </div>
            </div>
          </div>

          {/* System Status */}
          <div style={sideCardStyle}>
            <h3 style={sideCardTitleStyle}>🔔 WhatsApp</h3>
            <div style={{ marginTop: '0.75rem' }}>
              <Link href="/admin/whatsapp" style={quickActionStyle}>
                <MessageCircle size={16} /> Monitor Status
                <ChevronRight size={14} style={{ marginLeft: 'auto' }} />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Styles
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
  minHeight: '130px',
};

const statsGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(4, 1fr)',
  gap: '1rem',
};

const statCardStyle: CSSProperties = {
  borderRadius: '16px',
  padding: '1.25rem',
  display: 'flex',
  alignItems: 'center',
  gap: '1rem',
  transition: 'transform 0.2s',
};

const statIconStyle: CSSProperties = {
  width: '48px',
  height: '48px',
  borderRadius: '12px',
  background: 'rgba(255,255,255,0.7)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const statValueStyle: CSSProperties = {
  fontSize: '1.5rem',
  fontWeight: 700,
  color: '#1e293b',
  margin: 0,
  lineHeight: 1.2,
};

const statLabelStyle: CSSProperties = {
  fontSize: '0.8rem',
  color: '#475569',
  margin: '0.15rem 0 0',
  fontWeight: 500,
};

const sectionCardStyle: CSSProperties = {
  background: '#fff',
  borderRadius: '16px',
  padding: '1.5rem',
  boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
  border: '1px solid #f1f5f9',
};

const sectionHeaderStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: '1rem',
};

const sectionTitleStyle: CSSProperties = {
  fontSize: '1rem',
  fontWeight: 700,
  color: '#1e293b',
  margin: 0,
};

const viewAllStyle: CSSProperties = {
  fontSize: '0.8rem',
  color: '#3b82f6',
  fontWeight: 600,
  textDecoration: 'none',
};

const emptyStyle: CSSProperties = {
  padding: '2rem',
  textAlign: 'center',
  color: '#94a3b8',
};

const sessionItemStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '1rem',
  padding: '0.75rem',
  background: '#f8fafc',
  borderRadius: '12px',
};

const sessionDateStyle: CSSProperties = {
  width: '45px',
  textAlign: 'center',
  display: 'flex',
  flexDirection: 'column',
};

const statusBadgeStyle: CSSProperties = {
  padding: '0.3rem 0.7rem',
  borderRadius: '999px',
  fontSize: '0.7rem',
  fontWeight: 600,
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

const quickActionStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.6rem',
  padding: '0.7rem 0.85rem',
  background: '#f8fafc',
  borderRadius: '10px',
  color: '#475569',
  fontSize: '0.85rem',
  fontWeight: 500,
  textDecoration: 'none',
  transition: 'background 0.2s',
};

const miniStatStyle: CSSProperties = {
  flex: 1,
  textAlign: 'center',
  padding: '0.85rem',
  background: '#f8fafc',
  borderRadius: '12px',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.2rem',
};
