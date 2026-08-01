import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

describe('class enrollment payment period contract', () => {
  it('syncs every active payment period when a coder enters a new class', () => {
    const source = readSource('src/lib/dao/classesDao.ts');
    const enrollCoderSource = source.slice(
      source.indexOf('export async function enrollCoder'),
      source.indexOf('type ListEnrollmentOptions'),
    );

    expect(enrollCoderSource).toContain(".from('coder_payment_periods')");
    expect(enrollCoderSource).toContain('if (input.syncActivePaymentPeriod)');
    expect(enrollCoderSource).toContain('.update({ class_id: input.classId })');
    expect(enrollCoderSource).toContain(".eq('coder_id', input.coderId)");
    expect(enrollCoderSource).toContain(".eq('status', 'ACTIVE')");
    expect(enrollCoderSource).not.toContain(".is('class_id', null)");
  });

  it('uses the shared enrollment path from the invoice assignment modal API', () => {
    const source = readSource('src/app/api/admin/classes/[id]/enrollments/route.ts');

    expect(source).toContain('classesDao.enrollCoder({');
    expect(source).toContain('syncActivePaymentPeriod: true');
    expect(source).not.toContain(".is('class_id', null)");
  });

  it('syncs weekly class moves without attaching Ekskul enrollment to LMS billing', () => {
    const source = readSource('src/app/api/admin/classes/[id]/enroll/route.ts');
    const weeklyBranch = source.slice(
      source.indexOf("if (klass.type === 'WEEKLY')"),
      source.indexOf('} else {'),
    );
    const nonWeeklyBranch = source.slice(
      source.indexOf('} else {'),
      source.indexOf('export async function DELETE'),
    );

    expect(weeklyBranch).toContain('syncActivePaymentPeriod: true');
    expect(nonWeeklyBranch).not.toContain('syncActivePaymentPeriod: true');
  });
});
