import { randInt } from "../../engine/rng";
import type { Life } from "../../engine/types";

/**
 * สุ่มภารกิจแบบ "ประเภท × สถานที่" ที่ยังไม่เคยทำในชีวิตนี้ — ทำแล้วไม่วนกลับมาอีก
 * ถ้าทำครบทุกคู่แล้วจริงๆ (หลายสิบภารกิจ) ค่อยเริ่มนับใหม่
 */
export function freshQuest(life: Life, key: string, types: number, places: number): { t: number; p: number } {
  const flag = `done_${key}`;
  const done = new Set(String(life.flags[flag] ?? "").split(",").filter(Boolean));
  const free: string[] = [];
  for (let t = 0; t < types; t++) for (let p = 0; p < places; p++) if (!done.has(`${t}.${p}`)) free.push(`${t}.${p}`);
  if (!free.length) done.clear();
  const pool = free.length ? free : [...Array(types * places)].map((_, i) => `${Math.floor(i / places)}.${i % places}`);
  const id = pool[randInt(life, 0, pool.length - 1)];
  done.add(id);
  life.flags[flag] = [...done].join(",");
  const [t, p] = id.split(".").map(Number);
  return { t, p };
}

/** แทน {p} ในชื่อ/คำบรรยายด้วยชื่อสถานที่ */
export const atPlace = (s: string, place: string) => s.replace(/\{p\}/g, place);

/** จำนวนภารกิจที่เคยทำในชีวิตนี้ (สำหรับแสดงผล) */
export const questsDone = (life: Life, key: string) => String(life.flags[`done_${key}`] ?? "").split(",").filter(Boolean).length;
