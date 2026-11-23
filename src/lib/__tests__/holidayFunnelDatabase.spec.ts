import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';

let db:PGlite;
const id='00000000-0000-4000-8000-000000000001';
const details={parentName:'Orang Tua QA',phone:'6281234567890',studentName:'Peserta QA',email:'',schoolGrade:1,platform:'none',
  startDate:'2026-12-14',endDate:'2026-12-16',total:350000,dueDays:7,
  selections:[{name:'Scratch Jr.',batch:'14–16 Des',start:'2026-12-14',end:'2026-12-16',time:'09.00'}],
  level:'Explorer',items:[{name:'Scratch Jr.',description:'14–16 Des · 09.00 WIB',basePrice:350000,discount:0,total:350000}],attribution:{measurement:true,utm_source:'qa'}};
const make=async(uuid=id,choice=details)=>{
  const {rows}=await db.query<{invoice:string}>('select create_holiday_class_registration($1,$2,$3) as invoice',[uuid,'a'.repeat(64),choice]);
  return rows[0].invoice;
};
describe('Holiday funnel additive database migration',()=>{
  beforeAll(async()=>{
    db=new PGlite();
    await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;
      CREATE TABLE invoices(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),invoice_number text,parent_name text,parent_phone text,
        seasonal_student_name text,seasonal_student_phone text,period_month int,period_year int,period_start_date date,period_end_date date,
        total_amount int,due_date date,status text,invoice_type text,created_at timestamptz default now(),updated_at timestamptz,paid_at timestamptz,paid_notes text,payment_method text,payment_total_amount int);
      CREATE TABLE invoice_items(invoice_id uuid REFERENCES invoices(id) ON DELETE CASCADE,coder_name text,class_name text,level_name text,description text,base_price int,discount_amount int,final_price int);`);
    for(const name of ['20261112160000_holiday_class_registration.sql','20261116110000_delete_holiday_registration_invoice.sql','20261123090000_holiday_funnel.sql','20261123093000_holiday_meta_outbox.sql'])await db.exec(readFileSync('supabase/migrations/'+name,'utf8'));
  },30000);
  afterAll(async()=>{await db?.close();});
  it('reuses identical orders across UUIDs without changing existing data, but permits additional programs',async()=>{
    const first=await make();
    const same=await make('00000000-0000-4000-8000-000000000002');
    expect(same).toBe(first);
    const other=await make('00000000-0000-4000-8000-000000000003',{...details,selections:[{...details.selections[0],name:'Kodu'}]});
    expect(other).not.toBe(first);
    const {rows}=await db.query<{count:number}>('select count(*)::int as count from holiday_class_meta_outbox');
    expect(rows[0].count).toBe(2);
  });
  it('atomically queues one purchase for duplicate settlements, with the verified fee-inclusive gross',async()=>{
    const invoice=await make();
    const {rows:[i]}=await db.query<{invoice_number:string}>('select invoice_number from invoices where id=$1',[invoice]);
    for(let n=0;n<2;n++)await db.query('select settle_holiday_class_invoice_measured($1,$2,$3,now())',[i.invoice_number,350000,352500]);
    const {rows}=await db.query<{event_id:string;value:number}>("select event_id,value from holiday_class_meta_outbox where event_name='Purchase'");
    expect(rows).toEqual([{event_id:i.invoice_number,value:352500}]);
    await expect(db.query('select settle_holiday_class_invoice_measured($1,$2,$3,now())',[i.invoice_number,350000,1])).rejects.toThrow();
  });
  it('atomically queues checkout once when payment instructions are stored',async()=>{
    const invoice=await make();
    await db.query("update invoices set payment_method='qris',payment_total_amount=352500 where id=$1",[invoice]);
    await db.query("update invoices set payment_method='bni_va',payment_total_amount=352500 where id=$1",[invoice]);
    const {rows}=await db.query<{value:number}>("select value from holiday_class_meta_outbox where event_name='InitiateCheckout'");
    expect(rows).toEqual([{value:352500}]);
  });
  it('claims each Meta event once until its lease expires and denies public queue access',async()=>{
    const a=await db.query('select * from claim_holiday_meta_events()');
    const b=await db.query('select * from claim_holiday_meta_events()');
    expect(a.rows.length).toBeGreaterThan(0);expect(b.rows).toHaveLength(0);
    const {rows}=await db.query<{role:string;allowed:boolean}>(`select role,has_table_privilege(role,'holiday_class_meta_outbox','SELECT') as allowed from (values ('anon'),('authenticated')) r(role)`);
    expect(rows.every(r=>!r.allowed)).toBe(true);
  });
  it('does not enqueue reminders for paid invoices or create both stages during a late catch-up',async()=>{
    await db.exec("update holiday_class_registrations set created_at='2026-11-19T03:00:00Z'; update invoices set due_date='2026-11-30';");
    await db.query("select enqueue_holiday_reminders('2026-11-23T03:00:00Z')");
    const {rows}=await db.query<{kind:string;status:string}>(`select n.kind,i.status from holiday_class_whatsapp_outbox n join holiday_class_registrations r on r.id=n.registration_id join invoices i on i.id=r.invoice_id where n.kind like 'reminder_%'`);
    expect(rows).toEqual([{kind:'reminder_3',status:'PENDING'}]);
    await db.query("select enqueue_holiday_reminders('2026-11-23T03:00:00Z')");
    const {rows:counts}=await db.query(`select registration_id,kind,count(*) from holiday_class_whatsapp_outbox group by registration_id,kind having count(*)>1`);
    expect(counts).toHaveLength(0);
  });
  it('enqueues H+1 exactly once during sending hours and ignores expired invoices',async()=>{
    await db.exec("delete from holiday_class_whatsapp_outbox where kind like 'reminder_%';update holiday_class_registrations set created_at='2026-11-22T03:00:00Z';");
    await db.query("select enqueue_holiday_reminders('2026-11-23T01:59:00Z')");
    const empty=await db.query("select id from holiday_class_whatsapp_outbox where kind like 'reminder_%'");expect(empty.rows).toHaveLength(0);
    await db.query("select enqueue_holiday_reminders('2026-11-23T03:00:00Z')");
    const stage=await db.query("select kind from holiday_class_whatsapp_outbox where kind like 'reminder_%'");expect(stage.rows).toEqual([{kind:'reminder_1'}]);
    await db.exec("delete from holiday_class_whatsapp_outbox where kind like 'reminder_%';update invoices set due_date='2026-11-22';");
    await db.query("select enqueue_holiday_reminders('2026-11-23T03:00:00Z')");
    const expired=await db.query("select id from holiday_class_whatsapp_outbox where kind like 'reminder_%'");expect(expired.rows).toHaveLength(0);
  });
  it('preserves existing unpaid dummy deletion and paid invoice protection with the new queue',async()=>{
    const candidate=await make('00000000-0000-4000-8000-000000000009',{...details,phone:'6281987654321'});
    const removed=await db.query<{result:string}>('select delete_holiday_registration_invoice($1,true) as result',[candidate]);
    expect(removed.rows[0].result).toBe('deleted');
    const queue=await db.query("select id from holiday_class_meta_outbox where registration_id='00000000-0000-4000-8000-000000000009'");expect(queue.rows).toHaveLength(0);
    const paidInvoice=await make();
    const protectedRow=await db.query<{result:string}>('select delete_holiday_registration_invoice($1,true) as result',[paidInvoice]);expect(protectedRow.rows[0].result).toBe('paid');
  });
});
