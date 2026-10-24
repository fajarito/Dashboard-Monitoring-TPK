# Backgrounds — Nusantara Fresh Blue

Katalog: `background-manifest.json` (39 entri: nasional `00` + 38 provinsi).
Kode wilayah **string** — jaga leading zero (`11`, bukan `11` number tanpa pad di JSON).

## Status image
| Status di manifest | Perilaku UI |
|---|---|
| `MISSING - …` / `image: null` | CSS gradient fresh blue saja — **tidak** meminjam foto wilayah lain |
| berisi `AI-generated` + path image | Tampil foto + badge **Placeholder visual · bukan foto dokumenter** |
| verified + credit + license | Foto produksi + kredit halus |

## Menambah / mengganti foto riil
1. Simpan WebP: `public/backgrounds/<slug>.webp` (slug sesuai manifest).
2. Update entri di `background-manifest.json`:
   - `image`: `"/backgrounds/<slug>.webp"`
   - `photo_credit`, `source_url`, `license` (wajib sebelum produksi)
   - `status`: misalnya `"verified"` (bukan AI placeholder)
3. Jangan gunakan `demo-landscape.webp` atau `national.webp` sebagai fallback provinsi lain.
4. Jangan overwrite file existing tanpa backup.

## Starter pack saat ini
- `national.webp`, `sumatera-utara.webp` — **AI mockup prototyping**, bukan foto dokumenter.
- `demo-landscape.webp` — generik, **tidak** di-wire ke wilayah mana pun.
