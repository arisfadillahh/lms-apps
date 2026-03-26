import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseServer';
import { getSessionOrThrow } from '@/lib/auth';

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSessionOrThrow();
    if (session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();
    const { level_id, questions } = body;

    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from('block_evaluation_templates')
      .update({
        level_id: level_id || null,
        questions
      })
      .eq('id', id)
      .select(`
        *,
        level:levels(name)
      `)
      .single();

    if (error) {
      console.error('[PUT /api/admin/evaluation-templates] DB Error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (error: any) {
    console.error('[PUT /api/admin/evaluation-templates] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSessionOrThrow();
    if (session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { id } = await params;
    const supabase = getSupabaseAdmin();

    const { error } = await supabase
      .from('block_evaluation_templates')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('[DELETE /api/admin/evaluation-templates] DB Error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[DELETE /api/admin/evaluation-templates] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
