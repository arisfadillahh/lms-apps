import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseServer';
import { getSessionOrThrow } from '@/lib/auth';

export async function GET() {
  try {
    const session = await getSessionOrThrow();
    if (session.user.role !== 'ADMIN' && session.user.role !== 'COACH') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const supabase = getSupabaseAdmin();
    
    // Fetch all templates and left join levels to get level name
    const { data: templates, error } = await supabase
      .from('block_evaluation_templates')
      .select(`
        *,
        level:levels(name)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[GET /api/admin/evaluation-templates] DB Error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Also fetch all levels to populate a dropdown in the UI
    const { data: levels, error: levelsError } = await supabase
      .from('levels')
      .select('id, name')
      .order('order_index', { ascending: true });

    if (levelsError) {
       console.error('[GET /api/admin/evaluation-templates] Levels DB Error:', levelsError);
       return NextResponse.json({ error: levelsError.message }, { status: 500 });
    }

    return NextResponse.json({ data: templates, levels });
  } catch (error: any) {
    console.error('[GET /api/admin/evaluation-templates] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSessionOrThrow();
    if (session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const body = await req.json();
    const { level_id, questions } = body;

    // Validate
    if (!questions || !Array.isArray(questions) || questions.length === 0) {
      return NextResponse.json({ error: 'At least one question is required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from('block_evaluation_templates')
      .insert({
        level_id: level_id || null, // allow null for "All Levels" if needed
        questions
      })
      .select(`
        *,
        level:levels(name)
      `)
      .single();

    if (error) {
       console.error('[POST /api/admin/evaluation-templates] DB Error:', error);
       return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (error: any) {
    console.error('[POST /api/admin/evaluation-templates] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
