import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
const token = vi.hoisted(()=>vi.fn());
vi.mock('next-auth/jwt',()=>({getToken:token}));
import { middleware } from '../../../middleware';
beforeEach(()=>token.mockResolvedValue(null));
describe('public logo access boundaries',()=>{
  it('lets signed-out portfolio visitors request official images',async()=>{
    const response = await middleware(new NextRequest('https://lms.example/api/software/logos/scratch'));
    expect(response.headers.get('x-middleware-next')).toBe('1');
  });
  it.each(['/api/admin/software/logo','/api/admin/software','/api/software/logos-private/scratch'])('keeps %s protected',async path=>{
    const response = await middleware(new NextRequest('https://lms.example'+path,{method:'POST'}));
    expect(response.status).toBe(401);
  });
});
