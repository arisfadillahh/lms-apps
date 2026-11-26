import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(path, 'utf8');

describe('class closure interface', () => {
  it('keeps the action separate from navigation, and the dialog outside the dropdown', () => {
    const list = read('src/app/(admin)/admin/classes/ClassListClient.tsx');
    expect(list).toContain("position: 'absolute', inset: 0, zIndex: 1");
    expect(list).toContain("style={{ position: 'relative', zIndex: 2 }}");
    expect(list.indexOf('<CloseClassDialog')).toBeGreaterThan(list.indexOf('</ActionDropdown>'));
  });

  it('shows the impact before enabling confirmation and forwards the displayed name', () => {
    const dialog = read('src/app/(admin)/admin/classes/CloseClassDialog.tsx');
    expect(dialog).toContain('.showModal()');
    expect(dialog).toContain('Tinjau di');
    expect(dialog).toContain('preview.pendingPlacements');
    expect(dialog).toContain('body: JSON.stringify({ confirmationName: preview.className })');
    const api = read('src/app/api/admin/classes/[id]/route.ts');
    expect(api).toContain("session.user.role !== 'ADMIN'");
    expect(api).toContain('closeAndArchiveClass(id, session.user.id, confirmationName)');
  });
});
