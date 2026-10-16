# ชีวิตนับร้อยชาติ (Life Sim)

Life simulator แบบ BitLife ผสม trope มังฮวา · เว็บเกม (React + TypeScript + Vite)
รายละเอียดการออกแบบอยู่ที่ [design/GDD.md](design/GDD.md)

## รันเกม

```bash
npm install
npm run dev
```

เปิด http://localhost:5173 · มือถือในวง Wi-Fi เดียวกันเปิดผ่าน IP เครื่องคอมได้ (dev server เปิด `--host` ไว้แล้ว)

- **โหมด Admin:** ต่อท้าย URL ด้วย `?dev=1` แล้วไปที่แท็บ 👻 วิญญาณ → สร้างตัวละครเอง / กรอเวลา
- **ทดสอบ:** `npm test` (จำลอง 300 ชีวิตอัตโนมัติ + เช็กว่า seed เดิมได้ชีวิตเดิม)
- **Build:** `npm run build` → โฟลเดอร์ `dist/`
- **Deploy:** push ขึ้น branch `main` บน GitHub แล้ว workflow `.github/workflows/deploy.yml` จะ build และขึ้น GitHub Pages ให้เอง (ต้องเปิด Settings → Pages → Source: GitHub Actions)
- **ไอคอน:** `node scripts/make-icons.mjs`

## โครงสร้าง

| โฟลเดอร์ | หน้าที่ |
|---|---|
| `src/engine/` | กติกาเกม: การเกิด, +1 ปี, การตาย, งาน, ความสัมพันธ์, RNG แบบมี seed |
| `src/content/` | เนื้อหา: พรสวรรค์, อาชีพ, ชื่อ, event ของแต่ละโลก |
| `src/ui/` | หน้าจอ React |
| `src/save.ts` | เซฟอัตโนมัติลง IndexedDB |

## เพิ่ม event ใหม่

เพิ่มออบเจกต์ใน `src/content/hunter/events/*.ts` — ดูชนิดข้อมูล `GameEvent` ใน `src/engine/events.ts`
