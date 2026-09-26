<p align="center">
  <img src="public/logo.png" alt="Mupost Logo" width="140" />
</p>

<h1 align="center">Mupost</h1>

<p align="center">
  <strong>Multi-Platform Social Media Scheduler & Publisher</strong>
  <br />
  Publikasikan konten sekaligus ke Facebook, Instagram, TikTok, dan Threads dari satu dasbor terpadu — lengkap dengan antrean publikasi paralel berbasis BullMQ, Content Calendar, import massal CSV, PWA offline draft sync, dan dukungan kontainer Docker siap pakai.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-14.2-black?logo=next.js" alt="Next.js 14" />
  <img src="https://img.shields.io/badge/TypeScript-5-blue?logo=typescript" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker" alt="Docker" />
  <img src="https://img.shields.io/badge/TailwindCSS-3.4-38B2AC?logo=tailwind-css" alt="Tailwind CSS" />
  <img src="https://img.shields.io/badge/PostgreSQL-16-336791?logo=postgresql" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/BullMQ-Redis-DC382D?logo=redis" alt="Redis & BullMQ" />
</p>

---

## Daftar Isi

- [Fitur Utama](#fitur-utama)
- [Arsitektur Teknis](#arsitektur-teknis)
- [Deployment Cepat dengan Docker (Direkomendasikan)](#deployment-cepat-dengan-docker-direkomendasikan)
- [Prasyarat](#prasyarat)
- [Instalasi Lokal](#instalasi-lokal)
- [Konfigurasi Environment](#konfigurasi-environment)
- [Setup Database](#setup-database)
- [Menjalankan Aplikasi](#menjalankan-aplikasi)
- [Menjalankan Worker BullMQ](#menjalankan-worker-bullmq)
- [Pengujian](#pengujian)
- [Perintah Tersedia](#perintah-tersedia)
- [Struktur Proyek](#struktur-proyek)
- [Alur Kerja Platform](#alur-kerja-platform)
- [CI/CD Pipeline](#cicd-pipeline)
- [Panduan Deployment](#panduan-deployment)

---

## Fitur Utama

| Fitur                             | Keterangan                                                                                      |
| :-------------------------------- | :---------------------------------------------------------------------------------------------- |
| **Multi-platform**                | Publikasi serentak ke Facebook Page, Instagram, TikTok, dan Threads dari satu tempat            |
| **Sistem Tema Lengkap**           | Dukungan penuh mode Terang, Gelap, dan Auto (Sistem) dengan selektor minimalis                  |
| **Content Calendar View**         | Alihkan tampilan postingan antara format Daftar (_List_) dan Kalender Bulanan/Mingguan          |
| **Platform Constraint Validator** | Validasi batasan karakter dan media per platform secara interaktif dan _real-time_ saat menulis |
| **BullMQ Queue Dashboard**        | Halaman `/admin/queues` untuk memantau status antrean worker dan tombol _Retry_ postingan gagal |
| **Token Health & Expiry Alert**   | Peringatan dini masa kedaluwarsa token OAuth di Dashboard dan Settings Connections              |
| **PWA Offline Draft Sync**        | Simpan dan kelola draf di IndexedDB saat offline, sinkronisasi otomatis saat online             |
| **Mobile Bottom Bar Ergonomis**   | Navigasi mobile 5 tab ringkas dengan _Expandable Sheet Drawer_ untuk menu tambahan              |
| **Penjadwalan otomatis**          | Jadwalkan post hingga 365 hari ke depan dengan toleransi eksekusi ≤ 60 detik                    |
| **Publikasi paralel**             | Semua platform tujuan diproses secara bersamaan via BullMQ Worker terisolasi                    |
| **Retry otomatis**                | Maksimal 3 percobaan ulang dengan exponential backoff (1, 2, 4 menit)                           |
| **Import CSV massal**             | Upload hingga 500 baris sekaligus dengan validasi format dan laporan error per baris            |
| **Preview real-time**             | Tampilan pratinjau posting sesuai tata letak resmi setiap platform                              |
| **Refresh token otomatis**        | Background worker peremajaan token platform berjalan periodik via BullMQ                        |
| **Keamanan**                      | CSRF protection, sesi JWT HTTP-only, enkripsi token OAuth AES-256-GCM                           |
| **Upload media**                  | Gambar (JPEG/PNG/GIF, maks 8 MB) dan video (MP4/MOV, maks 512 MB) ke S3/MinIO                   |
| **Docker & Compose Ready**        | Multi-stage image ultra-ringan (~95MB compressed), non-root user, dan auto-migration            |

---

## Arsitektur Teknis

```
┌─────────────────────────────────┐       ┌──────────────────────────┐
│       Next.js 14 App Router     │       │   Worker Process (tsx)   │
│  ┌──────────┐  ┌─────────────┐  │       │  ┌────────────────────┐  │
│  │  UI Pages │  │  API Routes │  │       │  │  publish-worker.ts │  │
│  └──────────┘  └──────┬──────┘  │       │  ├────────────────────┤  │
│                        │         │       │  │token-refresh-worker│  │
└────────────────────────┼─────────┘       └──────────┬───────────┘  │
                         │                             │
              ┌──────────▼──────────┐       ┌──────────▼───────────┐
              │     PostgreSQL      │       │    Redis / BullMQ    │
              │  users, posts,      │       │  publish-queue       │
              │  sessions,          │       │  token-refresh-queue │
              │  connected_accounts │       └──────────────────────┘
              └─────────────────────┘
```

**Stack teknologi:**

- **Framework:** Next.js 14 (App Router, TypeScript)
- **Database:** PostgreSQL + Drizzle ORM
- **Queue:** BullMQ + Redis (ioredis)
- **Styling:** Tailwind CSS
- **Auth:** JWT via `jose`, session cookie HTTP-only
- **Media Storage:** S3-compatible (MinIO untuk development)
- **PWA:** `@ducanh2912/next-pwa` + Workbox
- **Testing:** Jest + fast-check (PBT) + Playwright + Testcontainers

---

## Deployment Cepat dengan Docker (Direkomendasikan)

Jika Anda sudah memasang **Docker** dan **Docker Compose**, Anda dapat menjalankan seluruh ekosistem Mupost (Web App, BullMQ Worker, PostgreSQL, Redis, dan MinIO S3) hanya dengan satu perintah:

```bash
# 1. Salin konfigurasi environment
cp .env.example .env

# 2. Jalankan seluruh layanan di latar belakang
npm run docker:up
# atau: docker compose up -d

# 3. Pantau status dan log
npm run docker:logs
```

Aplikasi akan otomatis melakukan migrasi database dan langsung siap diakses di:
👉 **[http://localhost:4829](http://localhost:4829)**

_Catatan: Image Docker Mupost (`mupost:latest`) dibuat dengan multi-stage build berukuran ultra-kompak (~95 MB terkompresi) dan menggunakan user non-root demi keamanan maksimal._

---

## Prasyarat (Untuk Jalur Non-Docker)

Jika ingin menjalankan aplikasi secara manual di mesin lokal:

| Perangkat Lunak | Versi Minimum | Keterangan                           |
| :-------------- | :------------ | :----------------------------------- |
| **Node.js**     | 20.x LTS      | Versi 22+ sangat direkomendasikan    |
| **npm**         | 10.x          | Package manager utama                |
| **PostgreSQL**  | 15+           | Database relasional                  |
| **Redis**       | 7+            | Antrean BullMQ & rate limiting       |
| **MinIO / S3**  | —             | Object storage untuk media postingan |

---

## Instalasi Lokal

### 1. Clone Repository

```bash
git clone https://github.com/efzynx/MUPOST.git
cd MUPOST
```

### 2. Instal Dependensi

```bash
npm install
```

### 3. Siapkan Layanan Database & Redis

Anda dapat menggunakan container database mandiri atau layanan lokal:

```bash
# PostgreSQL
docker run -d --name mupost-postgres -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=mupost -p 5432:5432 postgres:16-alpine

# Redis
docker run -d --name mupost-redis -p 6379:6379 redis:7-alpine

# MinIO
docker run -d --name mupost-minio -e MINIO_ROOT_USER=minioadmin -e MINIO_ROOT_PASSWORD=minioadmin -p 9000:9000 -p 9001:9001 quay.io/minio/minio server /data --console-address ":9001"
```

**Opsi B — Menggunakan instalasi lokal:**

Instal PostgreSQL, Redis, dan MinIO secara manual sesuai panduan masing-masing, lalu sesuaikan nilai `DATABASE_URL`, `REDIS_URL`, dan variabel S3 di file `.env`.

---

## Konfigurasi Environment

### 1. Salin File `.env.example`

```bash
cp .env.example .env
```

### 2. Edit File `.env`

Buka `.env` dan isi setiap variabel sesuai lingkungan Anda:

```env
# Node Environment
NODE_ENV=development

# ── DATABASE ────────────────────────────────────────────────────────────────
# Format: postgresql://<user>:<password>@<host>:<port>/<database>
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/mupost

# ── REDIS ───────────────────────────────────────────────────────────────────
# Digunakan oleh BullMQ (antrian publikasi) dan rate limiting login
REDIS_URL=redis://localhost:6379

# ── KEAMANAN ────────────────────────────────────────────────────────────────
# TOKEN_ENCRYPTION_KEY: kunci AES-256-GCM, harus persis 64 karakter hex
# Generate dengan: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
TOKEN_ENCRYPTION_KEY=ganti_dengan_64_karakter_hex_acak_anda

# NEXTAUTH_SECRET: kunci JWT sesi pengguna, minimal 32 karakter
# Generate dengan: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
NEXTAUTH_SECRET=ganti_dengan_string_acak_anda

# ── META (FACEBOOK & INSTAGRAM) ─────────────────────────────────────────────
# Daftarkan aplikasi di https://developers.facebook.com
META_APP_ID=your_meta_app_id
META_APP_SECRET=your_meta_app_secret

# ── TIKTOK ──────────────────────────────────────────────────────────────────
# Daftarkan aplikasi di https://developers.tiktok.com
TIKTOK_CLIENT_KEY=your_tiktok_client_key
TIKTOK_CLIENT_SECRET=your_tiktok_client_secret

# ── OBJECT STORAGE (S3 / MinIO) ─────────────────────────────────────────────
S3_BUCKET=mupost-media
S3_ENDPOINT=http://localhost:9000
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin
S3_REGION=us-east-1

# ── URL PUBLIK ──────────────────────────────────────────────────────────────
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

> **Catatan keamanan:** Jangan pernah commit file `.env` ke repository. File ini sudah masuk ke `.gitignore`.

### 3. Generate Kunci Enkripsi (jika belum ada)

```bash
# Generate TOKEN_ENCRYPTION_KEY (64 karakter hex = 32 bytes)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Generate NEXTAUTH_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## Setup Database

### 1. Buat Database

```bash
# Jika menggunakan psql langsung
psql -U postgres -c "CREATE DATABASE mupost;"

# Atau via Docker container yang sudah berjalan
docker exec mupost-postgres psql -U postgres -c "CREATE DATABASE mupost;"
```

### 2. Jalankan Migrasi

```bash
npm run db:migrate
```

Perintah ini menjalankan semua file migrasi SQL dari folder `drizzle/migrations/` ke database yang dikonfigurasi di `DATABASE_URL`.

### 3. (Opsional) Buat Bucket MinIO

Jika menggunakan MinIO untuk development, buat bucket `mupost-media`:

```bash
# Gunakan MinIO Client (mc) atau akses konsol web di http://localhost:9001
# Kredensial default: minioadmin / minioadmin
mc alias set local http://localhost:9000 minioadmin minioadmin
mc mb local/mupost-media
mc policy set public local/mupost-media
```

---

## Menjalankan Aplikasi

Mupost memerlukan **dua proses** yang berjalan secara bersamaan:

1. **Next.js Server** — melayani UI dan API HTTP
2. **BullMQ Worker** — memproses antrian publikasi di background

### Cara Cepat: Satu Perintah untuk Semua Proses (Direkomendasikan)

```bash
npm run dev:all
```

Perintah ini menjalankan skrip orkestrasi `scripts/dev-all.sh` yang:

- Memulai **Next.js dev server** dan **BullMQ worker** secara simultan
- Menambahkan prefix warna (`[next]` / `[worker]`) pada setiap baris log untuk membedakan output
- Menangani **graceful termination**: menekan `Ctrl+C` akan menghentikan semua proses anak dengan rapi (SIGTERM dulu, lalu SIGKILL setelah 5 detik jika belum berhenti)
- Mendeteksi jika salah satu proses keluar secara tidak terduga dan menghentikan proses lainnya otomatis

Aplikasi akan tersedia di [http://localhost:4829](http://localhost:4829).

### Alternatif: Menjalankan Proses Secara Terpisah

Jika lebih suka kontrol manual, buka dua terminal:

**Terminal 1: Next.js Development Server**

```bash
npm run dev
```

**Terminal 2: BullMQ Worker Process**

```bash
npm run worker
```

Worker ini menjalankan dua proses sekaligus:

- `publish-worker` — memproses job publikasi dari antrian `publish-queue`
- `token-refresh-worker` — memperbarui token platform yang akan kedaluwarsa (scan tiap 1 jam)

> **Penting:** Worker **tidak boleh** dijalankan di dalam proses Next.js. Selalu jalankan sebagai proses Node.js terpisah.

---

## Menjalankan Worker BullMQ

### Menjalankan Semua Worker Sekaligus (Direkomendasikan)

```bash
npm run worker
# Menjalankan: src/workers/index.ts
# Worker aktif: publish-worker + token-refresh-worker + scanner terjadwal
```

### Menjalankan Worker Secara Terpisah

```bash
# Hanya worker publikasi
npm run worker:publish

# Hanya worker token refresh
npm run worker:refresh
```

### Konfigurasi Antrian

| Antrian               | Fungsi                     | Retry | Backoff                    |
| --------------------- | -------------------------- | ----- | -------------------------- |
| `publish-queue`       | Publikasi post ke platform | 3x    | Exponential: 1, 2, 4 menit |
| `token-refresh-queue` | Refresh token OAuth        | 3x    | Fixed: 5 menit             |

---

## Pengujian

### Unit & Property-Based Tests

```bash
# Jalankan seluruh test suite
npm test

# Mode watch (otomatis rerun saat file berubah)
npm run test:watch

# Dengan laporan code coverage
npm run test:coverage
```

**Hasil yang diharapkan:** 280 tests, 24 test suites, 100% pass.

### Integration Tests (Testcontainers)

Integration tests menggunakan Docker untuk menjalankan PostgreSQL dan Redis sementara secara otomatis. Pastikan Docker daemon berjalan sebelum menjalankan:

```bash
# Jalankan hanya integration tests
npx jest __tests__/integration/ --forceExit --testTimeout=90000

# Atau jalankan satu file spesifik
npx jest __tests__/integration/auth-flow.integration.test.ts --forceExit
```

> **Catatan:** Integration tests memerlukan Docker yang aktif. Setiap test suite akan otomatis menjalankan dan menghentikan container PostgreSQL + Redis.

### E2E Tests (Playwright)

E2E tests memerlukan server Next.js yang berjalan. Jalankan di dua terminal:

```bash
# Terminal 1: jalankan server
npm run build && npm run start
# atau untuk development:
npm run dev

# Terminal 2: jalankan E2E tests
npm run test:e2e

# Mode dengan browser terlihat (headed)
npm run test:e2e:ui
```

> **Catatan:** Jika server tidak tersedia, E2E tests akan otomatis diskip (graceful skip) tanpa error.

### Lighthouse CI

Untuk verifikasi performa dan skor PWA:

```bash
# Pastikan server sudah berjalan di port 4829
npm run build && npm run start &
sleep 5

# Jalankan Lighthouse CI
npm run lhci
```

Target skor: `Performance ≥ 90` dan `PWA = pass`.

---

## Perintah Tersedia

```bash
# ── DOCKER (OPERASIONAL CEPAT) ──────────────────────────────────────────────
npm run docker:up        # Jalankan seluruh stack (Web, Worker, DB, Redis, S3)
npm run docker:down      # Hentikan semua container
npm run docker:logs      # Pantau log seluruh container
npm run docker:build     # Build ulang image mupost:latest

# ── DEVELOPMENT LOKAL ───────────────────────────────────────────────────────
npm run dev:all          # Semua proses sekaligus: Next.js + Worker (port 4829)
npm run dev              # Next.js dev server saja (http://localhost:4829)
npm run build            # Build production (Next.js standalone + worker bundles)
npm run start            # Jalankan production build (http://localhost:4829)
npm run lint             # ESLint
npm run format           # Prettier (format semua file)
npm run format:check     # Prettier (cek tanpa mengubah)

# ── WORKER ──────────────────────────────────────────────────────────────────
npm run worker           # Semua worker sekaligus (DIREKOMENDASIKAN)
npm run worker:publish   # Hanya publish-worker
npm run worker:refresh   # Hanya token-refresh-worker

# ── DATABASE ────────────────────────────────────────────────────────────────
npm run db:generate      # Generate file migrasi baru dari perubahan schema
npm run db:migrate       # Jalankan migrasi ke database

# ── TESTING ─────────────────────────────────────────────────────────────────
npm test                 # Semua unit & property tests (280 tests)
npm run test:watch       # Mode watch
npm run test:coverage    # Dengan code coverage
npm run test:e2e         # E2E tests Playwright (butuh server aktif)
npm run test:e2e:ui      # E2E dengan browser terlihat
npm run lhci             # Lighthouse CI (butuh server aktif)
```

---

## Struktur Proyek

```
mupost/
├── src/
│   ├── app/                        # Next.js App Router
│   │   ├── (auth)/                 # Halaman login & register
│   │   ├── (dashboard)/            # Halaman yang butuh autentikasi
│   │   │   ├── dashboard/          # Halaman utama dasbor
│   │   │   ├── posts/              # Daftar, buat, edit, import post
│   │   │   │   ├── page.tsx        # Daftar postingan
│   │   │   │   ├── new/            # Buat post baru
│   │   │   │   ├── [id]/edit/      # Edit post
│   │   │   │   └── import/         # Import CSV massal
│   │   │   └── settings/
│   │   │       └── connections/    # Manajemen koneksi platform
│   │   └── api/                    # REST API routes
│   │       ├── auth/               # Login, register, logout, me
│   │       ├── connect/            # OAuth Meta, TikTok, Threads
│   │       ├── csv/                # Upload CSV & download template
│   │       ├── media/              # Upload media ke S3
│   │       └── posts/              # CRUD post, publish, retry, preview
│   │
│   ├── components/                 # Komponen React
│   │   ├── preview/                # FacebookPreview, InstagramPreview, dll.
│   │   ├── ui/                     # Button, Card, Badge, Icon
│   │   └── OfflineBanner.tsx       # Banner mode offline
│   │
│   ├── lib/                        # Logika bisnis & utilitas
│   │   ├── db/                     # Drizzle ORM (schema, migrations, client)
│   │   ├── queue/                  # BullMQ queue definitions
│   │   ├── services/               # Service layer
│   │   │   ├── auth-service.ts     # Registrasi, login, JWT, rate limit
│   │   │   ├── csv-processor.ts    # Parse & validasi CSV massal
│   │   │   ├── media-uploader.ts   # Validasi & upload media ke S3
│   │   │   ├── platform-connector.ts  # OAuth & token management
│   │   │   ├── post-manager.ts     # CRUD post, schedule, BullMQ enqueue
│   │   │   └── preview-engine.ts   # Render preview per platform
│   │   ├── cookies.ts              # Konstanta cookie
│   │   ├── crypto.ts               # AES-256-GCM encrypt/decrypt
│   │   ├── csrf.ts                 # Generate & validasi CSRF token
│   │   ├── env.ts                  # Validasi environment variables
│   │   └── redis.ts                # ioredis client singleton
│   │
│   ├── workers/                    # BullMQ Worker processes
│   │   ├── index.ts                # Entry point: jalankan semua worker
│   │   ├── publish-worker.ts       # Proses job publikasi ke platform
│   │   └── token-refresh-worker.ts # Refresh token OAuth + scanner terjadwal
│   │
│   └── middleware.ts               # CSRF validation & session guard
│
├── drizzle/
│   └── migrations/                 # File SQL migrasi database
│
├── public/
│   ├── manifest.json               # PWA Web App Manifest
│   └── icons/                      # Ikon PWA (192px & 512px)
│
├── __tests__/
│   ├── unit/                       # Unit tests (Jest)
│   ├── property/                   # Property-based tests (fast-check)
│   └── integration/                # Integration tests (Testcontainers)
│
├── e2e/                            # E2E tests (Playwright)
├── playwright.config.ts            # Konfigurasi Playwright
├── lighthouserc.js                 # Konfigurasi Lighthouse CI
├── jest.config.js                  # Konfigurasi Jest
├── drizzle.config.ts               # Konfigurasi Drizzle Kit
├── next.config.mjs                 # Konfigurasi Next.js + PWA
└── .env.example                    # Template variabel environment
```

---

## Alur Kerja Platform

### Menghubungkan Akun Platform

1. Buka **Pengaturan → Koneksi Akun**
2. Klik **Hubungkan** pada platform yang diinginkan (Meta/Instagram, TikTok)
3. Ikuti alur OAuth — akun akan muncul di daftar setelah berhasil
4. Token akses disimpan terenkripsi menggunakan AES-256-GCM

### Membuat dan Mempublikasikan Post

1. Buka **Postingan → Buat Post**
2. Isi konten teks (maks 5.000 karakter), unggah media opsional
3. Pilih satu atau lebih akun tujuan
4. Pilih aksi:
   - **Simpan sebagai Draft** — tersimpan tanpa dijadwalkan
   - **Jadwalkan** — masukkan tanggal/waktu publikasi (min +5 menit)
   - **Publikasikan Sekarang** — langsung masuk antrian BullMQ

### Import Massal via CSV

1. Buka **Postingan → Import CSV**
2. Unduh **Template CSV** untuk mengetahui format kolom yang diperlukan
3. Isi template dengan kolom berikut:

| Kolom          | Wajib | Format                            | Keterangan                       |
| -------------- | ----- | --------------------------------- | -------------------------------- |
| `platform`     | Ya    | `facebook`, `instagram`, `tiktok` | Platform tujuan                  |
| `scheduled_at` | Ya    | ISO 8601 (`2026-12-01T10:00:00Z`) | Waktu publish (harus masa depan) |
| `text_content` | Ya    | Teks, maks 2.000 karakter         | Konten postingan                 |
| `media_url`    | Tidak | URL http/https                    | URL gambar atau video            |

4. Upload file CSV (maks 500 baris, maks 5 MB)
5. Sistem memproses baris valid, menampilkan laporan error per baris untuk yang tidak valid

### Skema Status Post

```
DRAFT → SCHEDULED → QUEUED → PUBLISHED
                              ↓
                           PARTIAL (sebagian platform berhasil)
                              ↓
                            FAILED (semua platform gagal, bisa retry)
```

---

## CI/CD Pipeline

Proyek ini menggunakan **GitHub Actions** untuk otomatisasi kualitas kode. Pipeline berjalan otomatis pada setiap **Pull Request** maupun **push** ke branch `dev` dan `main`.

### File Workflow

`.github/workflows/ci.yml`

### Tahapan Pipeline

| Tahap            | Perintah               | Keterangan                           |
| ---------------- | ---------------------- | ------------------------------------ |
| **Lint**         | `npm run lint`         | ESLint — deteksi masalah kode        |
| **Format check** | `npm run format:check` | Prettier — verifikasi gaya penulisan |
| **Build**        | `npm run build`        | Next.js build + TypeScript typecheck |
| **Test**         | `npm test`             | Semua unit & property tests (Jest)   |

### Konfigurasi

- **Trigger:** `pull_request` dan `push` ke `main` / `dev`
- **Runner:** `ubuntu-latest`
- **Node.js:** versi 20 LTS dengan caching npm
- **Concurrency:** satu run per branch — run lama dibatalkan otomatis saat ada push baru (`cancel-in-progress: true`)

### Menjalankan Pipeline Secara Lokal

Sebelum push, verifikasi semua langkah pipeline berjalan bersih:

```bash
npm run lint
npm run format:check
npm run build
npm test
```

---

## Panduan Deployment

### Variabel Environment Produksi

Pastikan variabel berikut dikonfigurasi dengan nilai yang kuat untuk production:

```env
NODE_ENV=production
DATABASE_URL=postgresql://user:strongpassword@db-host:5432/mupost
REDIS_URL=redis://:strongpassword@redis-host:6379
TOKEN_ENCRYPTION_KEY=<64-karakter-hex-acak>
NEXTAUTH_SECRET=<string-acak-minimal-32-karakter>
META_APP_ID=<app-id-dari-meta-developers>
META_APP_SECRET=<app-secret-dari-meta-developers>
TIKTOK_CLIENT_KEY=<client-key-dari-tiktok-developers>
TIKTOK_CLIENT_SECRET=<client-secret-dari-tiktok-developers>
S3_BUCKET=mupost-media
S3_ENDPOINT=https://your-s3-endpoint.com
S3_ACCESS_KEY=<access-key>
S3_SECRET_KEY=<secret-key>
S3_REGION=ap-southeast-1
NEXT_PUBLIC_APP_URL=https://yourdomain.com
```

### Build & Start

```bash
# Build production
npm run build

# Jalankan database migration
npm run db:migrate

# Terminal 1: Next.js server
npm run start

# Terminal 2: Worker process (wajib berjalan terpisah)
npm run worker
```

### Catatan Deployment

- **Worker wajib dipisah** dari proses Next.js. Gunakan `pm2`, `systemd`, atau container terpisah.
- Pastikan Redis dan PostgreSQL dapat diakses dari kedua proses (Next.js server dan worker).
- Konfigurasi `NEXTAUTH_SECRET` dan `TOKEN_ENCRYPTION_KEY` tidak boleh berubah setelah production — perubahan akan menginvalidasi semua sesi dan token yang tersimpan.
- Service Worker PWA hanya aktif di `NODE_ENV=production` (dinonaktifkan saat development).

### Contoh Konfigurasi PM2

```json
{
  "apps": [
    {
      "name": "mupost-web",
      "script": "node_modules/.bin/next",
      "args": "start",
      "env": { "NODE_ENV": "production", "PORT": "3000" }
    },
    {
      "name": "mupost-worker",
      "script": "node_modules/.bin/tsx",
      "args": "src/workers/index.ts",
      "env": { "NODE_ENV": "production" }
    }
  ]
}
```

```bash
pm2 start ecosystem.config.json
pm2 save
pm2 startup
```

---

## Lisensi

Hak cipta © 2024 Mupost. Seluruh hak dilindungi.
