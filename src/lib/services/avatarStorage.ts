import path from 'path';

import { isAllowedAvatarFilename } from '@/lib/services/avatarUploadSecurity';

export function getAvatarUploadDir(): string {
  const configuredDir = process.env.AVATAR_UPLOAD_DIR?.trim();

  return configuredDir ? path.resolve(configuredDir) : path.join(process.cwd(), '.uploads', 'avatars');
}

export function buildAvatarPublicPath(filename: string): string | null {
  if (!isAllowedAvatarFilename(filename)) {
    return null;
  }

  return `/api/avatars/${encodeURIComponent(filename)}`;
}

export function resolveAvatarPublicUrl(rawAvatarPath: string): string | null {
  const value = rawAvatarPath.trim();

  if (/^https?:\/\//i.test(value)) {
    return value;
  }

  return buildAvatarPublicPath(path.basename(value));
}
