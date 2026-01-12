import { NextResponse } from 'next/server';
import { getSessionOrThrow } from '@/lib/auth';
import { listAllSoftware, createSoftware } from '@/lib/dao/softwareDao';

export async function GET() {
    try {
        await getSessionOrThrow();
        const software = await listAllSoftware();
        return NextResponse.json(software);
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const session = await getSessionOrThrow();
        if (session.user.role !== 'ADMIN') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        const body = await request.json();
        const { name, description, version, installationUrl, installationInstructions, minimumSpecs, accessInfo, iconUrl } = body;

        if (!name || typeof name !== 'string' || name.trim().length < 2) {
            return NextResponse.json({ error: 'Name is required (min 2 characters)' }, { status: 400 });
        }

        const software = await createSoftware({
            name: name.trim(),
            description: description ?? null,
            version: version ?? null,
            installationUrl: installationUrl ?? null,
            installationInstructions: installationInstructions ?? null,
            minimumSpecs: minimumSpecs ?? null,
            accessInfo: accessInfo ?? null,
            iconUrl: iconUrl ?? null,
        });

        return NextResponse.json(software, { status: 201 });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
