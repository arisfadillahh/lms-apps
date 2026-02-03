import { NextResponse } from 'next/server';
import { getSessionOrThrow } from '@/lib/auth';
import { assertRole } from '@/lib/roles';

/**
 * GET /api/admin/migrations/add-period-dates
 * 
 * This endpoint provides instructions for running the migration.
 * The actual migration should be run via Supabase SQL Editor.
 * 
 * Migration file: migrations/20260203_add_invoice_period_dates.sql
 */
export async function GET(request: Request) {
    try {
        const session = await getSessionOrThrow();
        await assertRole(session, 'ADMIN');

        return NextResponse.json({
            message: 'Migration instructions',
            instructions: [
                '1. Go to Supabase Dashboard → SQL Editor',
                '2. Copy contents from migrations/20260203_add_invoice_period_dates.sql',
                '3. Paste and run the SQL',
                '4. Verify columns added successfully'
            ],
            migrationFile: 'migrations/20260203_add_invoice_period_dates.sql',
            columns: [
                'period_start_date DATE',
                'period_end_date DATE'
            ]
        });

    } catch (error) {
        console.error('[Migration] Error:', error);
        return NextResponse.json({
            success: false,
            error: String(error)
        }, { status: 500 });
    }
}
