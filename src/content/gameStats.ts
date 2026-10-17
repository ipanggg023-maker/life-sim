// ค่าสถานะแบบเกม STR / AGI / STA / INT / CHA / LUK
// ทุกคนมี "ค่าที่แท้จริง" ที่คิดจากสเตตัสพื้นฐาน · ผู้มีระบบ (โลกธรรมดา) ฝึกให้สูงกว่านั้นได้
// ไฟล์นี้ import แค่ types (util.ts / power.ts ใช้ไฟล์นี้)
import type { Life, StatKey, SysStat } from "../engine/types";

export const SYS_STATS: SysStat[] = ["str", "agi", "sta", "int", "cha", "luk"];

export const SYS_INFO: Record<SysStat, { label: string; name: string; emoji: string; desc: string }> = {
  str: { label: "STR", name: "พละกำลัง", emoji: "💪", desc: "ต่อสู้ ยกของหนัก กีฬาที่ใช้แรง" },
  agi: { label: "AGI", name: "ความว่องไว", emoji: "⚡", desc: "รีแอคชัน หลบหลีก เกม กีฬาความเร็ว" },
  sta: { label: "STA", name: "ความอึด", emoji: "🫀", desc: "ทำงานหนัก ร่างกายฟื้นตัว อายุยืน" },
  int: { label: "INT", name: "สติปัญญา", emoji: "🧠", desc: "เรียน หมอ วิศวกร ธุรกิจ" },
  cha: { label: "CHA", name: "เสน่ห์", emoji: "✨", desc: "การแสดง ไอดอล เข้าสังคม เจรจา" },
  luk: { label: "LUK", name: "โชค", emoji: "🍀", desc: "การพนัน ลงทุน เหตุบังเอิญ" },
};

/** ค่าที่ได้จากสเตตัสพื้นฐาน (คนทั่วไปมีเท่านี้) */
export function baseSys(l: Life, k: SysStat): number {
  const s = l.stats;
  const v = { str: s.health * 0.4, agi: (s.health + s.luck) * 0.2, sta: s.health * 0.4, int: s.smarts * 0.4, cha: s.looks * 0.4, luk: s.luck * 0.4 }[k];
  return Math.round(v);
}

/** ค่าที่ใช้จริง: ผู้มีระบบใช้ค่าที่ฝึกมา (ไม่ต่ำกว่าค่าพื้นฐาน) */
export function effSys(l: Life, k: SysStat): number {
  return Math.max(baseSys(l, k), l.sys?.[k] ?? 0);
}

/** ส่วนที่ฝึกเกินค่าพื้นฐาน → โบนัสการเช็กสเตตัส (สูงสุด +25%) */
export function sysCheckBonus(l: Life, stat: StatKey): number {
  if (!l.sys) return 0;
  const keys: Partial<Record<StatKey, SysStat[]>> = { health: ["str", "sta"], smarts: ["int"], looks: ["cha"], luck: ["luk"], happiness: ["cha"] };
  const ks = keys[stat];
  if (!ks) return 0;
  const gain = ks.reduce((s, k) => s + Math.max(0, effSys(l, k) - baseSys(l, k)), 0) / ks.length;
  return Math.min(0.25, gain / 120);
}

/** แปลงค่า STR–LUK (0–100+) เป็นสเกลผลงาน 0–100 */
export const sysAs100 = (v: number) => Math.max(0, Math.min(100, Math.round(v * 1.6)));

// ── สกิลที่ปลดล็อกเมื่อค่าสถานะถึงเกณฑ์ (เฉพาะผู้มีระบบ) ──
export const SYS_SKILLS: { name: string; stat: SysStat; min: number; tier: number }[] = [
  { name: "หมัดหนัก", stat: "str", min: 35, tier: 0 },
  { name: "พลังช้างสาร", stat: "str", min: 60, tier: 2 },
  { name: "ปฏิกิริยาไว", stat: "agi", min: 35, tier: 0 },
  { name: "เงาสายฟ้า", stat: "agi", min: 60, tier: 2 },
  { name: "อึดไม่รู้จบ", stat: "sta", min: 35, tier: 0 },
  { name: "ร่างไม่รู้จักเหนื่อย", stat: "sta", min: 60, tier: 2 },
  { name: "สมองไว", stat: "int", min: 35, tier: 0 },
  { name: "อัจฉริยะ", stat: "int", min: 60, tier: 2 },
  { name: "รอยยิ้มพิฆาต", stat: "cha", min: 35, tier: 0 },
  { name: "ออร่าดารา", stat: "cha", min: 60, tier: 2 },
  { name: "ดวงเฮง", stat: "luk", min: 35, tier: 0 },
  { name: "ลูกรักฟ้า", stat: "luk", min: 60, tier: 2 },
];
export const sysSkillTier = (name: string) => SYS_SKILLS.find((s) => s.name === name)?.tier;
export const sysSkillsOf = (l: Life): string[] => String(l.flags.sysSkills ?? "").split(",").filter(Boolean);
