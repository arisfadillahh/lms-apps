import { describe, expect, it } from 'vitest';
import { linkLegacyIdentities, type LegacyIdentityLink } from '@/lib/payroll/legacyIdentity';
import { createPeriod } from '@/lib/payroll/model';
import { mergeLegacySnapshots, type LegacyPayrollSnapshot } from '@/lib/payroll/legacyImport';
import { attendancePeriodView } from '@/lib/payroll/attendanceView';
import { coachPeriodView } from '@/lib/payroll/coachView';

const confirmed = { confirmed_at: '2026-11-05T10:00:00Z', reason: 'User confirmed exact identities' };
const links: Record<string, LegacyIdentityLink> = {
  old: { ...confirmed, status: 'LINKED', profile_id: 'p', user_id: 'u', kind: 'COACH', name: 'Example Coach' },
  current: { ...confirmed, status: 'LINKED', profile_id: 'p', user_id: 'u', kind: 'COACH', name: 'Example Coach' },
  staff: { ...confirmed, status: 'LINKED', profile_id: 'staff', user_id: null, kind: 'STAFF', name: 'Example Staff' },
  skipped: { ...confirmed, status: 'IGNORED' },
};
const snapshot = { sourceId: 'file', period: '2026-11', checksum: 'a'.repeat(64), total: 225000, rows: Object.keys(links).map(sourceId => ({ sourceId, name: sourceId, total: 225000, counters: [{ label: 'Trial', value: 1 }], fees: [{ label: 'Fee', value: 225000 }] })) } as LegacyPayrollSnapshot;
const original = () => ({ ...createPeriod(2026, 11), legacy_imports: [snapshot], pic_id: 'pic' });
describe('confirmed legacy identity linking', () => {
  it('supports two historical identities for one coach and staff without accounts, keeping archives unchanged', () => {
    const before = original(), after = linkLegacyIdentities(before, links);
    expect(after.legacy_links).toEqual(links); expect(after.legacy_imports).toEqual(before.legacy_imports);
    expect(after.slips).toEqual([]); expect(after.activities).toEqual([]); expect(after.transfers).toEqual([]); expect(after.deliveries).toEqual({}); expect(after.pic_id).toBe('pic');
    expect(before).not.toHaveProperty('legacy_links');
    expect(linkLegacyIdentities(after, links)).toEqual(after);
    expect(mergeLegacySnapshots(after, [{ ...snapshot, checksum: 'b'.repeat(64) }]).legacy_links).toEqual(links);
  });
  it('fails closed for incomplete or conflicting mappings', () => {
    expect(() => linkLegacyIdentities(original(), {})).toThrow(/belum dikonfirmasi/);
    const after = linkLegacyIdentities(original(), links);
    expect(() => linkLegacyIdentities(after, { ...links, old: { ...links.old, status: 'IGNORED' } })).toThrow(/penerima lain/);
    expect(() => linkLegacyIdentities(original(), { ...links, staff: { ...confirmed, status: 'LINKED', profile_id: 'p', user_id: 'u', kind: 'STAFF', name: 'Wrong' } })).toThrow(/tidak valid/);
  });
  it('keeps linked financial source metadata out of operational and coach projections', () => {
    const period = linkLegacyIdentities(original(), links);
    expect(JSON.stringify(attendancePeriodView({ id: period.id, revision: 1, document: period }))).not.toMatch(/legacy_links|225000|Example Staff/);
    expect(coachPeriodView(period, 'u')).toBeNull();
  });
});
