import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { getSessionOrThrow } from '@/lib/auth';
import { assertRole } from '@/lib/roles';
import { getSupabaseAdmin } from '@/lib/supabaseServer';

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: NextRequest, context: RouteContext) {
  const session = await getSessionOrThrow();
  await assertRole(session, 'ADMIN');

  const { id: planId } = await context.params;

  if (!planId) {
    return NextResponse.json({ error: 'Missing plan ID' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  const { data, error } = await (supabase as any)
    .from('ekskul_lessons')
    .select('id, title, order_index, estimated_meetings')
    .eq('plan_id', planId)
    .order('order_index', { ascending: true });

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch ekskul lessons' }, { status: 500 });
  }

  return NextResponse.json({ lessons: data ?? [] });
}
