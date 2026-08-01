import type { Metadata } from "next";
import {
  ArrowRight,
  Award,
  CheckCircle2,
  Gamepad2,
  Laptop,
  Rocket,
  Sparkles,
  Video,
  WandSparkles
} from "lucide-react";
import HolidayClassPixel, { HolidayClassLeadLink } from "./HolidayClassPixel";
import styles from "./HolidayClassLanding.module.css";

type LandingIcon = typeof Sparkles;

const asset = (name: string) => `/holiday-class-2026/${name}`;
const projectAsset = (name: string) => asset(`projects/${name}`);
const logoUrl = asset("clevio-logo.png");
const formUrl = "/event-manager/forms/holiday-class-2026";
const chatUrl = "https://clev.io/chat";

function WhatsAppLogo() {
  return (
    <svg aria-hidden="true" className={styles.whatsappLogo} viewBox="0 0 24 24" focusable="false">
      <path
        fill="currentColor"
        d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.33 4.95L2.05 22l5.27-1.38a9.91 9.91 0 0 0 4.72 1.2h.01c5.46 0 9.91-4.45 9.91-9.91S17.5 2 12.04 2Zm0 18.14h-.01a8.22 8.22 0 0 1-4.19-1.15l-.3-.18-3.13.82.84-3.05-.2-.31a8.18 8.18 0 0 1-1.26-4.36c0-4.55 3.7-8.25 8.25-8.25s8.25 3.7 8.25 8.25-3.7 8.23-8.25 8.23Zm4.52-6.16c-.25-.12-1.47-.73-1.7-.81-.23-.08-.4-.12-.56.12-.17.25-.65.81-.8.98-.15.17-.29.19-.54.06-.25-.12-1.05-.39-2-1.24-.74-.66-1.24-1.47-1.38-1.72-.15-.25-.02-.38.11-.51.11-.11.25-.29.37-.44.12-.15.17-.25.25-.42.08-.17.04-.31-.02-.44-.06-.12-.56-1.35-.77-1.85-.2-.48-.41-.42-.56-.43h-.48c-.17 0-.44.06-.67.31-.23.25-.88.86-.88 2.1s.9 2.44 1.03 2.6c.12.17 1.78 2.72 4.31 3.81.6.26 1.07.42 1.44.53.61.19 1.16.16 1.6.1.49-.07 1.47-.6 1.68-1.18.21-.58.21-1.08.15-1.18-.06-.1-.23-.16-.48-.29Z"
      />
    </svg>
  );
}

export const metadata: Metadata = {
  title: "Holiday Class Clevio 2026 | Liburan Seru, Anak Punya Karya Digital",
  description:
    "Program kelas liburan online untuk anak SD-SMA belajar coding, game, aplikasi, AI, robotik, dan project digital bersama Clevio.",
  alternates: {
    canonical: "/holidayclas2026"
  },
  openGraph: {
    title: "Holiday Class Clevio 2026",
    description: "Liburan seru untuk anak SD-SMA belajar teknologi dan membuat karya digital.",
    url: "https://lms.clev.io/holidayclas2026",
    siteName: "Clevio",
    images: [
      {
        url: "https://lms.clev.io/holiday-class-2026/landing-hero-bubble.png",
        width: 1200,
        height: 630,
        alt: "Holiday Class Clevio 2026"
      }
    ],
    type: "website"
  }
};

const levels = [
  {
    name: "Explorer",
    grade: "Untuk SD kelas 1-3",
    image: "level-explorer-software.png",
    materials: ["Scratch Jr", "Kodu", "Minecraft Builder"],
    outcome: "Anak membuat game sederhana, cerita interaktif, dan dunia Minecraft.",
    price: "Mulai Rp350.000"
  },
  {
    name: "Creator",
    grade: "Untuk SD kelas 4-6",
    image: "level-creator-software.png",
    materials: ["Minecraft Coding", "App Inventor", "Microbit"],
    outcome: "Anak membuat game, aplikasi sederhana, dan project robotik dasar.",
    price: "Mulai Rp425.000"
  },
  {
    name: "Innovator",
    grade: "Untuk SMP-SMA",
    image: "level-innovator-software.png",
    materials: ["AI", "Coding", "Automation", "Arduino", "Blender 3D"],
    outcome: "Anak membuat project teknologi modern untuk portfolio.",
    price: "Mulai Rp500.000"
  }
];

const outcomes: Array<{ label: string; icon: LandingIcon }> = [
  { label: "Anak membuat karya digital sendiri", icon: Sparkles },
  { label: "Belajar teknologi dengan cara fun", icon: Gamepad2 },
  { label: "Project-based learning", icon: Rocket },
  { label: "Pitching Day", icon: Video },
  { label: "Sertifikat", icon: Award },
  { label: "Cocok untuk pemula", icon: CheckCircle2 }
];

