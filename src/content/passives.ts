// สกิลติดตัว (passive): ได้จากการใช้ชีวิต การฝึก และเหตุการณ์ — ทุกโลกใช้ร่วมกัน ไม่ต้องมีพลัง
// ห้าม import engine/util หรือ content/hunter/power (ทั้งสองไฟล์ import ไฟล์นี้)
import type { Life, StatKey } from "../engine/types";
import { activeTalents } from "./talents";
import { MORE_PASSIVES } from "./passivesMore";

export interface Passive {
  id: string;
  name: string;
  emoji: string;
  desc: string;
  /** เงื่อนไขการได้มา (ตรวจทุกปี) */
  earn: (l: Life) => boolean;
  /** วิธีได้ — แสดงให้ผู้เล่นรู้ว่าต้องทำอะไร */
  how: string;
  cp?: number;
  survival?: number;
  exp?: number;
  money?: number;
  /** โบนัสการเช็กสเตตัส */
  check?: Partial<Record<StatKey, number>>;
  /** ทุกปี */
  yearly?: Partial<Record<StatKey, number>>;
}

const n = (l: Life, k: string) => Number(l.flags[k] ?? 0);
const seen = (l: Life, ...ids: string[]) => ids.some((id) => (l.seen[id] ?? 0) > 0);

export const PASSIVES: Passive[] = [
  { id: "iron_body", name: "ร่างกายเหล็ก", emoji: "💪", desc: "โอกาสรอด +3% · เช็กสุขภาพ +5%", how: "ฝึกฝนหรือออกกำลังกายรวม 6 ปี", earn: (l) => n(l, "trainCount") + n(l, "act_gym") + n(l, "act_m_train") >= 6, survival: 0.03, check: { health: 0.05 } },
  { id: "bookworm", name: "หนอนหนังสือ", emoji: "📚", desc: "เช็กสติปัญญา +6%", how: "อ่านหนังสือรวม 6 ปี", earn: (l) => n(l, "act_read") + n(l, "act_m_read") + n(l, "act_c_library") >= 6, check: { smarts: 0.06 } },
  { id: "charmer", name: "เสน่ห์ล้นเหลือ", emoji: "✨", desc: "เช็กรูปลักษณ์ +6%", how: "รูปลักษณ์ 80 ขึ้นไปตอนโต", earn: (l) => l.age >= 16 && l.stats.looks >= 80, check: { looks: 0.06 } },
  { id: "lucky_star", name: "ดาวนำโชค", emoji: "🍀", desc: "เช็กโชค +5%", how: "โชค 85 ขึ้นไป", earn: (l) => l.stats.luck >= 85, check: { luck: 0.05 } },
  { id: "poison_body", name: "ร่างทนพิษ", emoji: "🧪", desc: "โอกาสรอด +3%", how: "รอดจากการถูกวางยา", earn: (l) => seen(l, "m.poison", "court.poison", "m2.a.poison_banquet"), survival: 0.03 },
  { id: "undying", name: "ไม่ยอมตาย", emoji: "🔥", desc: "โอกาสรอด +5%", how: "รอดชีวิตจากภาวะใกล้ตาย", earn: (l) => !!l.flags.nearDeath, survival: 0.05 },
  { id: "instinct", name: "สัญชาตญาณนักสู้", emoji: "⚔️", desc: "พลังต่อสู้ +3", how: "ล้มบอส/คู่แข่งคนสำคัญ 10 ครั้ง", earn: (l) => (l.power?.bossKills ?? 0) >= 10, cp: 3 },
  { id: "veteran", name: "ประสบการณ์โชกโชน", emoji: "🎖️", desc: "โอกาสรอด +4%", how: "ผ่านภารกิจ 30 ครั้ง", earn: (l) => (l.power?.gates ?? 0) >= 30, survival: 0.04 },
  { id: "socialite", name: "ราชาแห่งงานเลี้ยง", emoji: "🥂", desc: "เช็กรูปลักษณ์/ความสุข +5%", how: "ชื่อเสียง 40 ขึ้นไป", earn: (l) => l.fame >= 40, check: { looks: 0.05, happiness: 0.05 } },
  { id: "merchant_mind", name: "หัวการค้า", emoji: "💰", desc: "รายได้ +5%", how: "ร่ำรวยระดับเศรษฐี", earn: (l) => l.money - l.debt >= 50_000_000, money: 0.05 },
  { id: "zen", name: "ใจสงบ", emoji: "🧘", desc: "ความสุข +2 ทุกปี", how: "ทำบุญ/พักผ่อนรวม 6 ปี", earn: (l) => Object.keys(l.flags).filter((k) => /^act_.*(temple|shrine|chapel|rest)$/.test(k)).reduce((s, k) => s + n(l, k), 0) >= 6, yearly: { happiness: 2 } },
  { id: "healer_hands", name: "มือหมอ", emoji: "🩺", desc: "สุขภาพ +1 ทุกปี", how: "จบแพทย์ หรือเป็นสายรักษา", earn: (l) => l.education.degree === "med" || ["healer", "m_medic", "c_holy", "a_medic", "t_lantern", "o_doctor"].includes(l.power?.hunterClass ?? ""), yearly: { health: 1 } },
  { id: "survivor_will", name: "เจตจำนงผู้รอดชีวิต", emoji: "🛡️", desc: "โอกาสรอด +4%", how: "รอดถึงฉากภารกิจหลัก #3 หลังวันสิ้นโลก", earn: (l) => !!l.flags.doomed && n(l, "mainScenario") >= 3, survival: 0.04 },
  { id: "mentor", name: "ครูผู้ให้", emoji: "🎓", desc: "EXP +8%", how: "มีศิษย์หรือเด็กในอุปการะ", earn: (l) => l.people.some((p) => p.alive && /ศิษย์|ทุน|เลี้ยง/.test(p.job ?? "")), exp: 0.08 },
  { id: "warm_heart", name: "หัวใจอบอุ่น", emoji: "💞", desc: "ความสุข +2 ทุกปี", how: "ความผูกพันกับคู่ชีวิตถึง 90", earn: (l) => l.people.some((p) => p.alive && p.relation === "spouse" && p.bond >= 90), yearly: { happiness: 2 } },
  { id: "traveler", name: "นักเดินทาง", emoji: "🧳", desc: "เช็กโชค +4%", how: "ไปเที่ยวรวม 4 ปี", earn: (l) => n(l, "act_trip") >= 4, check: { luck: 0.04 } },
];

