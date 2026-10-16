import { lifePoints, newAchievements, type Achievement } from "../content/achievements";
import { createLife, type BirthOptions } from "./game";
import { mergeMemories } from "./memory";
import { randInt } from "./rng";
import type { Legacy, Life, Memory, Soul, Wealth } from "./types";
import { clamp, log, people, shortName } from "./util";

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
  return gained;
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
  return clamp(Math.min(15 + n * 3, life.age - 1), 0, 200);
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
    : createLife({ seed: dead.seed, worldSeed: dead.worldSeed, birthYear: dead.birthYear, legacy: dead.legacy });
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
  log(
    base,
    `[ย้อนเวลา ครั้งที่ ${base.regressions}] …คุณสะดุ้งตื่นขึ้นในห้องนอนเก่า ร่างกายอายุ ${base.age} ปี แต่จำทุกอย่างในชาติก่อนได้ชัดเจน`,
    "system",
  );
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
    founderName: `${dead.firstName} ${dead.lastName}`,
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

export function nextEraOptions(dead: Life): BirthOptions {
  const r = { rng: dead.rng ^ 0x9e3779b9 };
  return {
    worldSeed: dead.worldSeed ?? dead.seed,
    birthYear: dead.birthYear + dead.age + randInt(r, 15, 45),
    legacy: legacyOf(dead),
  };
}
