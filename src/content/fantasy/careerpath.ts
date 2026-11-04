// เส้นทางอาชีพ: เลื่อนขั้นต้องได้มาด้วยฝีมือ ขั้นสูงสุดต้องสอบเป็นนายใหญ่ หลังจากนั้นเป็นตำนานของอาชีพ
// เกษียณตามอายุขัยของเผ่า มีบำนาญ · กลับมาทำงานเดิมไม่ต้องเริ่มจากศูนย์ · แผนอยู่ที่ design/SYSTEMS_UPDATE.md (Release 2)
import type { GameEvent } from "../../engine/events";
import { jobStartHooks, pensionHooks, promoteGates, retireAgeHooks, runEvent, yearHooks } from "../../engine/game";
import type { Life, StatKey } from "../../engine/types";
import { addFame, clamp, createPerson, log, shortName } from "../../engine/util";
import { careerById, type Career } from "../core/careers";
import { B, BIG, C, E, G, GOLD, K, N, P, PAY } from "./kit";
import { BODY_RANKS, MAGIC_RANKS, fightOdds } from "./power";
import { RACES } from "./life";
import { addStanding, deed, fl } from "./state";
import { workFactors } from "./worklife";

/** อาชีพที่วัดฝีมือด้วยขั้นพลังแทนค่าสถานะ */
const BODY_PATH = new Set(["ft_knight", "ft_soldier", "ft_gladiator", "ft_ranger"]);
const MAGIC_PATH = new Set(["ft_mage", "ft_enchanter", "ft_wandwright"]);
const STAT_NAME: Record<StatKey, string> = { health: "สุขภาพ", happiness: "ความสุข", smarts: "สติปัญญา", looks: "รูปลักษณ์", luck: "โชค" };

const on = (l: Life) => l.worldId === "fantasy" && !!l.ft;
const isFt = (c: Career) => c.world === "fantasy";
export const mastered = (l: Life, id: string) => !!l.flags[`ftMaster_${id}`];

export interface Step { label: string; ok: boolean }
/** สิ่งที่ต้องมีก่อนขึ้นขั้น next · ใช้ทั้งกันการเลื่อนและแสดงในแท็บอาชีพ */
export function stepsFor(l: Life, c: Career, next: number): Step[] {
  const j = l.job;
  const years = j?.careerId === c.id ? j.years : 0;
  const out: Step[] = [{ label: "ผลงานดีเด่น (80 ขึ้นไป)", ok: (j?.performance ?? 0) >= 80 }];
  const f = fl(l);
  const need = (yrs: number, rank: number, stat: number) => {
    out.push({ label: `ทำงานนี้มาแล้ว ${yrs} ปี`, ok: years >= yrs });
    if (BODY_PATH.has(c.id)) out.push({ label: `สายกายถึงขั้น${BODY_RANKS[rank]}`, ok: f.bodyRank >= rank });
    else if (MAGIC_PATH.has(c.id)) out.push({ label: `สายเวทถึงขั้น${MAGIC_RANKS[rank]}`, ok: f.magicRank >= rank });
    else out.push({ label: `${STAT_NAME[c.key]} ${stat} ขึ้นไป`, ok: l.stats[c.key] >= stat });
  };
  if (next === 3) need(3, 1, 45);
  else if (next === 4) need(6, 2, 55);
  else if (next === 5) { need(9, 2, 55); out.push({ label: "ผ่านการสอบเป็นนายใหญ่ของอาชีพ", ok: mastered(l, c.id) }); }
  return out;
}
const blocked = (l: Life, c: Career, next: number) => stepsFor(l, c, next).slice(1).find((s) => !s.ok)?.label;
export const canRise = (l: Life) => { const j = l.job; const c = j && careerById(j.careerId); return !!c && j!.level < 5 && !blocked(l, c, j!.level + 1); };

/** อายุเกษียณตามเผ่า · เลือกทำต่อได้ทีละห้าปี */
export const retireAge = (l: Life) => Number(l.flags.ftRetireAt ?? 60 + RACES[fl(l).race].younger);

