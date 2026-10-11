import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function readSource(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

describe('lesson report Admin workflow', () => {
  it('opens every report card in a dedicated detail page', () => {
    const board = readSource('src/app/(admin)/admin/curriculum/reports/KanbanBoard.tsx');
    const detail = readSource('src/app/(admin)/admin/curriculum/reports/[id]/page.tsx');

    expect(board).toContain('/admin/curriculum/reports/${report.id}');
    expect(detail).toContain('<LessonReportEditor');
    expect(detail).toContain('Buka editor lesson');
  });

  it('allows Admin to edit report fields without losing the Ekskul lesson marker', () => {
    const editor = readSource('src/app/(admin)/admin/curriculum/reports/[id]/LessonReportEditor.tsx');
    const api = readSource('src/app/api/admin/lesson-reports/[id]/route.ts');

    expect(editor).toContain('reportType, description: description.trim(), status');
    expect(api).toContain('EKSKUL_LESSON_MARKER');
    expect(api).toContain('updates.description = `${marker}${parsed.data.description}`');
  });

  it('keeps Coach report fields readable inside PWA theme overrides', () => {
    const form = readSource('src/app/(coach)/coach/lesson/[id]/ReportLessonButton.tsx');

    expect(form).toContain("WebkitTextFillColor: '#0f172a'");
    expect(form).toContain('placeholder:text-slate-500');
    expect(form).toContain('max-h-[calc(100dvh-2rem)]');
  });
});

describe('Coach attendance start-time guard', () => {
  it('enforces the same start-time check in UI, attendance API, and completion API', () => {
    const page = readSource('src/app/(coach)/coach/sessions/[sessionId]/attendance/page.tsx');
    const list = readSource('src/app/(coach)/coach/sessions/[sessionId]/attendance/AttendanceList.tsx');
    const attendanceApi = readSource('src/app/api/coach/attendance/route.ts');
    const statusApi = readSource('src/app/api/coach/sessions/[id]/status/route.ts');

    expect(page).toContain('canMarkAttendance={canMarkAttendance}');
    expect(list).toContain('disabled={!canEdit}');
    expect(attendanceApi).toContain('if (!hasSessionStarted(sessionRecord.date_time))');
    expect(statusApi).toContain("parsed.data.status === 'COMPLETED'");
    expect(statusApi).toContain('hasSessionStarted(sessionRecord.date_time)');
  });
});
