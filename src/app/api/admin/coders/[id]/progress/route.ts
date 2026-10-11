import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { getSessionOrThrow } from '@/lib/auth';
import { blocksDao, coderProgressDao } from '@/lib/dao';
import { canAccessMenu } from '@/lib/permissions';
import { assertRole } from '@/lib/roles';
import { getSupabaseAdmin } from '@/lib/supabaseServer';

type RouteContext = { params: Promise<{ id: string }> };

const migrationSchema = z.object({
  classId: z.string().uuid(),
  completedBlockIds: z.array(z.string().uuid()).min(1),
});

async function authorize() {
  const session = await getSessionOrThrow();
  await assertRole(session, 'ADMIN');
  if (!canAccessMenu(session.user.username, session.user.adminPermissions ?? null, 'users')) {
    throw new Error('FORBIDDEN');
  }
}

async function loadActiveWeeklyEnrollments(coderId: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('enrollments')
    .select('id, class_id, enrolled_at, classes!inner(id, name, type, level_id, lifecycle_status, levels(id, name))')
    .eq('coder_id', coderId)
    .eq('status', 'ACTIVE');

  if (error) throw new Error(`Failed to load coder enrollments: ${error.message}`);
  return (data ?? []).filter((row: any) =>
    row.classes?.type === 'WEEKLY' && row.classes?.level_id && row.classes?.lifecycle_status === 'ACTIVE',
  ) as any[];
}

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    await authorize();
    const { id: coderId } = await context.params;
    const supabase = getSupabaseAdmin();
    const { data: coder } = await supabase.from('users').select('id, full_name').eq('id', coderId).eq('role', 'CODER').maybeSingle();
    if (!coder) return NextResponse.json({ error: 'Coder tidak ditemukan' }, { status: 404 });

    const enrollments = await loadActiveWeeklyEnrollments(coderId);
    const journeys = await Promise.all(enrollments.map(async (enrollment) => {
      const levelId = enrollment.classes.level_id as string;
      const [blocks, progress] = await Promise.all([
        blocksDao.listBlocksByLevel(levelId),
        coderProgressDao.getCoderJourney(coderId, levelId),
      ]);
      const progressByBlock = new Map(progress.map((row) => [row.block_id, row]));
      return {
        classId: enrollment.class_id,
        className: enrollment.classes.name,
        levelId,
        levelName: enrollment.classes.levels?.name ?? 'Level',
        initialized: progress.length > 0,
        blocks: blocks.map((block) => ({
          id: block.id,
          name: block.name,
          orderIndex: block.order_index,
          status: progressByBlock.get(block.id)?.status ?? 'PENDING',
        })),
      };
    }));

    return NextResponse.json({ coder: { id: coder.id, name: coder.full_name }, journeys });
  } catch (error) {
    if (error instanceof Error && error.message === 'FORBIDDEN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    console.error('[CoderMigrationProgress] GET failed', error);
    return NextResponse.json({ error: 'Gagal memuat progress Coder' }, { status: 500 });
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    await authorize();
    const { id: coderId } = await context.params;
    const parsed = migrationSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: 'Pilihan kelas atau block tidak valid' }, { status: 400 });

    const supabase = getSupabaseAdmin();
    const [{ data: coder }, enrollments] = await Promise.all([
      supabase.from('users').select('id, full_name').eq('id', coderId).eq('role', 'CODER').maybeSingle(),
      loadActiveWeeklyEnrollments(coderId),
    ]);
    if (!coder) return NextResponse.json({ error: 'Coder tidak ditemukan' }, { status: 404 });

    const enrollment = enrollments.find((row) => row.class_id === parsed.data.classId);
    if (!enrollment) return NextResponse.json({ error: 'Coder tidak aktif di kelas Weekly tersebut' }, { status: 409 });

    const levelId = enrollment.classes.level_id as string;
    const blocks = await blocksDao.listBlocksByLevel(levelId);
    const validBlockIds = new Set(blocks.map((block) => block.id));
    if (parsed.data.completedBlockIds.some((blockId) => !validBlockIds.has(blockId))) {
      return NextResponse.json({ error: 'Ada block yang bukan bagian dari level Coder' }, { status: 400 });
    }

    const { data: classBlocks, error: classBlockError } = await supabase
      .from('class_blocks')
      .select('block_id, status, start_date')
      .eq('class_id', enrollment.class_id)
      .order('start_date', { ascending: true });
    if (classBlockError) throw new Error(`Failed to load class blocks: ${classBlockError.message}`);
    const entryBlockId = classBlocks?.find((row) => row.status === 'CURRENT')?.block_id
      ?? classBlocks?.find((row) => row.status === 'UPCOMING')?.block_id
      ?? blocks[0]?.id
      ?? null;

    await coderProgressDao.ensureJourneyForCoder({ coderId, levelId, blocks, entryBlockId });

    const { data: journey, error: journeyError } = await supabase
      .from('coder_block_progress')
      .select('id, block_id, status, journey_order')
      .eq('coder_id', coderId)
      .eq('level_id', levelId)
      .order('journey_order', { ascending: true });
    if (journeyError || !journey?.length) throw new Error(journeyError?.message ?? 'Journey was not initialized');

    const requested = new Set(parsed.data.completedBlockIds);
    const now = new Date().toISOString();
    const newlyCompleted = journey.filter((row) => requested.has(row.block_id) && row.status !== 'COMPLETED');
    if (newlyCompleted.length > 0) {
      const result = await supabase.from('coder_block_progress')
        .update({ status: 'COMPLETED', completed_at: now, updated_at: now })
        .in('id', newlyCompleted.map((row) => row.id));
      if (result.error) throw new Error(`Failed to complete migrated blocks: ${result.error.message}`);
    }

    const completedIds = new Set([
      ...journey.filter((row) => row.status === 'COMPLETED').map((row) => row.id),
      ...newlyCompleted.map((row) => row.id),
    ]);
    const unfinished = journey.filter((row) => !completedIds.has(row.id));
    const next = unfinished[0];
    if (unfinished.length > 0) {
      const pendingIds = unfinished.filter((row) => row.id !== next.id).map((row) => row.id);
      if (pendingIds.length > 0) {
        const pending = await supabase.from('coder_block_progress').update({ status: 'PENDING', completed_at: null, updated_at: now }).in('id', pendingIds);
        if (pending.error) throw new Error(`Failed to normalize pending blocks: ${pending.error.message}`);
      }
      const current = await supabase.from('coder_block_progress').update({ status: 'IN_PROGRESS', completed_at: null, updated_at: now }).eq('id', next.id);
      if (current.error) throw new Error(`Failed to activate next block: ${current.error.message}`);
    }

    await coderProgressDao.reconcileCompletedLevelsForClass(enrollment.class_id);

    return NextResponse.json({
      success: true,
      completedCount: completedIds.size,
      newlyCompletedCount: newlyCompleted.length,
      message: newlyCompleted.length > 0
        ? `${newlyCompleted.length} block migrasi ditandai selesai. Materinya sekarang tersedia untuk ${coder.full_name}.`
        : `Semua block yang dipilih sudah tercatat selesai untuk ${coder.full_name}.`,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'FORBIDDEN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    console.error('[CoderMigrationProgress] POST failed', error);
    return NextResponse.json({ error: 'Gagal menyimpan progress migrasi' }, { status: 500 });
  }
}
