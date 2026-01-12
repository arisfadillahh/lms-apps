"use server";

import { getSupabaseAdmin } from '@/lib/supabaseServer';
import type { SoftwareRecord } from './softwareDao';

export type BlockSoftwareRecord = {
    id: string;
    block_id: string;
    software_id: string;
    created_at: string;
};

export type BlockSoftwareWithDetails = BlockSoftwareRecord & {
    software: SoftwareRecord;
};

/**
 * Get all software associated with a block
 */
export async function getSoftwareByBlockId(blockId: string): Promise<SoftwareRecord[]> {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
        .from('block_software')
        .select(`
      software:software_id (*)
    `)
        .eq('block_id', blockId);

    if (error) {
        throw new Error(`Failed to fetch software for block: ${error.message}`);
    }

    // Extract software from the nested structure
    return (data ?? []).map((item: { software: SoftwareRecord }) => item.software);
}

/**
 * Set software for a block (replaces all existing associations)
 */
export async function setSoftwareForBlock(blockId: string, softwareIds: string[]): Promise<void> {
    const supabase = getSupabaseAdmin();

    // Delete existing associations
    const { error: deleteError } = await supabase
        .from('block_software')
        .delete()
        .eq('block_id', blockId);

    if (deleteError) {
        throw new Error(`Failed to clear block software: ${deleteError.message}`);
    }

    // Insert new associations
    if (softwareIds.length > 0) {
        const insertPayload = softwareIds.map(softwareId => ({
            block_id: blockId,
            software_id: softwareId,
        }));

        const { error: insertError } = await supabase
            .from('block_software')
            .insert(insertPayload);

        if (insertError) {
            throw new Error(`Failed to set block software: ${insertError.message}`);
        }
    }
}

/**
 * Add a single software to a block
 */
export async function addSoftwareToBlock(blockId: string, softwareId: string): Promise<void> {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase
        .from('block_software')
        .insert({ block_id: blockId, software_id: softwareId });

    if (error) {
        // Ignore unique constraint violations (already exists)
        if (!error.message.includes('duplicate')) {
            throw new Error(`Failed to add software to block: ${error.message}`);
        }
    }
}

/**
 * Remove a software from a block
 */
export async function removeSoftwareFromBlock(blockId: string, softwareId: string): Promise<void> {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase
        .from('block_software')
        .delete()
        .eq('block_id', blockId)
        .eq('software_id', softwareId);

    if (error) {
        throw new Error(`Failed to remove software from block: ${error.message}`);
    }
}
