
const { createClient } = require('@supabase/supabase-js');

// Credentials from .env (hardcoded for now as per other scripts)
const SUPABASE_URL = 'https://wfizooodvytlizdgxueh.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndmaXpvb29kdnl0bGl6ZGd4dWVoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM4NTg1MTksImV4cCI6MjA2OTQzNDUxOX0.J24fCF2ySo7KH9W0hChqms9qqss3nTipUeQ3L508Uwc';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function inspect() {
    // 1. Calculate Tomorrow (WIB)
    const now = new Date();
    const nowWib = new Date(now.getTime() + 7 * 60 * 60 * 1000);
    const tomorrow = new Date(nowWib);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    console.log(`Checking sessions for Tomorrow (WIB): ${tomorrowStr}`);

    const startFilter = `${tomorrowStr}T00:00:00+07:00`;
    const endFilter = `${tomorrowStr}T23:59:59+07:00`;

    const { data: sessions, error } = await supabase
        .from('sessions')
        .select('id, class_id')
        .eq('status', 'SCHEDULED')
        .gte('date_time', startFilter)
        .lte('date_time', endFilter);

    if (error) {
        console.error('Error fetching sessions:', error);
    } else {
        console.log(`Found ${sessions.length} sessions scheduled for tomorrow.`);
    }

    // 2. Check Logs Details
    const todayStr = nowWib.toISOString().split('T')[0];
    const startOfDayWib = `${todayStr}T00:00:00+07:00`;

    console.log(`Checking logs for Today (WIB): ${todayStr} (since ${startOfDayWib})`);

    const { data: logs, error: logError } = await supabase
        .from('whatsapp_message_logs')
        .select('*')
        .eq('category', 'REMINDER')
        .gte('created_at', startOfDayWib);

    if (logError) {
        console.error('Error fetching logs:', logError);
    } else {
        const classReminders = logs.filter(l => l.payload?.type === 'CLASS_REMINDER');
        console.log(`Found ${classReminders.length} CLASS_REMINDER logs.`);
        classReminders.forEach((l, i) => {
            console.log(`${i + 1}. Sent to: ${l.payload?.parent_phone} (${l.payload?.student_name}) at ${l.created_at}`);
        });
    }
}

inspect();
