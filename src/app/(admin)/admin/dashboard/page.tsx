import type { ReactNode } from 'react';
import Link from 'next/link';
import { addDays, format, isSameDay, isWithinInterval } from 'date-fns';
import { id } from 'date-fns/locale';
import {
  Calendar,
  Check,
  ChevronRight,
  FileText,
  GraduationCap,
  MessageCircle,
  Plus,
  Users,
  X,
} from 'lucide-react';

import { classLessonsDao, classesDao, coachLeaveDao, sessionsDao, usersDao } from '@/lib/dao';
import { getSupabaseAdmin } from '@/lib/supabaseServer';
import { getWhatsAppSession, listInvoices } from '@/lib/dao/invoicesDao';
import { resolvePitchingDayDate } from '@/lib/services/pitchingDay';

type DashboardReportRelation<T> = T | T[] | null;

type DashboardReportInboxRow = {
  id: string;
  status: string;
  updated_at: string | null;
  class: DashboardReportRelation<{ name: string | null; type: string | null }>;
  block: DashboardReportRelation<{ name: string | null }>;
  coder: DashboardReportRelation<{ full_name: string | null }>;
};

function getRelation<T>(relation: DashboardReportRelation<T>): T | undefined {
  if (Array.isArray(relation)) return relation[0];
  return relation ?? undefined;
}

export const dynamic = 'force-dynamic';

function levelTagClass(levelId: string | null, type: string) {
  if (type === 'EKSKUL' || !levelId) return 'tag-ekskul';
  if (levelId.toLowerCase().includes('explorer')) return 'tag-explorer';
  if (levelId.toLowerCase().includes('creator')) return 'tag-creator';
  return 'tag-innovator';
}

function levelLabel(levelName: string | null, type: string) {
  if (type === 'EKSKUL' || !levelName) return 'Ekskul';
  return levelName;
}

function statusBadge(status: string) {
  switch (status) {
    case 'COMPLETED':
      return { className: 'badge-neutral', label: 'Selesai' };
    case 'LIVE':
      return { className: 'badge-success', label: 'Live sekarang' };
    case 'CANCELLED':
      return { className: 'badge-danger', label: 'Dibatalkan' };
    default:
      return { className: 'badge-info', label: 'Terjadwal' };
  }
}

function PageHead({
  title,
  desc,
  actions,
}: {
  title: string;
  desc: string;
  actions?: ReactNode;
}) {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        <p>{desc}</p>
      </div>
      {actions ? <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>{actions}</div> : null}
    </div>
  );
}

function Stat({
  label,
  value,
  icon,
  trend,
  trendType,
  accent,
  footnote,
}: {
  label: string;
  value: string | number;
  icon: ReactNode;
  trend?: string;
  trendType?: 'up' | 'down' | 'flat';
  accent?: { bg: string; fg: string };
  footnote?: ReactNode;
}) {
  return (
    <div className="stat">
      <div className="stat-icon" style={accent ? { background: accent.bg, color: accent.fg } : undefined}>
        {icon}
      </div>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {trend ? (
        <div className="stat-foot">
          <span
            className={`badge ${
              trendType === 'up' ? 'badge-success' : trendType === 'down' ? 'badge-danger' : 'badge-neutral'
            }`}
          >
            {trendType === 'up' ? '↑' : trendType === 'down' ? '↓' : '·'} {trend}
          </span>
          <span className="muted" style={{ fontSize: 11 }}>
            vs minggu lalu
          </span>
        </div>
      ) : footnote ? (
        <div className="stat-foot">{footnote}</div>
      ) : null}
    </div>
  );
}

