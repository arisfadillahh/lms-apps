import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET } from '@/app/api/software/logos/[brand]/route';
import { BUILTIN_SOFTWARE_LOGOS } from '@/lib/softwareLogos';
const request = new Request('https://lms.example/api/software/logos/scratch?url=http://127.0.0.1/private');
afterEach(() => vi.unstubAllGlobals());
describe('official-logo proxy', () => {
  it('fetches only the fixed vendor source, never a query-provided URL', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(new Uint8Array([0,0,1,0,1,0]),{headers:{'Content-Type':'image/x-icon'}}));vi.stubGlobal('fetch',fetcher);
    const response = await GET(request,{params:Promise.resolve({brand:'scratch'})});
    expect(fetcher).toHaveBeenCalledWith(BUILTIN_SOFTWARE_LOGOS.scratch,expect.any(Object));
    expect(response.status).toBe(200);expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
  });
  it.each(['__proto__','unknown','../../admin'])('rejects unsupported brand %s without fetching', async brand => {
    const fetcher = vi.fn();vi.stubGlobal('fetch',fetcher);
    expect((await GET(request,{params:Promise.resolve({brand})})).status).toBe(404);expect(fetcher).not.toHaveBeenCalled();
  });
  it('rejects a vendor HTML error page instead of presenting it as an image', async () => {
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response('<html>not an icon</html>',{headers:{'Content-Type':'text/html'}})));
    expect((await GET(request,{params:Promise.resolve({brand:'scratch'})})).status).toBe(404);
  });
  it('bounds the upstream response and handles unavailability', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(new Uint8Array(512*1024+1),{headers:{'Content-Type':'image/png'}}));vi.stubGlobal('fetch',fetcher);
    expect((await GET(request,{params:Promise.resolve({brand:'scratch'})})).status).toBe(413);
    fetcher.mockRejectedValue(new Error('offline'));
    expect((await GET(request,{params:Promise.resolve({brand:'scratch'})})).status).toBe(404);
  });
  it('extracts only the actual Trinket header wordmark', async () => {
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==','base64');
    const content = `<img alt="Other" src="data:image/png;base64,YmFk"><img src="data:image/png;base64,${png.toString('base64')}" alt="Trinket">`;
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(content,{headers:{'Content-Type':'text/html'}})));
    const result = await GET(request,{params:Promise.resolve({brand:'trinket'})});
    expect(result.status).toBe(200);expect(new Uint8Array(await result.arrayBuffer())).toEqual(new Uint8Array(png));
  });
});
