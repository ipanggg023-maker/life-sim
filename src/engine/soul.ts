import { lifePoints, newAchievements, type Achievement } from "../content/achievements";
import { maybeComment, startArc } from "../content/manhwa";
import { createLife, type BirthOptions } from "./game";
import { getEvent, isStoryEvent } from "./events";
import { mergeMemories } from "./memory";
import { applySetBonus, foundThisLife } from "../content/shared/collection";
import { randInt } from "./rng";
import type { Legacy, Life, Memory, Soul, Wealth } from "./types";
import { clamp, displayName, log, money, people, shortName } from "./util";
import { seriesOf } from "../content/manhwa";
import { awaken, offerClasses, rankLabel, rollAwakening } from "../content/hunter/power";

export function newSoul(): Soul {
  return {
    version: 1,
    points: 0,
    totalPoints: 0,
    lives: 0,
    achievements: [],
    awarded: [],
    perks: { blessing: 0, reroll: 0, clarity: false },
  };
}

export interface Award {
  base: number;
  achievements: Achievement[];
  total: number;
}

/** คิดแต้มวิญญาณจากชีวิตที่จบลง (ครั้งเดียวต่อชีวิต) — ยังไม่บวกเข้า soul */
export function previewAward(soul: Soul, life: Life): Award {
  const base = lifePoints(life);
  const achievements = newAchievements(life, soul);
  return { base, achievements, total: base + achievements.reduce((s, a) => s + a.points, 0) };
}

/**
 * บวกแต้มเข้าวิญญาณ — ถ้าเลือกย้อนเวลา ได้แค่ครึ่งเดียวของแต้มพื้นฐาน (กันการฟาร์ม)
 * ความสำเร็จได้เต็มเสมอ
 */
export function claimAward(soul: Soul, life: Life, regress: boolean): number {
  if (soul.awarded.includes(life.id)) return 0;
  const a = previewAward(soul, life);
  const gained = (regress ? Math.round(a.base / 2) : a.base) + a.achievements.reduce((s, x) => s + x.points, 0);
  soul.points += gained;
  soul.totalPoints += gained;
  soul.lives += 1;
  soul.achievements.push(...a.achievements.map((x) => x.id));
  soul.awarded = [...soul.awarded, life.id].slice(-300);
  rememberSeen(soul, life);
  soul.collection = [...new Set([...(soul.collection ?? []), ...foundThisLife(life)])];
  soul.talentBook = [...new Set([...(soul.talentBook ?? []), ...life.talents.map((t) => t.id)])];
  return gained;
}

/** ส่งความทรงจำของวิญญาณให้ชีวิตใหม่ (เรื่องที่เคยเจอ ตู้สะสม) — newBirth = เกิดใหม่จริง ได้โบนัสครบชุด */
export function applySoul(life: Life, soul: Soul, newBirth: boolean) {
  life.pastSeen = soul.seenEver;
  life.ownedItems = soul.collection;
  if (newBirth) applySetBonus(life, soul.collection ?? []);
}

/** จำ event เรื่องราวที่ชาตินี้เจอแล้ว เพื่อให้ชาติหน้าได้เจอเรื่องใหม่ */
export function rememberSeen(soul: Soul, life: Life) {
  const all = new Set(soul.seenEver ?? []);
  for (const id of Object.keys(life.seen)) {
    const e = getEvent(id);
    if (e && isStoryEvent(e)) all.add(id);
  }
  soul.seenEver = [...all];
}

// ───────────────────────── ร้านวิญญาณ ─────────────────────────

export const SHOP = {
  blessing: { name: "พรแห่งโชค", desc: "ชาติหน้าได้พรสวรรค์หายากง่ายขึ้นมาก (ใช้ครั้งเดียว)", cost: 25 },
  reroll: { name: "สุ่มเกิดใหม่", desc: "สุ่มการเกิดใหม่ได้ 1 ครั้งที่หน้าเกิด", cost: 15 },
  lock: { name: "ผนึกพรสวรรค์", desc: "นำพรสวรรค์ 1 อย่างจากชาตินี้ติดตัวไปชาติหน้า", cost: 40 },
  clarity: { name: "ความทรงจำแจ่มชัด", desc: "ถาวร: การย้อนเวลาทำให้อนาคตเพี้ยนช้าลงครึ่งหนึ่ง", cost: 120 },
} as const;

// ───────────────────────── ย้อนเวลา ─────────────────────────

