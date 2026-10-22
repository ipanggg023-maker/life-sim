import { CAREERS, careerById, facultyById } from "../content/hunter/careers";
import { HIDDEN_RARITY_ODDS, RARITY_ODDS, TALENTS, talentById, talentFlavor } from "../content/talents";
import { currentScene, getEvent, pickEvents, stillValid, type Choice, type Ctx, type Outcome } from "./events";
import { chance, newSeed, nextFloat, pick, randInt, weightedPick } from "./rng";
import type { Career } from "../content/hunter/careers";
import type { Country, Faculty, Gender, SysStat, Legacy, Life, PastLife, Person, QueuedEvent, Rarity, Stats, Wealth, WorldId } from "./types";
import { isRealistic, worldMatches, worldOf } from "../content/worlds";
import { feel, relOf, remember } from "./npc";
import { birthplaceOf } from "../content/murim/life/region";
import { SAVE_VERSION, repairLife } from "./validate";

/** ระบบความรู้สึกหลายแกนของ NPC ใช้เฉพาะโลกสมจริง (โลกอื่นใช้ความสนิทแบบเดิม) */
const npcOn = (l: Life) => isRealistic(l.worldId);
import { countryOf } from "../content/countries";
import { rollAwakenTrack } from "../content/hunter/power";
import { awakenArc, birthArc, maybeComment, seriesOf, startChapter } from "../content/manhwa";
import { checkTitles, titleBonus } from "../content/titles";
import { sponsorBonus } from "../content/sponsors";
import { passiveBonus } from "../content/passives";
import { SYS_INFO, effSys, sysAs100 } from "../content/gameStats";
import {
  addFame,
  addMoney,
  addStat,
  checkChance,
  clamp,
  createPerson,
  displayName,
  firstPerson,
  money,
  hasTalent,
  log,
  people,
  randomName,
  shortName,
} from "./util";

// ───────────────────────── การเกิด ─────────────────────────

export interface BirthOptions {
  seed?: number;
  gender?: Gender;
  firstName?: string;
  lastName?: string;
  wealth?: Wealth;
  stats?: Partial<Stats>;
  talents?: string[];
  worldId?: WorldId;
  // ── ระบบวิญญาณ ──
  worldSeed?: number;
  birthYear?: number;
  legacy?: Legacy;
  /** พรแห่งโชค: เพิ่มโอกาสได้พรสวรรค์หายาก */
  blessed?: boolean;
  /** พรสวรรค์ที่ผนึกติดตัวมาจากชาติก่อน */
  inheritTalent?: string;
  /** ประเทศที่เกิด (โลกยุคปัจจุบัน) — ไม่ใส่ = สุ่ม ไทย/เกาหลี/ญี่ปุ่น */
  country?: Country;
  /** วิญญาณข้ามโลก: ชาติก่อนมาจากโลกอื่น */
  pastLife?: PastSelf;
}

export interface PastSelf {
  world: WorldId;
  name: string;
  age: number;
  rank?: number;
  skill?: string;
}

/** สรุปตัวตนชาติก่อนสำหรับเกิดข้ามโลก */
export const pastSelfOf = (l: Life): PastSelf => ({
  world: l.worldId,
  name: displayName(l),
  age: l.age,
  rank: l.power?.rank,
  skill: l.power?.skills[l.power.skills.length - 1],
});

const BLESSED_ODDS: Record<Rarity, number> = { common: 0.35, rare: 0.42, legendary: 0.18, divine: 0.05, mythic: 0.001 };
const BLESSED_HIDDEN: Record<Rarity, number> = { common: 0.15, rare: 0.45, legendary: 0.3, divine: 0.1, mythic: 0.003 };

function rollRarity(life: Life, odds: Record<Rarity, number>): Rarity {
  const order: Rarity[] = ["mythic", "divine", "legendary", "rare", "common"];
  return weightedPick(life, order, (r) => odds[r])!;
}

function rollTalent(life: Life, odds: Record<Rarity, number>, exclude: string[], allowPower: boolean): string {
  const rarity = rollRarity(life, odds);
  const ok = (t: (typeof TALENTS)[number]) => !exclude.includes(t.id) && (allowPower || !t.power);
  const pool = TALENTS.filter((t) => t.rarity === rarity && ok(t));
  const fallback = TALENTS.filter(ok);
  return pick(life, pool.length ? pool : fallback).id;
}

export function revealTalent(life: Life, id: string) {
  const t = life.talents.find((x) => x.id === id);
  const info = talentById(id);
  if (!t || t.revealed || !info) return;
  t.revealed = true;
  info.apply?.(life);
}

export const wealthLabel = (w: Wealth, world?: WorldId) => worldOf(world).wealthLabel[w];

const parentJobs = (l: Life) => (l.country && countryOf(l.country).parentJobs?.[l.wealth]) || worldOf(l.worldId).parentJobs[l.wealth];

