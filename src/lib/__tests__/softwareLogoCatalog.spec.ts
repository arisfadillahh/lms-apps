import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({session:vi.fn(),get:vi.fn(),update:vi.fn(),create:vi.fn()}));
vi.mock('@/lib/auth',()=>({getSessionOrThrow:mocks.session}));
vi.mock('@/lib/dao/softwareDao',()=>({getSoftwareById:mocks.get,updateSoftware:mocks.update,createSoftware:mocks.create,listAllSoftware:vi.fn(),deleteSoftware:vi.fn()}));
import { PUT } from '@/app/api/admin/software/[id]/route';
import { POST } from '@/app/api/admin/software/route';
const params = {params:Promise.resolve({id:'software-fixture'})};
const request = (body: unknown) => new Request('http://localhost/api/admin/software',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
beforeEach(()=>{vi.clearAllMocks();mocks.session.mockResolvedValue({user:{role:'ADMIN'}});mocks.get.mockResolvedValue({id:'software-fixture',icon_url:'https://assets.example/old.png'});mocks.update.mockResolvedValue({id:'software-fixture'});mocks.create.mockResolvedValue({id:'new-fixture'});});
describe('catalog logo writes',()=>{
  it.each(['javascript:alert(1)','http://127.0.0.1/private',42])('rejects unsafe icon %s before writes',async iconUrl=>{
    expect((await PUT(request({iconUrl}),params)).status).toBe(400);
    expect((await POST(request({name:'Software QA',iconUrl}))).status).toBe(400);
    expect(mocks.update).not.toHaveBeenCalled();expect(mocks.create).not.toHaveBeenCalled();
  });
  it('preserves a logo when an unrelated update omits it',async()=>{
    expect((await PUT(request({name:'New name'}),params)).status).toBe(200);
    expect(mocks.update).toHaveBeenCalledWith('software-fixture',expect.objectContaining({name:'New name',iconUrl:undefined}));
  });
  it('stores an explicit safe replacement or explicit default selection by immutable ID',async()=>{
    await PUT(request({iconUrl:' https://assets.example/new.png '}),params);
    expect(mocks.update).toHaveBeenLastCalledWith('software-fixture',expect.objectContaining({iconUrl:'https://assets.example/new.png'}));
    await PUT(request({iconUrl:null}),params);
    expect(mocks.update).toHaveBeenLastCalledWith('software-fixture',expect.objectContaining({iconUrl:null}));
  });
  it('rejects non-admin mutations',async()=>{
    mocks.session.mockResolvedValue({user:{role:'CODER'}});
    expect((await PUT(request({iconUrl:'https://assets.example/new.png'}),params)).status).toBe(403);
    expect(mocks.update).not.toHaveBeenCalled();
  });
});
