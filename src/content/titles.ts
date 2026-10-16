// ฉายา: ได้จากเหตุการณ์ในชีวิต ใส่ได้ทีละ 1 อัน และมีโบนัสเล็กน้อย
// (ห้าม import content/hunter/power — power.ts อ่านโบนัสจากไฟล์นี้)
import type { Life } from "../engine/types";
import { log } from "../engine/util";

export type TitleBonus = "cp" | "survival" | "exp" | "money" | "happiness";

export interface Title {
  id: string;
  name: string;
  desc: string;
  bonus: TitleBonus;
  value: number;
  has: (l: Life) => boolean;
}

const rank = (l: Life) => l.power?.rank ?? -1;

export const TITLES: Title[] = [
  { id: "regressor", name: "ผู้ย้อนเวลา", desc: "EXP +10%", bonus: "exp", value: 0.1, has: (l) => (l.regressions ?? 0) >= 1 },
  { id: "late", name: "ผู้ตื่นช้าแต่ไม่แพ้ใคร", desc: "EXP +8%", bonus: "exp", value: 0.08, has: (l) => !!l.flags.lateBloom },
  { id: "chosen", name: "ผู้ถูกเลือก", desc: "พลังต่อสู้ +3", bonus: "cp", value: 3, has: (l) => !!l.flags.sssAwakened },
  { id: "boss_hunter", name: "นักล่าบอส", desc: "พลังต่อสู้ +2", bonus: "cp", value: 2, has: (l) => (l.power?.bossKills ?? 0) >= 10 },
  { id: "survivor", name: "ผู้รอดจากความตาย", desc: "อัตรารอด +4%", bonus: "survival", value: 0.04, has: (l) => !!l.flags.secondAwakened || !!l.flags.redGateSurvivor },
  { id: "hero", name: "วีรบุรุษของประชาชน", desc: "อัตรารอด +3%", bonus: "survival", value: 0.03, has: (l) => !!l.flags.gateHero || !!l.flags.savedFamily },
  { id: "avenger", name: "ผู้ชำระแค้น", desc: "พลังต่อสู้ +2", bonus: "cp", value: 2, has: (l) => !!l.flags.revenge },
  { id: "pact", name: "ผู้ทำสัญญา", desc: "พลังต่อสู้ +2", bonus: "cp", value: 2, has: (l) => !!l.flags.pact },
  { id: "peak", name: "จุดสูงสุดของยุค", desc: "พลังต่อสู้ +4", bonus: "cp", value: 4, has: (l) => !!l.flags.arcWon },
  { id: "champion", name: "ยอดฝีมือแห่งยุค", desc: "พลังต่อสู้ +3", bonus: "cp", value: 3, has: (l) => Number(l.flags.champion ?? 0) > 0 },
  { id: "guillotine", name: "ผู้หักกิโยติน", desc: "ความสุขเพิ่มทุกปี", bonus: "happiness", value: 2, has: (l) => !!l.flags.fateDefied },
  { id: "saint", name: "นักบุญแห่งยุค", desc: "อัตรารอด +5%", bonus: "survival", value: 0.05, has: (l) => !!l.flags.saint },
  { id: "rich", name: "เจ้าสัว", desc: "รายได้ +5%", bonus: "money", value: 0.05, has: (l) => l.money - l.debt >= 100_000_000 },
  { id: "lucky", name: "ลูกรักของโชคชะตา", desc: "รายได้ +5%", bonus: "money", value: 0.05, has: (l) => !!l.flags.jackpot },
  { id: "top", name: "ระดับสูงสุดของประเทศ", desc: "พลังต่อสู้ +3", bonus: "cp", value: 3, has: (l) => rank(l) >= 6 },
  { id: "underdog", name: "ผู้ไม่เคยยอมแพ้", desc: "EXP +12%", bonus: "exp", value: 0.12, has: (l) => !!l.power && l.power.rank <= 1 && l.power.level >= 20 },
  { id: "ordinary", name: "คนธรรมดาผู้ยิ่งใหญ่", desc: "ความสุขเพิ่มทุกปี", bonus: "happiness", value: 2, has: (l) => !l.power && l.age >= 40 && l.fame >= 30 },
];

export const titleById = (id?: string | number | boolean) => TITLES.find((t) => t.id === id);

export function titlesOf(l: Life): Title[] {
  return TITLES.filter((t) => t.has(l));
}

/** โบนัสจากฉายาที่ใส่อยู่ */
export function titleBonus(l: Life, kind: TitleBonus): number {
  const t = titleById(l.flags.title as string | undefined);
  return t && t.bonus === kind && t.has(l) ? t.value : 0;
}

/** แจ้งเตือนฉายาใหม่ — และใส่ให้อัตโนมัติถ้ายังไม่มี */
export function checkTitles(l: Life) {
  const seen = String(l.flags.titlesSeen ?? "").split(",").filter(Boolean);
  for (const t of titlesOf(l)) {
    if (seen.includes(t.id)) continue;
    seen.push(t.id);
    log(l, `ได้รับฉายาใหม่:「${t.name}」(${t.desc})`, "system");
    if (!l.flags.title) l.flags.title = t.id;
  }
  l.flags.titlesSeen = seen.join(",");
}
