import fs from 'node:fs';
import path from 'node:path';

export function provisionedChromiumPath(): string | undefined {
  try {
    const config = JSON.parse(fs.readFileSync(path.join(process.cwd(), '.data', 'payment-browser.json'), 'utf8'));
    return typeof config?.executablePath === 'string' ? config.executablePath : undefined;
  } catch {
    return undefined;
  }
}
