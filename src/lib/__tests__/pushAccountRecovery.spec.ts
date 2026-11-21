import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mock = vi.hoisted(() => ({ sync: vi.fn(), effect: vi.fn() }));
vi.mock('react', () => ({ useEffect: mock.effect }));
vi.mock('@/lib/clientPushSubscription', () => ({ syncExistingPushSubscriptionToCurrentAccount: mock.sync }));
import PushSubscriptionAccountSync from '@/components/pwa/PushSubscriptionAccountSync';

describe('installed app push recovery', () => {
  let cleanup: () => void;
  let browser: EventTarget;
  let page: EventTarget & { visibilityState: string };
  beforeEach(() => {
    vi.useFakeTimers(); vi.clearAllMocks();
    mock.sync.mockResolvedValue(undefined);
    browser = new EventTarget();
    page = Object.assign(new EventTarget(), { visibilityState: 'visible' });
    vi.stubGlobal('window', browser);
    vi.stubGlobal('document', page);
    vi.stubGlobal('navigator', { serviceWorker: new EventTarget() });
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    mock.effect.mockImplementation((effect: () => () => void) => { cleanup = effect(); });
  });
  afterEach(() => { cleanup?.(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
  it('retries failures and rebinds on foreground and reconnect', async () => {
    mock.sync.mockRejectedValueOnce(new Error('offline'));
    PushSubscriptionAccountSync({ userId: 'lead' });
    await vi.advanceTimersByTimeAsync(5000);
    expect(mock.sync).toHaveBeenCalledTimes(2);
    browser.dispatchEvent(new Event('online')); await Promise.resolve();
    page.dispatchEvent(new Event('visibilitychange')); await Promise.resolve();
    expect(mock.sync).toHaveBeenCalledTimes(4);
    expect(mock.sync).toHaveBeenLastCalledWith('lead');
  });
  it('does not overlap pending registrations', () => {
    mock.sync.mockReturnValue(new Promise(() => undefined));
    PushSubscriptionAccountSync({ userId: 'lead' });
    browser.dispatchEvent(new Event('focus'));
    browser.dispatchEvent(new Event('online'));
    expect(mock.sync).toHaveBeenCalledTimes(1);
  });
  it('waits for a hidden app to become visible', async () => {
    page.visibilityState = 'hidden';
    PushSubscriptionAccountSync({ userId: 'lead' });
    expect(mock.sync).not.toHaveBeenCalled();
    page.visibilityState = 'visible'; page.dispatchEvent(new Event('visibilitychange'));
    await Promise.resolve(); expect(mock.sync).toHaveBeenCalledTimes(1);
  });
  it('removes listeners and retries on unmount', async () => {
    mock.sync.mockRejectedValue(new Error('offline'));
    PushSubscriptionAccountSync({ userId: 'lead' }); await Promise.resolve();
    cleanup(); browser.dispatchEvent(new Event('online'));
    await vi.advanceTimersByTimeAsync(60_000);
    expect(mock.sync).toHaveBeenCalledTimes(1);
  });
});
