import { NextRequest, NextResponse } from 'next/server';
import { createSeasonalInvoice } from '@/lib/dao/invoicesDao';

// Helper to generate seasonal invoice number
function generateSeasonalInvoiceNumber(month: number, year: number): string {
    const monthStr = String(month).padStart(2, '0');
    const randomStr = Math.floor(1000 + Math.random() * 9000).toString(); // 4 digit random
    return `SSN-${monthStr}${year}-${randomStr}`;
}

export async function POST(request: NextRequest) {
    try {
        // Simple API Key authentication (for n8n)
        const authHeader = request.headers.get('authorization');
        // Fallback token is provided as example. Ideally set this in .env
        const expectedToken = process.env.N8N_API_SECRET || 'clevio-seasonal-secret-2026';
        
        if (!authHeader || !authHeader.startsWith('Bearer ') || authHeader.split(' ')[1] !== expectedToken) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const {
            student_name,
            student_phone,
            class_name,
            base_price,
            discount_amount = 0,
            final_price,
            description
        } = body;

        // Validation
        if (!student_name || !student_phone || !class_name || base_price === undefined) {
            return NextResponse.json(
                { error: 'Missing required fields: student_name, student_phone, class_name, base_price' },
                { status: 400 }
            );
        }

        const calculatedFinalPrice = final_price !== undefined ? final_price : (base_price - discount_amount);

        // Current period processing
        const now = new Date();
        const periodMonth = now.getMonth() + 1;
        const periodYear = now.getFullYear();
        const startDate = now.toISOString().split('T')[0];
        
        // Due date is 1 day after creation
        const dueDateObj = new Date(now);
        dueDateObj.setDate(dueDateObj.getDate() + 1);
        const dueDate = dueDateObj.toISOString().split('T')[0];

        // Period end date is roughly 1 month after start date 
        const endDateObj = new Date(now);
        endDateObj.setMonth(endDateObj.getMonth() + 1);
        const endDate = endDateObj.toISOString().split('T')[0];

        const invoiceNumber = generateSeasonalInvoiceNumber(periodMonth, periodYear);

        const result = await createSeasonalInvoice({
            invoice_number: invoiceNumber,
            student_phone: student_phone,
            student_name: student_name,
            period_month: periodMonth,
            period_year: periodYear,
            period_start_date: startDate,
            period_end_date: endDate,
            due_date: dueDate,
            total_amount: calculatedFinalPrice,
            items: [
                {
                    class_name: class_name,
                    level_name: 'Seasonal Course',
                    description: description,
                    base_price: base_price,
                    discount_amount: discount_amount,
                    final_price: calculatedFinalPrice
                }
            ]
        });

        if (!result) {
            return NextResponse.json(
                { error: 'Failed to create seasonal invoice' },
                { status: 500 }
            );
        }

        // Fetch process.env.NEXT_PUBLIC_BASE_URL to generate the link
        let baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://lms-clevio.vercel.app';
        if (baseUrl.endsWith('/')) {
            baseUrl = baseUrl.slice(0, -1);
        }
        const invoiceUrl = `${baseUrl}/invoice/${invoiceNumber}`;

        return NextResponse.json({
            success: true,
            message: 'Seasonal invoice created successfully',
            invoice_number: invoiceNumber,
            invoice_url: invoiceUrl,
            data: result.invoice
        });

    } catch (error) {
        console.error('[API] Create seasonal invoice error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
