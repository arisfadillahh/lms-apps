import Link from 'next/link';
import { ArrowRight, Clock3, Edit3, FolderPlus, Image as ImageIcon, PanelsTopLeft, ShieldCheck } from 'lucide-react';

import { getSessionOrThrow } from '@/lib/auth';
import { getCoderPortfolioWorkspace } from '@/lib/coderPortfolioServer';
import DeletePortfolioDialog from '@/components/portfolio/DeletePortfolioDialog';
import PortfolioShareCard from '@/components/portfolio/PortfolioShareCard';
import PortfolioTabs from '@/components/portfolio/PortfolioTabs';

const statusStyle: Record<string, { label: string; className: string }> = {
  DRAFT: { label: 'Draft', className: 'bg-slate-100 text-slate-600' },
  SUBMITTED: { label: 'Menunggu Coach', className: 'bg-sky-100 text-sky-700' },
  REVISION: { label: 'Perlu Revisi', className: 'bg-amber-100 text-amber-700' },
  APPROVED: { label: 'Sudah Tayang', className: 'bg-emerald-100 text-emerald-700' },
};

export default async function CoderPortfolioPage() {
  const session = await getSessionOrThrow();
  const workspace = await getCoderPortfolioWorkspace(session.user.id);

  return (
    <main className="flex-1 space-y-7 overflow-y-auto p-5 sm:p-8">
      <header className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="mb-2 text-xs font-black uppercase tracking-[0.2em] text-clevio-green">Karya Coder</p>
          <h1 className="flex items-center gap-3 text-3xl font-black tracking-tight text-clevio-navy"><PanelsTopLeft size={30} /> Rapor & Portofolio</h1>
          <p className="mt-2 max-w-2xl text-sm font-semibold text-slate-500">Simpan proses belajarmu, kirim ke Coach, lalu bagikan karya yang sudah disetujui.</p>
        </div>
        {workspace.classes.length > 0 && <Link href="/coder/reports/portfolio/new" className="inline-flex items-center justify-center gap-2 rounded-2xl bg-clevio-green px-5 py-3 font-black text-clevio-navy shadow-lg transition hover:-translate-y-0.5"><FolderPlus size={20} /> Buat Portofolio</Link>}
      </header>
      <PortfolioTabs active="portfolio" />

      <PortfolioShareCard slug={workspace.profile.public_slug} schoolVisible={workspace.profile.school_visible} hasSchool={Boolean(workspace.user.school_name)} />

      {workspace.classes.length === 0 ? (
        <section className="rounded-[2rem] border-4 border-dashed border-pastel-blue bg-white p-10 text-center">
          <ShieldCheck className="mx-auto text-sky" size={42} />
          <h2 className="mt-4 text-xl font-black text-clevio-navy">Belum ada kelas yang bisa dipilih</h2>
          <p className="mt-2 text-sm font-semibold text-slate-500">Portofolio dapat dibuat setelah kamu terdaftar di kelas Weekly atau Ekskul.</p>
        </section>
      ) : workspace.portfolios.length === 0 ? (
        <section className="rounded-[2rem] border-4 border-dashed border-pastel-green bg-white p-10 text-center">
          <PanelsTopLeft className="mx-auto text-clevio-green" size={44} />
          <h2 className="mt-4 text-2xl font-black text-clevio-navy">Karya pertamamu menunggu</h2>
          <p className="mx-auto mt-2 max-w-md text-sm font-semibold text-slate-500">Mulai dari project yang paling kamu banggakan. Kamu tetap bisa menyimpannya sebagai draft.</p>
          <Link href="/coder/reports/portfolio/new" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-clevio-navy px-5 py-3 font-black text-white">Isi Portofolio <ArrowRight size={18} /></Link>
        </section>
      ) : (
        <section>
          <div className="mb-4 flex items-center justify-between"><h2 className="text-xl font-black text-clevio-navy">Semua Project</h2><span className="text-sm font-bold text-slate-400">{workspace.portfolios.length} karya</span></div>
          <div className="grid gap-5 xl:grid-cols-2">
            {workspace.portfolios.map((portfolio: any) => {
              const screenshots = [...(portfolio.coder_portfolio_screenshots ?? [])].sort((a: any, b: any) => a.sort_order - b.sort_order);
              const status = statusStyle[portfolio.status] || statusStyle.DRAFT;
              return (
                <article key={portfolio.id} className="overflow-hidden rounded-[2rem] border-2 border-slate-100 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
                  <div className="grid sm:grid-cols-[190px_1fr]">
                    <div className="flex aspect-video items-center justify-center bg-slate-100 sm:aspect-auto sm:min-h-52">
                      {screenshots[0] ? <img src={screenshots[0].public_url} alt={`Cover ${portfolio.title}`} className="h-full w-full object-cover" /> : <ImageIcon className="text-slate-300" size={38} />}
                    </div>
                    <div className="flex min-w-0 flex-col p-5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full px-3 py-1 text-xs font-black ${portfolio.program_type === 'WEEKLY' ? 'bg-blue-100 text-clevio-navy' : 'bg-purple-100 text-clevio-purple'}`}>{portfolio.program_type === 'WEEKLY' ? 'Weekly' : 'Ekskul'}</span>
                        <span className={`rounded-full px-3 py-1 text-xs font-black ${status.className}`}>{status.label}</span>
                      </div>
                      <h3 className="mt-3 truncate text-xl font-black text-clevio-navy">{portfolio.title}</h3>
                      <p className="mt-1 line-clamp-2 text-sm font-semibold text-slate-500">{portfolio.summary}</p>
                      {portfolio.review_note && <p className="mt-3 rounded-xl bg-amber-50 p-3 text-xs font-bold text-amber-700">Coach: {portfolio.review_note}</p>}
                      <div className="mt-auto flex flex-wrap items-center gap-2 pt-5">
                        <Link href={`/coder/reports/portfolio/${portfolio.id}/edit`} className="inline-flex items-center gap-2 rounded-xl bg-clevio-navy px-3 py-2 text-sm font-black text-white"><Edit3 size={16} /> Edit</Link>
                        <DeletePortfolioDialog id={portfolio.id} title={portfolio.title} />
                        <span className="ml-auto inline-flex items-center gap-1 text-xs font-bold text-slate-400"><Clock3 size={14} /> {new Date(portfolio.updated_at).toLocaleDateString('id-ID')}</span>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}
    </main>
  );
}
