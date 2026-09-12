export const SESSION_NOT_STARTED_MESSAGE = 'Presensi baru dapat diisi setelah sesi dimulai.';

export function hasSessionStarted(
  sessionDateTime: string,
  now: Date = new Date(),
): boolean {
  const startTime = new Date(sessionDateTime).getTime();
  return Number.isFinite(startTime) && now.getTime() >= startTime;
}
