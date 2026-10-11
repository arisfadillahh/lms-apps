import Link from 'next/link';
import { ArrowRight, Images } from 'lucide-react';

import { getSupabaseAdmin } from '@/lib/supabaseServer';

export default async function CoachPortfolioReviewAlert({ coachId }: { coachId: string }) {
  try {
    const supabase = getSupabaseAdmin() as any;
    const { data: classes, error } = await supabase.from('classes').select('id').eq('coach_id', coachId);
    if (error) throw error;
    const classIds = (classes ?? []).map((item: { id: string }) => item.id);
    if (classIds.length === 0) return null;
    const { count, error: countError } = await supabase
      .from('coder_portfolios')
      .select('id', { count: 'exact', head: true })
      .in('class_id', classIds)
      .eq('status', 'SUBMITTED');
    if (countError) throw countError;
    if (!count) return null;
    return (
      <Link href="/coach/portfolios" className="mb-4 flex items-center gap-4 rounded-2xl border border-blue-400/20 bg-blue-500/10 p-4 text-white transition hover:bg-blue-500/15">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-blue-300 text-blue-950"><Images size={22} /></span>
        <span className="min-w-0 flex-1"><strong className="block font-black">{count} portofolio menunggu review</strong><span className="text-sm font-semibold text-slate-400">Setujui sekali klik atau kirim arahan revisi.</span></span>
        <ArrowRight className="shrink-0 text-blue-300" size={20} />
      </Link>
    );
  } catch (error) {
    console.error('[CoachPortfolioReviewAlert]', error);
    return null;
  }
}
