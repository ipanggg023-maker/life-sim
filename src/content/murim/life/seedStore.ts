// "เมล็ดพันธุ์" ของผลที่ตามมาหลายสิบปี (EXPANSION §1.2 ทุกการเลือกมีต้นทุน · rubric: ผลระยะยาว 10+ ปี)
// การกระทำสำคัญปลูกเมล็ดไว้ · ถึงปีปฏิทินที่สุกจะกลายเป็นเรื่องราว (seeds.ts) · ตายก่อนสุกบางชนิดตกถึงลูกหลาน
// ไฟล์นี้ไม่ import ระบบเรื่องราว — ระบบต่อสู้/กฎหมาย/ข่าวลือเรียกปลูกเมล็ดได้โดยไม่เกิดวงจร import
import { randInt } from "../../../engine/rng";
import type { Life } from "../../../engine/types";

export type SeedKind =
  | "spared" // ไว้ชีวิตศัตรู
  | "killed" // ฆ่าคน — ลูก/ศิษย์ของเขาโตขึ้นมา
  | "crippled" // ทำลายวิชาคนอื่น
  | "betrayed" // ซัดทอดเพื่อนในคุก
  | "kindness" // ช่วยคนที่ไม่มีใครช่วย
  | "sold_trap"; // ขายข่าวลวงจนมีคนตาย

export interface Seed {
  id: string;
  k: SeedKind;
  /** ชื่อคนที่เกี่ยวข้อง */
  who: string;
  /** ปีปฏิทินที่ปลูก / ที่สุก */
  y: number;
  ripe: number;
  /** ชื่อคนที่ทำ (เมื่อตกทอดถึงลูกหลาน) */
  by?: string;
  pid?: string;
}

const KEY = "mwSeeds";
export function seedsOf(l: Life): Seed[] {
  try { return JSON.parse(String(l.flags[KEY] ?? "[]")) as Seed[]; } catch { return []; }
}
export const saveSeeds = (l: Life, s: Seed[]) => { l.flags[KEY] = JSON.stringify(s.slice(-12)); };

const RIPEN: Record<SeedKind, [number, number]> = {
  spared: [8, 20],
  killed: [14, 22],
  crippled: [10, 20],
  betrayed: [5, 12],
  kindness: [10, 25],
  sold_trap: [5, 10],
};

/** ปลูกเมล็ดของผลที่ตามมา (ยุทธภพเท่านั้น) */
export function plantSeed(l: Life, k: SeedKind, who: string, pid?: string) {
  if (l.worldId !== "murim") return;
  const y = l.birthYear + l.age;
  const [a, b] = RIPEN[k];
  const s = seedsOf(l);
  s.push({ id: `s${y}_${s.length}_${k}`, k, who, y, ripe: y + randInt(l, a, b), pid });
  saveSeeds(l, s);
}
