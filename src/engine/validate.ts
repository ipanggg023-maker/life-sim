import { artById } from "../content/murim/martial/arts";
import { getEvent } from "./events";
import type { Life } from "./types";

/**
 * รุ่นของโครงสร้างเซฟ (EXPANSION §16)
 * 1 = ก่อนยกเครื่องยุทธภพ · 2 = ยุทธภพชุดใหม่ (เป้าหมาย/NPC/ยุทธภพ/ข่าวลือ/งบเวลา)
 */
export const SAVE_VERSION = 2;

const num = (x: unknown) => typeof x === "number" && Number.isFinite(x);

/** ตรวจสถานะที่ห้ามเสีย — คืนรายการปัญหา (ว่าง = ปกติ) */
export function validateLife(l: Life): string[] {
  const bad: string[] = [];
  if (!num(l.age) || l.age < 0) bad.push(`อายุผิด: ${l.age}`);
  if (!num(l.money)) bad.push(`เงินไม่ใช่ตัวเลข: ${l.money}`);
  if (!num(l.debt) || l.debt < 0) bad.push(`หนี้ผิด: ${l.debt}`);
  if (!num(l.fame)) bad.push(`ชื่อเสียงไม่ใช่ตัวเลข: ${l.fame}`);
  for (const [k, v] of Object.entries(l.stats)) if (!num(v) || v < 0 || v > 100) bad.push(`ค่า ${k} ผิด: ${v}`);
  const ids = new Set<string>();
  for (const p of l.people) {
    if (ids.has(p.id)) bad.push(`id คนซ้ำ: ${p.id}`);
    ids.add(p.id);
    if (!num(p.age) || p.age < 0) bad.push(`อายุของ${p.name}ผิด: ${p.age}`);
    if (!num(p.bond) || p.bond < 0 || p.bond > 100) bad.push(`ความสัมพันธ์กับ${p.name}ผิด: ${p.bond}`);
  }
  for (const q of l.queue) {
    const e = getEvent(q.eventId);
    if (!e) bad.push(`คิวอ้าง event ที่หายไป: ${q.eventId}`);
    else if (q.scene && q.scene !== "start" && !e.scenes?.[q.scene]) bad.push(`คิวอ้างฉากที่หายไป: ${q.eventId}/${q.scene}`);
    if (!l.alive) bad.push(`คนตายยังมีเหตุการณ์ค้าง: ${q.eventId}`);
  }
  for (const a of l.mwArts ?? []) if (!a.own && !artById(a.id)) bad.push(`วิชาที่ไม่มีอยู่จริง: ${a.id}`);
  if (l.power && (!num(l.power.rank) || l.power.rank < 0)) bad.push(`ขั้นพลังผิด: ${l.power.rank}`);
  for (const [k, v] of Object.entries(l.flags)) if (typeof v === "number" && !Number.isFinite(v)) bad.push(`ค่า flag ${k} ไม่ใช่ตัวเลข`);
  return bad;
}

/** ซ่อมสิ่งที่ซ่อมได้โดยไม่เดา (ตัวเลขพัง คนซ้ำ คิวค้าง วิชาที่หายไป) — คืนจำนวนที่ซ่อม */
export function repairLife(l: Life): number {
  let n = 0;
  const fix = (cond: boolean, f: () => void) => { if (cond) { f(); n++; } };
  fix(!num(l.money), () => (l.money = 0));
  fix(!num(l.debt) || l.debt < 0, () => (l.debt = 0));
  fix(!num(l.fame), () => (l.fame = 0));
  fix(!num(l.age) || l.age < 0, () => (l.age = 0));
  for (const k of Object.keys(l.stats) as (keyof Life["stats"])[]) {
    const v = l.stats[k];
    fix(!num(v) || v < 0 || v > 100, () => (l.stats[k] = num(v) ? Math.max(0, Math.min(100, v)) : 50));
  }
  const seen = new Set<string>();
  const before = l.people.length;
  l.people = l.people.filter((p) => (seen.has(p.id) ? false : (seen.add(p.id), true)));
  n += before - l.people.length;
  for (const p of l.people) {
    fix(!num(p.bond) || p.bond < 0 || p.bond > 100, () => (p.bond = num(p.bond) ? Math.max(0, Math.min(100, p.bond)) : 50));
    fix(!num(p.age) || p.age < 0, () => (p.age = 0));
  }
  if (!l.alive && l.queue.length) { l.queue = []; n++; }
  if (l.mwArts) {
    const k = l.mwArts.length;
    l.mwArts = l.mwArts.filter((a) => a.own || artById(a.id));
    n += k - l.mwArts.length;
  }
  for (const [k, v] of Object.entries(l.flags)) fix(typeof v === "number" && !Number.isFinite(v), () => delete l.flags[k]);
  return n;
}