export function createLife(opts: BirthOptions = {}): Life {
  const seed = opts.seed ?? newSeed();
  const life: Life = {
    version: 1,
    sv: SAVE_VERSION,
    id: "",
    worldId: opts.worldId ?? "hunter",
    seed,
    rng: seed,
    firstName: "",
    nickname: "",
    lastName: "",
    gender: "m",
    birthYear: opts.birthYear ?? worldOf(opts.worldId).startYear,
    age: 0,
    alive: true,
    stats: { health: 0, happiness: 0, smarts: 0, looks: 0, luck: 0 },
    money: 0,
    debt: 0,
    fame: 0,
    wealth: "middle",
    talents: [],
    people: [],
    education: { stage: "none", grade: 50, highSchoolDone: false },
    flags: {},
    seen: {},
    doneThisYear: [],
    log: [],
    queue: [],
  };
  life.id = Math.floor(nextFloat(life) * 1e12).toString(36);
  life.worldSeed = opts.worldSeed ?? seed;
  // ประเทศสุ่มจาก RNG แยก เพื่อไม่ให้ชะตาส่วนอื่นของ seed เดิมเปลี่ยน
  if (worldOf(life.worldId).modern) {
    life.country = opts.country ?? weightedPick({ rng: seed ^ 0x5bd1e995 }, ["th", "kr", "jp"] as Country[], () => 1)!;
  }
  life.gender = opts.gender ?? (chance(life, 0.5) ? "m" : "f");
  const n = randomName(life, life.gender);
  life.firstName = opts.firstName ?? n.first;
  life.nickname = n.nick;
  life.lastName = opts.lastName ?? n.last;
  life.wealth =
    opts.wealth ??
    weightedPick(life, ["poor", "middle", "rich", "elite"] as Wealth[], (w) =>
      ({ poor: 30, middle: 45, rich: 20, elite: 5 })[w],
    )!;
  // เกิดใหม่ยุคถัดไป: มีโอกาสเกิดเป็นทายาทในตระกูลที่ตัวเองสร้างไว้
  if (opts.legacy) {
    life.legacy = opts.legacy;
    if (!opts.lastName && chance(life, 0.3)) {
      life.lastName = opts.legacy.lastName;
      life.wealth = opts.legacy.wealth;
      life.flags.descendant = true;
    }
  }
  life.stats = {
    health: randInt(life, 55, 95),
    happiness: randInt(life, 50, 90),
    smarts: randInt(life, 15, 80),
    looks: randInt(life, 15, 85),
    luck: randInt(life, 20, 80),
    ...opts.stats,
  };

  // พรสวรรค์: เห็น 1–2 อย่าง + ช่องลับ 1 ช่อง
  const ids: string[] = opts.talents ? [...opts.talents] : [];
  if (!opts.talents) {
    const visible = chance(life, 0.35) ? 2 : 1;
    for (let i = 0; i < visible; i++) ids.push(rollTalent(life, opts.blessed ? BLESSED_ODDS : RARITY_ODDS, ids, false));
  }
  if (opts.inheritTalent && !ids.includes(opts.inheritTalent)) ids.push(opts.inheritTalent);
  for (const id of ids) {
    life.talents.push({ id, revealed: false });
    revealTalent(life, id);
  }
  life.talents.push({ id: rollTalent(life, opts.blessed ? BLESSED_HIDDEN : HIDDEN_RARITY_ODDS, ids, true), revealed: false });
  rollAwakenTrack(life);

  // ครอบครัว
  const dadAge = randInt(life, 24, 42);
  const momAge = clamp(dadAge + randInt(life, -6, 3), 20, 42);
  createPerson(life, "father", { gender: "m", age: dadAge, bond: randInt(life, 55, 90), lastName: life.lastName, job: pick(life, parentJobs(life)) });
  createPerson(life, "mother", { gender: "f", age: momAge, bond: randInt(life, 60, 95), lastName: life.lastName, job: pick(life, parentJobs(life)) });
  const siblings = weightedPick(life, [0, 1, 2], (k) => [45, 40, 15][k])!;
  for (let i = 0; i < siblings; i++) {
    const maxSibAge = Math.max(1, Math.min(10, momAge - 19));
    createPerson(life, "sibling", { age: randInt(life, 1, maxSibAge), bond: randInt(life, 40, 80), lastName: life.lastName });
  }

  birthArc(life);
  log(
    life,
    `คุณเกิดเป็น${life.gender === "m" ? "ผู้ชาย" : "ผู้หญิง"} ชื่อ ${displayName(life)} (ชื่อเรียกในบ้าน "${life.nickname}") ใน${wealthLabel(life.wealth, life.worldId)} ที่${birthplaceOf(life, worldOf(life.worldId).birthplace)}`,
    "milestone",
  );
  const dad = firstPerson(life, "father")!;
  const mom = firstPerson(life, "mother")!;
  log(life, `พ่อของคุณคือ${shortName(dad)} (${dad.job}) อายุ ${dad.age} ปี · แม่ของคุณคือ${shortName(mom)} (${mom.job}) อายุ ${mom.age} ปี`);
  if (opts.inheritTalent) log(life, `พรสวรรค์「${talentById(opts.inheritTalent)?.name}」ที่ผนึกไว้ติดตามวิญญาณคุณมาด้วย`, "system");
  if (life.flags.descendant && opts.legacy) {
    log(life, `คุณเกิดในตระกูล${opts.legacy.lastName} — ทายาทรุ่นที่ ${opts.legacy.generation + 1} ของ${opts.legacy.founderName}… ซึ่งก็คือตัวคุณเองในชาติก่อน`, "system");
  }
  if (opts.pastLife && opts.pastLife.world !== life.worldId) {
    const p = opts.pastLife;
    life.flags.pastWorld = p.world;
    life.flags.pastName = p.name;
    if (p.rank !== undefined) life.flags.pastRank = p.rank;
    if (p.skill) life.flags.pastSkill = p.skill;
  }
  if (opts.stats || opts.talents || opts.wealth) life.devCreated = true;
  return life;
}

// ───────────────────────── +1 ปี ─────────────────────────


export function kill(life: Life, cause: string) {
  if (!life.alive) return;
  life.alive = false;
  life.causeOfDeath = cause;
  life.queue = [];
  log(life, `คุณเสียชีวิตเมื่ออายุ ${life.age} ปี — สาเหตุ: ${cause}`, "bad");
}

function mortality(age: number, health: number) {
  let p = 0.0005 + Math.max(0, age - 55) ** 2 * 0.00012;
  if (health < 25) p += (25 - health) / 90;
  return p;
}

