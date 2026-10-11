import { notFound } from 'next/navigation';

import PortfolioForm from '@/components/portfolio/PortfolioForm';
import { getSessionOrThrow } from '@/lib/auth';
import { getCoderPortfolioWorkspace } from '@/lib/coderPortfolioServer';

export default async function EditCoderPortfolioPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionOrThrow();
  const { id } = await params;
  const workspace = await getCoderPortfolioWorkspace(session.user.id);
  const portfolio = workspace.portfolios.find((item: any) => item.id === id);
  if (!portfolio) notFound();
  const screenshots = [...(portfolio.coder_portfolio_screenshots ?? [])].sort((a: any, b: any) => a.sort_order - b.sort_order);

  return (
    <main className="flex-1 overflow-y-auto bg-slate-50 p-5 sm:p-8">
      <div className="mx-auto max-w-4xl">
        <header className="mb-7"><p className="text-xs font-black uppercase tracking-[0.2em] text-clevio-green">Edit karya</p><h1 className="mt-2 text-3xl font-black text-clevio-navy">{portfolio.title}</h1><p className="mt-2 text-sm font-semibold text-slate-500">Perubahan pada karya yang sudah tayang baru terlihat publik setelah disetujui ulang oleh Coach.</p></header>
        <PortfolioForm classes={workspace.classes} initial={{ ...portfolio, screenshots }} />
      </div>
    </main>
  );
}
