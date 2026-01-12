import { NextResponse } from 'next/server';
import { getSessionOrThrow } from '@/lib/auth';
import { usersDao } from '@/lib/dao';
import { z } from 'zod';

const updateProfileSchema = z.object({
    fullName: z.string().min(1, "Full Name is required").optional(),
    avatarPath: z.string().optional(),
});

export async function POST(request: Request) {
    try {
        const session = await getSessionOrThrow();
        const userId = session.user.id;
        const body = await request.json();

        const parsed = updateProfileSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
        }

        const { fullName, avatarPath } = parsed.data;

        // Call DAO to update user
        await usersDao.updateUser(userId, {
            full_name: fullName,
            avatar_path: avatarPath
        });

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Profile update error:', error);
        return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
    }
}
