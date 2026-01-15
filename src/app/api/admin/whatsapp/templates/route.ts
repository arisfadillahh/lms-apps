import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getSessionOrThrow } from '@/lib/auth';
import { assertRole } from '@/lib/roles';
import { getSupabaseAdmin } from '@/lib/supabaseServer';

const templateSchema = z.object({
    id: z.string().uuid().optional(),
    category: z.enum(['PARENT_ABSENT', 'REPORT_SEND', 'REMINDER']),
    templateContent: z.string().min(1),
    variables: z.array(z.string()).optional(),
});

export async function GET() {
    const session = await getSessionOrThrow();
    await assertRole(session, 'ADMIN');

    const supabase = getSupabaseAdmin();

    // Cast to any since the table may not exist in types yet
    const { data, error } = await (supabase as any)
        .from('whatsapp_templates')
        .select('*')
        .order('category');

    if (error) {
        console.error('[Get Templates] Error:', error);
        return NextResponse.json({ templates: [] });
    }

    return NextResponse.json({ templates: data });
}

export async function POST(request: Request) {
    const session = await getSessionOrThrow();
    await assertRole(session, 'ADMIN');

    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const parsed = templateSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // Cast to any since the table may not exist in types yet
    const { data, error } = await (supabase as any)
        .from('whatsapp_templates')
        .insert({
            category: parsed.data.category,
            template_content: parsed.data.templateContent,
            variables: parsed.data.variables || [],
            updated_by: session.user.id,
        })
        .select('*')
        .single();

    if (error) {
        console.error('[Create Template] Error:', error);
        return NextResponse.json({ error: 'Gagal membuat template' }, { status: 500 });
    }

    return NextResponse.json({ template: data }, { status: 201 });
}

export async function PUT(request: Request) {
    const session = await getSessionOrThrow();
    await assertRole(session, 'ADMIN');

    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const parsed = templateSchema.safeParse(body);
    if (!parsed.success || !parsed.data.id) {
        return NextResponse.json({ error: 'Validation failed' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // Cast to any since the table may not exist in types yet
    const { data, error } = await (supabase as any)
        .from('whatsapp_templates')
        .update({
            category: parsed.data.category,
            template_content: parsed.data.templateContent,
            variables: parsed.data.variables || [],
            updated_by: session.user.id,
            updated_at: new Date().toISOString(),
        })
        .eq('id', parsed.data.id)
        .select('*')
        .single();

    if (error) {
        console.error('[Update Template] Error:', error);
        return NextResponse.json({ error: 'Gagal mengupdate template' }, { status: 500 });
    }

    return NextResponse.json({ template: data });
}
