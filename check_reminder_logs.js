
const { createClient } = require('@supabase/supabase-js');

// Credentials from .env (read in previous steps)
const SUPABASE_URL = 'https://wfizooodvytlizdgxueh.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndmaXpvb29kdnl0bGl6ZGd4dWVoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM4NTg1MTksImV4cCI6MjA2OTQzNDUxOX0.J24fCF2ySo7KH9W0hChqms9qqss3nTipUeQ3L508Uwc'; // Using SERVICE_ROLE_KEY for admin access

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkLogs() {
    // Current time in WIB is UTC+7
    const now = new Date();
    // Adjust to WIB just for display/logic check
    const nowWib = new Date(now.getTime() + 7 * 60 * 60 * 1000);
    const today = nowWib.toISOString().split('T')[0];

    // We want logs created AFTER today's start in WIB
    // But created_at is likely UTC. 
    // If we want "Today WIB", that is Yesterday 17:00 UTC.
    // Example: 2026-02-06 00:00 WIB = 2026-02-05 17:00 UTC.

    // However, the code uses: const startOfDayWib = `${todayStr}T00:00:00+07:00`;
    // Supabase handles timezone offset if provided in ISO string? 
    // Let's mimic the code's query exactly.

    const startFilter = `${today}T00:00:00+07:00`;

    console.log(`Checking logs for 'REMINDER' since ${startFilter}...`);

    const { data: logs, error } = await supabase
        .from('whatsapp_message_logs')
        .select('*')
        .eq('category', 'REMINDER')
        .gte('created_at', startFilter);

    if (error) {
        console.error('Error fetching logs:', error);
        return;
    }

    console.log('Logs found:', logs.length);
    logs.forEach(log => {
        console.log(`- [${log.created_at}] Type: ${log.payload?.type}`);
    });

    const hasClassReminder = logs.some(log => log.payload?.type === 'CLASS_REMINDER');
    console.log('Has CLASS_REMINDER today?', hasClassReminder);
}

checkLogs();
