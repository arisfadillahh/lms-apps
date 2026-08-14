import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();

function readSource(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

describe('admin notification push contract', () => {
  it('persists the website notification before best-effort PWA delivery', () => {
    const dao = readSource('src/lib/dao/notificationsDao.ts');
    const insertIndex = dao.indexOf("supabase.from('notifications' as any).insert");
    const pushIndex = dao.indexOf('await sendAdminPushBestEffort(adminIds, input)');

    expect(insertIndex).toBeGreaterThan(-1);
    expect(pushIndex).toBeGreaterThan(insertIndex);
    expect(dao).toContain(".eq('role', 'ADMIN')");
    expect(dao).toContain(".eq('is_active', true)");
    expect(dao).toContain('await sendAdminPushBestEffort([userId], { title, message, type, ...delivery });');
    expect(dao).toContain("console.error('[Notifications] Admin push delivery failed'");
  });

  it('routes every admin operational alert through the shared fan-out', () => {
    const issueRoute = readSource('src/app/api/issue-reports/route.ts');
    const lessonReportRoute = readSource('src/app/api/coach/lesson-reports/route.ts');
    const extension = readSource('src/lib/services/lessonExtension.ts');
    const whatsapp = readSource('src/lib/services/whatsappClient.ts');
    const freeTrial = readSource('src/app/api/free-trial/route.ts');
    const trialAssessment = readSource('src/app/api/coach/trials/[id]/assessment/route.ts');
    const coachLeave = readSource('src/app/api/coach/leave/route.ts');
    const coachReport = readSource('src/app/api/coach/reports/[id]/publish/route.ts');

    expect(issueRoute).toContain("pushUrl: '/admin/issue-reports'");
    expect(lessonReportRoute).toContain("pushUrl: '/admin/curriculum/reports'");
    expect(extension).toContain('await createAdminNotifications({');
    expect(whatsapp).toContain("pushUrl: '/admin/whatsapp'");
    expect(freeTrial).toContain("pushUrl: '/admin/free-trials'");
    expect(trialAssessment).toContain("pushUrl: '/admin/trial-assessments'");
    expect(coachLeave).toContain("pushUrl: '/admin/leave'");
    expect(coachReport).toContain("pushUrl: '/admin/reports'");
  });

  it('does not retain parallel explicit push calls that would duplicate alerts', () => {
    const extension = readSource('src/lib/services/lessonExtension.ts');
    const whatsapp = readSource('src/lib/services/whatsappClient.ts');

    expect(extension).not.toContain('sendPushToUsers');
    expect(whatsapp).not.toContain('sendPushToUsers');
  });
});
