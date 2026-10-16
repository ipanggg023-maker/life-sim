import { chance } from "./rng";
import type { Life, Memory } from "./types";
import { clamp } from "./util";

/** บันทึกสิ่งที่ได้เห็นในชาตินี้ — ถ้าย้อนเวลา จะกลายเป็นความทรงจำ */
export function observe(life: Life, key: string, text: string, data?: Memory["data"]) {
  life.observed ??= [];
  if (life.observed.some((m) => m.key === key)) return;
  life.observed.push({ key, age: life.age, text, data });
}

export function remembers(life: Life, key: string): Memory | undefined {
  return life.memories?.find((m) => m.key === key);
}

/** โอกาสที่อนาคตยังเป็นไปตามที่จำได้ */
export function memoryOdds(life: Life) {
  return clamp(1 - (life.divergence ?? 0) / 150, 0.15, 1);
}

/**
 * ใช้ความทรงจำเปลี่ยนอนาคต: ทอยว่ายังจริงอยู่ไหม แล้วเพิ่มค่าความเบี่ยงเบน
 * (ยิ่งแก้อดีตมาก อนาคตยิ่งไม่เหมือนที่จำได้)
 */
export function useMemory(life: Life, cost = 15): boolean {
  const holds = chance(life, memoryOdds(life));
  life.divergence = (life.divergence ?? 0) + cost;
  return holds;
}

/** รวมความทรงจำเก่ากับของใหม่ — ของใหม่ทับ key เดิม */
export function mergeMemories(...lists: (Memory[] | undefined)[]): Memory[] {
  const map = new Map<string, Memory>();
  for (const list of lists) for (const m of list ?? []) map.set(m.key, m);
  return [...map.values()].sort((a, b) => a.age - b.age);
}