function ageHealth(life: Life) {
  const a = life.age;
  let d = 0;
  if (a < 30) d = randInt(life, -1, 2);
  else if (a < 50) d = -randInt(life, 0, 2);
  else if (a < 70) d = -randInt(life, 1, 4);
  else d = -randInt(life, 2, 6);
  if (d < 0 && hasTalent(life, "sturdy")) d = Math.ceil(d / 2);
  if (life.flags.pact && a >= 20) d -= randInt(life, 1, 3); // ราคาของสัญญา: อายุขัยถูกกัดกิน
  if (a >= 30 && hasTalent(life, "cursed_body")) {
    d -= randInt(life, 4, 9);
    if (a === 30) log(life, "คำสาปในร่างกายเริ่มกัดกิน… เส้นเลือดดำปูดขึ้นตามแขน", "bad");
  }
  addStat(life, "health", d);
  if (a > 35 && !hasTalent(life, "protagonist_face")) addStat(life, "looks", -randInt(life, 0, 1));
  // ความสุขค่อยๆ กลับเข้าหา 55
  const h = life.stats.happiness;
  if (h > 60) addStat(life, "happiness", -randInt(life, 0, 3));
  if (h < 50) addStat(life, "happiness", randInt(life, 0, hasTalent(life, "optimist") ? 5 : 3));
}

function progressSchool(life: Life) {
  const ed = life.education;
  const a = life.age;
  // เกรดค่อยๆ เข้าหาระดับสติปัญญา (ไม่พุ่งเต็มเองทุกคน) · ตั้งใจเรียนช่วยดันได้ทีละปี
  const gradeDrift = (life.stats.smarts - 5 - life.education.grade) / 5 + randInt(life, -6, 6) + (hasTalent(life, "diligent") ? 3 : 0);

  if (a === 3) { ed.stage = "kinder"; log(life, "คุณเริ่มเข้าโรงเรียนอนุบาล"); }
  else if (a === 6) { ed.stage = "primary"; ed.grade = clamp(life.stats.smarts - 10, 0, 100); log(life, "คุณขึ้นชั้นประถมศึกษาปีที่ 1"); }
  else if (a === 12) { ed.stage = "secondary"; log(life, "คุณเข้าเรียนมัธยมต้น", "milestone"); }
  else if (a === 15) { ed.stage = "high"; log(life, "คุณขึ้นมัธยมปลาย", "milestone"); }
  else if (a === 18 && ed.stage === "high") {
    ed.stage = "done";
    ed.highSchoolDone = true;
    log(life, `คุณจบ ม.6 ด้วยเกรดเฉลี่ย ${gradeToGpa(ed.grade)}`, "milestone");
  }

  if (ed.stage === "primary" || ed.stage === "secondary" || ed.stage === "high") {
    ed.grade = clamp(ed.grade + gradeDrift, 0, 100);
    if (life.stats.smarts < 95 && chance(life, 0.5)) addStat(life, "smarts", 1);
  }

  if (ed.stage === "university" && ed.faculty) {
    const fac = facultyById(ed.faculty);
    ed.grade = clamp(ed.grade + gradeDrift, 0, 100);
    if (life.wealth === "poor") {
      life.debt += fac.tuition + 50_000;
    }
    ed.uniYearsLeft = (ed.uniYearsLeft ?? fac.years) - 1;
    if (ed.uniYearsLeft <= 0) {
      if (ed.grade >= 25) {
        ed.degree = ed.faculty;
        ed.stage = "done";
        log(life, `🎓 คุณจบปริญญาตรีคณะ${fac.name} เกรดเฉลี่ย ${gradeToGpa(ed.grade)}`, "milestone");
        addStat(life, "happiness", 10);
      } else {
        ed.uniYearsLeft = 1;
        log(life, "เกรดคุณไม่ถึงเกณฑ์ ต้องเรียนต่ออีกปี", "bad");
      }
    }
  }
}

export function gradeToGpa(grade: number) {
  return (clamp(grade, 0, 100) / 25).toFixed(2);
}

export function salaryOf(life: Life, career: Career, level: number) {
  let base = career.baseSalary * (1 + 0.35 * (level - 1));
  if (career.salary) base = career.salary(life, base);
  if (hasTalent(life, "merchant")) base *= 1.25;
  base *= 1 + titleBonus(life, "money") + sponsorBonus(life, "money") + passiveBonus(life, "money");
  // กิจการที่ขยายด้วยงานเฉพาะอาชีพ (ที่นา เรือ สาขา ห้องพัก ลูกศิษย์) — รายได้เพิ่ม 15% ต่อขั้น
  base *= 1 + Number(life.flags[`jobUp_${career.id}`] ?? 0) * 0.15;
  if (isStudent(life)) base *= 0.4;
  if (life.flags.doomed && !life.flags.rebuilt && !career.needsPower) base *= 0.3;
  return Math.round(base / 1000) * 1000;
}

export function isStudent(life: Life) {
  const s = life.education.stage;
  return s !== "none" && s !== "done";
}

function progressJob(life: Life) {
  const job = life.job;
  if (!job) return;
  const career = careerById(job.careerId)!;
  const pay = salaryOf(life, career, job.level);
  addMoney(life, pay);
  life.flags.income = pay;
  job.years++;
  job.performance = clamp(
    job.performance + ((career.sys ? sysAs100(effSys(life, career.sys.main)) : life.stats[career.key]) - 50) / 10 + randInt(life, -8, 8) + (hasTalent(life, "diligent") ? 5 : 0),
    0,
    100,
  );
  if (career.id === "streamer" || career.id === "seller") {
    if (chance(life, 0.3)) addFame(life, randInt(life, 1, 5));
  }
  if (job.performance >= 80 && job.level < 5 && chance(life, 0.6)) {
    job.level++;
    job.performance = 50;
    log(life, `🎉 คุณได้เลื่อนตำแหน่งเป็น "${career.titles[job.level - 1]}"`, "good");
    addStat(life, "happiness", 8);
  } else if (job.performance < 15 && chance(life, 0.5)) {
    log(life, `คุณโดนไล่ออกจากตำแหน่ง${career.titles[job.level - 1]} เพราะผลงานแย่`, "bad");
    life.job = undefined;
    addStat(life, "happiness", -15);
  }
  if (life.job && life.age >= 60 && !["seller", "streamer"].includes(career.id)) {
    const pension = ["police", "teacher"].includes(career.id) ? Math.round(pay * 0.4) : 0;
    life.flags.pension = pension;
    life.job = undefined;
    log(life, `คุณเกษียณจากงาน${career.name}${pension ? ` ได้บำนาญปีละ ${money(life, pension)}` : ""}`, "milestone");
  }
}