export default async function AdminDashboardPage() {
  const supabase = getSupabaseAdmin();
  const now = new Date();
  const tomorrow = addDays(now, 1);
  const thisWeekEnd = addDays(now, 14);
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrowStart = addDays(todayStart, 1);

  const [
    classes,
    coaches,
    coders,
    reportResult,
    leaveRequests,
    invoiceResult,
    { data: enrollmentsRaw },
    whatsappSession,
    { data: whatsappLogsRaw },
    levels,
  ] = await Promise.all([
    classesDao.listClasses(),
    usersDao.listUsersByRole('COACH'),
    usersDao.listUsersByRole('CODER'),
    supabase
      .from('block_reports')
      .select(
        `
        id,
        status,
        updated_at,
        class:classes(name, type),
        block:blocks(name),
        coder:users!block_reports_coder_id_fkey(full_name)
      `,
      )
      .neq('status', 'DRAFT')
      .order('updated_at', { ascending: false })
      .limit(200),
    coachLeaveDao.listLeaveRequestsWithCoach(),
    listInvoices({ page: 1, limit: 10 }),
    supabase.from('enrollments').select('class_id').eq('status', 'ACTIVE'),
    getWhatsAppSession(process.env.WHATSAPP_CLIENT_ID || 'clevio-wa-client'),
    supabase
      .from('whatsapp_message_logs')
      .select('status, created_at')
      .gte('created_at', todayStart.toISOString())
      .lt('created_at', tomorrowStart.toISOString()),
    (await import('@/lib/dao')).levelsDao.listLevels(),
  ]);

  if (reportResult.error) {
    console.error('[AdminDashboardPage] Failed to fetch submitted reports:', reportResult.error);
  }

  const coachMap = new Map(coaches.map((coach) => [coach.id, coach.full_name]));
  const levelMap = new Map(levels.map((level) => [level.id, level.name]));
  const enrollmentCountMap = ((enrollmentsRaw ?? []) as Array<{ class_id: string }>).reduce<Record<string, number>>(
    (accumulator, item) => {
      accumulator[item.class_id] = (accumulator[item.class_id] ?? 0) + 1;
      return accumulator;
    },
    {},
  );

  const allSessions = (
    await Promise.all(
      classes.map(async (klass) => {
        const sessionRows = await sessionsDao.listSessionsByClass(klass.id);
        return sessionRows.map((session) => ({
          ...session,
          className: klass.name,
          classType: klass.type,
          classLevelId: klass.level_id,
          classLevelName: klass.level_id ? (levelMap.get(klass.level_id) ?? klass.level_id) : '',
          coachName: coachMap.get(klass.coach_id) ?? 'Coach',
        }));
      }),
    )
  )
    .flat()
    .sort((left, right) => new Date(left.date_time).getTime() - new Date(right.date_time).getTime());

  const todaySessions = allSessions.filter((session) => isSameDay(new Date(session.date_time), now));
  const tomorrowSessions = allSessions.filter((session) => isSameDay(new Date(session.date_time), tomorrow));
  const sessionDateById = new Map(allSessions.map((session) => [session.id, session.date_time]));

  const blockRows = (
    await Promise.all(
      classes.map(async (klass) => {
        const blocks = await classesDao.getClassBlocks(klass.id);
        const rows = await Promise.all(
          blocks.map(async (block) => {
            const lessons = await classLessonsDao.listLessonsByClassBlock(block.id);
            const sessionDates = lessons
              .map((lesson) => (lesson.session_id ? sessionDateById.get(lesson.session_id) ?? null : null))
              .filter((value): value is string => value !== null);
            const pitchingDayDate = resolvePitchingDayDate(sessionDates, block.pitching_day_date);

            if (!pitchingDayDate) {
              return null;
            }

            return {
              classId: klass.id,
              className: klass.name,
              blockName: block.block_name ?? 'Pitching Day',
              pitchingDayDate,
              students: enrollmentCountMap[klass.id] ?? 0,
            };
          }),
        );

        return rows.filter((row): row is NonNullable<typeof row> => row !== null);
      }),
    )
  )
    .flat()
    .filter((block) =>
      isWithinInterval(new Date(block.pitchingDayDate), {
        start: now,
        end: thisWeekEnd,
      }),
    )
    .sort((left, right) => new Date(left.pitchingDayDate).getTime() - new Date(right.pitchingDayDate).getTime())
    .slice(0, 4);

  const activeClasses = classes.filter((klass) => klass.end_date >= format(now, 'yyyy-MM-dd')).length;
  const activeCoaches = coaches.filter((coach) => coach.is_active).length;
  const activeCoders = coders.filter((coder) => coder.is_active).length;
  const submittedReports = ((reportResult.data ?? []) as DashboardReportInboxRow[]).filter((report) => report.status === 'SUBMITTED');
  const reportInbox = submittedReports.slice(0, 3);
  const pendingReports = submittedReports.length;
  const pendingLeaves = leaveRequests.filter((request) => request.status === 'PENDING').length;
  const pendingInvoices = invoiceResult.invoices.filter((invoice) => invoice.status === 'PENDING' || invoice.status === 'OVERDUE');
  const overdueInvoices = pendingInvoices.filter((invoice) => invoice.status === 'OVERDUE');
  const whatsappTodayLogs = (whatsappLogsRaw ?? []) as Array<{ status: 'QUEUED' | 'SENT' | 'FAILED'; created_at: string }>;
  const whatsappSentToday = whatsappTodayLogs.filter((row) => row.status === 'SENT').length;
  const whatsappFailedToday = whatsappTodayLogs.filter((row) => row.status === 'FAILED').length;

  const whatsappConnected = Boolean((whatsappSession as { is_connected?: boolean } | null)?.is_connected);
  const todayLabel = format(now, "EEEE, d MMMM yyyy", { locale: id });

  return (
    <div>
      <PageHead
        title="Selamat datang di Admin Clevio"
        desc={`${todayLabel}. ${activeClasses} kelas aktif berjalan, ${pendingReports} rapor menunggu review, dan ${pendingInvoices.length} invoice masih perlu dipantau.`}
        actions={
          <>
            <Link href="/admin/classes" className="btn">
              <Calendar size={16} />
              Buka Kalender
            </Link>
            <Link href="/admin/classes" className="btn btn-primary">
              <Plus size={16} />
              Buat Kelas
            </Link>
          </>
        }
      />

      <div className="hero-banner" style={{ marginBottom: 22 }}>
        <div className="hero-accent" aria-hidden="true" />
        <div className="hero-inner">
          <div className="hero-text">
            <div className="hero-eyebrow">
              <span className="hero-eyebrow-dot" />
              Fokus hari ini
            </div>
            <h2 className="hero-headline">
              <span className="hero-num">{todaySessions.length}</span> sesi hari ini
              <span className="hero-sep">·</span>
              <span className="hero-num">{pendingReports}</span> rapor menunggu review
            </h2>
            <div className="hero-sub">
              {pendingInvoices.length > 0
                ? `${pendingInvoices.length} invoice masih pending, termasuk ${overdueInvoices.length} yang sudah overdue.`
                : 'Tidak ada invoice yang tertunggak saat ini.'}
            </div>
          </div>

          <div className="hero-actions">
            <Link href="/admin/reports" className="btn hero-btn hero-btn-ghost">
              <FileText size={16} />
              Review Rapor
              <span className="hero-btn-badge">{pendingReports}</span>
            </Link>
            <Link href="/admin/classes" className="btn hero-btn hero-btn-solid">
              Lihat Jadwal
              <ChevronRight size={16} />
            </Link>
          </div>
        </div>
      </div>

      <div className="grid grid-4" style={{ marginBottom: 22 }}>
        <Stat
          label="Kelas Aktif"
          value={activeClasses}
          icon={<GraduationCap size={16} />}
          trend="+2"
          trendType="up"
          accent={{ bg: 'var(--accent-weak)', fg: 'var(--accent)' }}
        />
        <Stat
          label="Coach Aktif"
          value={activeCoaches}
          icon={<Check size={16} />}
          trend="stabil"
          trendType="flat"
        />
        <Stat
          label="Coder Aktif"
          value={activeCoders}
          icon={<Users size={16} />}
          trend="+3"
          trendType="up"
        />
        <Stat
          label="Rapor Review"
          value={pendingReports}
          icon={<FileText size={16} />}
          trend={pendingReports > 2 ? 'perlu aksi' : 'normal'}
          trendType={pendingReports > 2 ? 'down' : 'flat'}
        />
      </div>

      <div className="grid grid-dash">
        <div className="col" style={{ gap: 16 }}>
          <div className="card card-p">
            <div className="row between" style={{ marginBottom: 14 }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: 15 }}>Sesi hari ini & besok</div>
                <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
                  Jadwal live dan terdekat berdasarkan data kelas aktif
                </div>
              </div>
              <Link href="/admin/classes" className="btn btn-sm">
                Kalender lengkap
                <ChevronRight size={14} />
              </Link>
            </div>

            <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--text-dim)', fontWeight: 700, marginBottom: 8 }}>
              Hari ini
            </div>
            <div className="col" style={{ gap: 8, marginBottom: 14 }}>
              {todaySessions.length === 0 ? (
                <div className="empty" style={{ padding: 24 }}>Belum ada sesi terjadwal hari ini.</div>
              ) : (
                todaySessions.map((session) => {
                  const badge = statusBadge(session.status);
                  return (
                    <div key={session.id} className="session">
                      <div className="session-date">
                        <span className="d">{format(new Date(session.date_time), 'HH')}</span>
                        <span className="m">{format(new Date(session.date_time), 'HH:mm')}</span>
                      </div>
                      <div className="flex1" style={{ minWidth: 0 }}>
                        <div className="row" style={{ gap: 8, marginBottom: 3, flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 700, fontSize: 13.5 }} className="truncate">
                            {session.className}
                          </span>
                          <span className={`chip ${levelTagClass(session.classLevelId, session.classType)}`} style={{ fontSize: 10 }}>
                            {levelLabel(session.classLevelName, session.classType)}
                          </span>
                        </div>
                        <div className="muted" style={{ fontSize: 12 }}>
                          {session.coachName} · {session.zoom_link_snapshot ? 'Online Zoom' : 'Onsite / manual'}
                        </div>
                      </div>
                      <span className={`badge ${badge.className}`}>
                        {badge.label}
                      </span>
                    </div>
                  );
                })
              )}
            </div>

            <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--text-dim)', fontWeight: 700, marginBottom: 8 }}>
              Besok
            </div>
            <div className="col" style={{ gap: 8 }}>
              {tomorrowSessions.length === 0 ? (
                <div className="empty" style={{ padding: 24 }}>Belum ada sesi terjadwal besok.</div>
              ) : (
                tomorrowSessions.map((session) => (
                  <div key={session.id} className="session">
                    <div className="session-date">
                      <span className="d">{format(new Date(session.date_time), 'HH')}</span>
                      <span className="m">{format(new Date(session.date_time), 'HH:mm')}</span>
                    </div>
                    <div className="flex1" style={{ minWidth: 0 }}>
                      <div className="row" style={{ gap: 8, marginBottom: 3, flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 700, fontSize: 13.5 }} className="truncate">
                          {session.className}
                        </span>
                        <span className={`chip ${levelTagClass(session.classLevelId, session.classType)}`} style={{ fontSize: 10 }}>
                          {levelLabel(session.classLevelName, session.classType)}
                        </span>
                      </div>
                      <div className="muted" style={{ fontSize: 12 }}>
                        {session.coachName} · {session.zoom_link_snapshot ? 'Online Zoom' : 'Onsite / manual'}
                      </div>
                    </div>
                    <span className="badge badge-info">Terjadwal</span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="card card-p">
            <div className="row between" style={{ marginBottom: 14 }}>
              <div style={{ fontWeight: 800, fontSize: 15 }}>Pitching Day mendatang</div>
              <span className="chip">{blockRows.length} event 2 minggu ke depan</span>
            </div>
            <table className="table">
              <thead>
                <tr>
                  <th>Tanggal</th>
                  <th>Kelas</th>
                  <th>Block</th>
                  <th>Siswa</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {blockRows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="empty">
                      Belum ada pitching day terjadwal dalam 2 minggu ke depan.
                    </td>
                  </tr>
                ) : (
                  blockRows.map((block) => (
                    <tr key={`${block.classId}-${block.pitchingDayDate}`}>
                      <td style={{ fontWeight: 700 }}>{format(new Date(block.pitchingDayDate), 'EEE, d MMM', { locale: id })}</td>
                      <td>{block.className}</td>
                      <td className="muted">{block.blockName}</td>
                      <td>{block.students}</td>
                      <td style={{ textAlign: 'right' }}>
                        <Link href="/admin/reports" className="btn btn-sm">
                          Siapkan
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="col" style={{ gap: 16 }}>
          <div className="card card-p" style={{ borderColor: pendingReports > 0 ? '#f5d2fb' : 'var(--border)' }}>
            <div className="row between" style={{ marginBottom: 12, gap: 8 }}>
              <div style={{ fontWeight: 800, fontSize: 14 }}>Rapor perlu review</div>
              <span className="badge badge-info">{pendingReports} rapor</span>
            </div>
            <div className="col" style={{ gap: 8 }}>
              {reportInbox.length === 0 ? (
                <div className="empty" style={{ padding: 16 }}>Tidak ada rapor yang menunggu review.</div>
              ) : (
                reportInbox.map((row) => {
                  const coder = getRelation(row.coder);
                  const klass = getRelation(row.class);
                  const block = getRelation(row.block);
                  const coderName = coder?.full_name ?? 'Coder';

                  return (
                    <div key={row.id} className="row" style={{ gap: 12, padding: 10, borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                      <div className="avatar">{coderName.slice(0, 2).toUpperCase()}</div>
                      <div className="flex1" style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 13 }} className="truncate">
                          {coderName}
                        </div>
                        <div className="muted" style={{ fontSize: 11.5 }}>
                          {block?.name ?? 'Rapor terbaru'}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: 800, fontSize: 12.5 }}>{klass?.name ?? 'Kelas'}</div>
                        <div className="muted" style={{ fontSize: 10.5 }}>
                          {row.updated_at ? format(new Date(row.updated_at), 'd MMM · HH:mm', { locale: id }) : '-'}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            <Link href="/admin/reports" className="btn btn-primary" style={{ width: '100%', marginTop: 10 }}>
              Buka semua rapor
              <ChevronRight size={14} />
            </Link>
          </div>

          <div className="card card-p">
            <div className="row between" style={{ marginBottom: 12 }}>
              <div style={{ fontWeight: 800, fontSize: 14 }}>Pembayaran</div>
              <span className={`badge ${overdueInvoices.length > 0 ? 'badge-danger' : 'badge-neutral'}`}>
                {overdueInvoices.length} overdue
              </span>
            </div>
            <div className="col" style={{ gap: 8 }}>
              {pendingInvoices.slice(0, 3).map((invoice) => (
                <div key={invoice.id} className="row" style={{ gap: 12, padding: 10, borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                  <div className="avatar">INV</div>
                  <div className="flex1" style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 13 }} className="truncate">
                      {invoice.parent_name}
                    </div>
                    <div className="muted" style={{ fontSize: 11 }}>
                      {invoice.invoice_number} · jatuh tempo {format(new Date(invoice.due_date), 'd MMM yyyy', { locale: id })}
                    </div>
                  </div>
                  <span className={`badge ${invoice.status === 'OVERDUE' ? 'badge-danger' : 'badge-warn'}`}>
                    {invoice.status === 'OVERDUE' ? 'Overdue' : 'Pending'}
                  </span>
                </div>
              ))}
            </div>
            <Link href="/admin/payments/invoices" className="btn" style={{ width: '100%', marginTop: 10 }}>
              Buka invoice
              <ChevronRight size={14} />
            </Link>
          </div>

          <div className="card card-p">
            <div className="row between" style={{ marginBottom: 12 }}>
              <div style={{ fontWeight: 800, fontSize: 14 }}>Izin Coach</div>
              <span className={`badge ${pendingLeaves > 0 ? 'badge-warn' : 'badge-neutral'}`}>
                {pendingLeaves} menunggu
              </span>
            </div>
            {leaveRequests.filter((request) => request.status === 'PENDING').slice(0, 2).map((request) => (
              <div key={request.id} style={{ padding: 10, borderRadius: 'var(--radius)', background: 'var(--surface-2)', marginBottom: 8 }}>
                <div className="row" style={{ gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                  <div className="avatar" style={{ width: 22, height: 22, fontSize: 10 }}>
                    {request.coach?.full_name.slice(0, 2).toUpperCase() ?? 'CH'}
                  </div>
                  <span style={{ fontWeight: 700, fontSize: 12.5 }}>{request.coach?.full_name ?? 'Coach'}</span>
                  <span className="chip" style={{ fontSize: 10 }}>
                    {request.session?.date_time
                      ? format(new Date(request.session.date_time), 'd MMM', { locale: id })
                      : 'Jadwal TBD'}
                  </span>
                </div>
                <div className="muted" style={{ fontSize: 11.5, marginBottom: 6 }}>
                  {request.note || 'Izin mengajar'} · pengganti:{' '}
                  {request.substitute?.full_name ?? 'belum ditentukan'}
                </div>
                <div className="row" style={{ gap: 8 }}>
                  <Link href="/admin/leave" className="btn btn-sm btn-primary" style={{ flex: 1 }}>
                    <Check size={14} />
                    Tinjau
                  </Link>
                  <Link href="/admin/leave" className="btn btn-sm" style={{ flex: 1 }}>
                    <X size={14} />
                    Buka
                  </Link>
                </div>
              </div>
            ))}
            <Link href="/admin/leave" className="btn btn-ghost btn-sm" style={{ width: '100%' }}>
              Lihat semua
              <ChevronRight size={14} />
            </Link>
          </div>

          <div className="card card-p">
            <div className="row between" style={{ marginBottom: 12 }}>
              <div style={{ fontWeight: 800, fontSize: 14 }}>WhatsApp Server</div>
              <span className="row" style={{ gap: 8 }}>
                {whatsappConnected ? <span className="pulse" /> : null}
                <span className={`badge ${whatsappConnected ? 'badge-success' : 'badge-neutral'}`}>
                  {whatsappConnected ? 'Terhubung' : 'Belum terhubung'}
                </span>
              </span>
            </div>
            <div className="row" style={{ gap: 12, marginBottom: 8 }}>
              <div style={{ flex: 1 }}>
                <div className="muted" style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em' }}>
                  Terkirim Hari Ini
                </div>
                <div style={{ fontWeight: 800, fontSize: 18 }}>
                  {whatsappSentToday}{' '}
                  <span className="muted" style={{ fontSize: 12, fontWeight: 500 }}>
                    pesan sukses
                  </span>
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <div className="muted" style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em' }}>
                  Gagal Hari Ini
                </div>
                <div style={{ fontWeight: 800, fontSize: 18, color: whatsappFailedToday > 0 ? '#ef4444' : 'var(--text)' }}>
                  {whatsappFailedToday}
                </div>
              </div>
            </div>
            <Link href="/admin/whatsapp" className="btn btn-sm" style={{ width: '100%' }}>
              <MessageCircle size={14} />
              Monitor
              <ChevronRight size={14} />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
