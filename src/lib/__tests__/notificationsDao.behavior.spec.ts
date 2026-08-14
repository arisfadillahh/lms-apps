import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getSupabaseAdmin: vi.fn(),
  sendPushToUsers: vi.fn(),
}));

vi.mock('@/lib/supabaseServer', () => ({
  getSupabaseAdmin: mocks.getSupabaseAdmin,
}));

vi.mock('@/lib/pushNotifications', () => ({
  sendPushToUsers: mocks.sendPushToUsers,
}));

import { createAdminNotifications, createNotification } from '@/lib/dao/notificationsDao';

function makeSupabase(
  recipient: { id: string } | null,
  activeAdmins: Array<{ id: string }> = recipient ? [recipient] : [],
) {
  const order: string[] = [];
  let insertedPayload: unknown;

  const notifications = {
    insert: vi.fn(async (payload: unknown) => {
      order.push('notifications.insert');
      insertedPayload = payload;
      return { error: null };
    }),
  };

  const users = {
    select: vi.fn(() => {
      order.push('users.select');
      return users;
    }),
    eq: vi.fn((field: string, value: unknown) => {
      order.push(`users.eq:${field}=${String(value)}`);
      return users;
    }),
    maybeSingle: vi.fn(async () => {
      order.push('users.maybeSingle');
      return { data: recipient, error: null };
    }),
    then: (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) => {
      order.push('users.execute');
      return Promise.resolve({ data: activeAdmins, error: null }).then(resolve, reject);
    },
  };

  const supabase = {
    from: vi.fn((table: string) => {
      if (table === 'notifications') return notifications;
      if (table === 'users') return users;
      throw new Error(`Unexpected table ${table}`);
    }),
  };

  return {
    supabase,
    order,
    get insertedPayload() {
      return insertedPayload;
    },
  };
}

describe('createNotification Admin PWA delivery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('pushes a generic Admin bell notification after the durable insert', async () => {
    const fixture = makeSupabase({ id: 'admin-1' });
    mocks.getSupabaseAdmin.mockReturnValue(fixture.supabase);
    mocks.sendPushToUsers.mockImplementation(async () => {
      fixture.order.push('push');
      return { sent: 1, removed: 0, skipped: false };
    });

    await createNotification('admin-1', 'Report bug baru', 'Ada bug di dashboard.', 'ISSUE_REPORT');

    expect(fixture.insertedPayload).toEqual({
      user_id: 'admin-1',
      title: 'Report bug baru',
      message: 'Ada bug di dashboard.',
      type: 'ISSUE_REPORT',
      is_read: false,
    });
    expect(mocks.sendPushToUsers).toHaveBeenCalledWith(['admin-1'], {
      title: 'Report bug baru',
      body: 'Ada bug di dashboard.',
      url: '/admin/dashboard',
      tag: 'admin-ISSUE_REPORT',
    });
    expect(fixture.order.indexOf('notifications.insert')).toBeLessThan(fixture.order.indexOf('push'));
  });

  it('fans out an issue-report style alert to every active Admin device', async () => {
    const fixture = makeSupabase(null, [{ id: 'admin-1' }, { id: 'admin-2' }]);
    mocks.getSupabaseAdmin.mockReturnValue(fixture.supabase);
    mocks.sendPushToUsers.mockImplementation(async () => {
      fixture.order.push('push');
      return { sent: 2, removed: 0, skipped: false };
    });

    await createAdminNotifications({
      type: 'ISSUE_REPORT',
      title: 'Report masalah baru',
      message: 'Buka menu Laporan Masalah untuk melihat detailnya.',
      pushUrl: '/admin/issue-reports',
      pushTag: 'issue-report-1',
    });

    expect(fixture.insertedPayload).toEqual([
      { user_id: 'admin-1', title: 'Report masalah baru', message: 'Buka menu Laporan Masalah untuk melihat detailnya.', type: 'ISSUE_REPORT', is_read: false },
      { user_id: 'admin-2', title: 'Report masalah baru', message: 'Buka menu Laporan Masalah untuk melihat detailnya.', type: 'ISSUE_REPORT', is_read: false },
    ]);
    expect(mocks.sendPushToUsers).toHaveBeenCalledWith(['admin-1', 'admin-2'], {
      title: 'Report masalah baru',
      body: 'Buka menu Laporan Masalah untuk melihat detailnya.',
      url: '/admin/issue-reports',
      tag: 'issue-report-1',
    });
    expect(fixture.order.indexOf('notifications.insert')).toBeLessThan(fixture.order.indexOf('push'));
  });

  it('does not push a notification addressed to a non-Admin user', async () => {
    const fixture = makeSupabase(null);
    mocks.getSupabaseAdmin.mockReturnValue(fixture.supabase);

    await createNotification('coach-1', 'Pengingat sesi', 'Sesi dimulai 15 menit lagi.', 'SESSION_REMINDER');

    expect(fixture.insertedPayload).toEqual({
      user_id: 'coach-1',
      title: 'Pengingat sesi',
      message: 'Sesi dimulai 15 menit lagi.',
      type: 'SESSION_REMINDER',
      is_read: false,
    });
    expect(mocks.sendPushToUsers).not.toHaveBeenCalled();
  });

  it('keeps the bell notification successful when PWA delivery fails', async () => {
    const fixture = makeSupabase({ id: 'admin-1' });
    mocks.getSupabaseAdmin.mockReturnValue(fixture.supabase);
    mocks.sendPushToUsers.mockRejectedValue(new Error('push endpoint unavailable'));
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await expect(
      createNotification('admin-1', 'Report bug baru', 'Detail tersimpan.', 'ISSUE_REPORT'),
    ).resolves.toBeUndefined();

    expect(fixture.insertedPayload).toEqual(expect.objectContaining({ user_id: 'admin-1', is_read: false }));
    expect(errorSpy).toHaveBeenCalledWith('[Notifications] Admin push delivery failed', expect.any(Error));
    errorSpy.mockRestore();
  });
});
