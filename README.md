# Dashboard Monitoring TPK

Aplikasi dashboard monitoring Tim Pendamping Keluarga (Next.js) untuk pimpinan pusat.

## Menjalankan aplikasi (root)

```bash
npm install
npm run build
npm run start -- -p 43127
# atau development:
npm run dev -- -p 43127
```

Buka `http://127.0.0.1:43127/`.

## Desain Figma Make

Aset desain Vite/Figma Make yang sebelumnya ada di root dipindahkan ke folder [`design/`](./design/) agar tidak tertimpa aplikasi dashboard. Lihat `design/AGENTS.md` untuk menjalankan ulang proyek desain.

```bash
cd design
pnpm install
pnpm dev
```

## Catatan

- Data di aplikasi bersifat **simulasi** untuk demo visual.
- GeoJSON batas provinsi ada di `public/data/` (app) dan salinan desain di `design/public/data/` (termasuk `west-java-regencies.geojson`).
