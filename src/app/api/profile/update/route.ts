import { NextResponse } from 'next/server';
import { getSessionOrThrow } from '@/lib/auth';
import { usersDao } from '@/lib/dao';
import { z } from 'zod';

const updateProfileSchema = z.object({
    fullName: z.string().min(1, "Full Name is required").optional(),
    avatarPath: z.string().optional(),
    // Coder-specific fields
    birthDate: z.string().nullable().optional(),
    gender: z.enum(['MALE', 'FEMALE']).nullable().optional(),
    schoolName: z.string().nullable().optional(),
    schoolGrade: z.string().nullable().optional(),
    parentName: z.string().nullable().optional(),
    parentEmail: z.string().email().nullable().optional().or(z.literal('')),
    parentContactPhone: z.string().nullable().optional(),
    address: z.string().nullable().optional(),
    referralSource: z.string().nullable().optional(),
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

        const data = parsed.data;

        // Build update payload - only include fields that are present
        const updatePayload: Record<string, unknown> = {};

        if (data.fullName !== undefined) updatePayload.full_name = data.fullName;
        if (data.avatarPath !== undefined) updatePayload.avatar_path = data.avatarPath;
        if (data.birthDate !== undefined) updatePayload.birth_date = data.birthDate || null;
        if (data.gender !== undefined) updatePayload.gender = data.gender || null;
        if (data.schoolName !== undefined) updatePayload.school_name = data.schoolName || null;
        if (data.schoolGrade !== undefined) updatePayload.school_grade = data.schoolGrade || null;
        if (data.parentName !== undefined) updatePayload.parent_name = data.parentName || null;
        if (data.parentEmail !== undefined) updatePayload.parent_email = data.parentEmail || null;
        if (data.parentContactPhone !== undefined) updatePayload.parent_contact_phone = data.parentContactPhone || null;
        if (data.address !== undefined) updatePayload.address = data.address || null;
        if (data.referralSource !== undefined) updatePayload.referral_source = data.referralSource || null;

        // Call DAO to update user
        await usersDao.updateUser(userId, updatePayload);

        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        console.error('Profile update error:', error);
        return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
    }
}

