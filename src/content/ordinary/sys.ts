// ระบบชีวิต (โลกธรรมดา): ค่าสถานะแบบเกม เลเวล แต้มแจก การฝึก ภารกิจรายวัน
import type { Outcome } from "../../engine/events";
import { yearHooks } from "../../engine/game";
import { chance, pick, randInt } from "../../engine/rng";
import type { Life, SysStat } from "../../engine/types";
import { addStat, log } from "../../engine/util";
import { SYS_INFO, SYS_SKILLS, SYS_STATS, baseSys, effSys, sysSkillsOf } from "../gameStats";

export const SYS_CAP = 100;
export const TRAININGS_PER_YEAR = 2;
export const sysExpToNext = (level: number) => 100 + level * 50;

export function initSys(l: Life) {
  l.sys = { level: 1, exp: 0, points: 5, str: 0, agi: 0, sta: 0, int: 0, cha: 0, luk: 0 };
  for (const k of SYS_STATS) l.sys[k] = baseSys(l, k);
  l.flags.awakenDone = true;
}

export function gainSysExp(l: Life, n: number) {
  const s = l.sys;
  if (!s) return;
  s.exp += Math.round(n);
  const before = s.level;
  while (s.exp >= sysExpToNext(s.level)) {
    s.exp -= sysExpToNext(s.level);
    s.level++;
    s.points += 3;
  }
  if (s.level > before) log(l, `[ระบบ] เลเวลอัป! Lv.${before} → Lv.${s.level} — ได้แต้มสถานะ +${(s.level - before) * 3}`, "system");
}

function raise(l: Life, k: SysStat, n: number) {
  const s = l.sys!;
  s[k] = Math.min(SYS_CAP, Math.max(s[k], baseSys(l, k)) + n);
}

/** แจกแต้มสถานะ 1 แต้ม */
export function allocate(l: Life, k: SysStat): Outcome | undefined {
  const s = l.sys;
  if (!s || s.points <= 0 || s[k] >= SYS_CAP) return;
  s.points--;
  raise(l, k, 1);
  checkSysSkills(l);
  return;
}

export const trainingsLeft = (l: Life) => TRAININGS_PER_YEAR - l.doneThisYear.filter((x) => x === "systrain").length;

const TRAIN_TEXT: Record<SysStat, string[]> = {
  str: ["ยกเหล็กตามเมนูที่ระบบจัดให้จนแขนสั่น", "วิดพื้นห้าร้อยครั้งตามภารกิจระบบ"],
  agi: ["วิ่งหลบกรวยเป็นชั่วโมงในสวนสาธารณะ", "ฝึกรีแอคชันกับเครื่องยิงลูกเทนนิส"],
  sta: ["วิ่งมาราธอนรอบเมืองทุกเช้า", "ว่ายน้ำจนหายใจไม่ทัน แล้วว่ายต่ออีกสิบรอบ"],
  int: ["อ่านตำราที่ระบบแนะนำวันละสามเล่ม", "แก้โจทย์ที่ระบบสุ่มให้จนตีสาม"],
  cha: ["ซ้อมพูดหน้ากระจกและเรียนการแสดง", "ไปงานสังคมทุกสัปดาห์ตามภารกิจระบบ"],
  luk: ["ทำความดีวันละสามครั้งตามที่ระบบบอกว่าเพิ่มโชค", "ไหว้ทุกศาลที่เดินผ่าน (ระบบยืนยันว่าได้ผล)"],
};

/** ฝึกตามเมนูระบบ — ปีละ 2 ครั้ง */
export function trainSys(l: Life, k: SysStat): Outcome | undefined {
  if (!l.sys || trainingsLeft(l) <= 0) return;
  l.doneThisYear.push("systrain");
  const n = randInt(l, 2, 4) + (l.sys.level >= 10 ? 1 : 0);
  raise(l, k, n);
  if (k === "str" || k === "sta") addStat(l, "health", 1);
  if (k === "int" && chance(l, 0.5)) addStat(l, "smarts", 1);
  if (k === "cha" && chance(l, 0.4)) addStat(l, "looks", 1);
  addStat(l, "happiness", -1);
  const out = { text: `[ระบบ] ${pick(l, TRAIN_TEXT[k])} — ${SYS_INFO[k].label} +${n}`, kind: "system" as const };
  log(l, out.text, out.kind);
  gainSysExp(l, 40);
  checkSysSkills(l);
  return out;
}

/** ภารกิจรายวันของระบบ — ทำครบทั้งปีได้ EXP และค่าสถานะ */
export function sysDaily(l: Life): Outcome | undefined {
  if (!l.sys || l.doneThisYear.includes("daily")) return;
  l.doneThisYear.push("daily");
  const k = pick(l, SYS_STATS);
  raise(l, k, 1);
  addStat(l, "health", randInt(l, 1, 3));
  const out = { text: `[ภารกิจรายวัน] ทำครบทุกวันตลอดปี — ${SYS_INFO[k].label} +1`, kind: "system" as const };
  log(l, out.text, out.kind);
  gainSysExp(l, 120 + l.sys.level * 10);
  checkSysSkills(l);
  return out;
}

/** สกิลที่ปลดล็อกเมื่อค่าสถานะถึงเกณฑ์ */
export function checkSysSkills(l: Life) {
  if (!l.sys) return;
  const owned = sysSkillsOf(l);
  const fresh = SYS_SKILLS.filter((s) => !owned.includes(s.name) && effSys(l, s.stat) >= s.min);
  if (!fresh.length) return;
  l.flags.sysSkills = [...owned, ...fresh.map((s) => s.name)].join(",");
  for (const s of fresh) log(l, `[ระบบ] ปลดล็อกสกิล「${s.name}」(${SYS_INFO[s.stat].label} ${s.min}+)`, "system");
}

// อายุมากขึ้น ร่างกายถดถอย (ระบบชะลอได้แค่บางส่วน)
yearHooks.push((l) => {
  if (!l.sys) return;
  if (l.age >= 45) for (const k of ["str", "agi", "sta"] as SysStat[]) if (chance(l, 0.4)) l.sys[k] = Math.max(0, l.sys[k] - 1);
  checkSysSkills(l);
});
