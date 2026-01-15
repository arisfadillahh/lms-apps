import type { CSSProperties } from 'react';
import Link from 'next/link';

import { getSessionOrThrow } from '@/lib/auth';
import { assertRole } from '@/lib/roles';
import { getSupabaseAdmin } from '@/lib/supabaseServer';
import { usersDao } from '@/lib/dao';
import CoderPaymentTable from './CoderPaymentTable';

export default async function CoderPaymentsPage() {
    const session = await getSessionOrThrow();
    await assertRole(session, 'ADMIN');

    const supabase = getSupabaseAdmin();

    // Fetch coders with their payment periods
    const coders = await usersDao.listUsersByRole('CODER');

    const { data: periods } = await supabase
        .from('coder_payment_periods')
        .select('*, payment_plans(*), pricing(*)')
        .order('end_date', { ascending: true });

    // Group periods by coder
    const coderPayments = new Map<string, typeof periods>();
    periods?.forEach((period) => {
        const existing = coderPayments.get(period.coder_id) || [];
        existing.push(period);
        coderPayments.set(period.coder_id, existing);
    });

    // Fetch plans and pricing for the button
    const [{ data: plans }, { data: pricing }] = await Promise.all([
        supabase.from('payment_plans').select('*').eq('is_active', true),
        supabase.from('pricing').select('*, levels(name)').eq('is_active', true),
    ]);

    // Fetch active enrollments to get class names
    const { data: rawEnrollments } = await supabase
        .from('enrollments')
        .select('coder_id, classes(name)')
        .eq('status', 'ACTIVE');

    const coderClasses = new Map<string, string[]>();
    rawEnrollments?.forEach((enrollment: any) => { // Type assertion as easy fix for nested join
        if (enrollment.classes?.name) {
            const existing = coderClasses.get(enrollment.coder_id) || [];
            existing.push(enrollment.classes.name);
            coderClasses.set(enrollment.coder_id, existing);
        }
    });

    // Prepare data for the client table
    const tableData = coders.map((coder) => {
        const coderPeriods = coderPayments.get(coder.id) || [];
        const activePeriod = coderPeriods.find((p: any) => p.status === 'ACTIVE');
        const classNames = coderClasses.get(coder.id) || [];

        return {
            id: coder.id,
            full_name: coder.full_name,
            username: coder.username,
            className: classNames.join(', '), // Join multiple classes
            activePeriod: activePeriod ? {
                id: activePeriod.id,
                start_date: activePeriod.start_date,
                end_date: activePeriod.end_date,
                total_amount: activePeriod.total_amount,
                status: activePeriod.status,
                payment_plan_id: activePeriod.payment_plan_id,
                pricing_id: activePeriod.pricing_id
            } : undefined
        };
    }).sort((a, b) => a.full_name.localeCompare(b.full_name));

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <header style={headerStyle}>
                <div>
                    <Link href="/admin/payments" style={backLinkStyle}>← Paket Pembayaran</Link>
                    <h1 style={titleStyle}>Periode Belajar Coder</h1>
                    <p style={subtitleStyle}>Lihat dan atur periode belajar aktif untuk setiap coder</p>
                </div>
            </header>

            <CoderPaymentTable
                coders={tableData}
                plans={plans || []}
                pricing={pricing || []}
            />
        </div>
    );
}

const headerStyle: CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '1rem',
    flexWrap: 'wrap',
};

const backLinkStyle: CSSProperties = {
    color: '#1e3a5f',
    fontSize: '0.9rem',
    marginBottom: '0.5rem',
    display: 'inline-block',
};

const titleStyle: CSSProperties = {
    fontSize: '1.5rem',
    fontWeight: 700,
    color: '#0f172a',
    margin: 0,
};

const subtitleStyle: CSSProperties = {
    color: '#64748b',
    fontSize: '0.9rem',
};
