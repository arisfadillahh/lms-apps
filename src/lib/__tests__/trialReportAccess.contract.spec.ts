import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();

describe('trial report preview access contract', () => {
  it('returns the LMS not-found boundary for anonymous or non-admin previews', () => {
    const source = fs.readFileSync(
      path.join(root, 'src/app/trial-report/[token]/page.tsx'),
      'utf8',
    );

    expect(source).toContain("import { getServerAuthSession } from '@/lib/auth';");
    expect(source).toContain("if (!session || session.user.role !== 'ADMIN') notFound();");
    expect(source).not.toContain('getSessionOrThrow');
    expect(source.indexOf("if (isAdminPreview)")).toBeLessThan(
      source.indexOf('getAssessmentByPublicToken(token)'),
    );
  });
});
