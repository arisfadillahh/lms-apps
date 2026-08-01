import 'server-only';

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_CALENDAR_API = 'https://www.googleapis.com/calendar/v3';
const GOOGLE_USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo';
const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.events';
const JAKARTA_TIME_ZONE = 'Asia/Jakarta';
const DEFAULT_OAUTH_REDIRECT_URI = 'https://lms.clev.io/api/admin/google-calendar/callback';
const OAUTH_STORE_PATH = path.join(process.cwd(), '.data', 'google-calendar', 'oauth.json');

type ServiceAccountCalendarConfig = {
  mode: 'service-account';
  clientEmail: string;
  privateKey: string;
  impersonatedUser: string;
  calendarId: string;
};

type OAuthCalendarConfig = {
  mode: 'oauth';
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  calendarId: string;
};

type CalendarConfig = ServiceAccountCalendarConfig | OAuthCalendarConfig;

type OAuthClientConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  organizerEmail: string;
};

type StoredOAuthCredential = {
  refreshToken: string;
  organizerEmail: string;
  connectedAt: string;
};

export type TrialCalendarInput = {
  studentName: string;
  studentGrade: string;
  parentName: string;
  phone: string;
  coachName: string;
  scheduledAt: string;
  durationMinutes: number;
};

export type TrialCalendarEvent = {
  eventId: string;
  meetUrl: string;
};

type GoogleCalendarEventResponse = {
  id?: string;
  hangoutLink?: string;
  conferenceData?: {
    entryPoints?: Array<{ entryPointType?: string; uri?: string }>;
  };
};

export function isGoogleTrialCalendarConfigured() {
  try {
    getCalendarConfig();
    return true;
  } catch {
    return false;
  }
}

export function getGoogleCalendarOAuthConnectionInfo() {
  const client = getOAuthClientConfigOrNull();
  const stored = readStoredOAuthCredential();
  return {
    available: Boolean(client),
    connected: Boolean(client && stored?.refreshToken),
    organizerEmail: client?.organizerEmail ?? null,
    redirectUri: client?.redirectUri ?? DEFAULT_OAUTH_REDIRECT_URI,
  };
}

export function createGoogleCalendarAuthorizationUrl(state: string) {
  const config = getOAuthClientConfig();
  const query = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: 'code',
    scope: `openid email ${CALENDAR_SCOPE}`,
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    state,
    login_hint: config.organizerEmail,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${query.toString()}`;
}

export async function exchangeGoogleCalendarAuthorizationCode(code: string) {
  const config = getOAuthClientConfig();
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
      grant_type: 'authorization_code',
      code,
    }),
    cache: 'no-store',
  });
  const payload = await response.json().catch(() => null) as {
    access_token?: string;
    refresh_token?: string;
    error_description?: string;
  } | null;

  if (!response.ok || !payload?.access_token || !payload.refresh_token) {
    throw new Error(
      `Google tidak mengembalikan refresh token: ${payload?.error_description || `HTTP ${response.status}`}`,
    );
  }

  const userInfoResponse = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${payload.access_token}` },
    cache: 'no-store',
  });
  const userInfo = await userInfoResponse.json().catch(() => null) as {
    email?: string;
    email_verified?: boolean;
  } | null;
  if (
    !userInfoResponse.ok
    || !userInfo?.email_verified
    || userInfo.email?.toLowerCase() !== config.organizerEmail.toLowerCase()
  ) {
    throw new Error(`Akun Google harus menggunakan ${config.organizerEmail}.`);
  }

  writeStoredOAuthCredential({
    refreshToken: payload.refresh_token,
    organizerEmail: config.organizerEmail,
    connectedAt: new Date().toISOString(),
  });
}

