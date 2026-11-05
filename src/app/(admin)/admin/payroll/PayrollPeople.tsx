'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { payrollPeopleRows, type PayrollCoachAccount } from '@/lib/payroll/people';
import type { PayrollPerson, PayrollTerm } from '@/lib/payroll/model';
import { rupiah } from '@/lib/payroll/presentation';
import styles from './PayrollAdmin.module.css';

export default function PayrollPeople({people,terms,coaches,date,busy,edit,add}: {
  people: PayrollPerson[]; terms: PayrollTerm[]; coaches: PayrollCoachAccount[]; date: string; busy: boolean;
  edit: (person: PayrollPerson) => void; add: (kind?: 'COACH' | 'STAFF', coachId?: string) => void;
}) {
  const [search,setSearch]=useState(''),[kind,setKind]=useState('ALL'),[status,setStatus]=useState('ACTIVE');
  const rows=payrollPeopleRows(people,terms,coaches,date);
  const visible=rows.filter(r => (!search || `${r.name} ${r.jobTitle}`.toLocaleLowerCase('id').includes(search.toLocaleLowerCase('id'))) && (kind==='ALL'||r.kind===kind) && (status==='ALL'||status==='ACTIVE'&&r.active||status==='INACTIVE'&&!r.active||status==='SETUP'&&r.active&&r.needsSetup));
  const pending=rows.filter(r=>r.active&&r.needsSetup).length;
  return <section className={`${styles.panel} ${styles.peoplePanel}`} aria-label="Daftar coach dan staf">
    <div className={styles.peopleHeader}><div><h2>Coach &amp; staf</h2><p className={styles.muted}>Atur kontrak, gaji rutin, tunjangan, dan kontak penerima.</p></div><Button disabled={busy} onClick={()=>add('STAFF')}><Plus data-icon="inline-start" />Tambah penerima</Button></div>
    <div className={styles.peopleFilters}><Input aria-label="Cari coach atau staf" placeholder="Cari nama atau jabatan" value={search} onChange={e=>setSearch(e.target.value)} /><select aria-label="Kategori coach dan staf" className={styles.select} value={kind} onChange={e=>setKind(e.target.value)}><option value="ALL">Coach &amp; staf</option><option value="COACH">Coach</option><option value="STAFF">Staf</option></select><select aria-label="Status penerima gaji" className={styles.select} value={status} onChange={e=>setStatus(e.target.value)}><option value="ACTIVE">Aktif</option><option value="SETUP">Perlu dilengkapi</option><option value="INACTIVE">Nonaktif</option><option value="ALL">Semua status</option></select></div>
    <p className={styles.muted} role="status">{visible.length} penerima ditampilkan{pending>0 && <> · {pending} penerima aktif perlu dilengkapi</>}</p>
    <div className={styles.peopleColumns} aria-hidden="true"><span>Nama</span><span>Pengaturan gaji</span><span>Gaji &amp; tunjangan rutin / bulan</span><span /></div>
    <ul className={styles.peopleList}>{visible.map(row=><li key={row.id} className={styles.personRow} aria-label={`Penerima ${row.name}`}>
      <div className={styles.personIdentity}><strong>{row.name}</strong><span>{[row.kind==='COACH'?'Coach':'Staf',row.jobTitle && row.jobTitle.toLowerCase()!=='coach'?row.jobTitle:''].filter(Boolean).join(' · ')}</span></div>
      <div className={styles.personState}><span className={!row.active?styles.muted:row.needsSetup?styles.personPending:styles.rowname}>{!row.active?'Nonaktif':row.salaryPending?'Fulltime · lengkapi gaji pokok':row.needsSetup?'Belum atur kontrak':row.startsLater?'Kontrak terjadwal':row.term?.contract==='FULLTIME'?'Fulltime':'Mitra'}</span>{row.startsLater && <span className={styles.rowmeta}>Mulai {new Date(row.startsLater+'T12:00:00+07:00').toLocaleDateString('id-ID',{dateStyle:'medium',timeZone:'Asia/Jakarta'})}</span>}</div>
      <div className={styles.personAmount}>{row.monthly===null?<span className={styles.muted}>—</span>:row.term?.contract==='MITRA'&&row.monthly===0?<span className={styles.muted}>Fee sesuai aktivitas</span>:<><strong>{rupiah(row.monthly)}</strong><span className={styles.rowmeta}>{row.term?.contract==='FULLTIME'?'Gaji pokok + tunjangan':'Tunjangan rutin'}</span></>}</div>
      <Button size="sm" variant="outline" disabled={busy} aria-label={`${row.needsSetup?'Atur gaji':'Edit'} ${row.name}`} onClick={()=>row.profile?edit(row.profile):add('COACH',row.coachId)}>{row.needsSetup?'Atur gaji':'Edit'}</Button>
    </li>)}</ul>
    {!visible.length && <div className={styles.empty}>{rows.length?'Tidak ada penerima yang cocok dengan pencarian atau filter.':'Belum ada penerima. Tambahkan staf atau coach untuk mulai mengatur gaji.'}</div>}
    <p className={styles.peopleHint}>Tambahan atau potongan khusus satu bulan diatur lewat <strong>Rekap &amp; arsip → Rincian</strong>.</p>
  </section>;
}
