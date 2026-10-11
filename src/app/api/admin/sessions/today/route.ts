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

        // Use Indonesia time (WIB) for "tomorrow" calculation (H-1)
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

        // Calculate Tomorrow
        const tomorrow = new Date(nowK);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowParts = formatter.formatToParts(tomorrow);
        const findTomorrow = (type: string) => tomorrowParts.find(p => p.type === type)?.value;
        const tomorrowStr = `${findTomorrow('year')}-${findTomorrow('month')}-${findTomorrow('day')}`;

        console.log('[API] Fetching sessions for date (WIB, H-1):', tomorrowStr);

        const startFilter = `${tomorrowStr}T00:00:00+07:00`;
        const endFilter = `${tomorrowStr}T23:59:59+07:00`;

        console.log('[API] Fetching sessions params (Explicit WIB):', { startFilter, endFilter });

        // Fetch sessions with classes
        const { data: rawSessions, error } = await supabase
            .from('sessions')
            .select('id, date_time, class_id, classes(id, name, zoom_link, delivery_mode, location_name, location_address, location_maps_url)')
            .gte('date_time', startFilter)
            .lte('date_time', endFilter);

        if (error) throw error;

        if (!rawSessions || rawSessions.length === 0) {
            return NextResponse.json({ students: [] });
        }

        // Fetch enrollments for these classes
        const classIds = [...new Set(rawSessions.map(s => s.class_id))];

        const { data: enrollments } = await supabase
            .from('enrollments')
            .select('coder_id, class_id, users(id, full_name, parent_name)')
            .in('class_id', classIds)
            .eq('status', 'ACTIVE');

        // Transform for UI: Create one entry per (session, student) pair
        const students = rawSessions.flatMap((s: any) => {
            const classEnrollments = enrollments?.filter(e => e.class_id === s.class_id) || [];
            const date = new Date(s.date_time);
            const timeStr = date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false });
            const classData = Array.isArray(s.classes) ? s.classes[0] : s.classes;

            return classEnrollments.map((enrollment: any) => {
                const userData = Array.isArray(enrollment.users) ? enrollment.users[0] : enrollment.users;
                return {
                    id: `${s.id}_${enrollment.coder_id}`, // Unique ID combining session + coder
                    session_id: s.id,
                    coder_id: enrollment.coder_id,
                    student_name: userData?.full_name || 'Unknown',
                    parent_name: userData?.parent_name || 'Ayah/Bunda',
                    time: timeStr,
                    class_name: classData?.name || '-',
                    delivery_mode: classData?.delivery_mode || 'ONLINE',
                    zoom_link: classData?.zoom_link || '-',
                    location_name: classData?.location_name || '',
                    location_address: classData?.location_address || '',
                    location_maps_url: classData?.location_maps_url || '',
                };
            });
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
