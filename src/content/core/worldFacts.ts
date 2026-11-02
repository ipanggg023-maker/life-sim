import { randInt } from "../../engine/rng";
import type { Life } from "../../engine/types";

export interface WorldFacts {
  lotteryAge: number;
  lotteryNumber: string;
  stockAge: number;
  cataclysmAge: number;
  secretGateAge: number;
}

const cache = new Map<string, WorldFacts>();

/**
 * ข้อเท็จจริงของโลกในยุคนี้ — คำนวณจาก seed ของโลก + ปีเกิด เท่านั้น
 * ไม่ใช้ RNG ของผู้เล่น ดังนั้นย้อนเวลากี่ครั้งก็เหมือนเดิม (จนกว่าค่าความเบี่ยงเบนจะทำให้ "เพี้ยน")
 */
export function worldFacts(life: Life): WorldFacts {
  const ws = life.worldSeed ?? life.seed;
  const key = `${ws}:${life.birthYear}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const r = { rng: (ws ^ Math.imul(life.birthYear, 2654435761)) | 0 };
  const facts: WorldFacts = {
    lotteryAge: randInt(r, 22, 40),
    lotteryNumber: String(randInt(r, 0, 999_999)).padStart(6, "0"),
    stockAge: randInt(r, 27, 45),
    cataclysmAge: randInt(r, 24, 38),
    secretGateAge: randInt(r, 21, 32),
  };
  cache.set(key, facts);
  return facts;
}
