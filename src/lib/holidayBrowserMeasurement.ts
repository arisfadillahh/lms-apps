'use client';

let bridge:HTMLIFrameElement|undefined;
/** Keep third-party code off the invoice document and its bearer-token URL. */
export async function sendHolidayBrowserMeasurement(name:string,id:string,value?:number):Promise<boolean> {
  if(!bridge){
    bridge=document.createElement('iframe');
    bridge.src='/holiday-measurement';bridge.hidden=true;bridge.title='Pengukuran Holiday Class';
    bridge.referrerPolicy='no-referrer';bridge.sandbox.add('allow-scripts');
    document.body.appendChild(bridge);
  }
  const frame=bridge;
  return new Promise(resolve=>{
    let finished=false;
    const nonce=crypto.randomUUID();
    const finish=(ok:boolean)=>{if(finished)return;finished=true;clearInterval(retry);clearTimeout(timeout);window.removeEventListener('message',receive);resolve(ok);};
    const receive=(event:MessageEvent)=>{if(event.source===frame.contentWindow&&event.data?.type==='HOLIDAY_MEASURED'&&event.data?.nonce===nonce)finish(true);};
    const send=()=>frame.contentWindow?.postMessage({type:'HOLIDAY_MEASURE',name,id,value,nonce},'*');
    window.addEventListener('message',receive);
    const retry=setInterval(send,150);
    const timeout=setTimeout(()=>finish(false),2500);
    send();
  });
}
