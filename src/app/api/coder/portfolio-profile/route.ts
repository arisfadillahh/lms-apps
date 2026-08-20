import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getSessionOrThrow } from '@/lib/auth';
import { getPortfolioApiErrorStatus, makeStablePortfolioSlug } from '@/lib/coderPortfolio';
import { getSupabaseAdmin } from '@/lib/supabaseServer';

const profileSchema = z.object({ schoolVisible: z.boolean() });

export async function GET() {
  try {
    const session = await getSessionOrThrow();
    if (session.user.role !== 'CODER') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const supabase = getSupabaseAdmin() as any;
    const { data: existing, error: readError } = await supabase
      .from('coder_portfolio_profiles')
      .select('*')
      .eq('coder_id', session.user.id)
      .maybeSingle();
    if (readError) throw readError;
    if (existing) return NextResponse.json({ profile: existing });
    const { data: created, error: createError } = await supabase
      .from('coder_portfolio_profiles')
      .insert({ coder_id: session.user.id, public_slug: makeStablePortfolioSlug(session.user.id) })
      .select('*')
      .single();
    if (createError) throw createError;
    return NextResponse.json({ profile: created });
  } catch (error) {
    console.error('[CoderPortfolio profile GET]', error);
    const status = getPortfolioApiErrorStatus(error);
    return NextResponse.json({ error: status === 401 ? 'Unauthorized' : 'Gagal memuat pengaturan bagikan.' }, { status });
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await getSessionOrThrow();
    if (session.user.role !== 'CODER') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const parsed = profileSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: 'Pengaturan tidak valid.' }, { status: 400 });
    const supabase = getSupabaseAdmin() as any;
    const { data, error } = await supabase
      .from('coder_portfolio_profiles')
      .upsert({
        coder_id: session.user.id,
        public_slug: makeStablePortfolioSlug(session.user.id),
        school_visible: parsed.data.schoolVisible,
      }, { onConflict: 'coder_id' })
      .select('*')
      .single();
    if (error) throw error;
    return NextResponse.json({ profile: data });
  } catch (error) {
    console.error('[CoderPortfolio profile PATCH]', error);
    const status = getPortfolioApiErrorStatus(error);
    return NextResponse.json({ error: status === 401 ? 'Unauthorized' : 'Gagal menyimpan pengaturan bagikan.' }, { status });
  }
}
