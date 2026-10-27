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
| `NEXT_PUBLIC_MASTER_WILAYAH_API_URL` | URL HTTPS | Base API/SDK peta Master Wilayah (BKKBN). Browser memuat `{URL}/map/widget.js`. **Wajib** agar peta sebaran tidak 404 `/undefined/map/widget.js`. |

Contoh `.env.local`:

```bash
DATA_SOURCE=mock
# DATA_SOURCE=postgres
# DATABASE_URL_SIGA=postgres://...
# DATABASE_URL_WILAYAH=postgres://...
# DATABASE_URL_DWH=postgres://...

# Peta Master Wilayah (UAT). Restart `next dev` setelah mengubah NEXT_PUBLIC_*.
NEXT_PUBLIC_MASTER_WILAYAH_API_URL=https://master-wilayah-api-git-master-wilayah-api.apps.ocp-uat.bkkbn.go.id
```

**Catatan Next.js:** `NEXT_PUBLIC_*` di-inline saat **build**. Mengubah env di pod OpenShift tanpa rebuild image **tidak** memperbaiki client bundle. Dockerfile sudah menerima build-arg dengan default UAT di atas. URL **production** belum ada di repo — tanya kolaborator / tim Master Wilayah.

Jika `DATA_SOURCE=postgres` tetapi **salah satu URL pool kosong**, API **fallback ke mock** (agar lokal tanpa DB tetap hidup).  
Jika ketiga URL terisi tetapi query gagal → **HTTP 503** JSON jelas (`meta.source=postgres-error`), **bukan** mock diam-diam.

**Jangan commit URL database / password.** Simpan hanya di Secret OpenShift atau `.env.local` (sudah di `.gitignore`).

### Endpoint agregat (home)

- `GET /api/ringkasan?tingkat=nasional|provinsi&id=` — KPI + rasio + prioritas + 6 indikator + komposisi TPK
- `GET /api/peringkat/provinsi` — ranking ringan (max 40 baris)

Cache in-memory + header `Cache-Control` ~**60 detik**. Home **tidak** memuat `by_name` / daftar keluarga.

### Detail PKB (API portal + foto SIMSDM)

Kartu pembina di detail TPK diperkaya by **NIP** dari portal UAT (`jab_akhir`, `email_dinas`, `nohp`, foto). Agregat jumlah PKB **tidak** berubah.

| Env | Keterangan |
|---|---|
| `PKB_PORTAL_API_BASE_URL` | Default `https://api-portal.apps.ocp-uat.bkkbn.go.id` |
| `PKB_PORTAL_API_TOKEN` | Bearer; tanpa token → stub NIP demo / fallback lokal |
| `SIMSDM_FOTO_BASE_URL` | Default `https://simsdm.bkkbn.go.id/assets/uploads/pictures` |

- Proxy: `GET /api/pkb/[nip]?propinsi=&kabupaten=&statuspegawai=PKB`
- NIP demo stub: `196803291988032003` (mock TPK rich Sukamaju)
- Template: `.env.example` (force-add; jangan commit token)

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

# 2) ConfigMap (non-secret) — termasuk NEXT_PUBLIC_MASTER_WILAYAH_API_URL (UAT)
oc apply -f deploy/openshift/configmap.yaml

# Atau set/patch env tanpa re-apply file:
oc set env configmap/dashboard-tpk-config \
  NEXT_PUBLIC_MASTER_WILAYAH_API_URL='https://master-wilayah-api-git-master-wilayah-api.apps.ocp-uat.bkkbn.go.id'

# 3) Secret — buat dari literal, JANGAN commit file berisi URL nyata
oc create secret generic dashboard-tpk-db \
  --from-literal=DATABASE_URL_SIGA='postgres://USER:PASS@HOST:5432/sigabaru' \
  --from-literal=DATABASE_URL_WILAYAH='postgres://USER:PASS@HOST:5432/pk2025' \
  --from-literal=DATABASE_URL_DWH='postgres://USER:PASS@HOST:5432/dwh_pk2025' \
  --dry-run=client -o yaml | oc apply -f -

# 4) Build & push image — WAJIB build-arg map SDK (NEXT_PUBLIC_* di-bake saat build)
# Docker lokal:
# docker build -t dashboard-monitoring-tpk:latest \
#   --build-arg NEXT_PUBLIC_MASTER_WILAYAH_API_URL='https://master-wilayah-api-git-master-wilayah-api.apps.ocp-uat.bkkbn.go.id' \
#   .
# OpenShift binary build (sesuaikan nama BuildConfig):
# oc new-build --name=dashboard-monitoring-tpk --strategy=docker --binary \
#   --build-arg NEXT_PUBLIC_MASTER_WILAYAH_API_URL='https://master-wilayah-api-git-master-wilayah-api.apps.ocp-uat.bkkbn.go.id'
# oc start-build dashboard-monitoring-tpk --from-dir=. --follow \
#   --build-arg NEXT_PUBLIC_MASTER_WILAYAH_API_URL='https://master-wilayah-api-git-master-wilayah-api.apps.ocp-uat.bkkbn.go.id'
# Lalu sesuaikan `image:` di deployment.yaml
#
# Setelah image lama tanpa env: rebuild wajib. `oc set env deployment/...` saja
# tidak memperbaiki bundle client yang sudah di-compile.

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
