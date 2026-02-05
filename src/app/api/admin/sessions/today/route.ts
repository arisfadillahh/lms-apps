import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseServer';

export const dynamic = 'force-dynamic';

export async function GET() {
    // API endpoint to fetch students with scheduled sessions for today
    try {
        const supabase = getSupabaseAdmin();

        // Check if admin is handled by the fact we are using admin client, 
        // effectively bypassing row level security for this admin-only endpoint.
        // If needed we can add middleware check later.

        // Use Indonesia time (WIB) for "today"
        const nowK = new Date();
        const formatter = new Intl.DateTimeFormat('id-ID', {
            timeZone: 'Asia/Jakarta',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        });

        // formatter.format(nowK) output depends on locale, but typically DD/MM/YYYY or YYYY-MM-DD
        // easier to just add 7 hours to UTC if environment is UTC, or just use parts
        // Let's use parts to be safe
        const parts = formatter.formatToParts(nowK);
        const find = (type: string) => parts.find(p => p.type === type)?.value;
        const todayStr = `${find('year')}-${find('month')}-${find('day')}`;

        console.log('[API] Fetching sessions for date (WIB):', todayStr);

        const startFilter = `${todayStr}T00:00:00+07:00`;
        const endFilter = `${todayStr}T23:59:59+07:00`;

        console.log('[API] Fetching sessions params (Explicit WIB):', { startFilter, endFilter });

        // Fetch scheduled sessions for today
        const { data: sessions, error } = await supabase
            .from('sessions')
            .select(`
            id,
            date_time,
            status,
            coder:users!coder_id (
                full_name,
                parent_name
            ),
            class:classes (
                id,
                zoom_link
            )
        `)
            // .eq('status', 'SCHEDULED')
            .gte('date_time', startFilter)
            .lte('date_time', endFilter);

        console.log('[API] Sessions query result:', {
            count: sessions?.length,
            error: error?.message,
            firstSessionTime: sessions?.[0]?.date_time
        });

        if (error) throw error;

        // Transform for UI
        const students = sessions.map((s: any) => {
            const date = new Date(s.date_time);
            const timeStr = date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false });

            // Coder might be returned as array or single object depending on query
            const coderData = Array.isArray(s.coder) ? s.coder[0] : s.coder;
            const classData = Array.isArray(s.class) ? s.class[0] : s.class;

            return {
                id: s.id,
                student_name: coderData?.full_name || 'Unknown',
                parent_name: coderData?.parent_name || 'Ayah/Bunda',
                time: timeStr,
                zoom_link: classData?.zoom_link || '-'
            };
        });

        return NextResponse.json({ students });
    } catch (error) {
        console.error('[API] Fetch today sessions error:', error);
        return NextResponse.json(
            { success: false, error: String(error) },
            { status: 500 }
        );
    }
}
