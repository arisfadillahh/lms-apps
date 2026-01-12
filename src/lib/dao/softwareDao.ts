"use server";

import { getSupabaseAdmin } from '@/lib/supabaseServer';
import type { TablesInsert, TablesRow, TablesUpdate } from '@/types/supabase';

export type SoftwareRecord = TablesRow<'software'>;

export type CreateSoftwareInput = {
    name: string;
    description?: string | null;
    version?: string | null;
    installationUrl?: string | null;
    installationInstructions?: string | null;
    minimumSpecs?: Record<string, unknown> | null;
    accessInfo?: string | null;
    iconUrl?: string | null;
};

export type UpdateSoftwareInput = Partial<CreateSoftwareInput>;

export async function listAllSoftware(): Promise<SoftwareRecord[]> {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
        .from('software')
        .select('*')
        .order('name', { ascending: true });

    if (error) {
        throw new Error(`Failed to list software: ${error.message}`);
    }

    return data ?? [];
}

export async function getSoftwareById(id: string): Promise<SoftwareRecord | null> {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from('software').select('*').eq('id', id).maybeSingle();

    if (error) {
        throw new Error(`Failed to fetch software: ${error.message}`);
    }

    return data;
}

export async function createSoftware(input: CreateSoftwareInput): Promise<SoftwareRecord> {
    const supabase = getSupabaseAdmin();
    const payload: TablesInsert<'software'> = {
        name: input.name,
        description: input.description ?? null,
        version: input.version ?? null,
        installation_url: input.installationUrl ?? null,
        installation_instructions: input.installationInstructions ?? null,
        minimum_specs: input.minimumSpecs as typeof payload.minimum_specs ?? null,
        access_info: input.accessInfo ?? null,
        icon_url: input.iconUrl ?? null,
    };

    const { data, error } = await supabase.from('software').insert(payload).select('*').single();
    if (error) {
        throw new Error(`Failed to create software: ${error.message}`);
    }

    return data;
}

export async function updateSoftware(id: string, input: UpdateSoftwareInput): Promise<SoftwareRecord> {
    const supabase = getSupabaseAdmin();
    const payload: TablesUpdate<'software'> = {};

    if (input.name !== undefined) payload.name = input.name;
    if (input.description !== undefined) payload.description = input.description;
    if (input.version !== undefined) payload.version = input.version;
    if (input.installationUrl !== undefined) payload.installation_url = input.installationUrl;
    if (input.installationInstructions !== undefined) payload.installation_instructions = input.installationInstructions;
    if (input.minimumSpecs !== undefined) payload.minimum_specs = input.minimumSpecs as typeof payload.minimum_specs;
    if (input.accessInfo !== undefined) payload.access_info = input.accessInfo;
    if (input.iconUrl !== undefined) payload.icon_url = input.iconUrl;

    const { data, error } = await supabase.from('software').update(payload).eq('id', id).select('*').single();
    if (error) {
        throw new Error(`Failed to update software: ${error.message}`);
    }

    return data;
}

export async function deleteSoftware(id: string): Promise<void> {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from('software').delete().eq('id', id);

    if (error) {
        throw new Error(`Failed to delete software: ${error.message}`);
    }
}