/** อายุที่จะย้อนกลับไป: ครั้งแรกอายุ 15 แล้วช้าลงครั้งละ 3 ปี (ต้องน้อยกว่าอายุตอนตาย) */
export function regressTarget(life: Life): number {
  const n = life.regressions ?? 0;
  // ชีวิตที่เริ่มกลางคัน (เล่นต่อเป็นลูก) ย้อนได้ไม่เกินวันที่เริ่มเล่น เพราะก่อนหน้านั้นไม่มี snapshot
  const start = Number(life.flags.startAge ?? 0);
  return clamp(Math.min(15 + n * 3, life.age - 1), start, 200);
}

function deathMemory(life: Life): Memory {
  return { key: "death", age: life.age, text: `คุณตายตอนอายุ ${life.age} ปี — ${life.causeOfDeath ?? "ไม่ทราบสาเหตุ"}` };
}

/**
 * สร้างชีวิตใหม่จาก snapshot ณ อายุเป้าหมาย พร้อมความทรงจำทั้งหมด
 * ไม่มี snapshot (เช่น ย้ายเครื่อง) → กลับไปเกิดใหม่ด้วย seed เดิม
 */
export function buildRegression(dead: Life, snapshot: Life | undefined, clarity: boolean): Life {
  const base: Life = snapshot
    ? structuredClone(snapshot)
    : createLife({ seed: dead.seed, worldId: dead.worldId, country: dead.country, worldSeed: dead.worldSeed, birthYear: dead.birthYear, legacy: dead.legacy });
  base.id = `${dead.id}r${(dead.regressions ?? 0) + 1}`;
  base.alive = true;
  base.causeOfDeath = undefined;
  base.queue = [];
  base.doneThisYear = [];
  base.log = dead.log.filter((e) => e.age <= base.age);
  base.regressions = (dead.regressions ?? 0) + 1;
  base.divergence = (dead.divergence ?? 0) + (clarity ? 6 : 12);
  base.memories = mergeMemories(dead.memories, dead.observed, [deathMemory(dead)]);
  base.observed = [];
  startArc(base, `ผู้ย้อนเวลา ครั้งที่ ${base.regressions}`);
  const text = `[ย้อนเวลา ครั้งที่ ${base.regressions}] …คุณสะดุ้งตื่นขึ้นในห้องนอนเก่า ร่างกายอายุ ${base.age} ปี แต่จำทุกอย่างในชาติก่อนได้ชัดเจน`;
  log(base, text, "system");
  maybeComment(base, text, "system", false);
  return base;
}

// ───────────────────────── เกิดใหม่ยุคถัดไป ─────────────────────────

function wealthTier(net: number): Wealth {
  if (net >= 1_000_000_000) return "elite";
  if (net >= 50_000_000) return "rich";
  if (net >= 2_000_000) return "middle";
  return "poor";
}

export function legacyOf(dead: Life): Legacy {
  return {
    founderName: displayName(dead),
    lastName: dead.lastName,
    founderAge: dead.age,
    founderDeathYear: dead.birthYear + dead.age,
    fame: dead.fame,
    rank: dead.power?.rank,
    wealth: wealthTier(dead.money - dead.debt),
    children: people(dead, "child", false).map(shortName),
    stash: Number(dead.flags.stash ?? 0) || undefined,
    generation: (dead.legacy?.generation ?? 0) + (dead.flags.descendant ? 1 : 0) + 1,
  };
}

// ───────────────────────── เล่นต่อเป็นลูก ─────────────────────────

/** ลูกที่รับช่วงต่อได้ (ยังมีชีวิต) */
export const heirsOf = (dead: Life) => people(dead, "child").filter((c) => c.alive);

/**
 * ภาคต่อของมังฮวาเรื่องเดิม: ลูกรับมรดก ชื่อเสียงตระกูล และเริ่มเล่นที่อายุปัจจุบันของลูก
 * โลกที่พังแล้ว (วันสิ้นโลก) ยังพังอยู่ — ลูกได้ระบบทันที
 */
