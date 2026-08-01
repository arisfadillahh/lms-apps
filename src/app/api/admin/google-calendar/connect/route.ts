import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';

import { getSessionOrThrow } from '@/lib/auth';
import { assertRole } from '@/lib/roles';
import { createGoogleCalendarAuthorizationUrl } from '@/lib/services/googleTrialCalendar';

export const runtime = 'nodejs';

const STATE_COOKIE = 'google-calendar-oauth-state';

export async function GET(request: NextRequest) {
  try {
    const session = await getSessionOrThrow();
    await assertRole(session, 'ADMIN');

    const state = crypto.randomBytes(32).toString('base64url');
    const response = NextResponse.redirect(createGoogleCalendarAuthorizationUrl(state));
    response.cookies.set(STATE_COOKIE, state, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 10 * 60,
    });
    return response;
  } catch (error) {
    console.error('[GoogleCalendar] Failed to start OAuth connection', error);
    return NextResponse.redirect(new URL('/admin/free-trials?googleCalendar=setup-error', request.url));
  }
}
