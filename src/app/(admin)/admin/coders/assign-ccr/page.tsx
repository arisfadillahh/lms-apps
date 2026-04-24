/**
 * Assign ID Invoice
 * Route: /admin/coders/assign-ccr
 */

import CCRAssignment from './CCRAssignment';
import PageHead from '@/components/admin/PageHead';

export const dynamic = 'force-dynamic';

export default function AssignCCRPage() {
  return (
    <div className="col gap-4">
      <PageHead
        title="Assign ID Invoice"
        desc="Tetapkan nomor ID Invoice (CCR) untuk coder atau keluarga baru yang mendaftar."
      />
      <CCRAssignment />
    </div>
  );
}
