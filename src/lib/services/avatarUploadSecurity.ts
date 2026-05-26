export const MAX_AVATAR_UPLOAD_BYTES = 2 * 1024 * 1024;

type AvatarImageType = {
  contentType: string;
  extension: string;
  matches: (buffer: Buffer) => boolean;
};

const AVATAR_IMAGE_TYPES: AvatarImageType[] = [
  {
    contentType: 'image/png',
    extension: '.png',
    matches: (buffer) =>
      buffer.length >= 8 &&
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0d &&
      buffer[5] === 0x0a &&
      buffer[6] === 0x1a &&
      buffer[7] === 0x0a,
  },
  {
    contentType: 'image/jpeg',
    extension: '.jpg',
    matches: (buffer) => buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff,
  },
  {
    contentType: 'image/gif',
    extension: '.gif',
    matches: (buffer) =>
      buffer.length >= 6 &&
      (buffer.subarray(0, 6).toString('ascii') === 'GIF87a' ||
        buffer.subarray(0, 6).toString('ascii') === 'GIF89a'),
  },
  {
    contentType: 'image/webp',
    extension: '.webp',
    matches: (buffer) =>
      buffer.length >= 12 &&
      buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
      buffer.subarray(8, 12).toString('ascii') === 'WEBP',
  },
];

export function detectAvatarImageType(contentType: string, buffer: Buffer): AvatarImageType | null {
  const normalizedContentType = contentType.toLowerCase();
  const imageType = AVATAR_IMAGE_TYPES.find((type) => type.contentType === normalizedContentType);

  if (!imageType || !imageType.matches(buffer)) {
    return null;
  }

  return imageType;
}

export function isAllowedAvatarFilename(filename: string): boolean {
  const normalizedFilename = filename.toLowerCase();
  return (
    AVATAR_IMAGE_TYPES.some((type) => normalizedFilename.endsWith(type.extension)) ||
    normalizedFilename.endsWith('.jpeg')
  );
}

export function getStoredAvatarContentType(filename: string, buffer: Buffer): string | null {
  const normalizedFilename = filename.toLowerCase();
  const imageType = AVATAR_IMAGE_TYPES.find((type) => type.matches(buffer));

  if (!imageType) {
    return null;
  }

  const matchesExtension =
    normalizedFilename.endsWith(imageType.extension) ||
    (imageType.contentType === 'image/jpeg' && normalizedFilename.endsWith('.jpeg'));

  return matchesExtension ? imageType.contentType : null;
}
