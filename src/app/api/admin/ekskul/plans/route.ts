import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getSessionOrThrow } from '@/lib/auth';
import { assertRole } from '@/lib/roles';
import { getSupabaseAdmin } from '@/lib/supabaseServer';

const createPlanSchema = z.object({
    name: z.string().min(1).max(200),
    description: z.string().max(1000).nullable().optional(),
});

export async function POST(request: Request) {
    const session = await getSessionOrThrow();
    await assertRole(session, 'ADMIN');

    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const parsed = createPlanSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // Use type casting in case the table types are not synced yet
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
        .from('ekskul_lesson_plans')
        .insert({
            name: parsed.data.name,
            description: parsed.data.description ?? null,
            total_lessons: 0,
            is_active: true,
        })
        .select('*')
        .single();

    if (error) {
        console.error('[Create Ekskul Plan] Error:', error);
        return NextResponse.json({ error: `Gagal membuat plan: ${error.message}` }, { status: 500 });
    }

    return NextResponse.json({ plan: data }, { status: 201 });
}

export async function GET() {
    const session = await getSessionOrThrow();
    await assertRole(session, 'ADMIN');

    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
        .from('ekskul_lesson_plans')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        return NextResponse.json({ error: 'Gagal mengambil data' }, { status: 500 });
    }

    return NextResponse.json(data);
}
