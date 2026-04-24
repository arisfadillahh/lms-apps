import { getSessionOrThrow } from '@/lib/auth';
import { assertRole } from '@/lib/roles';
import { getSupabaseAdmin } from '@/lib/supabaseServer';
import EkskulSplitViewClient from './EkskulSplitViewClient';

export default async function EkskulPlansPage() {
  const session = await getSessionOrThrow();
  await assertRole(session, 'ADMIN');

  const supabase = getSupabaseAdmin();
  const { data: plans } = await supabase
    .from('ekskul_lesson_plans')
    .select('*, ekskul_lessons(*), ekskul_plan_software(software(id, name))')
    .order('created_at', { ascending: false });

  return (
    <EkskulSplitViewClient plans={(plans || []) as any} />
  );
}
