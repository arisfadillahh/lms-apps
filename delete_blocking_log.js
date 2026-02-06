
const { createClient } = require('@supabase/supabase-js');

// Credentials from .env
const SUPABASE_URL = 'https://wfizooodvytlizdgxueh.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndmaXpvb29kdnl0bGl6ZGd4dWVoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM4NTg1MTksImV4cCI6MjA2OTQzNDUxOX0.J24fCF2ySo7KH9W0hChqms9qqss3nTipUeQ3L508Uwc';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function deleteLog() {
    const today = new Date().toISOString().split('T')[0];
    const startOfDay = `${today}T00:00:00+07:00`;

    console.log(`Deleting CLASS_REMINDER logs since ${startOfDay}...`);

    const { data, error } = await supabase
        .from('whatsapp_message_logs')
        .delete()
        .eq('category', 'REMINDER')
        .like('payload->>type', 'CLASS_REMINDER') // Specific to JSON payload type
        .gte('created_at', startOfDay);

    if (error) {
        console.error('Error deleting logs:', error);
        return;
    }

    // Since 'delete' doesn't always return count without select, let's verify
    console.log('Delete command executed.');
}

deleteLog();
