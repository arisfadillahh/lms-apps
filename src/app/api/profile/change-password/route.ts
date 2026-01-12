import { NextResponse } from 'next/server';
import { z } from 'zod'; // Assumed zod is available, otherwise manual validation
import { getSessionOrThrow } from '@/lib/auth';
import { getUserById, resetUserPassword } from '@/lib/dao/usersDao';
import { verifyPassword, hashPassword } from '@/lib/passwords';

const changePasswordSchema = z.object({
    currentPassword: z.string().min(1, "Password saat ini harus diisi"),
    newPassword: z.string().min(6, "Password baru minimal 6 karakter"),
});

export async function PATCH(request: Request) {
    try {
        const session = await getSessionOrThrow();
        const body = await request.json();

        const parseResult = changePasswordSchema.safeParse(body);
        if (!parseResult.success) {
            return NextResponse.json(
                { error: parseResult.error.issues[0].message },
                { status: 400 }
            );
        }

        const { currentPassword, newPassword } = parseResult.data;
        const userId = session.user.id;

        // 1. Fetch user to get current password hash
        const user = await getUserById(userId);
        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        // 2. Verify current password
        const isMatch = await verifyPassword(currentPassword, user.password_hash);
        if (!isMatch) {
            return NextResponse.json({ error: 'Password saat ini salah' }, { status: 400 });
        }

        // 3. Hash new password
        const newHash = await hashPassword(newPassword);

        // 4. Update password in DB
        // We reuse resetUserPassword but need to be careful about roles if strict check exists
        // usersDao.resetUserPassword expects roles array. We can pass the user's role or all roles.
        await resetUserPassword(userId, newHash, [user.role]);

        return NextResponse.json({ message: 'Password berhasil diubah' });
    } catch (error: any) {
        console.error('Error changing password:', error);
        return NextResponse.json(
            { error: error.message || 'Internal Server Error' },
            { status: 500 }
        );
    }
}
