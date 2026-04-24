import Link from 'next/link';
import { Package, Plus, Pencil, ExternalLink } from 'lucide-react';
import { softwareDao } from '@/lib/dao';
import PageHead from '@/components/admin/PageHead';

export default async function SoftwareListPage() {
  const softwareList = await softwareDao.listAllSoftware();

  return (
    <div className="col gap-4">
      <PageHead
        title="Software Inventory"
        desc="Catat software yang dipakai di kurikulum beserta versi, akses, dan distribusinya."
        actions={
          <Link href="/admin/software/new" className="btn btn-primary">
            <Plus size={16} /> Tambah Software
          </Link>
        }
      />

      {/* Software Grid - matches design reference: grid-3 with card card-p row between */}
      {softwareList.length === 0 ? (
        <div className="empty">Belum ada software terdaftar.</div>
      ) : (
        <div className="grid grid-3">
          {softwareList.map((software) => (
            <div key={software.id} className="card card-p row between">
              <div className="row gap-3">
                <div style={{
                  width: 48, height: 48, borderRadius: 'var(--radius)',
                  background: 'var(--surface-2)', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', flexShrink: 0,
                }}>
                  {software.icon_url ? (
                    <img src={software.icon_url} alt={software.name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'var(--radius)' }} />
                  ) : (
                    <Package size={22} style={{ color: 'var(--text-muted)' }} />
                  )}
                </div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 14.5 }}>{software.name}</div>
                  <div className="muted" style={{ fontSize: 12 }}>
                    {software.version ? `v${software.version}` : 'Tanpa versi'}
                  </div>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="muted" style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 700 }}>Aksi</div>
                <div className="row gap-1" style={{ justifyContent: 'flex-end', marginTop: 4 }}>
                  {software.installation_url && (
                    <a href={software.installation_url} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-ghost">
                      <ExternalLink size={14} />
                    </a>
                  )}
                  <Link href={`/admin/software/${software.id}`} className="btn btn-sm">
                    <Pencil size={14} />
                    Edit
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
