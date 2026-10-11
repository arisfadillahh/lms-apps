import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');

describe('push subscription account switch contract', () => {
  it('transfers one device endpoint away from the previous account', () => {
    const push = read('src/lib/pushNotifications.ts');
    const migration = read('supabase/migrations/20260824133000_security_hardening.sql');
    const serviceWorker = read('public/sw.js');

    expect(push).toContain("onConflict: 'endpoint'");
    expect(push).toContain('recipientUserId: row.user_id');
    expect(migration).toContain('push_subscriptions_endpoint_unique_idx');
    expect(serviceWorker).toContain('activeUserId !== String(payload.recipientUserId)');
  });

  it('detaches the endpoint before sign out and reclaims it after login', () => {
    const signOut = read('src/components/SignOutButton.tsx');
    const sync = read('src/components/pwa/PushSubscriptionAccountSync.tsx');
    const adminLayout = read('src/app/(admin)/admin/layout.tsx');
    const coachLayout = read('src/app/(coach)/coach/layout.tsx');
    const coderLayout = read('src/app/(coder)/coder/layout.tsx');

    expect(signOut).toContain('await detachPushSubscriptionFromCurrentAccount()');
    expect(sync).toContain('syncExistingPushSubscriptionToCurrentAccount(userId)');
    for (const layout of [adminLayout, coachLayout, coderLayout]) {
      expect(layout).toContain('<PushSubscriptionAccountSync userId={user.id} />');
    }
  });
});