function progressMoney(life: Life) {
  // นักศึกษา: ครอบครัวจ่ายให้ หรือกู้ กยศ. (บวกหนี้ใน progressSchool แล้ว)
  if (life.age < 18 || isStudent(life)) return;
  const pension = Number(life.flags.pension ?? 0);
  if (pension) addMoney(life, pension);
  const kids = people(life, "child").filter((c) => c.age < 18).length;
  // รายได้มากขึ้น ใช้จ่ายมากขึ้น (ค่าเช่า กินเที่ยว ภาษี)
  const income = Number(life.flags.income ?? 0) + pension;
  // หลังวันสิ้นโลกไม่มีค่าเช่า ไม่มีห้าง — ใช้จ่ายแค่ของจำเป็น
  const ruins = life.flags.doomed && !life.flags.rebuilt;
  const living = ruins ? 30_000 + kids * 15_000 : 84_000 + kids * 60_000 + Math.round(income * 0.4);
  addMoney(life, -living);
  if (life.debt > 0 && life.money > 0) {
    const pay = Math.min(life.debt, Math.round(life.money * 0.3));
    life.debt -= pay;
    addMoney(life, -pay);
    if (life.debt === 0) log(life, "คุณใช้หนี้หมดแล้ว! รู้สึกเบาหวิว", "good");
  }
  if (life.money < 0) {
    addStat(life, "happiness", -6);
    if (chance(life, 0.3)) log(life, "เงินไม่พอใช้ คุณต้องกู้นอกระบบมาจ่ายค่าเช่า", "bad");
  }
}

const INHERITANCE: Record<Wealth, number> = { poor: 20_000, middle: 800_000, rich: 12_000_000, elite: 400_000_000 };

function progressPeople(life: Life) {
  for (const p of life.people) {
    if (!p.alive) continue;
    p.age++;
    if (p.relation === "friend" || p.relation === "partner") p.bond = clamp(p.bond - randInt(life, 1, 4), 0, 100);
    if (p.relation === "spouse") p.bond = clamp(p.bond - randInt(life, 0, 2), 0, 100);
    if (chance(life, mortality(p.age, 70) * (p.age > 60 ? 1.2 : 0.5))) {
      p.alive = false;
      for (const h of kinDeathHooks) h(life, p, false);
      if (["father", "mother", "spouse", "child", "sibling"].includes(p.relation)) {
        log(life, `💔 ${shortName(p)} (${p.relation === "father" ? "พ่อ" : p.relation === "mother" ? "แม่" : "คนในครอบครัว"}) เสียชีวิตแล้วในวัย ${p.age} ปี`, "bad");
        addStat(life, "happiness", -randInt(life, 10, 25));
        life.flags.lossAge = life.age; // ตัวกระตุ้นพลังจากการสูญเสีย
      } else {
        log(life, `${shortName(p)} เสียชีวิตแล้วในวัย ${p.age} ปี`, "bad");
      }
    }
  }
  // มรดกเมื่อพ่อแม่จากไปทั้งคู่
  const parentsAlive = life.people.some((p) => (p.relation === "father" || p.relation === "mother") && p.alive);
  if (!parentsAlive && !life.flags.inherited) {
    life.flags.inherited = true;
    const heirs = 1 + people(life, "sibling").length;
    const amount = Math.round(INHERITANCE[life.wealth] / heirs);
    addMoney(life, amount);
    log(life, `คุณได้รับมรดกจากพ่อแม่ ${money(life, amount)}`, "milestone");
  }
  // เพื่อนที่ห่างกันจนหมดความสัมพันธ์
  for (const p of life.people) {
    if (p.alive && p.relation === "friend" && p.bond <= 0) {
      p.alive = false;
      log(life, `คุณกับ${shortName(p)}ห่างกันจนไม่ได้คุยกันอีกเลย`);
    }
  }
  // แฟนบอกเลิกเมื่อความสัมพันธ์ต่ำ
  for (const p of people(life, "partner")) {
    if (p.bond < 15 && chance(life, 0.5)) {
      life.people = life.people.filter((x) => x.id !== p.id);
      log(life, `${shortName(p)} บอกเลิกคุณ "เราไปกันต่อไม่ได้แล้วล่ะ"`, "bad");
      addStat(life, "happiness", -12);
    }
  }
}

/**
 * เปิดช่องลับ ??? — ปกติเปิดตอนตื่นพลัง (ดู awaken)
 * ถ้าไม่ตื่นพลังจะเปิดเองตอนอายุ 21 หรือเมื่อเฉียดตาย
 */
export function openHiddenSlot(life: Life, reason: string) {
  const hidden = life.talents.find((t) => !t.revealed);
  if (!hidden) return;
  revealTalent(life, hidden.id);
  const info = talentById(hidden.id)!;
  if (isRealistic(life.worldId)) log(life, `${reason === "ตรวจพบภาวะใกล้ตาย" ? "หลังรอดจากความตาย" : reason === "ครบเงื่อนไขอายุ" ? "เมื่อโตเต็มวัย" : reason} คุณค้นพบสิ่งที่ซ่อนอยู่ในตัวเอง: 「${info.name}」 — ${talentFlavor(info.desc)}`, "good");
  else log(life, `${reason} — ช่องลับถูกปลดล็อก: 「${info.name}」 (${info.desc})`, "system");
}

function checkHiddenTalent(life: Life) {
  if (!life.alive) return;
  if (life.stats.health <= 10) {
    life.flags.nearDeath = true;
    openHiddenSlot(life, "ตรวจพบภาวะใกล้ตาย");
  }
  else if (life.age === 21 && !life.power) openHiddenSlot(life, "ครบเงื่อนไขอายุ");
}

