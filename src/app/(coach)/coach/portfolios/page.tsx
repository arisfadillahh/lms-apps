import { Image as ImageIcon } from 'lucide-react';

import CoachPortfolioReviewClient from '@/components/portfolio/CoachPortfolioReviewClient';
import { getSessionOrThrow } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabaseServer';

export default async function CoachPortfoliosPage() {
  const session = await getSessionOrThrow();
  const supabase = getSupabaseAdmin() as any;
  const { data: classes, error: classError } = await supabase.from('classes').select('id').eq('coach_id', session.user.id);
  if (classError) throw classError;
  const classIds = (classes ?? []).map((item: { id: string }) => item.id);
  const { data, error } = classIds.length > 0
    ? await supabase.from('coder_portfolios').select('*, users!coder_portfolios_coder_id_fkey(full_name), classes(name), blocks(name), coder_portfolio_screenshots(*)').in('class_id', classIds).eq('status', 'SUBMITTED').order('submitted_at', { ascending: true })
    : { data: [], error: null };
  if (error) throw error;
  const portfolios = (data ?? []).map((item: any) => ({
    ...item,
    coderName: (Array.isArray(item.users) ? item.users[0]?.full_name : item.users?.full_name) || 'Coder',
    className: (Array.isArray(item.classes) ? item.classes[0]?.name : item.classes?.name) || 'Kelas',
    blockName: (Array.isArray(item.blocks) ? item.blocks[0]?.name : item.blocks?.name) || null,
    screenshots: [...(item.coder_portfolio_screenshots ?? [])].sort((a: any, b: any) => a.sort_order - b.sort_order),
  }));

  return (
    <main className="min-h-screen flex-1 bg-[#07101f] p-5 text-white sm:p-8 lg:p-10">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8"><p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-blue-300"><ImageIcon size={18} /> Review ringan</p><h1 className="mt-2 text-3xl font-black">Portofolio Coder</h1><p className="mt-2 max-w-2xl text-sm font-semibold text-slate-400">Coba project dan cek ceritanya. Setujui sekali klik, atau berikan arahan hanya jika perlu revisi.</p></header>
        <CoachPortfolioReviewClient initialPortfolios={portfolios} />
      </div>
    </main>
  );
}
