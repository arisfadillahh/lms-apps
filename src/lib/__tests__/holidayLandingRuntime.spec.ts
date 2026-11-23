import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { afterEach,describe,expect,it,vi } from 'vitest';

type Pixel=((...args:unknown[])=>void)&{callMethod?:(...args:unknown[])=>void};
function fixture() {
  const memory=new Map<string,string>();
  const noop=()=>undefined;
  const window:{fbq?:Pixel;clevioHolidayAttribution?:()=>Record<string,string>;clevioTrackHolidayRegistration?:(id:string)=>Promise<boolean>}={};
  const node={querySelector:()=>({addEventListener:noop}),close:noop,show:noop,addEventListener:noop};
  const document={querySelector:()=>node,addEventListener:noop,cookie:'_fbp=fb.1.1.browser',head:{appendChild:noop},createElement:()=>({})};
  const sessionStorage={getItem:(k:string)=>memory.get(k)??null,setItem:(k:string,v:string)=>memory.set(k,v)};
  runInNewContext(readFileSync('ops/holiday-landing/meta-tracking-v3.js','utf8'),{window,document,location:{search:'?utm_source=facebook&utm_campaign=holiday&fbclid=click-id'},localStorage:{getItem:()=>null},sessionStorage,URLSearchParams,Date,setTimeout});
  return {window,memory};
}
afterEach(()=>vi.useRealTimers());
describe('active static Holiday landing measurement',()=>{
  it('preserves attribution and waits for a real Pixel runtime, deduplicating concurrent callbacks',async()=>{
    vi.useFakeTimers();
    const {window}=fixture();
    expect(window.clevioHolidayAttribution!()).toMatchObject({utm_source:'facebook',utm_campaign:'holiday',fbclid:'click-id',fbp:'fb.1.1.browser'});
    const id='00000000-0000-4000-8000-000000000001';
    const a=window.clevioTrackHolidayRegistration!(id),b=window.clevioTrackHolidayRegistration!(id);
    const sent=vi.fn();window.fbq!.callMethod=sent;
    await vi.advanceTimersByTimeAsync(500);
    expect(await a).toBe(true);expect(await b).toBe(true);
    expect(sent).toHaveBeenCalledTimes(1);
    expect(sent.mock.calls[0]).toEqual(['trackSingle','710028324574763','CompleteRegistration',{}, {eventID:id}]);
  });
  it('returns failure when Pixel stays blocked so the invoice fallback can retain its marker',async()=>{
    vi.useFakeTimers();
    const {window}=fixture();const pending=window.clevioTrackHolidayRegistration!('00000000-0000-4000-8000-000000000001');
    await vi.advanceTimersByTimeAsync(1600);
    expect(await pending).toBe(false);
  });
});