const gallery = [
  ["Scratch Jr: Teman Baru di Sekolah", "Cerita interaktif dengan karakter, dialog, dan alur buatan anak.", "scratch-jr-teman-baru-sekolah.webp"],
  ["Kodu: Pahlawan Pemadam Kebakaran", "Game 3D dengan misi, arena, dan tantangan yang bisa dimainkan.", "kodu-pahlawan-pemadam-kebakaran.webp"],
  ["Minecraft Builder: Taman Untuk Semua", "Dunia Minecraft tematik yang dirancang sebagai karya visual anak.", "minecraft-builder-taman-untuk-semua.webp"],
  ["Minecraft Coder: Kota Hijau Masa Depan", "Project Minecraft dengan coding untuk membangun solusi kota ramah lingkungan.", "minecraft-coder-kota-hijau-masa-depan.webp"],
  ["App Inventor: Tanya Dokter Hewan AI", "Aplikasi mobile sederhana dengan fitur tanya jawab berbasis AI.", "app-inventor-tanya-dokter-hewan-ai.webp"],
  ["Microbit: Gempa! Siap Siaga", "Prototype interaktif untuk belajar sensor, logika, dan respon darurat.", "microbit-gempa-siap-siaga.webp"],
  ["n8n Automation: Teman Belajar", "Workflow otomatis yang membantu anak memahami alur kerja digital.", "n8n-automation-teman-belajar.webp"],
  ["Arduino: Alarm Anti Maling", "Rangkaian elektronik dengan sensor dan output yang terasa nyata.", "arduino-alarm-anti-maling-sederhana.webp"],
  ["Vibe Coding: Suara Pelajar", "Website atau aplikasi mini yang mengubah ide anak menjadi produk digital.", "vibe-coding-suara-pelajar.webp"]
];

const faqs = [
  ["Apakah kelas online?", "Ya. Kelas Holiday Class Clevio berjalan online via Zoom."],
  ["Apakah cocok untuk pemula?", "Cocok. Anak akan diarahkan sesuai level usia dan pengalaman belajarnya."],
  ["Perangkat apa yang dibutuhkan?", "Laptop atau komputer dengan internet stabil. Untuk Microbit atau Arduino, peserta bisa memakai device sendiri, simulator, atau membeli dari Clevio jika tersedia."],
  ["Apakah anak dapat sertifikat?", "Ya. Peserta akan mendapatkan sertifikat digital setelah menyelesaikan program."],
  ["Bagaimana cara daftar?", "Klik tombol daftar, isi data peserta, pilih level, paket, dan jadwal yang tersedia, lalu selesaikan pembayaran invoice."],
  ["Apakah ada Pitching Day?", "Ada. Anak dapat mempresentasikan karya digitalnya secara online di akhir program."]
];

