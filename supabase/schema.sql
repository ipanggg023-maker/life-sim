-- Life Sim: ตารางเก็บเซฟ 1 แถวต่อบัญชี (รันครั้งเดียวใน Supabase → SQL Editor)
create table if not exists public.saves (
  user_id uuid primary key references auth.users (id) on delete cascade,
  code text not null,                 -- เซฟที่บีบอัดแล้ว (รูปแบบเดียวกับ "คัดลอกรหัส")
  summary jsonb not null default '{}', -- สรุปสั้นๆ ไว้แสดงก่อนโหลด
  updated_at timestamptz not null default now()
);

alter table public.saves enable row level security;

-- แต่ละคนอ่าน/เขียนได้เฉพาะเซฟของตัวเอง
create policy "own save: select" on public.saves for select using (auth.uid() = user_id);
create policy "own save: insert" on public.saves for insert with check (auth.uid() = user_id);
create policy "own save: update" on public.saves for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own save: delete" on public.saves for delete using (auth.uid() = user_id);
