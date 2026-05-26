import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';

import { getStoredAvatarContentType } from '@/lib/services/avatarUploadSecurity';
import { getAvatarUploadDir, resolveAvatarPublicUrl } from '@/lib/services/avatarStorage';

const originalAvatarUploadDir = process.env.AVATAR_UPLOAD_DIR;

describe('avatar storage', () => {
  afterEach(() => {
    if (originalAvatarUploadDir === undefined) {
      delete process.env.AVATAR_UPLOAD_DIR;
    } else {
      process.env.AVATAR_UPLOAD_DIR = originalAvatarUploadDir;
    }
  });

  it('uses a configured persistent upload directory', () => {
    process.env.AVATAR_UPLOAD_DIR = './persistent/avatars';

    expect(getAvatarUploadDir()).toBe(path.resolve('./persistent/avatars'));
  });

  it('normalizes legacy local paths through the protected avatar endpoint', () => {
    expect(resolveAvatarPublicUrl('/uploads/avatars/user-photo.jpeg')).toBe('/api/avatars/user-photo.jpeg');
    expect(resolveAvatarPublicUrl('/uploads/avatars/not-an-image.html')).toBeNull();
  });
});

describe('stored avatar validation', () => {
  const jpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);

  it('serves valid legacy JPEG file extensions after migration', () => {
    expect(getStoredAvatarContentType('user-photo.jpg', jpegBuffer)).toBe('image/jpeg');
    expect(getStoredAvatarContentType('user-photo.jpeg', jpegBuffer)).toBe('image/jpeg');
  });

  it('rejects mismatched or non-image stored bytes', () => {
    expect(getStoredAvatarContentType('user-photo.png', jpegBuffer)).toBeNull();
    expect(getStoredAvatarContentType('user-photo.jpg', Buffer.from('<html>unsafe</html>'))).toBeNull();
  });
});
