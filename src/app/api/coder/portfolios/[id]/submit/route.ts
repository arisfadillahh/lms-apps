import { NextResponse } from 'next/server';

import { getSessionOrThrow } from '@/lib/auth';
import { assertPortfolioCanSubmit, getPortfolioApiErrorStatus, type PortfolioRecord } from '@/lib/coderPortfolio';
import { getSupabaseAdmin } from '@/lib/supabaseServer';

type Context = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: Context) {
  try {
    const session = await getSessionOrThrow();
    if (session.user.role !== 'CODER') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const { id } = await context.params;
    const supabase = getSupabaseAdmin() as any;
    const [{ data: portfolio, error: readError }, { count, error: countError }] = await Promise.all([
      supabase.from('coder_portfolios').select('*').eq('id', id).eq('coder_id', session.user.id).maybeSingle(),
      supabase.from('coder_portfolio_screenshots').select('id', { count: 'exact', head: true }).eq('portfolio_id', id),
    ]);
    if (readError) throw readError;
    if (countError) throw countError;
    if (!portfolio) return NextResponse.json({ error: 'Portofolio tidak ditemukan.' }, { status: 404 });
    assertPortfolioCanSubmit(portfolio as PortfolioRecord, count ?? 0);

    const { error } = await supabase
      .from('coder_portfolios')
      .update({ status: 'SUBMITTED', submitted_at: new Date().toISOString(), review_note: null })
      .eq('id', id)
      .eq('coder_id', session.user.id);
    if (error) throw error;
    return NextResponse.json({ status: 'SUBMITTED' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Gagal mengirim portofolio.';
    const status = /screenshot|menunggu review|lengkapi/i.test(message) ? 400 : getPortfolioApiErrorStatus(error);
    console.error('[CoderPortfolio submit]', error);
    return NextResponse.json({ error: message }, { status });
  }
}
