import { CalendarCheck, CalendarClock, CalendarSync, CircleX, Users } from 'lucide-react';

import PageHead from '@/components/admin/PageHead';
import { Button } from '@/components/ui/button';
import { listTrialClassSubmissions } from '@/lib/dao/trialClassDao';
import { listUsersByRole } from '@/lib/dao/usersDao';
import { deriveTrialOutcome } from '@/lib/services/trialLifecycle';
import {
  getGoogleCalendarOAuthConnectionInfo,
  isGoogleTrialCalendarConfigured,
} from '@/lib/services/googleTrialCalendar';

import TrialClassTable from './TrialClassTable';

export const dynamic = 'force-dynamic';

function jakartaDateKey(value: Date | string) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date(value));
}

function Stat({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div className="stat">
      <div className="stat-icon">{icon}</div>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
    </div>
  );
}

export default async function AdminFreeTrialsPage() {
  const [submissions, coachUsers] = await Promise.all([
    listTrialClassSubmissions(),
    listUsersByRole('COACH'),
  ]);
  const coaches = coachUsers
    .filter((coach) => coach.is_active)
    .map((coach) => ({ id: coach.id, name: coach.full_name }));
  const today = jakartaDateKey(new Date());
  const todayCount = submissions.filter((item) => jakartaDateKey(item.created_at) === today).length;
  const pendingCount = submissions.filter((item) => item.status === 'PENDING').length;
  const scheduledCount = submissions.filter((item) => item.status === 'SCHEDULED').length;
  const stoppedCount = submissions.filter((item) => item.status === 'CANCELLED' || item.status === 'FAILED').length;
  const outcomeCounts = submissions.reduce(
    (counts, item) => {
      const assessment = Array.isArray(item.trial_assessments)
        ? item.trial_assessments[0]
        : item.trial_assessments;
      const outcome = deriveTrialOutcome({
        scheduleStatus: item.status,
        assessmentStatus: assessment?.status,
        invoiceStatus: assessment?.invoice?.status,
      });
      counts[outcome] += 1;
      return counts;
    },
    {
      NOT_YET_TRIAL: 0,
      COMPLETED_NOT_REGISTERED: 0,
      COMPLETED_REGISTERED: 0,
      NOT_PROCEEDING: 0,
    } as Record<'NOT_YET_TRIAL' | 'COMPLETED_NOT_REGISTERED' | 'COMPLETED_REGISTERED' | 'NOT_PROCEEDING', number>,
  );
  const googleCalendarConfigured = isGoogleTrialCalendarConfigured();
  const googleOAuth = getGoogleCalendarOAuthConnectionInfo();

  return (
    <div className="admin-page-stack">
      <PageHead
        title="Free Trial"
        desc="Data orang tua yang mendaftarkan anak untuk trial class gratis melalui form publik."
      />

      {!googleCalendarConfigured ? (
        <div className="flex flex-col gap-3 rounded-md border border-amber-200 bg-amber-50 p-4 text-amber-950 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <CalendarSync className="mt-0.5 size-5 shrink-0 text-amber-700" />
            <div>
              <strong className="text-sm">Google Calendar belum terhubung</strong>
              <p className="mt-1 text-sm text-amber-800">
                Hubungkan {googleOAuth.organizerEmail || 'akun organizer'} agar trial online otomatis mendapatkan link Google Meet.
              </p>
            </div>
          </div>
          {googleOAuth.available ? (
            <Button asChild size="sm"><a href="/api/admin/google-calendar/connect">Hubungkan Google Calendar</a></Button>
          ) : null}
        </div>
      ) : null}

      <div className="grid grid-4" style={{ marginBottom: 18 }}>
        <Stat label={`Total Pendaftar (+${todayCount} hari ini)`} value={submissions.length} icon={<Users size={16} />} />
        <Stat label="Menunggu Assign" value={pendingCount} icon={<CalendarClock size={16} />} />
        <Stat label="Terjadwal" value={scheduledCount} icon={<CalendarCheck size={16} />} />
        <Stat label="Tidak Dilanjutkan" value={stoppedCount} icon={<CircleX size={16} />} />
      </div>

      <div className="grid grid-4" style={{ marginBottom: 18 }}>
        <Stat label="Belum Trial" value={outcomeCounts.NOT_YET_TRIAL} icon={<CalendarClock size={16} />} />
        <Stat label="Trial Selesai, Belum Daftar" value={outcomeCounts.COMPLETED_NOT_REGISTERED} icon={<Users size={16} />} />
        <Stat label="Trial Selesai, Sudah Daftar" value={outcomeCounts.COMPLETED_REGISTERED} icon={<CalendarCheck size={16} />} />
        <Stat label="Tidak Jadi Sebelum Trial" value={outcomeCounts.NOT_PROCEEDING} icon={<CircleX size={16} />} />
      </div>

      <TrialClassTable
        submissions={submissions}
        coaches={coaches}
        googleCalendarConfigured={googleCalendarConfigured}
      />
    </div>
  );
}
