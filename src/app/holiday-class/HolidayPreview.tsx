'use client';

import { useState } from 'react';
import { trackPageView } from '@/lib/metaPixel';
import { useEffect } from 'react';
import styles from './holiday.module.css';

const batches = ['14–16 Des', '17–19 Des', '21–23 Des', '24–26 Des', '28–30 Des', '4–6 Jan', '7–9 Jan'];
const levels = [
  { name: 'Explorer', grade: 'Kelas 1–3 SD', price: 350000, bundle: 900000, programs: [
    ['Scratch Jr.', '09.00', '13.00', '11.30', '11.30', '09.00', '09.00', '09.00'],
    ['Kodu', '09.00', '09.00', '11.30', '10.00', '09.00', '11.30', '09.00'],
    ['Minecraft Builder', '11.30', '10.00', '13.00', '09.00', '09.00', '13.00', '09.00'],
  ] },
  { name: 'Creator', grade: 'Kelas 4–6 SD', price: 425000, bundle: 1100000, programs: [
    ['MakeCode', '11.30', '11.30', '13.00', '09.00', '09.00', '13.00', '09.00'],
    ['GDevelop', '14.00', '13.00', '13.00', '14.00', '11.30', '09.00', '09.00'],
    ['Minecraft Code', '14.00', '14.00', '13.00', '09.00', '11.30', '11.30', '09.00'],
    ['Scratch 3', '09.00', '13.00', '09.00', '09.00', '14.00', '13.00', '14.00'],
  ] },
  { name: 'Innovator', grade: 'Kelas 7 SMP–12 SMA', price: 500000, bundle: 1300000, programs: [
    ['Vibe Coding Godot + MCP', '09.00', '13.00', '09.00', '09.00', '14.00', '13.00', '11.30'],
    ['n8n Automation', '09.00', '13.00', '14.00', '09.00', '09.00', '14.00', '09.00'],
    ['Vibes Coding (VS Code)', '09.00', '13.00', '14.00', '09.00', '09.00', '14.00', '10.00'],
  ] },
];
const money = (amount: number) => 'Rp' + amount.toLocaleString('id-ID');

export default function HolidayPreview() {
  const [level, setLevel] = useState(0);
  const [batch, setBatch] = useState(0);
  const group = levels[level];
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_HOLIDAY_META_ENABLED === 'true') {
      trackPageView({ program_id: 'holiday-class-2026-2027' });
    }
  }, []);
  return <main className={styles.page}>
    <header><strong>Clevio</strong><a href="https://clev.io/chat">Tanya via WhatsApp ↗</a></header>
    <section className={styles.hero}>
      <div>
        <p className={styles.kicker}>14 Desember 2026 – 9 Januari 2027</p>
        <h1>Liburan jadi waktu bikin karya.</h1>
        <p>Kelas coding dan game untuk anak SD sampai SMA. Pilih dari 10 program, lalu belajar langsung dengan coach via Zoom.</p>
        <a className={styles.primary} href="#jadwal">Lihat kelas & jadwal ↓</a>
      </div>
      {/* Existing Clevio project artwork */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/holiday-class-2026/projects/kodu-pahlawan-pemadam-kebakaran.webp" alt="Contoh arena game 3D yang dibuat dengan Kodu" />
    </section>
    <section id="jadwal" className={styles.catalog}>
      <h2>Cari kelas yang cocok</h2>
      <p>Setiap program berlangsung 3 hari, 90 menit per hari. Semua jam dalam WIB.</p>
      <div className={styles.filters}>
        <label>Jenjang<select value={level} onChange={e => setLevel(Number(e.target.value))}>{levels.map((item, i) => <option key={item.name} value={i}>{item.name} · {item.grade}</option>)}</select></label>
        <label>Batch<select value={batch} onChange={e => setBatch(Number(e.target.value))}>{batches.map((date, i) => <option key={date} value={i}>{i + 1} · {date}</option>)}</select></label>
      </div>
      <ul>{group.programs.map(([name, ...hours]) => <li key={name}><strong>{name}</strong><span>{hours[batch]} WIB</span></li>)}</ul>
      <p>Rancangan harga {money(group.price)} per kelas · {money(group.bundle)} untuk 3 kelas.</p>
      <p>Pendaftaran dan pembayaran akan dibuka setelah jadwal, harga, dan kuota dikonfirmasi.</p>
    </section>
    <footer><a href="https://clev.io/chat">Konsultasi pilihan kelas via WhatsApp ↗</a></footer>
  </main>;
}
