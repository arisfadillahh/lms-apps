export function normalizeLocalhostUrl(value: string | undefined): string | undefined {
  if (!value) {
    return value;
  }

  const runtimePort = process.env.PORT;
  if (!runtimePort) {
    return value;
  }

  try {
    const url = new URL(value);
    if (url.hostname !== 'localhost') {
      return value;
    }

    const currentPort = url.port || (url.protocol === 'https:' ? '443' : '80');
    if (currentPort === runtimePort) {
      return value;
    }

    url.port = runtimePort;
    const normalizedPath = url.pathname === '/' ? '' : url.pathname;
    const normalized = `${url.protocol}//${url.hostname}${url.port ? `:${url.port}` : ''}${normalizedPath}`;
    return normalized.endsWith('/') && normalized !== '/' ? normalized.slice(0, -1) : normalized;
  } catch (error) {
    console.warn('[env] Unable to normalize URL', value, error);
    return value;
  }
}

export function getLocalhostFallback(): string {
  const runtimePort = process.env.PORT ?? '3000';
  return `http://localhost:${runtimePort}`;
}
