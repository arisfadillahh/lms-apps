import { Image as ImageIcon, PanelsTopLeft } from 'lucide-react';

import PageHead from '@/components/admin/PageHead';
import DeletePortfolioDialog from '@/components/portfolio/DeletePortfolioDialog';
import { getSessionOrThrow } from '@/lib/auth';
import { assertRole } from '@/lib/roles';
import { getSupabaseAdmin } from '@/lib/supabaseServer';

export const dynamic = 'force-dynamic';

export default async function AdminPortfoliosPage() {
  const session = await getSessionOrThrow();
  await assertRole(session, 'ADMIN');
  const { data, error } = await (getSupabaseAdmin() as any)
    .from('coder_portfolios')
    .select('id, title, summary, status, program_type, updated_at, users!coder_portfolios_coder_id_fkey(full_name), classes(name), coder_portfolio_screenshots(public_url, sort_order)')
    .order('updated_at', { ascending: false })
    .limit(500);
  if (error) throw new Error(`Gagal memuat portofolio: ${error.message}`);

  return (
    <div className="admin-page-stack">
      <PageHead title="Portofolio Coder" desc="Moderasi seluruh karya. Penghapusan hanya tersedia dengan konfirmasi judul persis dan tidak dapat dipulihkan." />
      {(data ?? []).length === 0 ? <div className="card" style={{ padding: 40, textAlign: 'center' }}><PanelsTopLeft size={42} style={{ margin: '0 auto 12px', color: '#94a3b8' }} /><strong>Belum ada portofolio.</strong></div> : <div className="grid gap-4 lg:grid-cols-2">
        {(data ?? []).map((portfolio: any) => {
          const coder = Array.isArray(portfolio.users) ? portfolio.users[0] : portfolio.users;
          const selectedClass = Array.isArray(portfolio.classes) ? portfolio.classes[0] : portfolio.classes;
          const screenshots = [...(portfolio.coder_portfolio_screenshots ?? [])].sort((a: any, b: any) => a.sort_order - b.sort_order);
          return <article key={portfolio.id} className="grid overflow-hidden rounded-2xl border border-slate-200 bg-white sm:grid-cols-[150px_1fr]">
            <div className="flex aspect-video items-center justify-center bg-slate-100 sm:aspect-auto">{screenshots[0] ? <img src={screenshots[0].public_url} alt={`Cover ${portfolio.title}`} className="h-full w-full object-cover" /> : <ImageIcon className="text-slate-300" />}</div>
            <div className="p-5"><div className="flex flex-wrap gap-2"><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-black">{portfolio.status}</span><span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-black text-clevio-navy">{portfolio.program_type}</span></div><h2 className="mt-3 text-lg font-black text-clevio-navy">{portfolio.title}</h2><p className="mt-1 text-sm font-semibold text-slate-500">{coder?.full_name || 'Coder'} · {selectedClass?.name || 'Kelas lama'}</p><p className="mt-2 line-clamp-2 text-sm text-slate-500">{portfolio.summary}</p><div className="mt-4"><DeletePortfolioDialog id={portfolio.id} title={portfolio.title} returnPath="/admin/portfolios" /></div></div>
          </article>;
        })}
      </div>}
    </div>
  );
}
