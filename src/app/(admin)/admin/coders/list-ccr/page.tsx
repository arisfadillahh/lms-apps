/**
 * List ID Invoice (CCR)
 * Route: /admin/coders/list-ccr
 */

import CCRList from './CCRList';
import PageHead from '@/components/admin/PageHead';

export const dynamic = 'force-dynamic';

export default function ListCCRPage() {
  return (
    <div className="col gap-4">
      <PageHead
        title="Daftar ID Invoice"
        desc="Lihat dan kelola daftar nomor ID Invoice (CCR) yang telah ditetapkan ke coder aktif."
      />
      <CCRList />
    </div>
  );
}