/** แปลง Outcome หรือ auto ของ event ให้เป็นบันทึกชีวิต */
export function runEvent(life: Life, eventId: string, ctx: Ctx = {}, prepared = false) {
  const e = getEvent(eventId)!;
  // ฉากที่เลือกเป้าหมายเอง (prepare) ต้องได้ ctx ด้วย แม้จะเปิดจากปุ่ม — ctx ที่ส่งมาชนะ
  if (e.prepare && !prepared && Object.keys(ctx).length === 0) ctx = e.prepare(life);
  life.seen[eventId] = (life.seen[eventId] ?? 0) + 1;
  if (e.choices?.length) {
    life.queue.push({ eventId, ctx });
  } else {
    if (e.title) startChapter(life, e.title);
    const hadPower = !!life.power;
    const kind = e.auto?.(life, ctx) ?? "normal";
    const text = e.text(life, ctx);
    log(life, text, e.system ? "system" : kind);
    if (e.title || kind === "milestone" || e.system) maybeComment(life, text, e.system ? "system" : kind, !hadPower && !!life.power);
  }
}

/** ระบบที่ต้องทำงานทุกปี (เช่น Focus) ลงทะเบียนตรงนี้ — กัน import วนกับ content */
export const yearHooks: Array<(life: Life) => void> = [];
/** ปีที่ "แก่ช้าลง" จากพลัง/วิชา (ลดความเสี่ยงตายตามวัย) */
export const lifespanHooks: Array<(life: Life) => number> = [];
/** เมื่อมีคนรู้จักเสียชีวิต (violent = ถูกฆ่า) — ให้ content ใช้กระตุ้นเรื่องราว เช่น เปลี่ยนเป้าหมายชีวิต */
/** ผลเสริมตามระดับผลลัพธ์ (งดงาม/พลาดหนัก) — คืนข้อความต่อท้าย */
export const rollTierHooks: Array<(life: Life, tier: "great" | "ok" | "fail" | "disaster") => string> = [];
export const kinDeathHooks: Array<(life: Life, p: Person, violent: boolean, killer?: string) => void> = [];

export function ageUp(life: Life) {
  if (!life.alive || life.queue.length) return;
  life.age++;
  life.doneThisYear = [];
  life.flags.income = 0;

  ageHealth(life);
  if (worldOf(life.worldId).modern) progressSchool(life);
  progressJob(life);
  progressMoney(life);
  progressPeople(life);
  for (const hook of yearHooks) hook(life);
  const joy = titleBonus(life, "happiness");
  if (joy) addStat(life, "happiness", joy);

  if (life.age === 18 && !life.flags.allowance) {
    life.flags.allowance = true;
    const gift = { poor: 0, middle: 20_000, rich: 300_000, elite: 5_000_000 }[life.wealth];
    if (gift) {
      addMoney(life, gift);
      log(life, `ครอบครัวให้เงินตั้งตัวคุณ ${money(life, gift)} เป็นของขวัญวันโต`, "good");
    }
  }

  // ขั้นพลังสูงทำให้แก่ช้าลง (ยุทธภพ: จุดสูงสุด +10 ปี … เหนือความเป็นความตาย)
  const younger = lifespanHooks.reduce((s, h) => s + h(life), 0);
  if (chance(life, mortality(life.age - younger, life.stats.health))) {
    const w = worldOf(life.worldId);
    const ruins = life.flags.doomed && !life.flags.rebuilt && w.deathRuins;
    kill(life, ruins ? pick(life, ruins) : life.age < 50 ? pick(life, w.deathYoung) : pick(life, w.deathOld));
    return;
  }

  // ปิดด่าน: ตัดขาดจากโลก — มีแต่เหตุการณ์บังคับ (forced) เท่านั้น
  const secluded = Number(life.flags.secludeUntil ?? 0) > life.age;
  const count = secluded ? 0 : life.age < 3 ? (chance(life, 0.6) ? 1 : 0) : chance(life, 0.45) ? 2 : 1;
  for (const e of pickEvents(life, count)) {
    if (!stillValid(life, e)) continue;
    const ctx = e.prepare?.(life) ?? {};
    runEvent(life, e.id, ctx, true);
    if (!life.alive) return;
  }
  checkHiddenTalent(life);
  checkTitles(life);
}

function oddsOf(life: Life, c: Choice, ctx: Ctx): number | undefined {
  if (c.odds) return clamp(c.odds(life, ctx), 0.01, 0.99);
  if (c.check) return checkChance(life, c.check.stat, c.check.dc, c.check.bonus?.(life, ctx) ?? 0);
  return;
}

/** เซฟเก่า: ทิ้ง event ที่ถูกลบออกจากเกมไปแล้ว (เช่น เนื้อเรื่องยุทธภพชุดเก่า) — กันจอค้าง */
export function migrateLife(life: Life): Life {
  life.queue = life.queue.filter((q) => {
    const e = getEvent(q.eventId);
    return !!e && (!q.scene || q.scene === "start" || !!e.scenes?.[q.scene]);
  });
  repairLife(life);
  // เซฟรุ่นเก่า: เล่นต่อได้จนจบชีวิตนี้ (ระบบใหม่เริ่มนับจากตอนโหลด) — รุ่นถัดไปเกิดเป็นเซฟรุ่นใหม่เต็มตัว
  if ((life.sv ?? 1) < SAVE_VERSION) {
    if (life.worldId === "murim" && life.alive) life.flags.legacySave = life.sv ?? 1;
    life.sv = SAVE_VERSION;
  }
  return life;
}

