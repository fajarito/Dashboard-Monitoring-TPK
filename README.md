# Dashboard Monitoring TPK

Aplikasi dashboard monitoring Tim Pendamping Keluarga (Next.js) untuk pimpinan pusat.

## Menjalankan aplikasi

```bash
npm install
npm run build
npm run start -- -p 43127
# atau development:
npm run dev -- -p 43127
```

Buka `http://127.0.0.1:43127/`.

## Sumber data (fase 1)

Default **mock** (tanpa database). Ganti via env:

| Variabel | Nilai | Keterangan |
|---|---|---|
| `DATA_SOURCE` | `mock` (default) \| `postgres` | Adapter data layer |
| `DATABASE_URL_SIGA` | URL Postgres | TPK / anggota / PKB (`sigabaru`) |
| `DATABASE_URL_WILAYAH` | URL Postgres | Label wilayah (`pk2025`) |
| `DATABASE_URL_DWH` | URL Postgres | Rekap KRS (`dwh_pk2025`) |

Contoh `.env.local`:

```bash
DATA_SOURCE=mock
# DATA_SOURCE=postgres
# DATABASE_URL_SIGA=postgres://...
# DATABASE_URL_WILAYAH=postgres://...
# DATABASE_URL_DWH=postgres://...
```

Jika `DATA_SOURCE=postgres` tetapi URL pool kosong / query live belum siap, API **fallback ke mock** agar home tetap hidup.

### Endpoint agregat (home)

- `GET /api/ringkasan?tingkat=nasional|provinsi&id=` — KPI + rasio + prioritas + 6 indikator + komposisi TPK
- `GET /api/peringkat/provinsi` — ranking ringan (max 40 baris)

Cache in-memory + header `Cache-Control` ~**60 detik**. Home **tidak** memuat `by_name` / daftar keluarga.

## Desain Figma Make

Aset desain Vite/Figma Make ada di [`design/`](./design/). Lihat `design/AGENTS.md`.

```bash
cd design
pnpm install
pnpm dev
```

## Catatan

- Adapter Postgres masih **stub** (struktur pool siap; SQL MV belum).
- GeoJSON batas provinsi di `public/data/`.