export default function HolidayClassLandingPage() {
  return (
    <main className={styles.page}>
      <HolidayClassPixel />
      <img className={`${styles.palm} ${styles.palmLeft}`} src={asset("palm-left.png")} alt="" aria-hidden="true" />
      <img className={`${styles.palm} ${styles.palmRight}`} src={asset("palm-right.png")} alt="" aria-hidden="true" />
      <HolidayClassLeadLink className={styles.floatingChat} href={chatUrl} ariaLabel="Chat WhatsApp Clevio">
        <WhatsAppLogo />
      </HolidayClassLeadLink>

      <nav className={styles.nav} aria-label="Holiday Class navigation">
        <a href="#top" className={styles.brand}>
          <img src={logoUrl} alt="Clevio Innovator Camp" />
        </a>
        <div>
          <a href="#kelas">Kelas</a>
          <a href="#harga">Harga</a>
          <a href="#faq">FAQ</a>
        </div>
        <a className={styles.navCta} href={formUrl}>
          Daftar
        </a>
      </nav>

      <section className={styles.hero} id="top">
        <div className={styles.heroCopy}>
          <img className={styles.heroLogo} src={asset("holiday-logo.png")} alt="Holiday Class Clevio 2026" />
          <h1>Liburan Seru, Anak Punya Karya Digital</h1>
          <p>
            Program kelas liburan online untuk anak SD-SMA belajar coding, game, aplikasi, AI, robotik, dan project digital bersama Clevio.
          </p>
          <div className={styles.heroActions}>
            <a className={styles.primaryButton} href={formUrl}>
              Daftar Sekarang
              <ArrowRight size={18} />
            </a>
            <a className={styles.secondaryButton} href="#kelas">
              Lihat Pilihan Kelas
            </a>
          </div>
          <div className={styles.heroBadges}>
            <img src={asset("date-badge.png")} alt="15 Juni sampai 11 Juli 2026, online via Zoom" />
            <img src={asset("belajar-badge.png")} alt="3 hari belajar online via Zoom" />
          </div>
        </div>
        <div className={styles.heroVisual}>
          <img className={styles.heroBubble} src={asset("landing-hero-bubble.png")} alt="Anak belajar membuat karya digital di Holiday Class" />
          <img className={styles.drone} src={asset("drone.png")} alt="" aria-hidden="true" />
        </div>
      </section>

      <section className={`${styles.section} ${styles.problem}`}>
        <div>
          <h2>Liburan tidak harus habis untuk scroll dan main game.</h2>
          <p>
            Liburan sekolah sering habis untuk main gadget, scroll, atau bermain game. Di Holiday Class Clevio, anak tetap bisa menikmati teknologi, tapi sebagai pembuat karya, bukan hanya pengguna.
          </p>
        </div>
        <img src={asset("landing-problem-transform.png")} alt="Anak berubah dari pengguna gadget menjadi pembuat karya digital" />
      </section>

      <section className={styles.section} id="kelas">
        <div className={styles.sectionHeader}>
          <h2>Pilih level sesuai usia anak</h2>
          <p>Materi dibuat bertahap agar anak nyaman belajar, mencoba, lalu membuat karya digital yang bisa ditunjukkan ke orang tua.</p>
        </div>
        <div className={styles.levelGrid}>
          {levels.map((level) => (
            <article className={styles.levelCard} key={level.name}>
              <img src={asset(level.image)} alt={level.name} />
              <div>
                <h3>{level.name}</h3>
                <span>{level.grade}</span>
                <ul>
                  {level.materials.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
                <p>{level.outcome}</p>
                <a href={formUrl}>Daftar Level Ini</a>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className={`${styles.section} ${styles.outcomes}`}>
        <div className={styles.sectionHeader}>
          <h2>Yang anak dapatkan</h2>
          <p>Bukan hanya ikut kelas, anak diarahkan membuat project kecil yang terasa nyata dan membangun rasa percaya diri.</p>
        </div>
        <div className={styles.outcomeGrid}>
          {outcomes.map(({ label, icon: Icon }) => (
            <div className={styles.outcomeCard} key={label}>
              <Icon size={22} />
              <strong>{label}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className={`${styles.section} ${styles.why}`}>
        <div>
          <h2>Kenapa Clevio?</h2>
          <p>Holiday Class dirancang untuk orang tua yang ingin anak tetap produktif, tapi tidak terasa seperti sekolah tambahan yang berat.</p>
        </div>
        <div className={styles.whyList}>
          {["Mentor berpengalaman", "Materi sesuai usia anak", "Online via Zoom", "Belajar bertahap", "Fokus pada hasil karya"].map((item) => (
            <div key={item}>
              <CheckCircle2 size={20} />
              <span>{item}</span>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.section} id="harga">
        <div className={styles.sectionHeader}>
          <h2>Harga mulai dari</h2>
          <p>Pilih level yang sesuai dengan kelas anak. Detail paket dan jadwal dipilih di form pendaftaran.</p>
        </div>
        <div className={styles.priceGrid}>
          {levels.map((level) => (
            <article className={styles.priceCard} key={level.name}>
              <span>{level.name}</span>
              <h3>{level.price}</h3>
              <p>{level.grade}</p>
              <a href={formUrl}>
                Daftar Level Ini
                <ArrowRight size={17} />
              </a>
            </article>
          ))}
        </div>
      </section>

      <section className={`${styles.section} ${styles.gallery}`}>
        <div className={styles.sectionHeader}>
          <h2>Contoh karya yang dibuat anak</h2>
          <p>Setiap kelas diarahkan ke project yang bisa dilihat, dimainkan, atau dipresentasikan.</p>
        </div>
        <div className={styles.galleryGrid}>
          {gallery.map(([title, copy, image]) => (
            <article className={styles.galleryCard} key={title}>
              <img src={projectAsset(image)} alt="" aria-hidden="true" />
              <div>
                <h3>{title}</h3>
                <p>{copy}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.section} id="faq">
        <div className={styles.sectionHeader}>
          <h2>Pertanyaan yang sering ditanyakan</h2>
          <p>Jawaban singkat sebelum orang tua memilih jadwal dan membuat invoice.</p>
        </div>
        <div className={styles.faqList}>
          {faqs.map(([question, answer]) => (
            <details key={question}>
              <summary>{question}</summary>
              <p>{answer}</p>
            </details>
          ))}
        </div>
      </section>

      <section className={styles.finalCta}>
        <WandSparkles size={34} />
        <h2>Siap Bikin Liburan Anak Lebih Produktif?</h2>
        <p>Pilih level sesuai usia anak dan mulai buat karya digital pertama mereka.</p>
        <a className={styles.primaryButton} href={formUrl}>
          Daftar Sekarang
          <ArrowRight size={18} />
        </a>
      </section>
    </main>
  );
}
