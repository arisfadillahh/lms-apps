import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');

describe('Coder migration progress override', () => {
  const route = read('src/app/api/admin/coders/[id]/progress/route.ts');
  const dialog = read('src/app/(admin)/admin/users/ProgressOverrideButton.tsx');
  const coderService = read('src/lib/services/coder.ts');

  it('writes to the authoritative personal journey and never the legacy completion table', () => {
    expect(route).toContain(".from('coder_block_progress')");
    expect(route).not.toContain('coder_block_completions');
    expect(route).toContain('ensureJourneyForCoder');
  });

  it('scopes migration to an active Weekly enrollment and validates level block ownership', () => {
    expect(route).toContain(".eq('status', 'ACTIVE')");
    expect(route).toContain("row.classes?.type === 'WEEKLY'");
    expect(route).toContain('validBlockIds.has(blockId)');
    expect(route).toContain("canAccessMenu(session.user.username, session.user.adminPermissions ?? null, 'users')");
  });

  it('only adds completed blocks and preserves level progression reconciliation', () => {
    expect(route).toContain("row.status !== 'COMPLETED'");
    expect(route).toContain("status: 'COMPLETED'");
    expect(route).toContain('reconcileCompletedLevelsForClass');
    expect(dialog).toContain('if (alreadyCompleted.has(blockId)) return');
    expect(dialog).toContain('Progress yang sudah selesai tidak dapat dibatalkan');
  });

  it('keeps migrated materials visible after source enrollment completion without exposing future lessons', () => {
    expect(coderService).toContain('listClassesForCoder(coderId, { includeInactive: true })');
    expect(coderService).toContain('isCompletedBlock ||');
    expect(coderService).toContain('(hasActiveEnrollment && (isCatchUpInEntryBlock || isCompletedSinceEnrollment))');
    expect(coderService).toContain('(!hasActiveEnrollment || (!isCurrentScheduleBlock && !isEntryBlock))');
  });
});

describe('Admin users table responsive UX', () => {
  const table = read('src/app/(admin)/admin/users/UsersTable.tsx');
  const css = read('src/app/globals.css');

  it('provides mobile labels and keeps the action menu directly reachable', () => {
    expect(table).toContain('className="table users-table"');
    expect(table).toContain('data-label="Kontak orang tua"');
    expect(table).toContain('className="users-actions-cell"');
    expect(css).toContain(".users-table tbody td::before");
    expect(css).toContain(".users-table .users-actions-cell");
  });

  it('keeps every user action in one consistent full-width menu row', () => {
    expect(table).toContain('className="admin-action-list"');
    expect(table).toContain('className="admin-action-item"');
    expect(css).toContain('.admin-action-item > button');
    expect(css).toContain('min-width: 172px');
    expect(css).toContain('white-space: nowrap');
  });
});
