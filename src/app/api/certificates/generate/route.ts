import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { createCertificate } from '@/lib/services/certificates';

const certificateSchema = z.object({
    external_reference: z.string().min(3).max(120),
    student: z.object({
        name: z.string().min(1).max(160)
    }),
    program: z.object({
        name: z.string().min(1).max(180),
        date_range: z.string().max(120).optional().nullable()
    }),
    class_names: z.array(z.string().min(1).max(120)).min(1).max(8),
    level_name: z.string().max(80).optional().nullable(),
    issued_date: z.string().max(40).optional().nullable(),
    certificate_number: z.string().max(80).optional().nullable(),
    template: z.object({
        key: z.string().min(1).max(80).optional(),
        name: z.string().min(1).max(120).optional(),
        version: z.number().int().positive().max(999).optional(),
        layout: z.record(z.string(), z.unknown()).optional()
    }).optional()
});

export async function POST(request: NextRequest) {
    const unauthorized = assertCoreApiToken(request);
    if (unauthorized) return unauthorized;

    const body = await request.json().catch(() => null);
    const parsed = certificateSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ ok: false, error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
    }

    const payload = parsed.data;
    const result = await createCertificate({
        externalReference: payload.external_reference,
        studentName: payload.student.name,
        programName: payload.program.name,
        classNames: payload.class_names,
        levelName: payload.level_name,
        dateRange: payload.program.date_range,
        issuedDate: payload.issued_date,
        certificateNumber: payload.certificate_number,
        template: payload.template
    });

    return NextResponse.json({
        ok: true,
        ...result
    });
}

function assertCoreApiToken(request: NextRequest) {
    const expectedToken = process.env.LMS_CORE_API_TOKEN?.trim();
    if (!expectedToken) return null;

    const authorization = request.headers.get('authorization') || '';
    const actualToken = authorization.replace(/^Bearer\s+/i, '').trim();
    if (actualToken !== expectedToken) {
        return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    return null;
}
