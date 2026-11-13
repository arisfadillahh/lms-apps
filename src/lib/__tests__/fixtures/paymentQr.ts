export function testQr(total:number){
    const s=`000201010212530336054${String(total).length.toString().padStart(2,'0')}${total}5802ID6304`;
    let crc=0xffff;for(const b of Buffer.from(s)){crc^=b<<8;for(let i=0;i<8;i++)crc=crc&0x8000?((crc<<1)^0x1021)&0xffff:(crc<<1)&0xffff;}
    return s+crc.toString(16).toUpperCase().padStart(4,'0');
}