function careerYear(l: Life) {
  if (!on(l) || !l.alive) return;
  const j = l.job;
  if (!j) return;
  const c = careerById(j.careerId)!;
  const key = `ftBest_${c.id}`;
  const before = Number(l.flags[key] ?? 0);
  if (j.level > before) {
    l.flags[key] = j.level;
    // ขั้นสำคัญของอาชีพ: ชื่อเริ่มเป็นที่รู้จัก และขั้นสูงสุดเป็นเรื่องที่ทำไว้ในชีวิต
    if (j.level === 3 && before < 3) { addFame(l, 2); addStanding(l, 1); log(l, `ตำแหน่ง${c.titles[2]}ทำให้คนในวงการ${c.name}เริ่มรู้จักชื่อคุณ`, "good"); }
    if (j.level === 5 && before < 5) { addFame(l, 5); deed(l, `${c.titles[4]}แห่งวงการ${c.name}`); }
  }
  if (l.queue.length > 2) return;
  const age = l.age;
  // การสอบเป็นนายใหญ่: ขั้นสี่ที่พร้อมแล้ว · สอบตกรอสองปี
  if (j.level === 4 && !mastered(l, c.id) && j.performance >= 75 && !stepsFor(l, c, 5).slice(1, -1).some((s) => !s.ok) && age - Number(l.flags.ftTrialAt ?? -9) >= 2) {
    l.flags.ftTrialAt = age; runEvent(l, "ft.cp.trial"); return;
  }
  // ตำนานของอาชีพ: เป็นนายใหญ่มาสี่ปี ครั้งเดียวในชีวิต
  if (j.level === 5 && !l.flags.ftLegacyDone && Number(l.flags.ftMasterAge ?? age) <= age - 4) { l.flags.ftLegacyDone = true; runEvent(l, "ft.cp.legacy"); return; }
  // ใกล้เกษียณ: ถามก่อนหนึ่งปี
  if (age === retireAge(l) - 1 && l.flags.ftRetireAsked !== age) { l.flags.ftRetireAsked = age; runEvent(l, "ft.cp.retire"); }
}

const jobName = (l: Life) => (l.job ? careerById(l.job.careerId)!.name : "อาชีพนี้");
const topTitle = (l: Life) => (l.job ? careerById(l.job.careerId)!.titles[4] : "นายใหญ่");
const pass = (l: Life) => {
  const j = l.job!;
  l.flags[`ftMaster_${j.careerId}`] = true; l.flags.ftMasterAge = l.age;
  j.level = 5; j.performance = 60;
  log(l, `คุณได้เป็น "${topTitle(l)}"`, "milestone");
};
const fail = (l: Life) => { if (l.job) l.job.performance = clamp(l.job.performance - 10, 0, 100); };
/** ทักษะที่ใช้สอบ: นักสู้ใช้การต่อสู้ นักเวทใช้ขั้นเวท อาชีพอื่นใช้ค่าสถานะหลัก */
const trialOdds = (l: Life) => {
  const c = l.job && careerById(l.job.careerId);
  if (!c) return 0.3;
  if (BODY_PATH.has(c.id)) return fightOdds(l, 34);
  if (MAGIC_PATH.has(c.id)) return clamp(0.3 + fl(l).magicRank * 0.12 + (l.stats.smarts - 50) / 200, 0.1, 0.9);
  return clamp(0.3 + (l.stats[c.key] - 50) / 100 + (l.job!.performance - 75) / 100, 0.1, 0.9);
};
const support = (l: Life) => clamp(0.35 + workFactors(l).reduce((s, x) => s + x.value, 0) / 25, 0.1, 0.85);

const TRIAL: GameEvent = {
  ...E("ft.cp.trial", [14, 900], (l) => `สมาคม${jobName(l)}แห่งแผ่นดินเปิดการสอบเลือก${topTitle(l)}คนใหม่ ทุกคนในวงการมาดูว่าคุณจะผ่านหรือไม่`, [
    P("แสดงฝีมือต่อหน้ากรรมการ", trialOdds, BIG((l) => `กรรมการลุกขึ้นยืนทั้งแถว คุณคือ${topTitle(l)}คนใหม่`, { fame: 4 }, pass), B("มือคุณพลาดในจังหวะที่สำคัญที่สุด กรรมการขอให้กลับมาใหม่ในสองปี", { joy: -6 }, fail)),
    P("ให้คนในวงการรับรองผลงานที่ผ่านมา", support, BIG("เจ้านายและเพื่อนร่วมงานยืนยันชื่อคุณทีละคน สมาคมไม่มีข้อสงสัย", { fame: 3 }, pass), N("เสียงรับรองไม่พอ กรรมการบอกว่าคุณยังต้องสร้างคนรอบตัวอีกหน่อย", { joy: -4 }, fail)),
    P("สร้างผลงานชิ้นเอกมาให้สมาคมดู (60 เหรียญทอง)", (l) => trialOdds(l) + 0.15,
      BIG("ผลงานชิ้นนั้นถูกแขวนไว้ในหอของสมาคมจนทุกวันนี้", { fame: 6, gold: -60 }, pass),
      B("ผลงานดี แต่ยังไม่ถึงขั้นชิ้นเอก เงินที่ลงไปหายไปกับมัน", { joy: -5, gold: -60 }, fail),
      { req: (l) => (l.money < 60 * GOLD ? "ต้องมี 60 เหรียญทอง" : undefined), cons: "ถ้าไม่ผ่าน เงินที่ลงไปจะหายไปด้วย" }),
    C("ยังไม่พร้อม ขอสอบรอบหน้า", N("คุณกลับไปฝึกต่ออีกสองปี")),
  ], { title: "สอบเป็นนายใหญ่", forced: true }),
  manual: true,
};

