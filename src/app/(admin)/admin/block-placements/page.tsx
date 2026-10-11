import Link from 'next/link';
import PageHead from '@/components/admin/PageHead';
import TransferCoderButton from '@/app/(admin)/admin/classes/[id]/TransferCoderButton';
import { getSessionOrThrow } from '@/lib/auth';
import { assertRole } from '@/lib/roles';
import { getSupabaseAdmin } from '@/lib/supabaseServer';

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
  const [{ data: coders }, { data: blocks }, { data: levels }, { data: sources }, { data: currentBlocks }] = await Promise.all([
    coderIds.length ? supabase.from('users').select('id, full_name').in('id', coderIds) : Promise.resolve({ data: [] }),
    blockIds.length ? supabase.from('blocks').select('id, name').in('id', blockIds) : Promise.resolve({ data: [] }),
    levelIds.length ? supabase.from('levels').select('id, name').in('id', levelIds) : Promise.resolve({ data: [] }),
    sourceIds.length ? supabase.from('classes').select('id, name').in('id', sourceIds) : Promise.resolve({ data: [] }),
    blockIds.length ? supabase.from('class_blocks').select('class_id, block_id').in('block_id', blockIds).eq('status', 'CURRENT') : Promise.resolve({ data: [] }),
  ]);
  const candidateIds = [...new Set((currentBlocks ?? []).map((row) => row.class_id))];
  const { data: candidates, error: candidateError } = candidateIds.length
    ? await supabase.from('classes').select('id, name, level_id, type, lifecycle_status, archived_at, end_date')
      .in('id', candidateIds).eq('type', 'WEEKLY').eq('lifecycle_status', 'ACTIVE')
      .is('archived_at', null).gte('end_date', new Date().toISOString().slice(0, 10))
    : { data: [], error: null };
  if (candidateError) throw new Error(`Gagal memuat saran kelas: ${candidateError.message}`);
  const coderNames = new Map((coders ?? []).map((row) => [row.id, row.full_name]));
  const blockNames = new Map((blocks ?? []).map((row) => [row.id, row.name]));
  const levelNames = new Map((levels ?? []).map((row) => [row.id, row.name]));
  const sourceNames = new Map((sources ?? []).map((row) => [row.id, row.name]));
  const current = new Set((currentBlocks ?? []).map((row) => `${row.class_id}:${row.block_id}`));

  return <div className="col gap-5">
    <PageHead title="Penempatan Blok" desc="Tempatkan coder ke kelas aktif yang sedang menjalankan blok tertunda." />
    {placements.length === 0 && <p>Tidak ada coder yang menunggu penempatan blok.</p>}
    {placements.map((row) => {
      const name = coderNames.get(row.coder_id) ?? 'Coder';
      const targets = (candidates ?? []).filter((klass) => klass.level_id === row.level_id
        && klass.id !== row.source_class_id && current.has(`${klass.id}:${row.block_id}`))
        .map((klass) => ({ id: klass.id, name: klass.name, levelName: levelNames.get(row.level_id) ?? null }));
      return <article key={row.id} style={{ padding: 16, border: '1px solid #e2e8f0', borderRadius: 12 }}>
        <h2>{name}</h2>
        <p>Blok: {blockNames.get(row.block_id) ?? row.block_id} · Lanjut dari pertemuan {row.entry_lesson_position}</p>
        <p>Level: {levelNames.get(row.level_id) ?? '-'} · Kelas asal: {sourceNames.get(row.source_class_id) ?? '-'}</p>
        <p>{targets.length ? `Saran kelas: ${targets.map((klass) => klass.name).join(', ')}` : 'Belum ada kelas aktif di blok ini. Admin perlu membuka kelas.'}</p>
        <TransferCoderButton classId={row.source_class_id} coderId={row.coder_id}
          coderName={name} targetClasses={targets} />{' '}
        <Link href={`/admin/classes/${row.source_class_id}`}>Lihat kelas asal</Link>
      </article>;
    })}
  </div>;
}