export function buildHeir(dead: Life, childId: string): Life {
  const child = dead.people.find((p) => p.id === childId)!;
  const heirs = heirsOf(dead);
  const estate = Math.max(0, dead.money - dead.debt);
  const share = Math.round(estate / Math.max(1, heirs.length));
  const [first, ...rest] = child.name.replace(/\s*\(.+?\)\s*/, " ").trim().split(/\s+/);
  const familyFirst = dead.lastName === first; // เกาหลี/ญี่ปุ่น: นามสกุลขึ้นก่อน
  const firstName = child.short ?? (familyFirst ? rest.join(" ") : dead.worldId === "murim" ? (child.name.startsWith(dead.lastName) ? child.name.slice(dead.lastName.length) : child.name) : first);
  const life = createLife({
    seed: (dead.seed ^ hashId(child.id)) >>> 0,
    worldId: dead.worldId,
    country: dead.country,
    worldSeed: dead.worldSeed,
    birthYear: dead.birthYear + dead.age - child.age,
    gender: child.gender,
    firstName: firstName || child.name,
    lastName: dead.lastName,
    wealth: wealthTier(share),
    legacy: legacyOf(dead),
  });
  life.id = `${dead.id}h${(Number(dead.flags.generation ?? 1) + 1)}`;
  life.age = child.age;
  life.flags.startAge = child.age;
  life.devCreated = undefined; // ใส่ค่าฐานะเอง แต่ไม่ใช่การสร้างตัวละครแบบ Admin
  life.flags.generation = Number(dead.flags.generation ?? 1) + 1;
  life.flags.seriesTitle = String(dead.flags.seriesTitle ?? seriesOf(dead).title);
  life.flags.inherited = true;
  // ลูกรับช่วงกิจการและทรัพย์สินของพ่อแม่
  if (dead.flags.bizData) life.flags.bizData = dead.flags.bizData;
  if (dead.flags.propData) life.flags.propData = dead.flags.propData;
  life.money = share;
  life.fame = Math.round(dead.fame * 0.3) || 0; // กัน -0
  // คนในครอบครัว: พ่อ/แม่คนเดิม (ผู้เล่นชาติก่อน) + คู่สมรสของเขา + พี่น้อง
  life.people = [];
  const parentRel = dead.gender === "m" ? "father" : "mother";
  life.people.push({ id: `p${dead.id}`, name: displayName(dead), gender: dead.gender, relation: parentRel, age: dead.age, bond: child.bond, alive: false });
  for (const s of people(dead, "spouse")) life.people.push({ ...s, relation: s.gender === "m" ? "father" : "mother", age: s.age });
  for (const c of heirs) if (c.id !== child.id) life.people.push({ ...c, relation: "sibling" });
  // การศึกษาตามวัย
  if (child.age >= 18) {
    life.education = { stage: "done", grade: 50 + randInt(life, -10, 20), highSchoolDone: true };
  } else if (child.age >= 15) life.education.stage = "high";
  else if (child.age >= 12) life.education.stage = "secondary";
  else if (child.age >= 6) life.education.stage = "primary";
  else if (child.age >= 3) life.education.stage = "kinder";
  // ชะตาที่เลยวัยไปแล้วเลื่อนมาเป็นปีหน้า (ไม่งั้นจะไม่มีวันตื่นพลัง)
  for (const k of ["awakenAge", "ceremonyAge", "tpAge"]) if (Number(life.flags[k] ?? 0) <= life.age) life.flags[k] = life.age + 1;
  // โลกที่พังแล้วยังพังอยู่
  if (dead.flags.doomed) {
    for (const k of ["doomed", "rebuilt", "mainScenario", "mainNext"]) if (dead.flags[k] !== undefined) life.flags[k] = dead.flags[k];
    life.flags.awakenDone = true;
  }
  life.log = [];
  startArc(life, `รุ่นที่ ${life.flags.generation} — ทายาทของ${displayName(dead)}`);
  log(life, `คุณคือ ${displayName(life)} อายุ ${life.age} ปี ลูกของ${displayName(dead)} ผู้จากไปเมื่ออายุ ${dead.age} ปี`, "milestone");
  if (share > 0) log(life, `คุณได้รับมรดก ${money(life, share)}${heirs.length > 1 ? ` (แบ่งกับพี่น้องอีก ${heirs.length - 1} คน)` : ""}`, "good");
  if (dead.flags.doomed && !dead.flags.rebuilt) inheritSystem(life);
  return life;
}

function hashId(id: string) {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** ลูกที่เกิดหลังวันสิ้นโลก: ระบบติดตัวมาตั้งแต่เกิด */
function inheritSystem(l: Life) {
  l.flags.forceAwaken = true;
  const r = Math.max(0, rollAwakening(l, 0));
  delete l.flags.forceAwaken;
  awaken(l, r, offerClasses(l)[0]);
  log(l, `[ระบบ] ผู้รอดชีวิตรุ่นที่สอง — ระดับเริ่มต้น【${rankLabel(l, r)}】`, "system");
}

export function nextEraOptions(dead: Life): BirthOptions {
  const r = { rng: dead.rng ^ 0x9e3779b9 };
  return {
    worldId: dead.worldId,
    country: dead.country,
    worldSeed: dead.worldSeed ?? dead.seed,
    birthYear: dead.birthYear + dead.age + randInt(r, 15, 45),
    legacy: legacyOf(dead),
  };
}
