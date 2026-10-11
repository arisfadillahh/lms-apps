import PageHead from '@/components/admin/PageHead';
import { getSessionOrThrow } from '@/lib/auth';
import { assertRole } from '@/lib/roles';
import { getSupabaseAdmin } from '@/lib/supabaseServer';
import LevelProgressionManager, { type ProgressionView } from './LevelProgressionManager';

export const dynamic = 'force-dynamic';

export default async function LevelProgressionsPage() {
  const session = await getSessionOrThrow();
  await assertRole(session, 'ADMIN');
  const supabase = getSupabaseAdmin();
  const { data: progressions, error } = await supabase.from('coder_level_progressions').select('*').order('completed_at', { ascending: false });
  if (error) throw new Error(`Gagal memuat kenaikan level: ${error.message}`);

  const coderIds = [...new Set((progressions ?? []).map((row) => row.coder_id))];
  const levelIds = [...new Set((progressions ?? []).flatMap((row) => [row.source_level_id, row.target_level_id].filter(Boolean) as string[]))];
  const classIds = [...new Set((progressions ?? []).flatMap((row) => [row.source_class_id, row.target_class_id].filter(Boolean) as string[]))];
  const [{ data: users }, { data: levels }, { data: namedClasses }, { data: candidates }, { data: blocks }, { data: progress }] = await Promise.all([
    coderIds.length ? supabase.from('users').select('id, full_name').in('id', coderIds) : Promise.resolve({ data: [] }),
    levelIds.length ? supabase.from('levels').select('id, name').in('id', levelIds) : Promise.resolve({ data: [] }),
    classIds.length ? supabase.from('classes').select('id, name').in('id', classIds) : Promise.resolve({ data: [] }),
    levelIds.length ? supabase.from('classes').select('id, name, level_id, schedule_day, schedule_time, coach_id').eq('type', 'WEEKLY').eq('lifecycle_status', 'ACTIVE').in('level_id', levelIds) : Promise.resolve({ data: [] }),
    levelIds.length ? supabase.from('blocks').select('id, name').in('level_id', levelIds) : Promise.resolve({ data: [] }),
    coderIds.length ? supabase.from('coder_block_progress').select('coder_id, level_id, block_id, status').in('coder_id', coderIds) : Promise.resolve({ data: [] }),
  ]);
  const coachIds = [...new Set((candidates ?? []).map((klass) => klass.coach_id))];
  const { data: coaches } = coachIds.length ? await supabase.from('users').select('id, full_name').in('id', coachIds) : { data: [] };
  const names = new Map((users ?? []).map((row) => [row.id, row.full_name]));
  const levelNames = new Map((levels ?? []).map((row) => [row.id, row.name]));
  const classNames = new Map((namedClasses ?? []).map((row) => [row.id, row.name]));
  const coachNames = new Map((coaches ?? []).map((row) => [row.id, row.full_name]));
  const blockNames = new Map((blocks ?? []).map((row) => [row.id, row.name]));
  const rows: ProgressionView[] = (progressions ?? []).map((row) => {
    const required = new Set((progress ?? []).filter((item) => item.coder_id === row.coder_id && item.level_id === row.source_level_id).map((item) => item.block_id));
    const completed = new Set((progress ?? []).filter((item) => item.coder_id === row.coder_id && item.level_id === row.source_level_id && item.status === 'COMPLETED').map((item) => item.block_id));
    return {
      id: row.id, status: row.status, completedAt: row.completed_at, placedAt: row.placed_at,
      coderName: names.get(row.coder_id) ?? 'Coder', sourceLevel: levelNames.get(row.source_level_id) ?? '-',
      targetLevel: row.target_level_id ? levelNames.get(row.target_level_id) ?? '-' : null,
      sourceClass: classNames.get(row.source_class_id) ?? '-', targetClass: row.target_class_id ? classNames.get(row.target_class_id) ?? '-' : null,
      completedBlocks: completed.size, totalBlocks: required.size,
      completedBlockNames: [...completed].map((blockId) => blockNames.get(blockId) ?? 'Blok lama'),
      pendingBlockNames: [...required].filter((blockId) => !completed.has(blockId)).map((blockId) => blockNames.get(blockId) ?? 'Blok lama'),
      classes: (candidates ?? []).filter((klass) => klass.level_id === row.target_level_id).map((klass) => ({
        id: klass.id, name: klass.name, schedule: `${klass.schedule_day} ${klass.schedule_time}`, coach: coachNames.get(klass.coach_id) ?? 'Coach',
      })),
    };
  });
  return <div className="col gap-5"><PageHead title="Kenaikan Level" desc="Tempatkan Coder yang sudah menyelesaikan seluruh blok ke kelas pada level berikutnya."/><LevelProgressionManager rows={rows}/></div>;
}
