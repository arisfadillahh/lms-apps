import { NextResponse } from 'next/server';

import { getSessionOrThrow } from '@/lib/auth';
import { getPortfolioApiErrorStatus } from '@/lib/coderPortfolio';
import { getSupabaseAdmin } from '@/lib/supabaseServer';

export async function GET() {
  try {
    const session = await getSessionOrThrow();
    if (session.user.role !== 'COACH') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const supabase = getSupabaseAdmin() as any;
    const { data: classes, error: classError } = await supabase
      .from('classes').select('id').eq('coach_id', session.user.id);
    if (classError) throw classError;
    const classIds = (classes ?? []).map((item: { id: string }) => item.id);
    if (classIds.length === 0) return NextResponse.json({ portfolios: [] });
    const { data, error } = await supabase
      .from('coder_portfolios')
      .select('*, users!coder_portfolios_coder_id_fkey(full_name), classes(name), blocks(name), coder_portfolio_screenshots(*)')
      .in('class_id', classIds)
      .eq('status', 'SUBMITTED')
      .order('submitted_at', { ascending: true });
    if (error) throw error;
    return NextResponse.json({ portfolios: data ?? [] });
  } catch (error) {
    console.error('[CoachPortfolio GET]', error);
    const status = getPortfolioApiErrorStatus(error);
    return NextResponse.json({ error: status === 401 ? 'Unauthorized' : 'Gagal memuat antrean review.' }, { status });
  }
}