export function resolveChoice(life: Life, choiceIndex: number): Outcome | undefined {
  const q = life.queue[0];
  if (!q) return;
  const c = currentScene(q, life)!.choices[choiceIndex];
  // ตัวเลือกที่เงื่อนไขยังไม่ครบ (หน้าจอปิดปุ่มไว้แล้ว) — ไม่ทำอะไร
  const missing = c.req?.(life, q.ctx);
  if (missing) return { text: `ทำไม่ได้: ${missing}` };
  // ฉากแรกของ event ที่มีชื่อ = ตอนใหม่ของมังฮวา
  const e = getEvent(q.eventId)!;
  if (!q.scene && e.title && !e.manual) startChapter(life, e.title);
  else if (!q.scene && e.manual && e.title) {
    // ภารกิจ/Gate: ใช้ชื่อในวงเล็บ【】จากข้อความ เช่น "บุก Gate: ถ้ำน้ำแข็ง"
    const name = e.text(life, q.ctx).match(/【(.+?)】/)?.[1];
    startChapter(life, name ? `${e.title}: ${name}` : e.title);
  }
  const hadPower = !!life.power;
  const p = oddsOf(life, c, q.ctx);
  const r = p === undefined ? undefined : nextFloat(life);
  const success = r === undefined ? true : r < p!;
  const out = c.run(life, q.ctx, success);
  if (r !== undefined) {
    // 4 ระดับ: ทอยได้ดีมาก = งดงาม · พลาดแบบห่างมาก = พลาดหนัก (MURIM_PLAN §14)
    const tier = success ? (r < p! * 0.3 ? "great" : "ok") : r > p! + (1 - p!) * 0.7 ? "disaster" : "fail";
    out.roll = { ok: success, p: p!, tier };
    const extra = rollTierHooks.reduce((t, f) => t + f(life, tier), "");
    if (extra) out.text += extra;
  }
  if (out.next && life.alive) q.scene = out.next;
  else {
    life.queue.shift();
    // ทิ้ง event ที่รอคิวอยู่แต่หมดเงื่อนไขไปแล้ว (เช่น ลาออกจากงานก่อนถึง event หัวหน้าเหวี่ยง)
    life.queue = life.queue.filter((x) => x.scene || stillValid(life, getEvent(x.eventId)!));
  }
  if (out.text) log(life, out.text, out.kind ?? "normal");
  const awakenedNow = !hadPower && !!life.power;
  if (awakenedNow) awakenArc(life);
  // คอมเมนต์ผู้อ่านหลังจบฉาก (ไม่ใช่ระหว่างฉากต่อเนื่อง)
  if (!out.next) maybeComment(life, out.text, out.kind ?? "normal", awakenedNow);
  checkHiddenTalent(life);
  if (life.alive) checkTitles(life);
  return out;
}

export function choiceChance(life: Life, q: QueuedEvent, index: number): number | undefined {
  const c = currentScene(q, life)?.choices[index];
  return c ? oddsOf(life, c, q.ctx) : undefined;
}

// ───────────────────────── งาน ─────────────────────────

export function jobRequirementMissing(life: Life, c: Career): string | undefined {
  if (!worldMatches(c.world, life.worldId)) return "ไม่มีในโลกนี้";
  if (life.age < c.minAge) return `อายุ ${c.minAge}+`;
  if (c.needsPower && !life.power) return "ต้องเป็นผู้ตื่นพลัง";
  if (c.mundaneOnly && life.power) return "รับเฉพาะคนธรรมดา";
  if (c.highSchool && !life.education.highSchoolDone) return "ต้องจบ ม.6";
  if (c.anyDegree && !life.education.degree) return "ต้องมีปริญญาตรี";
  if (c.degree && (!life.education.degree || !c.degree.includes(life.education.degree)))
    return `ต้องจบ ${c.degree.map((d) => facultyById(d).name).join("/")}`;
  const special = c.needs?.(life);
  if (special) return special;
  for (const [k, v] of Object.entries(c.sys?.min ?? {})) {
    if (effSys(life, k as SysStat) < (v ?? 0)) return `${SYS_INFO[k as SysStat].label} ${v}+`;
  }
  for (const [k, v] of Object.entries(c.minStat ?? {})) {
    if (life.stats[k as keyof Stats] < (v ?? 0)) return `${STAT_LABEL[k as keyof Stats]} ${v}+`;
  }
  return;
}

export function jobChance(life: Life, c: Career) {
  if (c.sys) return clamp(0.5 + (sysAs100(effSys(life, c.sys.main)) - c.dc) / 60 + (life.stats.luck - 50) / 400, 0.05, 0.95);
  return checkChance(life, c.key, c.dc, (life.education.grade - 50) / 300);
}

export function applyJob(life: Life, careerId: string): Outcome {
  const c = careerById(careerId)!;
  const key = `apply:${careerId}`;
  if (life.doneThisYear.includes(key)) return { text: "ปีนี้คุณสมัครที่นี่ไปแล้ว รอปีหน้านะ" };
  life.doneThisYear.push(key);
  const missing = jobRequirementMissing(life, c);
  if (missing) return { text: `สมัครไม่ได้ (${missing})`, kind: "bad" };
  if (chance(life, jobChance(life, c))) {
    life.job = { careerId, level: 1, performance: 50, years: 0 };
    const out = { text: `คุณได้งานเป็น${c.titles[0]} (${c.name}) เงินเดือนปีละ ${money(life, salaryOf(life, c, 1))}`, kind: "good" as const };
    log(life, out.text, out.kind);
    return out;
  }
  const out = { text: `คุณไปสัมภาษณ์งาน${c.name} แต่ไม่ผ่าน`, kind: "bad" as const };
  log(life, out.text, out.kind);
  return out;
}

export function quitJob(life: Life): Outcome {
  if (!life.job) return { text: "" };
  const c = careerById(life.job.careerId)!;
  life.job = undefined;
  const out = { text: `คุณลาออกจากงาน${c.name}` };
  log(life, out.text);
  return out;
}

export function workHard(life: Life): Outcome {
  if (!life.job) return { text: "" };
  if (life.doneThisYear.includes("workhard")) return { text: "ปีนี้คุณทุ่มเทเต็มที่แล้ว" };
  life.doneThisYear.push("workhard");
  life.job.performance = clamp(life.job.performance + randInt(life, 6, 14), 0, 100);
  addStat(life, "happiness", -3);
  addStat(life, "health", -1);
  const out = { text: "คุณทำงานล่วงเวลาทั้งปีจนหัวหน้าเริ่มจำชื่อได้" };
  log(life, out.text);
  return out;
}

