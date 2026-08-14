import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const script = readFileSync(resolve(process.cwd(), 'scripts/deploy-production.sh'), 'utf8');

describe('production deployment contract', () => {
  it('serializes deployments and accepts only the current production head', () => {
    expect(script).toContain('/var/lock/lms-production-deploy.lock');
    expect(script).toContain('flock -n 9');
    expect(script).toContain('refs/remotes/origin/production');
    expect(script).toContain('[[ "$TARGET_SHA" != "$PRODUCTION_SHA" ]]');
  });

  it('builds and smoke-tests the candidate before switching current', () => {
    const buildIndex = script.indexOf('npm run build');
    const candidateIndex = script.indexOf('CANDIDATE_READY=0');
    const switchIndex = script.indexOf('switch_current "$RELEASE_DIR"');

    expect(buildIndex).toBeGreaterThan(-1);
    expect(candidateIndex).toBeGreaterThan(buildIndex);
    expect(switchIndex).toBeGreaterThan(candidateIndex);
  });

  it('keeps runtime data shared and rolls back failed post-switch checks', () => {
    expect(script).toContain('ln -sfn "$SHARED_DIR/.env"');
    expect(script).toContain('baileys_auth_info');
    expect(script).toContain('public-uploads');
    expect(script).toContain('rollback()');
    expect(script).toContain('switch_current "$PREVIOUS_TARGET"');
  });
});
