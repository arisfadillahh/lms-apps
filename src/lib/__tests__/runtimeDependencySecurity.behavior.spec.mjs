// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import sharp from 'sharp';
import bcrypt from 'bcrypt';

describe('patched collection validation preserves boundaries without oversized work', () => {
  for (const collection of ['array', 'set']) {
    it.each([1, 2])(`accepts ${collection} below/at the size limit (%s)`, size => {
      const values = Array.from({ length: size }, (_, index) => index + 1);
      const input = collection === 'array' ? values : new Set(values);
      const schema = collection === 'array' ? z.array(z.number()).max(2) : z.set(z.number()).max(2);
      const result = schema.safeParse(input);
      expect(result.success).toBe(true);
      expect(result.data).toEqual(input);
    });

    it(`rejects an oversized ${collection} before visiting its items`, () => {
      let visited = 0;
      const item = z.preprocess(value => { visited++; return value; }, z.number());
      const schema = collection === 'array' ? z.array(item).max(2) : z.set(item).max(2);
      const input = collection === 'array' ? [1, 2, 3] : new Set([1, 2, 3]);
      const result = schema.safeParse(input);
      expect(result.success).toBe(false);
      expect(result.error.issues.map(issue => issue.code)).toEqual(['too_big']);
      expect(visited).toBe(0);
    });
  }

  it('retains asynchronous valid parsing but does not schedule oversized item work', async () => {
    let visited = 0;
    const schema = z.array(z.preprocess(async value => { visited++; return value; }, z.number())).max(2);
    expect(await schema.parseAsync([1, 2])).toEqual([1, 2]);
    expect(visited).toBe(2);
    visited = 0;
    expect((await schema.safeParseAsync([1, 2, 3])).success).toBe(false);
    expect(visited).toBe(0);
  });
});

describe('native production integrations remain operational without unused Jimp', () => {
  it('generates a real WhatsApp JPEG profile image through the supported Sharp path', async () => {
    const { generateProfilePicture } = await import('@whiskeysockets/baileys');
    const input = await sharp({ create: { width: 96, height: 48, channels: 4, background: '#183b78' } }).png().toBuffer();
    const { img } = await generateProfilePicture(input, { width: 64, height: 64 });
    const metadata = await sharp(img).metadata();
    expect(metadata.format).toBe('jpeg');
    expect([metadata.width, metadata.height]).toEqual([64, 64]);
  }, 20000);

  it('rejects corrupt image bytes instead of returning an invalid image', async () => {
    const { generateProfilePicture } = await import('@whiskeysockets/baileys');
    await expect(generateProfilePicture(Buffer.from('synthetic-invalid-image'))).rejects.toThrow();
  });

  it('retains real native password hashing and comparison', async () => {
    const hash = await bcrypt.hash('synthetic-regression-input', 4);
    expect(await bcrypt.compare('synthetic-regression-input', hash)).toBe(true);
    expect(await bcrypt.compare('different-synthetic-input', hash)).toBe(false);
  });
});
