// Synthetic records for normal local login/dashboard/navigation. No VPS import.
export async function seedLocalDashboard(db, appUrl) {
  const level = '60000000-0000-4000-8000-000000000001';
  const block = '60000000-0000-4000-8000-000000000002';
  await db.query("INSERT INTO levels(id,name,description,order_index) VALUES ($1,'Explorer Demo','Level contoh local',1) ON CONFLICT(id) DO NOTHING", [level]);
  await db.query("INSERT INTO blocks(id,level_id,name,summary,order_index,is_published) VALUES ($1,$2,'Blok Demo','Materi contoh local',1,true) ON CONFLICT(id) DO NOTHING", [block, level]);
  await db.query('UPDATE blocks SET estimated_sessions=2 WHERE id=$1 AND estimated_sessions IS NULL', [block]);
  const templateIds = ['63000000-0000-4000-8000-000000000001', '63000000-0000-4000-8000-000000000002'];
  for (const [i, id] of templateIds.entries()) {
    await db.query('INSERT INTO lesson_templates(id,block_id,title,summary,order_index,estimated_meeting_count,is_archived) VALUES ($1,$2,$3,$4,$5,1,false) ON CONFLICT(id) DO NOTHING', [id, block, `Lesson Demo ${i + 1}`, 'Contoh materi local', i + 1]);
  }
  // Repair only empty duplicate blocks produced by the previous synthetic fixture.
  // Keep original blocks, lesson-bearing blocks and every financial record intact.
  await db.query(`DELETE FROM class_blocks WHERE id IN (
    SELECT id FROM (
      SELECT cb.id, row_number() OVER (PARTITION BY class_id,block_id,start_date,end_date,status ORDER BY created_at,id) AS duplicate_number
      FROM class_blocks cb WHERE block_id=$1 AND status='UPCOMING'
      AND NOT EXISTS (SELECT 1 FROM class_lessons cl WHERE cl.class_block_id=cb.id)
    ) duplicates WHERE duplicate_number>1
  )`, [block]);
  await db.query('UPDATE classes SET level_id=$1 WHERE level_id IS NULL AND type=\'WEEKLY\'', [level]);
  const classes = await db.query('SELECT id FROM classes ORDER BY id');
  for (const [i, row] of classes.rows.entries()) {
    const classBlock = `61000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`;
    await db.query("INSERT INTO class_blocks(id,class_id,block_id,status,start_date,end_date) VALUES ($1,$2,$3,'CURRENT',CURRENT_DATE,CURRENT_DATE+90) ON CONFLICT(id) DO NOTHING", [classBlock, row.id, block]);
    if (!(await db.query('SELECT 1 FROM class_lessons WHERE class_block_id=$1 LIMIT 1', [classBlock])).rows.length) {
      await db.query("INSERT INTO class_lessons(class_block_id,title,summary,order_index) VALUES ($1,'Lesson Demo 1','Contoh materi untuk inspeksi local',1),($1,'Lesson Demo 2','Contoh materi berikutnya',2)", [classBlock]);
    }
    for (const [j, templateId] of templateIds.entries()) {
      await db.query('UPDATE class_lessons SET lesson_template_id=$1 WHERE class_block_id=$2 AND order_index=$3 AND lesson_template_id IS NULL', [templateId, classBlock, j + 1]);
    }
    const sessionId = `62000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`;
    await db.query("INSERT INTO sessions(id,class_id,date_time,status) VALUES ($1,$2,(CURRENT_DATE::text || ' 16:00:00+07')::timestamptz,'SCHEDULED') ON CONFLICT(id) DO NOTHING", [sessionId, row.id]);
  }
  const invoices = await db.query('SELECT id FROM invoices WHERE invoice_number IS NULL ORDER BY id');
  for (const [i, row] of invoices.rows.entries()) await db.query("UPDATE invoices SET invoice_number=$2,parent_name='Orang Tua Demo',parent_phone='',period_month=EXTRACT(MONTH FROM CURRENT_DATE),period_year=EXTRACT(YEAR FROM CURRENT_DATE),total_amount=200000,due_date=CURRENT_DATE+10,invoice_type='MONTHLY' WHERE id=$1", [row.id, `LOCAL-DEMO-${String(i + 1).padStart(4,'0')}`]);
  for (const row of (await db.query('SELECT id FROM invoices')).rows) {
    if (!(await db.query('SELECT 1 FROM invoice_items WHERE invoice_id=$1 LIMIT 1', [row.id])).rows.length) await db.query("INSERT INTO invoice_items(invoice_id,coder_name,class_name,level_name,base_price,final_price,description) VALUES ($1,'Coder Contoh','Weekly Dua Anak','Explorer Demo',200000,200000,'Data sintetis local')", [row.id]);
  }
  if (!(await db.query('SELECT 1 FROM invoice_settings LIMIT 1')).rows.length) await db.query("INSERT INTO invoice_settings(base_url,bank_name,bank_account_number,bank_account_holder,enable_class_reminder,enable_absent_notification) VALUES ($1,'DEMO LOCAL','-','BUKAN REKENING PEMBAYARAN',false,false)", [appUrl]);
  if (!(await db.query("SELECT 1 FROM whatsapp_sessions WHERE client_id='clevio-wa-client'")).rows.length) await db.query("INSERT INTO whatsapp_sessions(client_id,is_connected) VALUES ('clevio-wa-client',false)");
}