const LEGACY: GameEvent = {
  ...E("ft.cp.legacy", [14, 900], (l) => `คุณเป็น${topTitle(l)}มาหลายปี คนรุ่นใหม่ในวงการ${jobName(l)}เรียกชื่อคุณเหมือนชื่อในตำนาน คุณอยากทิ้งอะไรไว้ให้อาชีพนี้`, [
    C("รับลูกศิษย์สืบทอดวิชา", BIG((l) => `ลูกศิษย์ของคุณจะสืบงาน${jobName(l)}ต่อไปหลังคุณ`, { joy: 6 }, (l) => {
      const p = createPerson(l, "ally", { age: Math.max(16, l.age - 25), bond: 70 });
      p.job = `ลูกศิษย์${topTitle(l)}`; p.tags = [...(p.tags ?? []), "apprentice"];
      deed(l, `รับ${shortName(p)}เป็นศิษย์สืบทอดวิชา${jobName(l)}`);
    }), { mark: "ลูกศิษย์เป็นคนสำคัญในชีวิตคุณ" }),
    PAY("เปิดสำนักของตัวเอง", 120, BIG("ป้ายสำนักแขวนขึ้นกลางเมือง คนมาสมัครเรียนตั้งแต่วันแรก", { fame: 4 }, (l) => { l.flags.ftHall = 1; deed(l, `เปิดสำนัก${jobName(l)}ของตัวเอง`); }), { mark: "ได้ 15 เหรียญทองทุกปี", cons: "ลงทุนก้อนใหญ่" }),
    K("เขียนตำราของอาชีพนี้", "smarts", 50, BIG("ตำราของคุณถูกคัดลอกไปทุกหอสมุดในแผ่นดิน", { fame: 8, iq: 2 }, (l) => deed(l, `เขียนตำรา${jobName(l)}ที่ทุกคนในวงการต้องอ่าน`)), N("ตำราของคุณมีคนอ่าน แต่ยังไม่ถึงกับเป็นตำนาน", { fame: 2 })),
  ], { title: "ตำนานของอาชีพ", forced: true }),
  manual: true,
};

const RETIRE: GameEvent = {
  ...E("ft.cp.retire", [14, 900], (l) => `ปีหน้าคุณจะถึงวัยเกษียณจากงาน${jobName(l)} ร่างกายยัง${l.stats.health >= 50 ? "ไหว" : "พอไหว แต่เริ่มบ่น"}`, [
    C("เกษียณตามกำหนด", G("คุณเริ่มนับวันที่จะได้ตื่นสายโดยไม่มีใครตาม", { joy: 3 })),
    C("ทำต่ออีกห้าปี", N("เจ้านายดีใจ และคุณก็ยังไม่อยากวางมือ", {}, (l) => { l.flags.ftRetireAt = retireAge(l) + 5; }), { cons: "เหนื่อยกว่าเดิม และบำนาญจะเริ่มช้าลง" }),
  ], { title: "ใกล้วัยเกษียณ", forced: true }),
  manual: true,
};

export const CAREER_PATH_EVENTS: GameEvent[] = [TRIAL, LEGACY, RETIRE];

export function loadCareerPath() {
  promoteGates.push((l, c, next) => (on(l) && isFt(c) ? blocked(l, c, next) : undefined));
  retireAgeHooks.push((l) => (on(l) ? retireAge(l) : undefined));
  pensionHooks.push((l, c, pay) => {
    if (!on(l) || !isFt(c) || !l.job) return undefined;
    const lv = l.job.level;
    const rate = lv >= 5 ? (mastered(l, c.id) ? 0.5 : 0.4) : lv >= 3 ? 0.25 : 0.1;
    return Math.round(pay * rate);
  });
  // กลับมาทำงานเดิมเริ่มต่ำกว่าขั้นที่เคยถึงหนึ่งขั้น · เคยเป็นขั้นสี่ขึ้นไปในอาชีพที่ใช้ค่าสถานะเดียวกัน เริ่มขั้นสอง
  jobStartHooks.push((l) => {
    if (!on(l) || !l.job) return;
    const c = careerById(l.job.careerId)!;
    const same = Number(l.flags[`ftBest_${c.id}`] ?? 0);
    const kin = Math.max(0, ...Object.keys(l.flags).filter((k) => k.startsWith("ftBest_") && k !== `ftBest_${c.id}`).map((k) => (careerById(k.slice(7))?.key === c.key ? Number(l.flags[k]) : 0)));
    const start = clamp(Math.max(same - 1, kin >= 4 ? 2 : 1), 1, 4);
    if (start > 1) { l.job.level = start; log(l, `ประสบการณ์เดิมทำให้คุณเริ่มที่ตำแหน่ง${c.titles[start - 1]} ไม่ต้องเริ่มจากศูนย์`, "good"); }
  });
  yearHooks.push(careerYear);
}
