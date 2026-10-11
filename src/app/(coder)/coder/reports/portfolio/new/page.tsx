import { redirect } from 'next/navigation';

import PortfolioForm from '@/components/portfolio/PortfolioForm';
import { getSessionOrThrow } from '@/lib/auth';
import { getCoderPortfolioWorkspace } from '@/lib/coderPortfolioServer';

export default async function NewCoderPortfolioPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const session = await getSessionOrThrow();
  const workspace = await getCoderPortfolioWorkspace(session.user.id);
  if (workspace.classes.length === 0) redirect('/coder/reports/portfolio');
  const query = await searchParams;
  const value = (key: string) => typeof query[key] === 'string' ? query[key] as string : undefined;

  return (
    <main className="flex-1 overflow-y-auto bg-slate-50 p-5 sm:p-8">
      <div className="mx-auto max-w-4xl">
        <header className="mb-7"><p className="text-xs font-black uppercase tracking-[0.2em] text-clevio-green">Project baru</p><h1 className="mt-2 text-3xl font-black text-clevio-navy">Isi Portofolio</h1><p className="mt-2 text-sm font-semibold text-slate-500">Isi dengan bahasamu sendiri. Draft bisa disimpan dan dilanjutkan kapan saja.</p></header>
        <PortfolioForm classes={workspace.classes} defaults={{ classId: value('classId'), blockId: value('blockId'), evaluationSessionId: value('evaluationSessionId') }} />
      </div>
    </main>
  );
}
