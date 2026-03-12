import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getSessionOrThrow } from '@/lib/auth';
import { assertRole } from '@/lib/roles';
import { getSupabaseAdmin } from '@/lib/supabaseServer';

interface RouteContext { params: Promise<{ id: string }> }

export async function PUT(req: NextRequest, { params }: RouteContext) {
  try {
    const session = await getSessionOrThrow();
    await assertRole(session, 'ADMIN');
    
    const { id } = await params;
    const { name, description, order_index } = await req.json();

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('evaluation_criteria')
      .update({ name, description, order_index })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: RouteContext) {
  try {
    const session = await getSessionOrThrow();
    await assertRole(session, 'ADMIN');
    
    const { id } = await params;

    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from('evaluation_criteria')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
