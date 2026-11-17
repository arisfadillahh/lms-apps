import { createHash } from 'node:crypto';

export async function sendHolidayRegistrationConversion(id: string, phone: string, createdAt: string) {
  const token = process.env.META_CONVERSIONS_API_TOKEN;
  const pixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID;
  if (!token || !pixelId || !/^\d+$/.test(pixelId)) return;

  const response = await fetch(`https://graph.facebook.com/v23.0/${pixelId}/events`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(5000),
    body: JSON.stringify({
      data: [{
        event_name: 'CompleteRegistration',
        event_id: id,
        event_time: Math.floor(new Date(createdAt).getTime() / 1000),
        action_source: 'website',
        event_source_url: 'https://lms.clev.io/holiday-class/',
        user_data: { ph: [createHash('sha256').update(phone).digest('hex')] },
      }],
    }),
  });
  if (!response.ok) throw new Error(`Meta conversions HTTP ${response.status}`);
}
