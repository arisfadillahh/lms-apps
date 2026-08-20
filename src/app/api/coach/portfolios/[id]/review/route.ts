import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getSessionOrThrow } from '@/lib/auth';
import { buildPublishedSnapshot, getPortfolioApiErrorStatus, type PortfolioRecord, type PortfolioScreenshot } from '@/lib/coderPortfolio';
import { getSupabaseAdmin } from '@/lib/supabaseServer';

const reviewSchema = z.discriminatedUnion('decision', [
  z.object({ decision: z.literal('APPROVE') }),
  z.object({ decision: z.literal('REVISION'), note: z.string().trim().min(5).max(1000) }),
]);

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  try {
    const session = await getSessionOrThrow();
    if (session.user.role !== 'COACH') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const parsed = reviewSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Keputusan review tidak valid.' }, { status: 400 });
    }
    const { id } = await context.params;
    const supabase = getSupabaseAdmin() as any;
    const { data: portfolio, error: readError } = await supabase
      .from('coder_portfolios')
      .select('*, coder_portfolio_screenshots(*)')
      .eq('id', id)
      .eq('status', 'SUBMITTED')
      .maybeSingle();
    if (readError) throw readError;
    if (!portfolio) return NextResponse.json({ error: 'Portofolio tidak ditemukan atau sudah direview.' }, { status: 404 });

    const { data: ownedClass, error: classError } = await supabase
      .from('classes').select('id').eq('id', portfolio.class_id).eq('coach_id', session.user.id).maybeSingle();
    if (classError) throw classError;
    if (!ownedClass) return NextResponse.json({ error: 'Coach tidak memiliki akses ke kelas portofolio ini.' }, { status: 403 });

    const now = new Date().toISOString();
    const update = parsed.data.decision === 'APPROVE'
      ? {
          status: 'APPROVED',
          review_note: null,
          reviewed_by: session.user.id,
          reviewed_at: now,
          approved_at: now,
          published_at: now,
          published_snapshot: buildPublishedSnapshot(
            portfolio as PortfolioRecord,
            (portfolio.coder_portfolio_screenshots ?? []) as PortfolioScreenshot[],
          ),
        }
      : {
          status: 'REVISION',
          review_note: parsed.data.note,
          reviewed_by: session.user.id,
          reviewed_at: now,
        };
    const { data: updated, error } = await supabase
      .from('coder_portfolios')
      .update(update)
      .eq('id', id)
      .eq('status', 'SUBMITTED')
      .select('id');
    if (error) throw error;
    if (updated?.length !== 1) return NextResponse.json({ error: 'Portofolio sudah berubah. Muat ulang halaman.' }, { status: 409 });
    return NextResponse.json({ status: update.status });
  } catch (error) {
    console.error('[CoachPortfolio review]', error);
    const status = getPortfolioApiErrorStatus(error);
    return NextResponse.json({ error: status === 401 ? 'Unauthorized' : 'Gagal menyimpan hasil review.' }, { status });
  }
}
