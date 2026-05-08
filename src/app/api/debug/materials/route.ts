import { NextResponse } from 'next/server';
import { getServerAuthSession } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabaseServer';
import { getAccessibleLessonsForCoder } from '@/lib/services/coder';

export async function GET() {
  if (process.env.NODE_ENV === 'production' && process.env.ENABLE_DEBUG_ROUTES !== 'true') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const session = await getServerAuthSession();
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  const classId = '23a83a47-b026-4ead-9d26-50ed8a56a5ef'; // Explorer Sabtu

  const { data: enrollments } = await supabase
    .from('enrollments')
    .select('coder_id, enrolled_at, status')
    .eq('class_id', classId)
    .eq('status', 'ACTIVE');

  const results: any[] = [];

  for (const enr of (enrollments || []).slice(0, 5)) {
    const { data: user } = await supabase
      .from('users')
      .select('id, full_name')
      .eq('id', enr.coder_id)
      .single();

    let data;
    try {
      data = await getAccessibleLessonsForCoder(enr.coder_id);
    } catch (e: any) {
      data = { error: e.message };
    }

    const summary = Array.isArray(data)
      ? data.map((cls: any) => ({
          className: cls.name,
          blocks: cls.blocks?.map((b: any) => ({
            name: b.name,
            status: b.status,
            lessonCount: b.lessons?.length ?? 0,
          }))
        }))
      : data;

    results.push({
      coder: user?.full_name,
      enrolled_at: enr.enrolled_at,
      summary,
    });
  }

  return NextResponse.json({ now: new Date().toISOString(), results });
}
