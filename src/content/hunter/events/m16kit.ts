// ของใช้ร่วมกันของ event ชุด M16 (โลก Hunter)
import type { Outcome } from "../../../engine/events";
import { kill } from "../../../engine/game";
import { chance, randInt } from "../../../engine/rng";
import type { Life } from "../../../engine/types";
import { addStat } from "../../../engine/util";
import { survivalOdds } from "../power";

export const good = (text: string, next?: string): Outcome => ({ text, kind: "good", next });
export const bad = (text: string, next?: string): Outcome => ({ text, kind: "bad", next });
export const meh = (text: string, next?: string): Outcome => ({ text, next });
export const big = (text: string): Outcome => ({ text, kind: "milestone" });

export const rank = (l: Life) => l.power?.rank ?? -1;
export const awake = (l: Life) => !!l.power;
export const isHunter = (l: Life) => !!l.power && l.job?.careerId === "hunter";
/** ผู้ใหญ่ที่ไม่มีพลัง (ตรวจแล้วไม่ตื่น หรือยังรอ) */
export const mundane = (l: Life) => !l.power && l.age >= 18;
export const w = (cond: boolean, n: number) => (cond ? n : 0);

export function hurt(l: Life, min: number, max: number, cause: string): string {
  const d = randInt(l, min, max);
  addStat(l, "health", -d);
  if (l.stats.health <= 0) {
    kill(l, cause);
    return " …ร่างกายคุณทนไม่ไหวอีกต่อไป";
  }
  return ` (สุขภาพ -${d})`;
}

/** แพ้การต่อสู้: ลุ้นรอดด้วย survivalOdds (event นอก Gate ใจดีกว่าใน Gate เล็กน้อย) */
export function lost(l: Life, gateRank: number, cause: string, text: string, min = 10, max = 25): Outcome {
  if (!chance(l, survivalOdds(l, gateRank, 0.1))) {
    kill(l, cause);
    return bad(`${text} …ภาพสุดท้ายที่คุณเห็นคือท้องฟ้าสีม่วงของมานา`);
  }
  return bad(text + hurt(l, min, max, cause));
}
