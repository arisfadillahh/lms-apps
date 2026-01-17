/**
 * POST /api/invoices/generate
 * Generate invoices for a specific month/year
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { generateInvoicesForMonth } from '@/lib/services/invoiceGenerator';

export async function POST(request: NextRequest) {
    try {
        // Check authentication
        const session = await getServerSession(authOptions);
        if (!session || session.user.role !== 'ADMIN') {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        // Parse request body
        const body = await request.json();
        const { month, year } = body;

        // Validate input
        if (!month || !year) {
            return NextResponse.json(
                { error: 'Month and year are required' },
                { status: 400 }
            );
        }

        if (month < 1 || month > 12) {
            return NextResponse.json(
                { error: 'Month must be between 1 and 12' },
                { status: 400 }
            );
        }

        if (year < 2020 || year > 2100) {
            return NextResponse.json(
                { error: 'Invalid year' },
                { status: 400 }
            );
        }

        // Generate invoices
        const result = await generateInvoicesForMonth(month, year);

        return NextResponse.json(result);

    } catch (error) {
        console.error('[API] Generate invoices error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
