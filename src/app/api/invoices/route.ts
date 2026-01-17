/**
 * GET /api/invoices - List invoices with filters
 * POST /api/invoices - Not used (use /generate instead)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { listInvoices, getInvoiceSettings } from '@/lib/dao/invoicesDao';
import { getInvoiceStats } from '@/lib/services/invoiceGenerator';
import type { InvoiceFilters, InvoiceStatus } from '@/lib/types/invoice';

export async function GET(request: NextRequest) {
    try {
        // Check authentication
        const session = await getServerSession(authOptions);
        if (!session || session.user.role !== 'ADMIN') {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        // Parse query params
        const { searchParams } = new URL(request.url);
        const filters: InvoiceFilters = {
            month: searchParams.get('month') ? parseInt(searchParams.get('month')!) : undefined,
            year: searchParams.get('year') ? parseInt(searchParams.get('year')!) : undefined,
            status: searchParams.get('status') as InvoiceStatus | undefined,
            search: searchParams.get('search') || undefined,
            page: searchParams.get('page') ? parseInt(searchParams.get('page')!) : 1,
            limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 20
        };

        // Get invoices
        const result = await listInvoices(filters);

        // Get stats if month/year provided
        let stats = null;
        if (filters.month && filters.year) {
            stats = await getInvoiceStats(filters.month, filters.year);
        }

        // Get settings
        const settings = await getInvoiceSettings();

        return NextResponse.json({
            ...result,
            stats,
            settings
        });

    } catch (error) {
        console.error('[API] List invoices error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
