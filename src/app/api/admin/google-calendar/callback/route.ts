import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';

import { getSessionOrThrow } from '@/lib/auth';
import { assertRole } from '@/lib/roles';
import { exchangeGoogleCalendarAuthorizationCode } from '@/lib/services/googleTrialCalendar';

export const runtime = 'nodejs';

const STATE_COOKIE = 'google-calendar-oauth-state';

export async function GET(request: NextRequest) {
  const destination = new URL('/admin/free-trials', request.url);
  try {
    const session = await getSessionOrThrow();
    await assertRole(session, 'ADMIN');

    const code = request.nextUrl.searchParams.get('code');
    const state = request.nextUrl.searchParams.get('state');
    const expectedState = request.cookies.get(STATE_COOKIE)?.value;
    if (!code || !state || !expectedState || !safeEqual(state, expectedState)) {
      destination.searchParams.set('googleCalendar', 'invalid-state');
      return clearStateCookie(NextResponse.redirect(destination));
    }

    await exchangeGoogleCalendarAuthorizationCode(code);
    destination.searchParams.set('googleCalendar', 'connected');
    return clearStateCookie(NextResponse.redirect(destination));
  } catch (error) {
    console.error('[GoogleCalendar] OAuth callback failed', error);
    destination.searchParams.set('googleCalendar', 'connection-error');
    return clearStateCookie(NextResponse.redirect(destination));
  }
}

function safeEqual(actual: string, expected: string) {
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);
  return actualBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(actualBuffer, expectedBuffer);
}

function clearStateCookie(response: NextResponse) {
  response.cookies.set(STATE_COOKIE, '', { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 0 });
  return response;
}
