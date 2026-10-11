import Link from 'next/link';
import PageHead from '@/components/admin/PageHead';
import TransferCoderButton from '@/app/(admin)/admin/classes/[id]/TransferCoderButton';
import { getSessionOrThrow } from '@/lib/auth';
import { assertRole } from '@/lib/roles';
import { getSupabaseAdmin } from '@/lib/supabaseServer';
import { placementAction, rankPlacementCandidates, type PlacementCandidate } from '@/lib/services/blockPlacementRecommendation';

export const dynamic = 'force-dynamic';

type Placement = {
  id: string; coder_id: string; level_id: string; block_id: string;
  source_class_id: string; entry_lesson_position: number; created_at: string;
};

export default async function BlockPlacementsPage() {
  const session = await getSessionOrThrow();
  await assertRole(session, 'ADMIN');
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from('coder_block_placements' as never)
    .select('id, coder_id, level_id, block_id, source_class_id, entry_lesson_position, created_at')
    .eq('status', 'NEEDS_BLOCK_PLACEMENT').order('created_at', { ascending: true });
  if (error) throw new Error(`Gagal memuat antrean penempatan: ${error.message}`);
  const placements = (data ?? []) as unknown as Placement[];
  const coderIds = [...new Set(placements.map((row) => row.coder_id))];
  const blockIds = [...new Set(placements.map((row) => row.block_id))];
  const levelIds = [...new Set(placements.map((row) => row.level_id))];
  const sourceIds = [...new Set(placements.map((row) => row.source_class_id))];
  const [{ data: coders }, { data: blocks }, { data: levels }, { data: sources }, { data: candidateRows, error: candidateError }] = await Promise.all([
    coderIds.length ? supabase.from('users').select('id, full_name').in('id', coderIds) : Promise.resolve({ data: [] }),
    blockIds.length ? supabase.from('blocks').select('id, name').in('id', blockIds) : Promise.resolve({ data: [] }),
    levelIds.length ? supabase.from('levels').select('id, name').in('id', levelIds) : Promise.resolve({ data: [] }),
    sourceIds.length ? supabase.from('classes').select('id, name').in('id', sourceIds) : Promise.resolve({ data: [] }),
    placements.length ? supabase.from('block_placement_candidates' as never)
      .select('placement_id, class_id, class_name, class_position, active_coder_count, schedule_day, schedule_time')
      .in('placement_id', placements.map((row) => row.id)) : Promise.resolve({ data: [], error: null }),
  ]);
  if (candidateError) throw new Error(`Gagal memuat saran kelas: ${candidateError.message}`);
  const coderNames = new Map((coders ?? []).map((row) => [row.id, row.full_name]));
  const blockNames = new Map((blocks ?? []).map((row) => [row.id, row.name]));
  const levelNames = new Map((levels ?? []).map((row) => [row.id, row.name]));
  const sourceNames = new Map((sources ?? []).map((row) => [row.id, row.name]));
  const candidates = (candidateRows ?? []) as unknown as PlacementCandidate[];

  return <div className="col gap-5">
    <PageHead title="Penempatan Blok" desc="Tempatkan coder ke kelas aktif yang sedang menjalankan blok tertunda." />
    {placements.length === 0 && <p>Tidak ada coder yang menunggu penempatan blok.</p>}
    {placements.map((row) => {
      const name = coderNames.get(row.coder_id) ?? 'Coder';
      const ranked = rankPlacementCandidates(candidates.filter((candidate) => candidate.placement_id === row.id), row.entry_lesson_position);
      const targets = ranked.map((candidate) => ({ id: candidate.class_id, name: candidate.class_name,
        levelName: levelNames.get(row.level_id) ?? null }));
      const blockName = blockNames.get(row.block_id) ?? row.block_id;
      return <article key={row.id} style={{ padding: 16, border: '1px solid #e2e8f0', borderRadius: 12 }}>
        <h2>{name}</h2>
        <p>Blok: {blockName} · Lanjut dari pertemuan {row.entry_lesson_position}</p>
        <p>Level: {levelNames.get(row.level_id) ?? '-'} · Kelas asal: {sourceNames.get(row.source_class_id) ?? '-'}</p>
        <p><strong>Rekomendasi: {placementAction(blockName, ranked, row.entry_lesson_position)}</strong>
          {ranked[0] ? ` (kelas pertemuan ${ranked[0].class_position}; ${ranked[0].active_coder_count} coder aktif)` : ''}
        </p>
        {ranked.length > 1 && <p>Alternatif: {ranked.slice(1).map((klass) => `${klass.class_name} (pertemuan ${klass.class_position})`).join(', ')}</p>}
        <TransferCoderButton key={`${row.id}:${ranked[0]?.class_id ?? 'none'}`}
          classId={row.source_class_id} coderId={row.coder_id}
          coderName={name} targetClasses={targets} recommendedTargetClassId={ranked[0]?.class_id} />{' '}
        <Link href={`/admin/classes/${row.source_class_id}`}>Lihat kelas asal</Link>
      </article>;
    })}
  </div>;
}
