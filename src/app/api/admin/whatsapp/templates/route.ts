import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getSessionOrThrow } from '@/lib/auth';
import { assertRole } from '@/lib/roles';
import { getSupabaseAdmin } from '@/lib/supabaseServer';

const templateSchema = z.object({
    id: z.string().uuid().optional(),
    category: z.enum([
        'PARENT_ABSENT',
        'REPORT_SEND',
        'TRIAL_REPORT_SEND',
        'REMINDER',
        'CLASS_REMINDER_ONLINE',
        'CLASS_REMINDER_OFFLINE',
    ]),
    templateContent: z.string().min(1),
    variables: z.array(z.string()).optional(),
});

type PackedReportTemplates = {
    weekly?: string[];
    trial?: { content: string; variables: string[]; updatedAt?: string };
};

function readPackedTemplates(value: unknown): PackedReportTemplates | null {
    if (!value || Array.isArray(value) || typeof value !== 'object') return null;
    return value as PackedReportTemplates;
}

function isCategoryConstraintError(error: { code?: string; message?: string } | null) {
    return Boolean(error && (error.code === '23514' || /valid_whatsapp_template_category|check constraint/i.test(error.message || '')));
}

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

    const templates = [...(data || [])];
    const weeklyTemplate = templates.find((template: any) => template.category === 'REPORT_SEND');
    const directTrialTemplate = templates.some((template: any) => template.category === 'TRIAL_REPORT_SEND');
    const packed = readPackedTemplates(weeklyTemplate?.variables);
    if (weeklyTemplate && !directTrialTemplate && packed?.trial?.content) {
        templates.push({
            ...weeklyTemplate,
            id: undefined,
            category: 'TRIAL_REPORT_SEND',
            template_content: packed.trial.content,
            variables: packed.trial.variables,
            updated_at: packed.trial.updatedAt || weeklyTemplate.updated_at,
        });
    }

    return NextResponse.json({ templates });
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

    const templatePayload = {
        category: parsed.data.category,
        template_content: parsed.data.templateContent,
        variables: parsed.data.variables || [],
        updated_by: session.user.id,
        updated_at: new Date().toISOString(),
    };

    let storedVariables: unknown = templatePayload.variables;
    if (parsed.data.category === 'REPORT_SEND') {
        const { data: existingWeekly } = await (supabase as any)
            .from('whatsapp_templates')
            .select('variables')
            .eq('category', 'REPORT_SEND')
            .maybeSingle();
        const packed = readPackedTemplates(existingWeekly?.variables);
        if (packed?.trial?.content) {
            storedVariables = { weekly: templatePayload.variables, trial: packed.trial };
        }
    }

    // New databases store trial templates as their own row. Older deployments
    // temporarily pack the trial template into REPORT_SEND.variables until the
    // additive migration is applied, so the admin UI remains usable meanwhile.
    let { data, error } = await (supabase as any)
        .from('whatsapp_templates')
        .upsert({
            ...templatePayload,
            variables: storedVariables,
        }, { onConflict: 'category' })
        .select('*')
        .single();

    if (parsed.data.category === 'TRIAL_REPORT_SEND' && isCategoryConstraintError(error)) {
        const { data: weekly, error: weeklyError } = await (supabase as any)
            .from('whatsapp_templates')
            .select('id, category, template_content, variables, updated_at')
            .eq('category', 'REPORT_SEND')
            .maybeSingle();
        const existingPacked = readPackedTemplates(weekly?.variables);
        if (!weeklyError && weekly) {
            const packed: PackedReportTemplates = {
                weekly: Array.isArray(weekly.variables) ? weekly.variables : existingPacked?.weekly,
                trial: {
                    content: parsed.data.templateContent,
                    variables: parsed.data.variables || [],
                    updatedAt: templatePayload.updated_at,
                },
            };
            const fallback = await (supabase as any)
                .from('whatsapp_templates')
                .update({ variables: packed, updated_by: session.user.id, updated_at: templatePayload.updated_at })
                .eq('id', weekly.id)
                .select('*')
                .single();
            data = fallback.data
                ? { ...fallback.data, id: undefined, category: 'TRIAL_REPORT_SEND', template_content: parsed.data.templateContent, variables: parsed.data.variables || [] }
                : null;
            error = fallback.error;
        }
    }

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