PASSIVES.push(...MORE_PASSIVES);

export const passiveById = (id: string) => PASSIVES.find((p) => p.id === id);
export const passivesOf = (l: Life): Passive[] =>
  // โลกสมจริงไม่มี "สกิลติดตัว" แบบเกม — ความชำนาญอยู่ในวิชา/ร่างกายแทน
  l.worldId === "murim" ? [] : String(l.flags.passives ?? "")
    .split(",")
    .filter(Boolean)
    .map((id) => passiveById(id))
    .filter((p): p is Passive => !!p);

/** เพดานผลรวมของสกิลติดตัว (กันสะสมจนเกมพัง) — ผลของพรสวรรค์ไม่นับในเพดาน */
export const PASSIVE_CAP = { cp: 10, survival: 0.08, exp: 0.15, money: 0.3, check: 0.15, yearly: 3 } as const;

export function passiveBonus(l: Life, kind: "cp" | "survival" | "exp" | "money"): number {
  const own = Math.min(PASSIVE_CAP[kind], passivesOf(l).reduce((s, p) => s + (p[kind] ?? 0), 0));
  // รวมผลของพรสวรรค์ที่เปิดเผยแล้วด้วย
  return own + activeTalents(l).reduce((s, t) => s + (t[kind] ?? 0), 0);
}

export function passiveCheck(l: Life, stat: StatKey): number {
  const own = Math.min(PASSIVE_CAP.check, passivesOf(l).reduce((s, p) => s + (p.check?.[stat] ?? 0), 0));
  return own + activeTalents(l).reduce((s, t) => s + (t.c?.[stat] ?? 0), 0);
}

/** สกิลติดตัวที่เพิ่งได้ (ยังไม่มีในรายการ) — ผู้เรียกเป็นคนบันทึก log */
export function newPassives(l: Life): Passive[] {
  if (l.worldId === "murim") return [];
  const owned = String(l.flags.passives ?? "").split(",").filter(Boolean);
  const fresh = PASSIVES.filter((p) => !owned.includes(p.id) && p.earn(l));
  if (fresh.length) l.flags.passives = [...owned, ...fresh.map((p) => p.id)].join(",");
  return fresh;
}
