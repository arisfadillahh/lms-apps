import { NextResponse } from 'next/server';

import { getSessionOrThrow } from '@/lib/auth';
import { getPortfolioApiErrorStatus, makeStablePortfolioSlug, portfolioDraftInputSchema, portfolioInputSchema, toPortfolioColumns } from '@/lib/coderPortfolio';
import { getSupabaseAdmin } from '@/lib/supabaseServer';

async function validatePortfolioScope(
  supabase: any,
  coderId: string,
  classId: string,
  blockId?: string | null,
  evaluationSessionId?: string | null,
) {
  const { data: enrollment, error: enrollmentError } = await supabase
    .from('enrollments')
    .select('id')
    .eq('coder_id', coderId)
    .eq('class_id', classId)
    .maybeSingle();
  if (enrollmentError) throw enrollmentError;
  if (!enrollment) return { error: 'Kelas tidak termasuk dalam riwayat belajar Coder.', status: 403 };

  const { data: selectedClass, error: classError } = await supabase
    .from('classes')
    .select('id, type')
    .eq('id', classId)
    .maybeSingle();
  if (classError) throw classError;
  if (!selectedClass || !['WEEKLY', 'EKSKUL'].includes(selectedClass.type)) {
    return { error: 'Tipe kelas tidak mendukung portofolio.', status: 400 };
  }

  if (blockId) {
    const { data: classBlock, error: blockError } = await supabase
      .from('class_blocks')
      .select('id')
      .eq('class_id', classId)
      .eq('block_id', blockId)
      .maybeSingle();
    if (blockError) throw blockError;
    if (!classBlock) return { error: 'Block tidak berasal dari kelas yang dipilih.', status: 400 };
  }

  if (evaluationSessionId) {
    const { data: evaluation, error: evaluationError } = await supabase
      .from('block_evaluation_sessions')
      .select('id')
      .eq('id', evaluationSessionId)
      .eq('class_id', classId)
      .eq('block_id', blockId)
      .maybeSingle();
    if (evaluationError) throw evaluationError;
    if (!evaluation) return { error: 'Sesi evaluasi tidak sesuai dengan kelas dan block.', status: 400 };
  }

  return { programType: selectedClass.type as 'WEEKLY' | 'EKSKUL' };
}

export async function GET(request: Request) {
  try {
    const session = await getSessionOrThrow();
    if (session.user.role !== 'CODER') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const supabase = getSupabaseAdmin() as any;
    const evaluationSessionId = new URL(request.url).searchParams.get('evaluationSessionId');
    let query = supabase
      .from('coder_portfolios')
      .select(evaluationSessionId ? 'id, evaluation_session_id' : '*, coder_portfolio_screenshots(*)')
      .eq('coder_id', session.user.id);
    if (evaluationSessionId) query = query.eq('evaluation_session_id', evaluationSessionId);
    const { data, error } = await query.order('updated_at', { ascending: false });
    if (error) throw error;
    return NextResponse.json({ portfolios: data ?? [] });
  } catch (error) {
    console.error('[CoderPortfolio GET]', error);
    return NextResponse.json({ error: getPortfolioApiErrorStatus(error) === 401 ? 'Unauthorized' : 'Gagal memuat portofolio.' }, { status: getPortfolioApiErrorStatus(error) });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSessionOrThrow();
    if (session.user.role !== 'CODER') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const body = await request.json();
    const parsed = (body?.saveAsDraft ? portfolioDraftInputSchema : portfolioInputSchema).safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Data portofolio tidak valid.' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin() as any;
    const scope = await validatePortfolioScope(
      supabase,
      session.user.id,
      parsed.data.classId,
      parsed.data.blockId,
      parsed.data.evaluationSessionId,
    );
    if ('error' in scope) {
      return NextResponse.json({ error: scope.error }, { status: scope.status });
    }

    const { data, error } = await supabase
      .from('coder_portfolios')
      .insert({
        coder_id: session.user.id,
        program_type: scope.programType,
        ...toPortfolioColumns(parsed.data),
      })
      .select('id')
      .single();
    if (error) throw error;

    await supabase.from('coder_portfolio_profiles').upsert(
      {
        coder_id: session.user.id,
        public_slug: makeStablePortfolioSlug(session.user.id),
      },
      { onConflict: 'coder_id', ignoreDuplicates: true },
    );

    return NextResponse.json({ id: data.id }, { status: 201 });
  } catch (error) {
    console.error('[CoderPortfolio POST]', error);
    return NextResponse.json({ error: getPortfolioApiErrorStatus(error) === 401 ? 'Unauthorized' : 'Gagal menyimpan draft portofolio.' }, { status: getPortfolioApiErrorStatus(error) });
  }
}

export { validatePortfolioScope };
