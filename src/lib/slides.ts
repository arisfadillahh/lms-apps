export function normalizeSlideUrl(input: string | null | undefined): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (!trimmed) return null;

  const iframeMatch = trimmed.match(/<iframe[^>]*src=['"]([^'"]+)['"][^>]*>/i);
  const candidate = iframeMatch ? iframeMatch[1].trim() : trimmed;

  try {
    const url = new URL(candidate);

    if (url.hostname.endsWith('docs.google.com') && url.pathname.includes('/presentation/')) {
      url.pathname = url.pathname.replace(/\/u\/\d+\//, '/');

      url.pathname = url.pathname.replace(/\/presentation\/d\/e\/([^/]+)\/pub(?:html)?/i, '/presentation/d/e/$1/embed');
      url.pathname = url.pathname.replace(/\/presentation\/d\/([^/]+)\/pub(?:html)?/i, '/presentation/d/$1/embed');
      url.pathname = url.pathname.replace(/\/presentation\/d\/e\/([^/]+)\/$/i, '/presentation/d/e/$1/embed');
      url.pathname = url.pathname.replace(/\/presentation\/d\/([^/]+)\/$/i, '/presentation/d/$1/embed');

      if (!/\/embed$/i.test(url.pathname)) {
        const exportMatch = url.pathname.match(/\/presentation\/d\/e\/([^/]+)/i);
        if (exportMatch) {
          url.pathname = `/presentation/d/e/${exportMatch[1]}/embed`;
        } else {
          const deckMatch = url.pathname.match(/\/presentation\/d\/([^/]+)/i);
          if (deckMatch) {
            url.pathname = `/presentation/d/${deckMatch[1]}/embed`;
          }
        }
      }

      if (!url.search || url.search === '?') {
        url.search = '?start=false&loop=false&delayms=3000';
      }
    }

    return url.toString();
  } catch {
    return null;
  }
}
