import { NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import { getSessionOrThrow } from '@/lib/auth';
import { detectAvatarImageType, MAX_AVATAR_UPLOAD_BYTES } from '@/lib/services/avatarUploadSecurity';

export async function POST(request: Request) {
    try {
        const session = await getSessionOrThrow();
        const userId = session.user.id;

        const formData = await request.formData();
        const file = formData.get('file') as File;

        if (!file) {
            return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
        }

        if (file.size > MAX_AVATAR_UPLOAD_BYTES) {
            return NextResponse.json({ error: 'File too large. Maximum size is 2MB.' }, { status: 400 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        const imageType = detectAvatarImageType(file.type, buffer);

        if (!imageType) {
            return NextResponse.json({ error: 'Only PNG, JPG, GIF, or WEBP images are allowed.' }, { status: 400 });
        }

        const filename = `${userId}-${Date.now()}-${randomUUID()}${imageType.extension}`;
        const uploadDir = path.join(process.cwd(), '.uploads/avatars');

        // Ensure directory exists
        await mkdir(uploadDir, { recursive: true });

        const filePath = path.join(uploadDir, filename);
        await writeFile(filePath, buffer);

        const publicPath = `/api/avatars/${filename}`;

        return NextResponse.json({ success: true, filePath: publicPath });
    } catch (error: any) {
        console.error('Upload error:', error);
        return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
    }
}
