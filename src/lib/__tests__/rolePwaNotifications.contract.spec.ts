import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');

describe('role PWA notification contract', () => {
  it('shows the install and notification invitation only on phone layouts', () => {
    const card = read('src/components/pwa/MobilePwaOnboardingCard.tsx');
    const coderDashboard = read('src/app/(coder)/coder/dashboard/page.tsx');
    const coachDashboard = read('src/app/(coach)/coach/dashboard/page.tsx');

    expect(card).toContain("window.matchMedia('(max-width: 767px)')");
    expect(card).toContain("window.matchMedia('(pointer: coarse)')");
    expect(card).toContain("window.matchMedia('(display-mode: standalone)')");
    expect(card).toContain("Notification.requestPermission()");
    expect(card).toContain('Add to Home Screen');
    expect(card).toContain('H-1 dan satu jam sebelum mulai');
    expect(coderDashboard).toContain('<MobilePwaOnboardingCard role="CODER" />');
    expect(coachDashboard).toContain('<MobilePwaOnboardingCard role="COACH" />');
  });

  it('persists actionable notification metadata and exposes a bell deep link', () => {
    const dao = read('src/lib/dao/notificationsDao.ts');
    const dropdown = read('src/components/layout/NotificationDropdown.tsx');
    const migration = read('supabase/migrations/20260824150000_role_notification_metadata.sql');

    expect(dao).toContain('action_url: normalizeActionUrl');
    expect(dao).toContain("category: delivery.category || 'SYSTEM'");
    expect(dropdown).toContain('notif.action_url?.startsWith');
    expect(dropdown).toContain('Buka detail');
    expect(migration).toContain('notifications_action_url_internal_check');
    expect(migration).toContain('notifications_priority_check');
  });

  it('deduplicates Coder H-1 and one-hour reminders', () => {
    const reminders = read('src/lib/services/roleSessionReminders.ts');
    const scheduler = read('src/lib/services/classReminderScheduler.ts');

    expect(reminders).toContain('sendOneHourSessionReminders');
    expect(reminders).toContain('sendCoderDayBeforeReminders');
    expect(reminders).toContain('hasNotificationByDedupeKey');
    expect(reminders).toContain('session-${scheduled.id}-coder-1h');
    expect(reminders).toContain('coder-classes-${dateKey}-h1');
    expect(scheduler).toContain('await sendOneHourSessionReminders(now)');
    expect(scheduler).toContain('await sendCoderDayBeforeReminders');
  });

  it('routes key Coach and Coder events to actionable push notifications', () => {
    const trial = read('src/lib/services/trialClassNotifications.ts');
    const schedule = read('src/app/api/admin/classes/[id]/schedule/route.ts');
    const makeup = read('src/app/api/coach/makeup/[id]/review/route.ts');
    const portfolio = read('src/app/api/coach/portfolios/[id]/review/route.ts');
    const report = read('src/app/api/admin/reports/[id]/send-whatsapp/route.ts');

    for (const source of [trial, schedule, makeup, portfolio, report]) {
      expect(source).toContain('push: true');
      expect(source).toContain('actionUrl:');
    }
  });
});
