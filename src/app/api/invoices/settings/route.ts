/**
 * GET /api/invoices/settings - Get invoice settings
 * PUT /api/invoices/settings - Update invoice settings
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { getInvoiceSettings, updateInvoiceSettings } from '@/lib/dao/invoicesDao';

export async function GET() {
    try {
        // Check authentication
        const session = await getServerSession(authOptions);
        if (!session || session.user.role !== 'ADMIN') {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const settings = await getInvoiceSettings();

        if (!settings) {
            return NextResponse.json(
                { error: 'Settings not found' },
                { status: 404 }
            );
        }

        return NextResponse.json(settings);

    } catch (error) {
        console.error('[API] Get invoice settings error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

export async function PUT(request: NextRequest) {
    try {
        // Check authentication
        const session = await getServerSession(authOptions);
        if (!session || session.user.role !== 'ADMIN') {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const body = await request.json();

        // Validate generate_day
        if (body.generate_day !== undefined) {
            if (body.generate_day < 1 || body.generate_day > 28) {
                return NextResponse.json(
                    { error: 'Generate day must be between 1 and 28' },
                    { status: 400 }
                );
            }
        }

        // Validate due_days
        if (body.due_days !== undefined) {
            if (body.due_days < 1) {
                return NextResponse.json(
                    { error: 'Due days must be at least 1' },
                    { status: 400 }
                );
            }
        }

        const settings = await updateInvoiceSettings(body);

        if (!settings) {
            return NextResponse.json(
                { error: 'Failed to update settings' },
                { status: 500 }
            );
        }

        return NextResponse.json(settings);

    } catch (error) {
        console.error('[API] Update invoice settings error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
