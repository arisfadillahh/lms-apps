import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();

function readSource(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

describe('trial class management contract', () => {
  it('persists the lifecycle, assignment, schedule, reason, and Google Meet metadata', () => {
    const migration = readSource('supabase/migrations/20260729090000_trial_class_management.sql');

    expect(migration).toContain("status text not null default 'PENDING'");
    expect(migration).toContain('coach_id uuid references public.users(id) on delete set null');
    expect(migration).toContain('scheduled_at timestamptz');
    expect(migration).toContain("status in ('PENDING', 'SCHEDULED', 'CANCELLED', 'FAILED')");
    expect(migration).toContain('google_calendar_event_id text');
    expect(migration).toContain('google_meet_url text');
  });

  it('creates or updates Google Meet before saving an online assignment', () => {
    const route = readSource('src/app/api/admin/free-trials/[id]/assign/route.ts');

    expect(route).toContain("await assertRole(session, 'ADMIN')");
    expect(route).toContain("trial.trial_mode === 'ONLINE'");
    expect(route).toContain('await upsertTrialCalendarEvent(');
    expect(route.indexOf('await upsertTrialCalendarEvent(')).toBeLessThan(route.indexOf('await assignTrialClass('));
    expect(route).toContain("coach.role !== 'COACH' || !coach.is_active");
    expect(route).toContain('scheduledAt.getTime() <= Date.now()');
    expect(route).toContain('createTrialCoachAssignmentWebsiteNotification(notificationInput)');
    expect(route.indexOf('await assignTrialClass(')).toBeLessThan(
      route.indexOf('createTrialCoachAssignmentWebsiteNotification(notificationInput)'),
    );
    expect(route).toContain('after(async () =>');
    expect(route).toContain('sendTrialCoachAssignmentWhatsAppNotification(notificationInput)');
    expect(route).toContain('coachPhone: coach.parent_contact_phone');
  });

  it('requests a Google Meet conference and suppresses automatic email invitations', () => {
    const calendar = readSource('src/lib/services/googleTrialCalendar.ts');

    expect(calendar).toContain("conferenceSolutionKey: { type: 'hangoutsMeet' }");
    expect(calendar).toContain('conferenceDataVersion=1&sendUpdates=none');
    expect(calendar).toContain('GOOGLE_CALENDAR_IMPERSONATED_USER');
    expect(calendar).toContain('GOOGLE_CALENDAR_OAUTH_CLIENT_ID');
    expect(calendar).toContain("grant_type: 'refresh_token'");
    expect(calendar).toContain("mode: 0o600");
    expect(calendar).toContain('GOOGLE_USERINFO_URL');
    expect(calendar).toContain('userInfo.email?.toLowerCase() !== config.organizerEmail.toLowerCase()');
    expect(calendar).toContain('deleteTrialCalendarEvent');
  });

  it('protects the OAuth callback with an HttpOnly state cookie', () => {
    const connect = readSource('src/app/api/admin/google-calendar/connect/route.ts');
    const callback = readSource('src/app/api/admin/google-calendar/callback/route.ts');

    expect(connect).toContain('httpOnly: true');
    expect(connect).toContain("sameSite: 'lax'");
    expect(callback).toContain('crypto.timingSafeEqual');
    expect(callback).toContain('exchangeGoogleCalendarAuthorizationCode');
  });

  it('requires a reason for cancelled or failed trials', () => {
    const route = readSource('src/app/api/admin/free-trials/[id]/status/route.ts');

    expect(route).toContain("status: z.enum(['CANCELLED', 'FAILED'])");
    expect(route).toContain("reason: z.string().trim().min(5");
    expect(route).toContain("trial.status !== 'SCHEDULED'");
    expect(route).toContain('setTrialClassTerminalStatus');
  });

  it('removes the email action and exposes assign, cancel, failed, and Meet controls', () => {
    const table = readSource('src/app/(admin)/admin/free-trials/TrialClassTable.tsx');

    expect(table).not.toContain('mailto:');
    expect(table).toContain('Assign trial ke coach');
    expect(table).toContain('Batalkan trial');
    expect(table).toContain('Tandai trial gagal');
    expect(table).toContain('Buka Meet');
    expect(table).toContain('Alasan wajib dicatat');
    expect(table).toContain("item.status === 'SCHEDULED'");
  });

  it('shows only the signed-in coach upcoming scheduled trials on the coach dashboard', () => {
    const dao = readSource('src/lib/dao/trialClassDao.ts');
    const dashboard = readSource('src/app/(coach)/coach/dashboard/page.tsx');
    const schedule = readSource('src/app/(coach)/coach/dashboard/TrialClassSchedule.tsx');

    expect(dao).toContain(".eq('coach_id', coachId)");
    expect(dao).toContain(".eq('status', 'SCHEDULED')");
    expect(dao).toContain(".not('scheduled_at', 'is', null)");
    expect(dao).toContain('endTime >= now.getTime()');
    expect(dashboard).toContain('listUpcomingTrialClassesForCoach(session.user.id)');
    expect(dashboard).toContain("export const dynamic = 'force-dynamic'");
    expect(schedule).toContain('Trial Class Terjadwal');
    expect(schedule).toContain('Masuk Google Meet');
    expect(schedule).toContain('xl:w-auto');
  });
});
