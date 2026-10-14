export type SoftwareLogoRecord = { id?: string; name: string; icon_url: string | null };

// Primary vendor sites, verified 2026-10-14. No user-provided URL is fetched by the proxy.
export const BUILTIN_SOFTWARE_LOGOS = {
  scratch: 'https://scratch.mit.edu/favicon.ico',
  scratchjr: 'https://www.scratchjr.org/favicon.ico',
  kodu: 'https://www.kodugamelab.com/images/Kodu.png',
  appinventor: 'https://appinventor.mit.edu/images/logo.png',
  thunkable: 'https://cdn.prod.website-files.com/63b59ece6123439ac23e226f/6410c01aa798863aea566543_thunkable-webclip.png',
  gdevelop: 'https://gdevelop.io/favicons/apple-touch-icon.png',
  vscode: 'https://code.visualstudio.com/assets/apple-touch-icon.png',
  codeorg: 'https://code.org/_next/static/media/favicon-codeai.fd1175d1.ico',
  makecode: 'https://raw.githubusercontent.com/microsoft/pxt/master/docs/static/logo/Microsoft-MakeCode-logo-square-purple-small.png',
  canva: 'https://www.canva.com/favicon.ico',
  bookcreator: 'https://bookcreator.com/wp-content/uploads/2018/08/cropped-512-192x192.png',
  bebras: 'https://www.bebras.org/logo.png',
  tinkercad: 'https://www.tinkercad.com/favicon.ico',
  trinket: 'https://trinket.io/', // The official header embeds its PNG wordmark.
  minecraft: 'https://education.minecraft.net/etc.clientlibs/minecraft-edu/clientlibs/clientlib-common/resources/images/favicon/new-apple-icon-152x152.png',
} as const;

type Brand = keyof typeof BUILTIN_SOFTWARE_LOGOS;
const ALIASES: Record<string, Brand> = {
  scratch: 'scratch', scratch3: 'scratch', scratch30: 'scratch', scratch2: 'scratch',
  scratchjr: 'scratchjr', scratchjunior: 'scratchjr',
  kodu: 'kodu', kodugamelab: 'kodu',
  mitappinventor: 'appinventor', appinventor: 'appinventor', appinventor2: 'appinventor',
  thunkable: 'thunkable', thunkablex: 'thunkable',
  gdevelop: 'gdevelop', gdevelop5: 'gdevelop',
  visualstudiocode: 'vscode', vscode: 'vscode',
  codeorg: 'codeorg', makecode: 'makecode', microsoftmakecode: 'makecode',
  canva: 'canva', bookcreator: 'bookcreator', bebras: 'bebras',
  tinkercad: 'tinkercad', trinket: 'trinket', trinketio: 'trinket',
  minecraft: 'minecraft', minecrafteducation: 'minecraft', minecrafteducationedition: 'minecraft',
};

function nameKey(name: string) {
  return name.normalize('NFKC').trim().toLowerCase().replace(/\s+/g, ' ');
}

export function softwareBrand(name: string): Brand | null {
  const key = nameKey(name).replace(/\s*-\s*sample$/, '')
    .replace(/\b(online|install|desktop)\b/g, '').replace(/[^a-z0-9]/g, '');
  return Object.hasOwn(ALIASES, key) ? ALIASES[key] : null;
}

export function defaultSoftwareLogo(name: string): string | null {
  const brand = softwareBrand(name);
  return brand ? `/api/software/logos/${brand}` : null;
}

export function normalizeSoftwareLogoUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  if (!text || /[\\\r\n\u0000]/.test(text)) return null;
  if (/^\/api\/software\/logos\/[a-z]+$/.test(text)) return text;
  try {
    const url = new URL(text);
    if (url.protocol !== 'https:' || url.username || url.password) return null;
    const host = url.hostname.toLowerCase();
    if (host === 'localhost' || host.endsWith('.local') || host.startsWith('[') ||
      /^(127\.|10\.|192\.168\.|169\.254\.|0\.)/.test(host) || /^172\.(1[6-9]|2\d|3[01])\./.test(host)) return null;
    return url.href;
  } catch { return null; }
}

export function resolveSoftwareLogo(name: string, catalog: SoftwareLogoRecord[] = []): string | null {
  const exact = catalog.filter(row => nameKey(row.name) === nameKey(name));
  if (exact.length) {
    const urls = [...new Set(exact.map(row => normalizeSoftwareLogoUrl(row.icon_url)).filter(Boolean))];
    return urls.length === 1 ? urls[0] : defaultSoftwareLogo(name);
  }
  const brand = softwareBrand(name);
  if (brand) {
    const urls = [...new Set(catalog.filter(row => softwareBrand(row.name) === brand)
      .map(row => normalizeSoftwareLogoUrl(row.icon_url)).filter(Boolean))];
    if (urls.length === 1) return urls[0];
  }
  return defaultSoftwareLogo(name);
}
