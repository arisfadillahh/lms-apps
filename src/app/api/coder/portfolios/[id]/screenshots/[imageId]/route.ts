import { NextResponse } from 'next/server';

import { getSessionOrThrow } from '@/lib/auth';
import { getPortfolioApiErrorStatus, nextStatusAfterCoderEdit, type PortfolioRecord } from '@/lib/coderPortfolio';
import { deletePortfolioScreenshots } from '@/lib/storage';
import { getSupabaseAdmin } from '@/lib/supabaseServer';

type Context = { params: Promise<{ id: string; imageId: string }> };

export async function DELETE(_request: Request, context: Context) {
  try {
    const session = await getSessionOrThrow();
    if (session.user.role !== 'CODER') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const { id, imageId } = await context.params;
    const supabase = getSupabaseAdmin() as any;
    const { data: portfolio, error: portfolioError } = await supabase
      .from('coder_portfolios').select('id, status').eq('id', id).eq('coder_id', session.user.id).maybeSingle();
    if (portfolioError) throw portfolioError;
    if (!portfolio) return NextResponse.json({ error: 'Portofolio tidak ditemukan.' }, { status: 404 });
    const { data: image, error: imageError } = await supabase
      .from('coder_portfolio_screenshots').select('id, storage_path').eq('id', imageId).eq('portfolio_id', id).maybeSingle();
    if (imageError) throw imageError;
    if (!image) return NextResponse.json({ error: 'Screenshot tidak ditemukan.' }, { status: 404 });

    await deletePortfolioScreenshots([image.storage_path]);
    const { error: deleteError } = await supabase.from('coder_portfolio_screenshots').delete().eq('id', imageId).eq('portfolio_id', id);
    if (deleteError) throw deleteError;
    const status = nextStatusAfterCoderEdit(portfolio.status as PortfolioRecord['status']);
    await supabase.from('coder_portfolios').update({ status }).eq('id', id).eq('coder_id', session.user.id);
    return NextResponse.json({ deleted: true, status });
  } catch (error) {
    console.error('[CoderPortfolio screenshot DELETE]', error);
    const status = getPortfolioApiErrorStatus(error);
    return NextResponse.json({ error: status === 401 ? 'Unauthorized' : 'Gagal menghapus screenshot.' }, { status });
  }
}
