import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

describe('coach rubric attendance gate contract', () => {
  it('keeps incomplete-attendance lessons in the journey with an explicit gate', () => {
    const source = readSource('src/lib/services/coach.ts');
    const pendingEvaluationSource = source.slice(
      source.indexOf('export type PendingEvaluationLesson'),
      source.indexOf('export async function getDraftReportsForCoach'),
    );

    expect(pendingEvaluationSource).toContain('missingAttendanceCount: number');
    expect(pendingEvaluationSource).toContain('canEvaluate: boolean');
    expect(pendingEvaluationSource).toContain('attendanceDao.listAttendanceForSessions(');
    expect(pendingEvaluationSource).toContain('filterActiveEnrollmentsForSession(activeEnrollments, session.date_time)');
    expect(pendingEvaluationSource).toContain('canEvaluate: missingAttendanceCount === 0');
    expect(pendingEvaluationSource).not.toContain(
      "klass.type === 'EKSKUL' &&\n        !relevantEnrollments.every",
    );
  });

  it('shows a red alert and disables Beri Nilai until attendance is complete', () => {
    const source = readSource('src/app/(coach)/coach/rubrics/RubricPageClient.tsx');

    expect(source).toContain('role="alert"');
    expect(source).toContain(
      'Lengkapi presensi {item.missingAttendanceCount} siswa dulu sebelum memberi nilai.',
    );
    expect(source).toContain('disabled={!item.canEvaluate || isLoading}');
    expect(source).toContain("'Presensi Belum Lengkap'");
  });
});
