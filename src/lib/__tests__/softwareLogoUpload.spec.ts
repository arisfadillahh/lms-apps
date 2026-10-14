import { beforeEach, describe, expect, it, vi } from 'vitest';
import sharp from 'sharp';
import { readSoftwareLogoForm, validateSoftwareLogoImage, MAX_SOFTWARE_LOGO_REQUEST_BYTES } from '@/lib/services/softwareLogoUpload';

const mocks = vi.hoisted(() => ({session:vi.fn(),rate:vi.fn(),upload:vi.fn()}));
vi.mock('@/lib/auth', () => ({getServerAuthSession:mocks.session}));
vi.mock('@/lib/rateLimit', () => ({consumeRateLimit:mocks.rate}));
vi.mock('@/lib/storage', () => ({uploadPortfolioScreenshot:mocks.upload}));
import { POST } from '@/app/api/admin/software/logo/route';

const png = async () => new Uint8Array(await sharp({create:{width:20,height:20,channels:4,background:'#123456'}}).png().toBuffer());
async function request(file: File) {
  const form = new FormData(); form.set('file',file);
  return new Request('http://localhost/api/admin/software/logo',{method:'POST',body:form});
}
beforeEach(() => {
  vi.clearAllMocks();mocks.session.mockResolvedValue({user:{id:'admin-fixture',role:'ADMIN'}});
  mocks.rate.mockResolvedValue(true);mocks.upload.mockResolvedValue('https://assets.example/logo.png');
});
describe('bounded software logo uploads', () => {
  it('validates a real PNG and keeps original bytes', async () => {
    const bytes = await png();const output = await validateSoftwareLogoImage(new File([bytes],'logo.png',{type:'image/png'}));
    expect(output.extension).toBe('.png');expect(output.buffer).toEqual(Buffer.from(bytes));
  });
  it.each(['image/svg+xml','image/gif','text/html'])('rejects %s before storage', async type => {
    const response = await POST(await request(new File(['<svg onload="test"/>'],'logo.svg',{type})));
    expect(response.status).toBe(400);expect(mocks.upload).not.toHaveBeenCalled();
  });
  it('rejects spoofed and truncated PNG content', async () => {
    await expect(validateSoftwareLogoImage(new File(['not-an-image'],'bad.png',{type:'image/png'}))).rejects.toThrow('INVALID_IMAGE');
    await expect(validateSoftwareLogoImage(new File([new Uint8Array([137,80,78,71,13,10,26,10])],'bad.png',{type:'image/png'}))).rejects.toThrow('INVALID_IMAGE');
  });
  it('rejects an empty file and a file above 1 MiB without storage',async()=>{
    expect((await POST(await request(new File([],'empty.png',{type:'image/png'})))).status).toBe(400);
    expect((await POST(await request(new File([new Uint8Array(1024*1024+1)],'large.png',{type:'image/png'})))).status).toBe(413);
    expect(mocks.upload).not.toHaveBeenCalled();
  });
  it('enforces body size even without a Content-Length header', async () => {
    const req = new Request('http://localhost/upload',{method:'POST',headers:{'Content-Type':'multipart/form-data; boundary=test'},body:new Uint8Array(MAX_SOFTWARE_LOGO_REQUEST_BYTES+1)});
    await expect(readSoftwareLogoForm(req)).rejects.toThrow('TOO_LARGE');
  });
  it('rejects unauthenticated and non-admin callers before reading/storing files', async () => {
    mocks.session.mockResolvedValue(null);
    expect((await POST(await request(new File([await png()],'logo.png',{type:'image/png'})))).status).toBe(401);
    mocks.session.mockResolvedValue({user:{id:'coder-fixture',role:'CODER'}});
    expect((await POST(await request(new File([await png()],'logo.png',{type:'image/png'})))).status).toBe(403);
    expect(mocks.rate).not.toHaveBeenCalled();expect(mocks.upload).not.toHaveBeenCalled();
  });
  it('stores a new immutable object only after authorization, rate check and validation', async () => {
    const response = await POST(await request(new File([await png()],'../../existing.png',{type:'image/png'})));
    expect(response.status).toBe(200);expect(await response.json()).toEqual({iconUrl:'https://assets.example/logo.png'});
    expect(mocks.upload).toHaveBeenCalledWith(expect.stringMatching(/^software-logos\/[a-f0-9-]+\.png$/),expect.any(Buffer),'image/png');
    expect(mocks.session.mock.invocationCallOrder[0]).toBeLessThan(mocks.rate.mock.invocationCallOrder[0]);
    expect(mocks.rate.mock.invocationCallOrder[0]).toBeLessThan(mocks.upload.mock.invocationCallOrder[0]);
  });
  it('does not store after hitting a rate limit', async () => {
    mocks.rate.mockResolvedValue(false);
    expect((await POST(await request(new File([await png()],'logo.png',{type:'image/png'})))).status).toBe(429);
    expect(mocks.upload).not.toHaveBeenCalled();
  });
});
