import path from 'node:path';

export const BANNERS_DIR = path.join(process.cwd(), '.data', 'banners');
export const BANNERS_JSON = path.join(BANNERS_DIR, 'banners.json');

export function bannerImageUrl(imagePath: string) {
  return imagePath.startsWith('/banners/')
    ? imagePath.replace('/banners/', '/api/banner-images/')
    : imagePath;
}
