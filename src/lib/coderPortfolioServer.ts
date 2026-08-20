import 'server-only';

import { makeStablePortfolioSlug } from '@/lib/coderPortfolio';
import { getSupabaseAdmin } from '@/lib/supabaseServer';

export async function getCoderPortfolioWorkspace(coderId: string) {
  const supabase = getSupabaseAdmin() as any;
  const [{ data: user, error: userError }, { data: enrollments, error: enrollmentError }, { data: portfolios, error: portfolioError }] = await Promise.all([
    supabase.from('users').select('id, full_name, school_name, school_grade').eq('id', coderId).single(),
    supabase.from('enrollments').select('class_id, enrolled_at, classes(id, name, type, level_id, levels(name))').eq('coder_id', coderId).order('enrolled_at'),
    supabase.from('coder_portfolios').select('*, classes(name), blocks(name), coder_portfolio_screenshots(*)').eq('coder_id', coderId).order('updated_at', { ascending: false }),
  ]);
  if (userError) throw userError;
  if (enrollmentError) throw enrollmentError;
  if (portfolioError) throw portfolioError;

  const classIds = [...new Set((enrollments ?? []).map((item: any) => item.class_id))] as string[];
  const { data: classBlocks, error: blockError } = classIds.length > 0
    ? await supabase.from('class_blocks').select('class_id, block_id, blocks(id, name)').in('class_id', classIds).order('order_index')
    : { data: [], error: null };
  if (blockError) throw blockError;

  const seen = new Set<string>();
  const classes = (enrollments ?? []).flatMap((item: any) => {
    const selectedClass = Array.isArray(item.classes) ? item.classes[0] : item.classes;
    if (!selectedClass || seen.has(selectedClass.id) || !['WEEKLY', 'EKSKUL'].includes(selectedClass.type)) return [];
    seen.add(selectedClass.id);
    return [{
      id: selectedClass.id,
      name: selectedClass.name,
      type: selectedClass.type as 'WEEKLY' | 'EKSKUL',
      levelName: Array.isArray(selectedClass.levels) ? selectedClass.levels[0]?.name : selectedClass.levels?.name,
      blocks: (classBlocks ?? []).flatMap((row: any) => {
        if (row.class_id !== selectedClass.id) return [];
        const block = Array.isArray(row.blocks) ? row.blocks[0] : row.blocks;
        return block ? [{ id: block.id, name: block.name }] : [];
      }),
    }];
  });

  const slug = makeStablePortfolioSlug(coderId);
  const { data: existingProfile, error: profileReadError } = await supabase
    .from('coder_portfolio_profiles')
    .select('*')
    .eq('coder_id', coderId)
    .maybeSingle();
  if (profileReadError) throw profileReadError;
  let profile = existingProfile;
  if (!profile) {
    const { data: createdProfile, error: profileCreateError } = await supabase
      .from('coder_portfolio_profiles')
      .insert({ coder_id: coderId, public_slug: slug })
      .select('*')
      .single();
    if (profileCreateError) throw profileCreateError;
    profile = createdProfile;
  }

  return { user, classes, portfolios: portfolios ?? [], profile };
}
