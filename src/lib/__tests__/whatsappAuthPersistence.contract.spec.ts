import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';

const root = path.resolve(__dirname, '../../..');
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), 'utf8');

describe('LMS WhatsApp authentication persistence contract', () => {
    it('uses an explicit persistent auth directory when production provides one', () => {
        const source = read('src/lib/services/whatsappClient.ts');

        expect(source).toContain("process.env.WHATSAPP_AUTH_DIR?.trim()");
        expect(source).toContain("path.join(process.cwd(), 'baileys_auth_info')");
        expect(source).toContain('useMultiFileAuthState(AUTH_FOLDER)');
    });

    it('does not delete credentials merely because QR delivery repeats', () => {
        const source = read('src/lib/services/whatsappClient.ts');

        expect(source).toContain('qrRetryCount === 6');
        expect(source).toContain('preserving credentials until a confirmed logout');
        expect(source).not.toContain('Too many QR attempts, clearing credentials');
    });

    it('injects the shared directory into the production LMS process', () => {
        const script = read('scripts/deploy-production.sh');

        expect(script).toContain('WHATSAPP_AUTH_DIR="${WHATSAPP_AUTH_DIR:-$SHARED_DIR/baileys_auth_info}"');
        expect(script).toContain('mkdir -p "$RELEASES_DIR" "$SHARED_DIR" "$DEPLOY_LOG_DIR" "$WHATSAPP_AUTH_DIR"');
        expect(script).toContain('NODE_ENV=production WHATSAPP_AUTH_DIR="$WHATSAPP_AUTH_DIR" pm2 start npm');
    });
});
