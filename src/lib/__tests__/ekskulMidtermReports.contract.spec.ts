import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');

describe('Ekskul midterm report cycle', () => {
  const migration = read('supabase/migrations/20260918090000_ekskul_midterm_report_cycles.sql');
  const service = read('src/lib/services/aiReports.ts');
  const reportsDao = read('src/lib/dao/reportsDao.ts');
  const route = read('src/app/api/admin/classes/[id]/ekskul-midterm-reports/route.ts');
  const adminClassPage = read('src/app/(admin)/admin/classes/[id]/page.tsx');
  const coachPublishRoute = read('src/app/api/coach/reports/[id]/publish/route.ts');
  const deleteRoute = read('src/app/api/coach/reports/[id]/route.ts');
  const publicReportPage = read('src/app/report/[id]/page.tsx');
  const reportStory = read('src/app/report/[id]/ReportStoryExperience.tsx');

  it('stores a separate, one-time midterm cycle without mutating automatic reports', () => {
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS public.ekskul_report_cycles');
    expect(migration).toContain("report_type = 'MIDTERM'");
    expect(migration).toContain('UNIQUE(class_id, report_type)');
    expect(migration).toContain("report_period_type IN ('BLOCK', 'EKSKUL_MIDTERM')");
    expect(migration).toContain('ALTER COLUMN block_id DROP NOT NULL');
  });

  it('only permits Admin to initiate an Ekskul cycle and only includes completed lessons through the cutoff', () => {
    expect(route).toContain("assertRole(session, 'ADMIN')");
    expect(route).toContain("klass.type !== 'EKSKUL'");
    expect(service).toContain("session.status === 'COMPLETED'");
    expect(service).toContain('new Date(session.date_time).getTime() <= cutoff.getTime()');
    expect(reportsDao).toContain("report_period_type: 'EKSKUL_MIDTERM'");
  });

  it('returns before AI generation and safely resumes an existing partial cycle', () => {
    expect(route).toContain('after(async () =>');
    expect(route).toContain('status: 202');
    expect(service).toContain('existingCycle?.cutoff_at');
    expect(service).toContain('getEkskulMidtermReport(cycle.id, coderId)');
    expect(service).toContain("report.status !== 'DRAFT'");
    expect(reportsDao).toContain('getEkskulMidtermReport');
  });

  it('reuses the review pipeline without requiring a block reflection or deleting source evaluations', () => {
    expect(coachPublishRoute).toContain("report.report_period_type === 'EKSKUL_MIDTERM'");
    expect(coachPublishRoute).toContain('!isEkskulMidterm && !reflection');
    expect(deleteRoute).toContain("report.report_period_type === 'EKSKUL_MIDTERM' || !report.block_id");
    expect(adminClassPage).toContain('PublishEkskulMidtermReportButton');
  });

  it('shows completed Ekskul lessons and omits coder reflection from Ekskul reports', () => {
    expect(publicReportPage).toContain("session.status === 'COMPLETED'");
    expect(publicReportPage).toContain("klass?.level_id || klass?.ekskul_lesson_plan_id");
    expect(publicReportPage).toContain('klass.level_id ?? null');
    expect(publicReportPage).toContain("supabase.from('ekskul_report_cycles').select('cutoff_at')");
    expect(publicReportPage).toContain('computeLessonSchedule(report.class_id');
    expect(publicReportPage).toContain('reflections={isEkskulReport ? [] : reportReflections}');
    expect(publicReportPage).toContain('!isEkskulReport && reportReflections.length > 0');
    expect(reportStory).toContain("SCENES.filter((scene) => scene.id !== 'reflection')");
    expect(reportStory).toContain('splitRadarLabel(item.name)');
    expect(reportStory).toContain("props.isEkskul ? 'lesson sudah' : 'materi berhasil'");
  });
});