export async function upsertTrialCalendarEvent(
  existingEventId: string | null,
  input: TrialCalendarInput,
): Promise<TrialCalendarEvent> {
  const config = getCalendarConfig();
  const accessToken = await getAccessToken(config);
  const eventBody = buildCalendarEventBody(input, !existingEventId);
  const calendarPath = `/calendars/${encodeURIComponent(config.calendarId)}/events`;
  const response = existingEventId
    ? await googleCalendarRequest<GoogleCalendarEventResponse>(
        `${calendarPath}/${encodeURIComponent(existingEventId)}?conferenceDataVersion=1&sendUpdates=none`,
        accessToken,
        { method: 'PATCH', body: eventBody },
      )
    : await googleCalendarRequest<GoogleCalendarEventResponse>(
        `${calendarPath}?conferenceDataVersion=1&sendUpdates=none`,
        accessToken,
        { method: 'POST', body: eventBody },
      );

  const eventId = response.id;
  const meetUrl = response.hangoutLink
    ?? response.conferenceData?.entryPoints?.find((entry) => entry.entryPointType === 'video')?.uri;

  if (!eventId || !meetUrl) {
    throw new Error('Google Calendar tidak mengembalikan link Google Meet. Pastikan akun organizer memiliki lisensi Google Meet.');
  }

  return { eventId, meetUrl };
}

export async function deleteTrialCalendarEvent(eventId: string) {
  const config = getCalendarConfig();
  const accessToken = await getAccessToken(config);
  const path = `/calendars/${encodeURIComponent(config.calendarId)}/events/${encodeURIComponent(eventId)}?sendUpdates=none`;
  await googleCalendarRequest(path, accessToken, { method: 'DELETE' });
}

function getCalendarConfig(): CalendarConfig {
  const oauthClient = getOAuthClientConfigOrNull();
  if (oauthClient) {
    const stored = readStoredOAuthCredential();
    if (!stored?.refreshToken) {
      throw new Error('Google Calendar belum dihubungkan oleh admin.');
    }
    return {
      mode: 'oauth',
      clientId: oauthClient.clientId,
      clientSecret: oauthClient.clientSecret,
      refreshToken: stored.refreshToken,
      calendarId: process.env.GOOGLE_CALENDAR_ID || 'primary',
    };
  }

  const serviceAccount = parseServiceAccountJson(process.env.GOOGLE_CALENDAR_SERVICE_ACCOUNT_JSON);
  const clientEmail = process.env.GOOGLE_CALENDAR_CLIENT_EMAIL || serviceAccount?.client_email;
  const privateKey = process.env.GOOGLE_CALENDAR_PRIVATE_KEY || serviceAccount?.private_key;
  const impersonatedUser = process.env.GOOGLE_CALENDAR_IMPERSONATED_USER;

  if (!clientEmail || !privateKey || !impersonatedUser) {
    throw new Error(
      'Google Calendar belum dikonfigurasi. Isi service account dan GOOGLE_CALENDAR_IMPERSONATED_USER di environment server.',
    );
  }

  return {
    mode: 'service-account',
    clientEmail,
    privateKey: privateKey.replace(/\\n/g, '\n'),
    impersonatedUser,
    calendarId: process.env.GOOGLE_CALENDAR_ID || 'primary',
  };
}

function getOAuthClientConfig(): OAuthClientConfig {
  const config = getOAuthClientConfigOrNull();
  if (!config) {
    throw new Error('OAuth Google Calendar belum dikonfigurasi di server.');
  }
  return config;
}

function getOAuthClientConfigOrNull(): OAuthClientConfig | null {
  const clientId = process.env.GOOGLE_CALENDAR_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CALENDAR_OAUTH_CLIENT_SECRET;
  const organizerEmail = process.env.GOOGLE_CALENDAR_OAUTH_ORGANIZER_EMAIL;
  if (!clientId || !clientSecret || !organizerEmail) return null;

  return {
    clientId,
    clientSecret,
    organizerEmail,
    redirectUri: process.env.GOOGLE_CALENDAR_OAUTH_REDIRECT_URI || DEFAULT_OAUTH_REDIRECT_URI,
  };
}

function readStoredOAuthCredential(): StoredOAuthCredential | null {
  try {
    const payload = JSON.parse(fs.readFileSync(OAUTH_STORE_PATH, 'utf8')) as StoredOAuthCredential;
    if (!payload.refreshToken || !payload.organizerEmail) return null;
    return payload;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    console.error('[GoogleCalendar] Failed to read stored OAuth credential', error);
    return null;
  }
}

