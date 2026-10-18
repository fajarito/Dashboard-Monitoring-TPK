# Dashboard Monitoring TPK

Aplikasi dashboard monitoring Tim Pendamping Keluarga (Next.js) untuk pimpinan pusat.

## Menjalankan aplikasi (lokal)

```bash
npm install
npm run build
PORT=43127 npm run start
# atau development:
npm run dev
```

Buka `http://127.0.0.1:43127/`.

`npm run start` menghormati `PORT` (default **8080**, cocok OpenShift) dan listen di `0.0.0.0`.

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

Jika `DATA_SOURCE=postgres` tetapi **salah satu URL pool kosong**, API **fallback ke mock** (agar lokal tanpa DB tetap hidup).  
Jika ketiga URL terisi tetapi query gagal → **HTTP 503** JSON jelas (`meta.source=postgres-error`), **bukan** mock diam-diam.

**Jangan commit URL database / password.** Simpan hanya di Secret OpenShift atau `.env.local` (sudah di `.gitignore`).

### Endpoint agregat (home)

- `GET /api/ringkasan?tingkat=nasional|provinsi&id=` — KPI + rasio + prioritas + 6 indikator + komposisi TPK
- `GET /api/peringkat/provinsi` — ranking ringan (max 40 baris)

Cache in-memory + header `Cache-Control` ~**60 detik**. Home **tidak** memuat `by_name` / daftar keluarga.

## Build image (Docker / OpenShift)

```bash
docker build -t dashboard-monitoring-tpk:latest .
# uji lokal (jika Docker tersedia):
docker run --rm -p 8080:8080 \
  -e DATA_SOURCE=mock \
  -e PORT=8080 \
  dashboard-monitoring-tpk:latest
```

Image multi-stage: `npm ci` → `next build` → runner `next start` di port `PORT` (default 8080), non-root.

## Deploy OpenShift

Manifest di [`deploy/openshift/`](./deploy/openshift/):

| File | Isi |
|---|---|
| `configmap.yaml` | `DATA_SOURCE=postgres`, `PORT=8080` |
| `secret.yaml.example` | placeholder `DATABASE_URL_*` — **bukan** nilai nyata |
| `deployment.yaml` | env dari ConfigMap + Secret, probes |
| `service.yaml` | ClusterIP :8080 |
| `route.yaml` | Route TLS edge |

### Contoh `oc` (tanpa cluster nyata — salin & sesuaikan)

```bash
# 1) Namespace / project
oc project YOUR_PROJECT

# 2) ConfigMap (non-secret)
oc apply -f deploy/openshift/configmap.yaml

# 3) Secret — buat dari literal, JANGAN commit file berisi URL nyata
oc create secret generic dashboard-tpk-db \
  --from-literal=DATABASE_URL_SIGA='postgres://USER:PASS@HOST:5432/sigabaru' \
  --from-literal=DATABASE_URL_WILAYAH='postgres://USER:PASS@HOST:5432/pk2025' \
  --from-literal=DATABASE_URL_DWH='postgres://USER:PASS@HOST:5432/dwh_pk2025' \
  --dry-run=client -o yaml | oc apply -f -

# 4) Build & push image ke registry cluster (contoh)
# oc new-build --name=dashboard-monitoring-tpk --strategy=docker --binary
# oc start-build dashboard-monitoring-tpk --from-dir=. --follow
# Lalu sesuaikan `image:` di deployment.yaml

# 5) App + Service + Route
oc apply -f deploy/openshift/deployment.yaml
oc apply -f deploy/openshift/service.yaml
oc apply -f deploy/openshift/route.yaml

# 6) Cek
oc get pods,svc,route -l app=dashboard-monitoring-tpk
oc logs -l app=dashboard-monitoring-tpk --tail=50
```

Egress cluster harus bisa ke **tiga host Postgres** (SIGA, wilayah, DWH). Hitung berat tetap di DB (MV / CronJob refresh), bukan di tiap request pod.

## Desain Figma Make

Aset desain Vite/Figma Make ada di [`design/`](./design/). Lihat `design/AGENTS.md`.

```bash
cd design
pnpm install
pnpm dev
```

## Catatan

- Adapter Postgres **live** untuk `/api/ringkasan` dan `/api/peringkat/provinsi` (agregat SIGA + DWH rekap; nama via `pk2025.v_provinsi`). Tidak scan `by_name`.
- RTLH di DWH belum ada → `indikator.rtlh = null` pada sumber postgres.
- GeoJSON batas provinsi di `public/data/`.