export function studyHard(life: Life): Outcome {
  if (!isStudent(life)) return { text: "" };
  if (life.doneThisYear.includes("study")) return { text: "ปีนี้คุณอ่านหนังสือจนตาจะถลนแล้ว" };
  life.doneThisYear.push("study");
  life.education.grade = clamp(life.education.grade + randInt(life, 5, 12), 0, 100);
  addStat(life, "smarts", randInt(life, 1, 3));
  addStat(life, "happiness", -2);
  const out = { text: "คุณตั้งใจเรียนอย่างหนัก เกรดดีขึ้น" };
  log(life, out.text);
  return out;
}

export function enrollUniversity(life: Life, faculty: Faculty) {
  const fac = facultyById(faculty);
  life.education.stage = "university";
  life.education.faculty = faculty;
  life.education.uniYearsLeft = fac.years;
  life.education.grade = clamp(life.education.grade, 30, 100);
}

// ───────────────────────── ความสัมพันธ์ ─────────────────────────

export function spendTime(life: Life, p: Person): Outcome {
  const key = `time:${p.id}`;
  if (life.doneThisYear.includes(key)) return { text: `ปีนี้คุณใช้เวลากับ${shortName(p)}ไปแล้ว` };
  life.doneThisYear.push(key);
  const gain = randInt(life, 5, 12) + (hasTalent(life, "sweettalk") ? 5 : 0);
  p.bond = clamp(p.bond + gain, 0, 100);
  if (npcOn(life)) feel(p, { love: 3, trust: 2 });
  addStat(life, "happiness", 2);
  const out = { text: `คุณใช้เวลาดีๆ กับ${shortName(p)}`, kind: "good" as const };
  log(life, out.text, out.kind);
  return out;
}

export function argue(life: Life, p: Person): Outcome {
  p.bond = clamp(p.bond - randInt(life, 10, 20), 0, 100);
  if (npcOn(life)) remember(life, p, "argue", "ทะเลาะกันรุนแรง", 1, { trust: -6, love: -4, grudge: 8 });
  addStat(life, "happiness", -3);
  const out = { text: `คุณทะเลาะกับ${shortName(p)}เสียงดังจนข้างบ้านได้ยิน`, kind: "bad" as const };
  log(life, out.text, out.kind);
  return out;
}

export function askMoney(life: Life, p: Person): Outcome {
  const key = `ask:${p.id}`;
  if (life.doneThisYear.includes(key)) return { text: "ขอบ่อยไปแล้ว เดี๋ยวโดนบ่น" };
  life.doneThisYear.push(key);
  const amount = { poor: 500, middle: 5_000, rich: 50_000, elite: 1_000_000 }[life.wealth];
  if (chance(life, p.bond / 120)) {
    addMoney(life, amount);
    p.bond = clamp(p.bond - 3, 0, 100);
    if (npcOn(life)) feel(p, { respect: -2 });
    const out = { text: `${shortName(p)}ให้เงินคุณ ${money(life, amount)}`, kind: "good" as const };
    log(life, out.text, out.kind);
    return out;
  }
  p.bond = clamp(p.bond - 5, 0, 100);
  const out = { text: `${shortName(p)}ปฏิเสธ "เงินไม่ได้งอกจากต้นไม้นะ"`, kind: "bad" as const };
  log(life, out.text, out.kind);
  return out;
}

export function propose(life: Life, p: Person): Outcome {
  if (life.doneThisYear.includes("propose")) return { text: "รอปีหน้าค่อยลองใหม่นะ" };
  if (life.worldId === "murim" && life.job?.careerId === "monk") return { text: "คุณบวชอยู่ — ต้องสึกก่อนจึงจะแต่งงานได้ (ลาออกจากอาชีพ)" };
  if (Number(life.flags.mourningUntil ?? -1) > life.age) return { text: "คุณยังไว้ทุกข์ให้พ่อแม่อยู่ — ธรรมเนียมห้ามแต่งงานจนครบสามปี" };
  life.doneThisYear.push("propose");
  if (chance(life, clamp((p.bond - 30) / 60, 0.05, 0.95))) {
    const already = life.people.filter((x) => x.alive && x.relation === "spouse" && x.id !== p.id);
    p.relation = "spouse";
    if (npcOn(life)) remember(life, p, "married", "แต่งงานกัน", 3, { love: 10, trust: 8, loyalty: 20 });
    // ยุทธภพ: มีคู่สมรสอยู่แล้ว = เข้าบ้านเป็นฮูหยินรอง และคนเดิมจดจำเรื่องนี้
    if (npcOn(life) && already.length) {
      p.tags = [...(p.tags ?? []), "secondary"];
      for (const w of already) remember(life, w, "second_wife", "สามีรับคนใหม่เข้าบ้าน", 3, { trust: -12, jealousy: 25, love: -8 });
    }
    const cost = { poor: 50_000, middle: 250_000, rich: 1_500_000, elite: 20_000_000 }[life.wealth];
    addMoney(life, -cost);
    addStat(life, "happiness", 20);
    const out = { text: `💍 ${shortName(p)}ตอบตกลง! งานแต่งจัดใหญ่ ค่าสินสอดและงานรวม ${money(life, cost)}`, kind: "milestone" as const };
    log(life, out.text, out.kind);
    return out;
  }
  p.bond = clamp(p.bond - 15, 0, 100);
  addStat(life, "happiness", -10);
  const out = { text: `${shortName(p)}ปฏิเสธการขอแต่งงาน "ยังไม่พร้อม..."`, kind: "bad" as const };
  log(life, out.text, out.kind);
  return out;
}