function writeStoredOAuthCredential(credential: StoredOAuthCredential) {
  const directory = path.dirname(OAUTH_STORE_PATH);
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  const temporaryPath = `${OAUTH_STORE_PATH}.${crypto.randomUUID()}.tmp`;
  fs.writeFileSync(temporaryPath, JSON.stringify(credential), { encoding: 'utf8', mode: 0o600 });
  fs.renameSync(temporaryPath, OAUTH_STORE_PATH);
  fs.chmodSync(OAUTH_STORE_PATH, 0o600);
}

function parseServiceAccountJson(value: string | undefined): { client_email?: string; private_key?: string } | null {
  if (!value) return null;

  try {
    const normalized = value.trim().startsWith('{') ? value : Buffer.from(value, 'base64').toString('utf8');
    return JSON.parse(normalized) as { client_email?: string; private_key?: string };
  } catch {
    throw new Error('GOOGLE_CALENDAR_SERVICE_ACCOUNT_JSON tidak valid. Gunakan JSON asli atau base64.');
  }
}

async function getAccessToken(config: CalendarConfig): Promise<string> {
  if (config.mode === 'oauth') {
    return getOAuthAccessToken(config);
  }

  const issuedAt = Math.floor(Date.now() / 1000);
  const assertion = signJwt(
    {
      alg: 'RS256',
      typ: 'JWT',
    },
    {
      iss: config.clientEmail,
      sub: config.impersonatedUser,
      scope: CALENDAR_SCOPE,
      aud: GOOGLE_TOKEN_URL,
      iat: issuedAt,
      exp: issuedAt + 3600,
    },
    config.privateKey,
  );

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
    cache: 'no-store',
  });
  const payload = await response.json().catch(() => null) as { access_token?: string; error_description?: string } | null;

  if (!response.ok || !payload?.access_token) {
    throw new Error(`Autentikasi Google Calendar gagal: ${payload?.error_description || `HTTP ${response.status}`}`);
  }

  return payload.access_token;
}

async function getOAuthAccessToken(config: OAuthCalendarConfig): Promise<string> {
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: config.refreshToken,
      grant_type: 'refresh_token',
    }),
    cache: 'no-store',
  });
  const payload = await response.json().catch(() => null) as {
    access_token?: string;
    error_description?: string;
  } | null;

  if (!response.ok || !payload?.access_token) {
    throw new Error(`Autentikasi Google Calendar gagal: ${payload?.error_description || `HTTP ${response.status}`}`);
  }
  return payload.access_token;
}

function signJwt(header: Record<string, unknown>, claims: Record<string, unknown>, privateKey: string) {
  const unsigned = `${base64Url(JSON.stringify(header))}.${base64Url(JSON.stringify(claims))}`;
  const signature = crypto.sign('RSA-SHA256', Buffer.from(unsigned), privateKey);
  return `${unsigned}.${signature.toString('base64url')}`;
}

function base64Url(value: string) {
  return Buffer.from(value).toString('base64url');
}

function buildCalendarEventBody(input: TrialCalendarInput, includeConferenceRequest: boolean) {
  const start = new Date(input.scheduledAt);
  const end = new Date(start.getTime() + input.durationMinutes * 60_000);

  return {
    summary: `Free Trial Clevio - ${input.studentName}`,
    description: [
      `Peserta: ${input.studentName}`,
      `Kelas: ${input.studentGrade}`,
      `Orang tua: ${input.parentName}`,
      `WhatsApp: ${input.phone}`,
      `Coach: ${input.coachName}`,
    ].join('\n'),
    start: { dateTime: start.toISOString(), timeZone: JAKARTA_TIME_ZONE },
    end: { dateTime: end.toISOString(), timeZone: JAKARTA_TIME_ZONE },
    ...(includeConferenceRequest
      ? {
          conferenceData: {
            createRequest: {
              requestId: crypto.randomUUID(),
              conferenceSolutionKey: { type: 'hangoutsMeet' },
            },
          },
        }
      : {}),
  };
}

async function googleCalendarRequest<T = void>(
  path: string,
  accessToken: string,
  options: { method: 'POST' | 'PATCH' | 'DELETE'; body?: unknown },
): Promise<T> {
  const response = await fetch(`${GOOGLE_CALENDAR_API}${path}`, {
    method: options.method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
    cache: 'no-store',
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { error?: { message?: string } } | null;
    throw new Error(`Google Calendar gagal: ${payload?.error?.message || `HTTP ${response.status}`}`);
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}
