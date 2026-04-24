# SYSTEM MAP

## Project Summary
- **Tujuan Aplikasi**: Sistem Manajemen Pembelajaran (LMS) Clevio untuk mengelola jadwal kelas, presensi, rapor/evaluasi, dan progres siswa. Melayani peran Admin, Coach, dan Coder (Siswa).
- **Tech Stack Utama**: 
  - **Framework/Runtime**: Next.js 16 (App Router), React 18, Node.js.
  - **Database & Auth**: Supabase (PostgreSQL, Supabase Auth).
  - **Integrasi**: WhatsApp API (Baileys), OpenAI (AI Reports).
  - **Styling/UI**: Tailwind CSS v4, Radix UI.
- **Pola Arsitektur Singkat**: Layered Architecture terpisah.
  - UI/Route Handler -> Services (Business Logic) -> DAO (Data Access) -> Supabase.

## Core Logic Flow (Function-Level Flowchart)
- **General Flow**: Next.js App Route/API (`src/app/api`) -> Service Function (`src/lib/services`) -> DAO Function (`src/lib/dao`) -> Supabase DB.
- **Contoh Scheduling**: API/Cron Trigger -> `classAutoPlanner[generateSchedule]` -> `sessionsDao[insertSession]` -> DB.
- **Contoh Notifikasi**: API Action -> `whatsappClient[sendMessage]` -> Baileys Runtime -> WA Server.

## Clean Tree
```text
lms-apps/
├── src/
│   ├── app/
│   │   ├── (admin)/       # UI Dashboard Admin
│   │   ├── (coach)/       # UI Dashboard Coach 
│   │   ├── (coder)/       # UI Dashboard Coder (Siswa)
│   │   ├── (evaluations)/ # UI Lembar Evaluasi
│   │   ├── (public)/      # Public pages (Login, Landing)
│   │   └── api/           # Entry points API (Controllers)
│   ├── components/        # Shared Components (Radix/Tailwind)
│   ├── contexts/          # React Context (State Management)
│   └── lib/
│       ├── dao/           # Data Access Object Layer (DB Queries)
│       ├── services/      # Business Logic (Usecases)
│       ├── whatsapp/      # Modul Internal WA Baileys
│       └── types/         # TypeScript types definition
├── supabase/              # Supabase lokal & schema definitions
└── migrations/            # DB Migrations
```

## Module Map (The Chapters)

### 1. Controllers / Entry Points (`src/app/`)
- `src/app/api/.../route.ts`
  - **Main Functions**: Next.js route handlers (`GET`, `POST`, dll).
  - **Peran**: Menerima HTTP request, memvalidasi input, dan memanggil layer Service.

### 2. Service Layer (`src/lib/services/`)
- `src/lib/services/classAutoPlanner.ts` & `lessonScheduler.ts`
  - **Main Functions**: Logika penjadwalan kelas dan rotasi materi.
  - **Peran**: Pusat algoritma penjadwalan otomatis.
- `src/lib/services/aiReports.ts`
  - **Main Functions**: Interaksi prompt ke OpenAI.
  - **Peran**: Men-generate laporan evaluasi otomatis untuk siswa.
- `src/lib/services/whatsappClient.ts`
  - **Main Functions**: Wrapper kirim pesan, reminder otomatis.
  - **Peran**: Mengatur flow pesan WA (notifikasi kelas, tagihan).

### 3. DAO Layer (`src/lib/dao/`)
- `src/lib/dao/classesDao.ts`, `usersDao.ts`, `sessionsDao.ts`, `attendanceDao.ts`, dll.
  - **Main Functions**: Pembungkus query Supabase (misal `getClasses`, `updateAttendance`).
  - **Peran**: Abstraksi database tunggal agar logic DB terpusat dan mudah di-maintain.

### 4. Auth & Config (`src/lib/`)
- `src/lib/authOptions.ts`
  - **Peran**: Konfigurasi NextAuth.js (Custom Credentials dengan Supabase).
- `src/lib/supabaseServer.ts` & `supabaseBrowser.ts`
  - **Peran**: Singleton/Instance dari Supabase client.

## Data & Config
- **Konfigurasi Utama**: `.env` (Env vars), `src/lib/env.ts` (Env mapping), `next.config.ts`, `tailwind.config.ts`.
- **Skema Data**: Supabase PostgreSQL. Entitas utama: `users`, `classes`, `sessions`, `attendances`, `invoices`. Skema tercatat di file `supabase_schema.sql` (di root).
- **Lokasi Migration/Seed**: Direktori `migrations/` dan file `.sql` sample data di root (`supabase_sample_data.sql`, dsb).
- **Output/Runtime**: Folder `.next/` (Build output), log runtime di `*.log`. State WA bot tersimpan di direktori `baileys_auth_info/`.

## External Integrations
- **Supabase API**: Dipanggil oleh file di `src/lib/supabase*.ts` dan module DAO.
- **WhatsApp**: Diintegrasikan melalui pustaka `@whiskeysockets/baileys` yang dikelola di `src/lib/whatsapp/`.
- **OpenAI**: Dipanggil oleh `src/lib/services/aiReports.ts`.

## Risks / Blind Spots
- **Baileys Auth State**: Status koneksi WA mengandalkan folder lokal `baileys_auth_info/`. Jika dideploy di serverless (misal Vercel), integrasi WA bot akan mereset state karena filesystem serverless ephemeral.
- **Cron API**: Endpoint di `src/app/api/cron` kemungkinan bergantung pada pemicu eksternal, sehingga tidak akan jalan otomatis di lokal tanpa trigger manual.
- **TypeScript & DB Drift**: Karena menggunakan skema SQL mentah di `supabase_schema.sql`, perubahan struktur DB memerlukan update manual di Types Supabase (bisa terjadi ketidaksesuaian jika tidak sinkron).