export function breakUp(life: Life, p: Person): Outcome {
  const divorce = p.relation === "spouse";
  life.flags.breakups = Number(life.flags.breakups ?? 0) + 1;
  life.people = life.people.filter((x) => x.id !== p.id);
  if (divorce && life.money > 0) addMoney(life, -Math.round(life.money / 2));
  addStat(life, "happiness", -8);
  const out = { text: divorce ? `คุณหย่ากับ${shortName(p)} และต้องแบ่งทรัพย์สินครึ่งหนึ่ง` : `คุณเลิกกับ${shortName(p)}`, kind: "bad" as const };
  log(life, out.text, out.kind);
  return out;
}

export function giveGift(life: Life, p: Person): Outcome {
  const key = `gift:${p.id}`;
  if (life.doneThisYear.includes(key)) return { text: "ปีนี้ให้ของขวัญไปแล้ว" };
  life.doneThisYear.push(key);
  life.flags.gifts = Number(life.flags.gifts ?? 0) + 1;
  const cost = { poor: 500, middle: 3_000, rich: 30_000, elite: 300_000 }[life.wealth];
  addMoney(life, -cost);
  const liked = chance(life, 0.75);
  p.bond = clamp(p.bond + (liked ? randInt(life, 8, 16) : 2), 0, 100);
  // ของขวัญซื้อใจได้ แต่ลบความแค้นจากเรื่องใหญ่ไม่ได้
  if (npcOn(life)) feel(p, { love: liked ? 4 : 1, grudge: relOf(p).grudge < 40 ? -3 : 0 });
  addStat(life, "happiness", 2);
  const out = liked
    ? { text: `🎁 ${shortName(p)}ชอบของขวัญมาก เก็บไว้อย่างดี`, kind: "good" as const }
    : { text: `🎁 ${shortName(p)}ยิ้มรับ แต่คุณเห็นของชิ้นนั้นวางอยู่มุมห้องตลอดทั้งปี` };
  log(life, out.text, "kind" in out ? out.kind : "normal");
  return out;
}

/** สารภาพรักกับเพื่อน/คู่แข่ง/เพื่อนร่วมทีม */
export function confess(life: Life, p: Person): Outcome {
  if (life.doneThisYear.includes("confess")) return { text: "ปีนี้หัวใจคุณเหนื่อยพอแล้ว" };
  life.doneThisYear.push("confess");
  const odds = clamp((p.bond - 35) / 55 + (life.stats.looks - 50) / 200, 0.05, 0.9);
  if (chance(life, odds)) {
    p.relation = "partner";
    p.bond = clamp(p.bond + 10, 0, 100);
    if (npcOn(life)) remember(life, p, "lovers", "เริ่มคบกัน", 2, { love: 12, trust: 5 });
    addStat(life, "happiness", 15);
    const out = { text: `💕 ${shortName(p)}เงียบไปนาน แล้วยิ้ม "นึกว่าจะไม่พูดสักที" — คุณสองคนเริ่มคบกัน`, kind: "milestone" as const };
    log(life, out.text, out.kind);
    return out;
  }
  p.bond = clamp(p.bond - 12, 0, 100);
  addStat(life, "happiness", -10);
  const out = { text: `${shortName(p)}ขอโทษ "เราเป็นเพื่อนกันแบบนี้ดีแล้ว" — บรรยากาศอึดอัดไปหลายเดือน`, kind: "bad" as const };
  log(life, out.text, out.kind);
  return out;
}

export function cutTies(life: Life, p: Person): Outcome {
  // ตัดขาดคนที่ยังผูกพัน = เขาจำ (ถ้ากลับมาเจอกันในอนาคต)
  if (npcOn(life) && p.bond >= 40) remember(life, p, "cut", "ถูกตัดขาดอย่างไม่ไยดี", 2, { grudge: 25, love: -20 });
  life.people = life.people.filter((x) => x.id !== p.id);
  addStat(life, "happiness", p.bond < 30 ? 4 : -4);
  const out = { text: p.bond < 30 ? `คุณตัดขาดกับ${shortName(p)} — โล่งอกอย่างบอกไม่ถูก` : `คุณตัดขาดกับ${shortName(p)} บางคืนก็ยังนึกถึง` };
  log(life, out.text);
  return out;
}

export function tryForBaby(life: Life, p: Person): Outcome {
  if (life.doneThisYear.includes("baby")) return { text: "ปีนี้ลองไปแล้ว" };
  life.doneThisYear.push("baby");
  const motherAge = life.gender === "f" ? life.age : p.age;
  const fertile = motherAge <= 44 ? 0.55 - Math.max(0, motherAge - 35) * 0.05 : 0;
  if (chance(life, fertile)) {
    const kid = createPerson(life, "child", { age: 0, bond: 90, lastName: life.lastName });
    addStat(life, "happiness", 15);
    const out = { text: `👶 ${shortName(kid)} ${kid.gender === "m" ? "ลูกชาย" : "ลูกสาว"}ของคุณลืมตาดูโลกแล้ว!`, kind: "milestone" as const };
    log(life, out.text, out.kind);
    return out;
  }
  const out = { text: "ปีนี้ยังไม่มีข่าวดี" };
  log(life, out.text);
  return out;
}

// ───────────────────────── สรุปชีวิต ─────────────────────────

export const STAT_LABEL: Record<keyof Stats, string> = {
  health: "สุขภาพ",
  happiness: "ความสุข",
  smarts: "สติปัญญา",
  looks: "รูปลักษณ์",
  luck: "โชค",
};

export function toPastLife(life: Life): PastLife {
  return {
    id: life.id,
    name: displayName(life),
    world: life.worldId,
    gender: life.gender,
    age: life.age,
    cause: life.causeOfDeath ?? "-",
    money: life.money - life.debt,
    job: life.job ? careerById(life.job.careerId)?.name : undefined,
    degree: life.education.degree,
    fame: life.fame,
    talents: life.talents.filter((t) => t.revealed).map((t) => talentById(t.id)?.name ?? t.id),
    endedAt: Date.now(),
    rank: life.power?.rank,
    regressed: (life.regressions ?? 0) > 0,
    birthYear: life.birthYear,
    series: seriesOf(life),
  };
}

export { CAREERS };
