import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');

describe('class meeting link contract', () => {
  it('uses the scheduled session snapshot and never sends a placeholder to Coder', () => {
    const dashboard = read('src/app/(coder)/coder/dashboard/page.tsx');

    expect(dashboard).toContain("select('date_time, status, zoom_link_snapshot')");
    expect(dashboard).toContain('normalizeClassMeetingUrl(sess.zoom_link_snapshot) ?? zoomLink');
    expect(dashboard).toContain("'Link belum diatur'");
  });

  it('lets Admin update the class and only active or future scheduled snapshots', () => {
    const route = read('src/app/api/admin/classes/[id]/route.ts');

    expect(route).toContain("await assertRole(session, 'ADMIN')");
    expect(route).toContain(".update({ zoom_link: zoomLink })");
    expect(route).toContain(".update({ zoom_link_snapshot: zoomLink })");
    expect(route).toContain(".eq('status', 'SCHEDULED')");
    expect(route).toContain(".gt('date_time', activeWindowStart)");
  });

  it('shows a responsive class-link editor on the Admin class detail', () => {
    const page = read('src/app/(admin)/admin/classes/[id]/page.tsx');
    const modal = read('src/app/(admin)/admin/classes/[id]/EditClassLinkModal.tsx');

    expect(page).toContain('<EditClassLinkModal');
    expect(page).toContain('Ruang kelas online');
    expect(modal).toContain("width: 'min(520px, 100%)'");
    expect(modal).toContain("maxHeight: 'calc(100svh - 24px)'");
  });
});
