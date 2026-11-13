import 'server-only';
import { getSupabaseAdmin } from '@/lib/supabaseServer';
import { setTimeout as delay } from 'node:timers/promises';

/** BSI status/cancel requires the provider ID delivered by a signed webhook. */
export async function verifiedSnapTransactionId(orderId: string): Promise<string> {
    for(let attempt=0;attempt<3;attempt++){
        const {data,error}=await getSupabaseAdmin().from('midtrans_webhook_events' as never)
            .select('transaction_id').eq('order_id',orderId).not('transaction_id','is',null)
            .order('claimed_at',{ascending:false}).limit(1).maybeSingle();
        const id=(data as {transaction_id?:string}|null)?.transaction_id;
        if(!error&&id&&/^[a-zA-Z0-9-]{10,100}$/.test(id))return id;
        if(error)break;
        if(attempt<2)await delay(400);
    }
    throw new Error('Konfirmasi pembayaran belum diterima. Coba lagi sebentar atau hubungi admin.');
}
