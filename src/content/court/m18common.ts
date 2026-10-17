// ตัวช่วยร่วมของ event ราชสำนัก M18
import type { Outcome } from "../../engine/events";
import { kill } from "../../engine/game";
import { randInt } from "../../engine/rng";
import type { Life } from "../../engine/types";
import { addStat, people } from "../../engine/util";

export const good = (text: string, next?: string): Outcome => ({ text, kind: "good", next });
export const bad = (text: string, next?: string): Outcome => ({ text, kind: "bad", next });
export const meh = (text: string, next?: string): Outcome => ({ text, next });
export const sys = (text: string, next?: string): Outcome => ({ text, kind: "system", next });
export const big = (text: string): Outcome => ({ text, kind: "milestone" });

export const noble = (l: Life) => l.wealth !== "poor";
export const commoner = (l: Life) => l.wealth === "poor";
export const single = (l: Life) => !people(l, "partner").length && !people(l, "spouse").length;
export const married = (l: Life) => people(l, "spouse").length > 0;
export const other = (l: Life) => (l.gender === "m" ? "f" : "m");
export const lady = (l: Life) => (l.gender === "f" ? "คุณหนู" : "คุณชาย");
export const lord = (l: Life) => (l.gender === "f" ? "ท่านหญิง" : "ท่านลอร์ด");
export const role = (l: Life) => String(l.flags.role ?? "");
export const isVillain = (l: Life) => role(l) === "villain";
export const NOVEL = "ดอกกุหลาบแห่งจักรวรรดิ";
export const hero = (l: Life) => (l.gender === "f" ? "ลิเซีย" : "ลิออน");
export const royal = (l: Life) => (l.gender === "f" ? "องค์รัชทายาทคาเลียน" : "องค์หญิงเซราฟิน่า");

/** คู่ปรับประจำวงสังคม — ชื่อคงที่ตลอดชีวิต */
const RIVALS_F = ["เลดี้โรซาลีน เดอ มาร์โกต์", "เคานต์เตสเบียทริซ วาเลนเทีย", "มาร์เชียเนสอิโซลด์ เฟเธอร์สโตน"];
const RIVALS_M = ["ลอร์ดเซดริก แอชฟอร์ด", "ไวเคานต์ลูเซียน มอนแทกิว", "มาร์ควิสเฟลิกซ์ ฮาร์ตเวล"];
export const rivalName = (l: Life) => {
  const list = l.gender === "f" ? RIVALS_F : RIVALS_M;
  return list[Math.abs(l.seed) % list.length];
};

export function hurt(l: Life, min: number, max: number, cause: string): string {
  const d = randInt(l, min, max);
  addStat(l, "health", -d);
  if (l.stats.health <= 0) {
    kill(l, cause);
    return " …ร่างกายคุณทนไม่ไหวอีกต่อไป";
  }
  return ` (สุขภาพ -${d})`;
}

/** น้ำหนักพื้นฐานของ event M18 — ต่ำกว่าค่าเริ่มต้นเพื่อไม่ให้กลบ event เดิมของราชสำนัก */
export const W = 5;
