import { NextResponse } from 'next/server';
import { writeFile, mkdir, readdir, rename, unlink } from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import { getSessionOrThrow } from '@/lib/auth';
import { detectAvatarImageType, MAX_AVATAR_UPLOAD_BYTES } from '@/lib/services/avatarUploadSecurity';
import { buildAvatarPublicPath, getAvatarUploadDir } from '@/lib/services/avatarStorage';
import { consumeRateLimit } from '@/lib/rateLimit';

export async function POST(request: Request) {
    try {
        const session = await getSessionOrThrow();
        const userId = session.user.id;

        if (!await consumeRateLimit({ request, scope: 'avatar-upload', actorId: userId, maxRequests: 10, windowSeconds: 60 * 60 })) {
            return NextResponse.json({ error: 'Terlalu banyak percobaan upload. Silakan coba lagi nanti.' }, { status: 429 });
        }

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

        const filename = `${userId}${imageType.extension}`;
        const temporaryFilename = `.${userId}-${randomUUID()}.tmp`;
        const uploadDir = getAvatarUploadDir();

        // Ensure directory exists
        await mkdir(uploadDir, { recursive: true });

        const filePath = path.join(uploadDir, filename);
        const temporaryPath = path.join(uploadDir, temporaryFilename);
        await writeFile(temporaryPath, buffer, { flag: 'wx' });
        await rename(temporaryPath, filePath);

        const staleFiles = (await readdir(uploadDir)).filter((entry) =>
            entry !== filename && entry.startsWith(`${userId}-`)
        );
        await Promise.all(staleFiles.map((entry) => unlink(path.join(uploadDir, entry)).catch(() => undefined)));

        const publicPath = buildAvatarPublicPath(filename);

        return NextResponse.json({ success: true, filePath: publicPath });
    } catch (error: unknown) {
        console.error('Upload error:', error);
        return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
    }
}
