import type { Life } from "./types";

/**
 * Seeded RNG (mulberry32) — สถานะเก็บไว้ใน life.rng
 * เพื่อให้เส้นเวลาเดิมสุ่มออกมาเหมือนเดิม (จำเป็นสำหรับระบบย้อนเวลา)
 */
export function nextFloat(life: Pick<Life, "rng">): number {
  let t = (life.rng = (life.rng + 0x6d2b79f5) | 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function randInt(life: Pick<Life, "rng">, min: number, max: number): number {
  return min + Math.floor(nextFloat(life) * (max - min + 1));
}

export function chance(life: Pick<Life, "rng">, p: number): boolean {
  return nextFloat(life) < p;
}

export function pick<T>(life: Pick<Life, "rng">, items: readonly T[]): T {
  return items[Math.floor(nextFloat(life) * items.length)];
}

export function weightedPick<T>(
  life: Pick<Life, "rng">,
  items: readonly T[],
  weight: (item: T) => number,
): T | undefined {
  const total = items.reduce((sum, it) => sum + Math.max(0, weight(it)), 0);
  if (total <= 0) return undefined;
  let roll = nextFloat(life) * total;
  for (const it of items) {
    roll -= Math.max(0, weight(it));
    if (roll < 0) return it;
  }
  return items[items.length - 1];
}

export function newSeed(): number {
  return (Math.random() * 2 ** 32) | 0;
}
