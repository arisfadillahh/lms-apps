import { NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { getSessionOrThrow } from '@/lib/auth';

export async function POST(request: Request) {
    try {
        const session = await getSessionOrThrow();
        const userId = session.user.id;

        const formData = await request.formData();
        const file = formData.get('file') as File;

        if (!file) {
            return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        const filename = `${userId}-${Date.now()}${path.extname(file.name)}`;
        const uploadDir = path.join(process.cwd(), 'public/uploads/avatars');

        // Ensure directory exists
        await mkdir(uploadDir, { recursive: true });

        const filePath = path.join(uploadDir, filename);
        await writeFile(filePath, buffer);

        const publicPath = `/uploads/avatars/${filename}`;

        return NextResponse.json({ success: true, filePath: publicPath });
    } catch (error: any) {
        console.error('Upload error:', error);
        return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
    }
}
