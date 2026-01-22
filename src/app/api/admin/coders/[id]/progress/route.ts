/**
 * POST /api/admin/coders/[id]/progress
 * Override coder block completion for migration purposes
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { getSupabaseAdmin } from '@/lib/supabaseServer';

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        // Check auth
        const session = await getServerSession(authOptions);
        if (!session || session.user.role !== 'ADMIN') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id: coderId } = await params;
        const body = await request.json();
        const { blockId, action } = body;

        if (!blockId) {
            return NextResponse.json({ error: 'blockId is required' }, { status: 400 });
        }

        const supabase = getSupabaseAdmin();

        // Verify coder exists
        const { data: coder, error: coderError } = await supabase
            .from('users')
            .select('id, full_name')
            .eq('id', coderId)
            .eq('role', 'CODER')
            .single();

        if (coderError || !coder) {
            return NextResponse.json({ error: 'Coder not found' }, { status: 404 });
        }

        // Get block info
        const { data: block, error: blockError } = await supabase
            .from('blocks')
            .select('id, name, level_id')
            .eq('id', blockId)
            .single();

        if (blockError || !block) {
            return NextResponse.json({ error: 'Block not found' }, { status: 404 });
        }

        if (action === 'complete') {
            // Check if completion record exists
            const { data: existing } = await supabase
                .from('coder_block_completions' as any)
                .select('id')
                .eq('coder_id', coderId)
                .eq('block_id', blockId)
                .maybeSingle();

            if (existing) {
                return NextResponse.json({
                    success: true,
                    message: `${coder.full_name} sudah pernah ditandai selesai untuk block "${block.name}"`
                });
            }

            // Insert completion record
            const { error: insertError } = await supabase
                .from('coder_block_completions' as any)
                .insert({
                    coder_id: coderId,
                    block_id: blockId,
                    completed_at: new Date().toISOString(),
                    completed_by_admin: true,
                    notes: 'Migrated from non-LMS system'
                });

            if (insertError) {
                console.error('[ProgressOverride] Insert error:', insertError);

                // If table doesn't exist, try alternative approach using class_blocks
                // For now, return error with guidance
                return NextResponse.json({
                    error: 'Database error. Pastikan tabel coder_block_completions sudah dibuat.',
                    details: insertError.message
                }, { status: 500 });
            }

            return NextResponse.json({
                success: true,
                message: `Block "${block.name}" berhasil ditandai selesai untuk ${coder.full_name}`
            });
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

    } catch (error) {
        console.error('[ProgressOverride] Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// GET: List completed blocks for a coder
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || session.user.role !== 'ADMIN') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id: coderId } = await params;
        const supabase = getSupabaseAdmin();

        const { data: completions, error } = await supabase
            .from('coder_block_completions' as any)
            .select(`
                id,
                block_id,
                completed_at,
                completed_by_admin,
                block_templates!coder_block_completions_block_id_fkey(name, level_id)
            `)
            .eq('coder_id', coderId)
            .order('completed_at', { ascending: false });

        if (error) {
            console.error('[ProgressOverride] Fetch error:', error);
            return NextResponse.json({ completions: [] });
        }

        return NextResponse.json({ completions: completions || [] });

    } catch (error) {
        console.error('[ProgressOverride] Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
