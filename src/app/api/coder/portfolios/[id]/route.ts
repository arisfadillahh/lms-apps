import { NextResponse } from 'next/server';

import { getSessionOrThrow } from '@/lib/auth';
import {
  deletePortfolioPermanently,
  getPortfolioApiErrorStatus,
  nextStatusAfterCoderEdit,
  portfolioDraftInputSchema,
  portfolioInputSchema,
  toPortfolioColumns,
  type PortfolioRecord,
} from '@/lib/coderPortfolio';
import { deletePortfolioScreenshots } from '@/lib/storage';
import { getSupabaseAdmin } from '@/lib/supabaseServer';

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Context) {
  try {
    const session = await getSessionOrThrow();
    if (session.user.role !== 'CODER') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const { id } = await context.params;
    const body = await request.json();
    const supabase = getSupabaseAdmin() as any;
    const { data: existing, error: readError } = await supabase
      .from('coder_portfolios')
      .select('*')
      .eq('id', id)
      .eq('coder_id', session.user.id)
      .maybeSingle();
    if (readError) throw readError;
    if (!existing) return NextResponse.json({ error: 'Portofolio tidak ditemukan.' }, { status: 404 });
    const parsed = (body?.saveAsDraft && existing.status === 'DRAFT' ? portfolioDraftInputSchema : portfolioInputSchema).safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Data portofolio tidak valid.' }, { status: 400 });
    }
    if (existing.class_id !== parsed.data.classId) {
      return NextResponse.json({ error: 'Asal kelas portofolio tidak dapat diubah.' }, { status: 400 });
    }

    if (parsed.data.blockId) {
      const { data: classBlock, error: blockError } = await supabase
        .from('class_blocks')
        .select('id')
        .eq('class_id', existing.class_id)
        .eq('block_id', parsed.data.blockId)
        .maybeSingle();
      if (blockError) throw blockError;
      if (!classBlock) return NextResponse.json({ error: 'Block tidak berasal dari kelas portofolio.' }, { status: 400 });
    }

    const status = nextStatusAfterCoderEdit(existing.status as PortfolioRecord['status']);
    const { error } = await supabase
      .from('coder_portfolios')
      .update({
        ...toPortfolioColumns(parsed.data),
        class_id: existing.class_id,
        evaluation_session_id: existing.evaluation_session_id,
        status,
        review_note: status === 'REVISION' ? existing.review_note : null,
      })
      .eq('id', id)
      .eq('coder_id', session.user.id);
    if (error) throw error;
    return NextResponse.json({ id, status });
  } catch (error) {
    console.error('[CoderPortfolio PATCH]', error);
    const status = getPortfolioApiErrorStatus(error);
    return NextResponse.json({ error: status === 401 ? 'Unauthorized' : 'Gagal memperbarui portofolio.' }, { status });
  }
}

export async function DELETE(request: Request, context: Context) {
  try {
    const session = await getSessionOrThrow();
    if (!['CODER', 'ADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const { id } = await context.params;
    const body = await request.json();
    const confirmationTitle = typeof body?.confirmationTitle === 'string' ? body.confirmationTitle : '';
    const supabase = getSupabaseAdmin() as any;
    let query = supabase.from('coder_portfolios').select('id, title, coder_id').eq('id', id);
    if (session.user.role === 'CODER') query = query.eq('coder_id', session.user.id);
    const { data: portfolio, error: readError } = await query.maybeSingle();
    if (readError) throw readError;
    if (!portfolio) return NextResponse.json({ error: 'Portofolio tidak ditemukan.' }, { status: 404 });

    const { data: screenshots, error: screenshotError } = await supabase
      .from('coder_portfolio_screenshots')
      .select('storage_path')
      .eq('portfolio_id', id);
    if (screenshotError) throw screenshotError;

    await deletePortfolioPermanently(
      portfolio,
      confirmationTitle,
      (screenshots ?? []).map((item: { storage_path: string }) => item.storage_path),
      {
        removeScreenshots: deletePortfolioScreenshots,
        deleteRow: async (portfolioId) => {
          const { data: deleted, error } = await supabase
            .from('coder_portfolios')
            .delete()
            .eq('id', portfolioId)
            .select('id');
          if (error) throw error;
          if (deleted?.length !== 1) throw new Error('Portfolio delete did not affect exactly one row.');
        },
      },
    );
    return NextResponse.json({ deleted: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Gagal menghapus portofolio.';
    const status = message.includes('sama persis') ? 400 : getPortfolioApiErrorStatus(error);
    console.error('[CoderPortfolio DELETE]', error);
    return NextResponse.json({ error: message }, { status });
  }
}
