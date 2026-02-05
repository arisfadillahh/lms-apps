import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseServer';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const supabase = getSupabaseAdmin();

        // 1. Get raw last 5 sessions to see date format
        const { data: recentSessions, error: recentError } = await supabase
            .from('sessions')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(5);

        // 2. Get today's sessions (WIB) - Debugging "Missing" Sessions
        const nowK = new Date();
        const formatter = new Intl.DateTimeFormat('id-ID', {
            timeZone: 'Asia/Jakarta',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        });
        const parts = formatter.formatToParts(nowK);
        const find = (type: string) => parts.find(p => p.type === type)?.value;
        const todayStr = `${find('year')}-${find('month')}-${find('day')}`;

        const startFilter = `${todayStr}T00:00:00+07:00`;
        const endFilter = `${todayStr}T23:59:59+07:00`;

        const { data: todaySessions, error: todayError } = await supabase
            .from('sessions')
            .select(`
                id, date_time, status, 
                class:classes(name), 
                coder:users!coder_id(full_name)
            `)
            .gte('date_time', startFilter)
            .lte('date_time', endFilter);

        return NextResponse.json({
            info: 'Debug Session Data (WIB)',
            serverTime: new Date().toISOString(),
            wibDate: todayStr,
            filterRange: { start: startFilter, end: endFilter },
            todaySessionsFound: todaySessions?.length || 0,
            todaySessions: todaySessions, // This will show us the status of the "missing" sessions
            recentSessions: recentSessions,
            error: todayError || recentError
        });
    } catch (error) {
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}
