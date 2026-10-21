# ตั้งค่า Supabase สำหรับ login + ซิงก์เซฟ

ทำครั้งเดียว ประมาณ 10 นาที

## 1. สร้างโปรเจกต์
1. เข้า https://supabase.com → Sign in (ใช้ GitHub ได้) → **New project**
2. ตั้งชื่อ เช่น `life-sim` · Region เลือก **Southeast Asia (Singapore)** · ตั้ง Database password (เก็บไว้เอง ไม่ต้องส่งให้ใคร)
3. รอสร้างเสร็จ 1–2 นาที

## 2. สร้างตารางเซฟ
1. เมนูซ้าย **SQL Editor** → **New query**
2. คัดลอกทั้งหมดจากไฟล์ `supabase/schema.sql` วาง แล้วกด **Run**

## 3. ตั้งค่าการล็อกอิน
1. เมนู **Authentication → Sign In / Providers → Email**: เปิดไว้ (ค่าเริ่มต้นเปิดอยู่แล้ว)
2. ถ้าไม่อยากกดยืนยันอีเมลตอนสมัคร: ปิด **Confirm email**
   (ถ้าเปิดไว้ ต้องเปิดลิงก์ในอีเมลก่อนถึงจะเข้าสู่ระบบได้)
3. **Authentication → URL Configuration**
   - Site URL: `https://ipanggg023-maker.github.io/life-sim/`
   - Redirect URLs: เพิ่ม `https://ipanggg023-maker.github.io/life-sim/` และ `http://127.0.0.1:5173/`

## 4. เอาคีย์มาใส่
เมนู **Project Settings → API** (หรือ Data API / API Keys) คัดลอก 2 อย่าง:
- **Project URL** เช่น `https://abcd1234.supabase.co`
- **anon public** key (หรือ publishable key) — ใส่ในเว็บได้ ปลอดภัยเพราะมี RLS

> ⚠️ ห้ามใช้ **service_role** / secret key เด็ดขาด

### บนเว็บจริง (GitHub Pages)
GitHub repo → **Settings → Secrets and variables → Actions → Variables → New repository variable**
- `VITE_SUPABASE_URL` = Project URL
- `VITE_SUPABASE_ANON_KEY` = anon public key

แล้ว push / กด Re-run deploy — ปุ่ม "บัญชี & ซิงก์เซฟ" จะขึ้นเอง

### บนเครื่องตัวเอง (ทดสอบ)
สร้างไฟล์ `.env.local` ที่โฟลเดอร์โปรเจกต์:
```
VITE_SUPABASE_URL=https://abcd1234.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

## ใช้งาน
- แท็บ 👻 → **บัญชี & ซิงก์เซฟ** → สมัคร/เข้าสู่ระบบ (หรือที่หน้าเลือกโลก)
- ล็อกอินแล้วเซฟอัปโหลดเองทุก ~20 วินาที และตอนปิดแอป
- เปิดอีกเครื่องแล้วล็อกอิน ถ้าคลาวด์มีเซฟใหม่กว่า เกมจะถามว่าจะโหลดมาแทนไหม
