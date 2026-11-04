// แกนกลางของ "ทุกทางเลือกมีผล": ติดป้ายให้ตัวเลือกเดิมโดยไม่ต้องแก้ไฟล์ของมัน แล้วจดนิสัย เมล็ดชะตา ข่าวลือ และความทรงจำ
// ป้ายอยู่ใน tags.ts · เรื่องที่กลับมาอยู่ใน echoes.ts
import type { Choice, Ctx, GameEvent } from "../../engine/events";
import { allEvents } from "../../engine/events";
import { choiceHooks, oddsHooks, runEvent, yearHooks } from "../../engine/game";
import { chance } from "../../engine/rng";
import { remember, type RelAxes } from "../../engine/npc";
import type { Life } from "../../engine/types";
import { log } from "../../engine/util";
import { E, type Res } from "./kit";
import { inCharacter, lean, noticeShift, traitWords, type Persona } from "./persona";
import { spread } from "./rumors";
import { fl } from "./state";

export interface Tag extends Partial<Persona> {
  /** เมล็ดชะตาที่ปลูก */
  seed?: string;
  /** ปลูกเฉพาะเมื่อสำเร็จ */
  ok?: boolean;
  /** ข่าวลือ: ข้อความ (คุณ...) · ดี 1 ร้าย -1 · ความร้อน */
  rumor?: [string, 1 | -1, number?];
  /** ความทรงจำของคนในฉาก (ctx.pid): ชนิด ข้อความ น้ำหนัก ความรู้สึก */
  mem?: [string, string, 1 | 2 | 3, Partial<RelAxes>];
  /** เปลี่ยนแผ่นดิน: ข้อความ · p รุ่งเรือง s มั่นคง w กำลังทัพ */
  world?: [string, { p?: number; s?: number; w?: number }];
}
/** worldmark.ts ลงทะเบียน · กัน import วน */
export const worldHook: { fn?: (l: Life, text: string, fx: { p?: number; s?: number; w?: number }) => void } = {};
export const TAGS: Record<string, Tag> = {};
const tagOf = new WeakMap<Choice, Tag>();
export const MARK = "จะถูกจดจำ";

export interface SeedDef { note: string; delay: [number, number] }
export const SEEDS: Record<string, SeedDef> = {};
export const seedsOf = (l: Life) => (fl(l).seeds ??= []);
export const activeSeed = (l: Life, id: string) => seedsOf(l).find((s) => s.id === id && s.done === undefined);
export function plant(l: Life, id: string, who?: string) {
  const def = SEEDS[id];
  if (!def || activeSeed(l, id)) return;
  seedsOf(l).push({ id, age: l.age, note: def.note, ...(who ? { who } : {}) });
}

/** เรื่องที่กลับมาหาคุณจากเมล็ดที่ปลูกไว้ · ยิ่งนานยิ่งมีโอกาสกลับมา */
export function ECHO(id: string, note: string, delay: [number, number], text: string | ((l: Life, c: Ctx) => string), choices: Choice[], title: string): GameEvent {
  SEEDS[id] = { note, delay };
  const ready = (l: Life) => { const s = activeSeed(l, id); return !!s && l.age >= s.age + delay[0]; };
  return E(`ft.ec.${id}`, [0, 900], text, choices, {
    when: ready,
    weight: (l) => { const s = activeSeed(l, id); return s ? Math.min(60, 25 + Math.max(0, l.age - s.age - delay[1]) * 8) : 0; },
    maxTimes: 1,
    title,
    prepare: (l) => { const s = activeSeed(l, id)!; s.done = l.age; s.back = title; log(l, `เรื่องเก่ากลับมา: ตอนอายุ ${s.age} คุณ${s.note}`, "milestone"); return { who: s.who ?? "", was: s.age }; },
  });
}

/** ติดป้ายให้ตัวเลือกของ event ที่โหลดแล้ว · เรียกหลังลงทะเบียน event ทั้งหมด */
export function applyTags() {
  for (const e of allEvents()) {
    if (e.world !== "fantasy") continue;
    (e.choices ?? []).forEach((c, i) => {
      const t = TAGS[`${e.id}#${i}`];
      if (!t) return;
      tagOf.set(c, t);
      const d: Record<string, number> = {};
      for (const k of ["m", "h", "c", "f"] as const) if (t[k]) d[k] = t[k]!;
      if (Object.keys(d).length) c.lean = d;
      if (t.seed) { c.seed = t.seed; c.mark = MARK; }
      if (t.mem && t.mem[2] >= 2) c.mark = MARK;
    });
  }
}

export const who = (l: Life, c: Ctx) => l.people.find((p) => p.id === c.pid);
export function loadConseq() {
  choiceHooks.push((l, c, ctx, ok) => {
    if (l.worldId !== "fantasy" || !l.ft) return;
    const t = tagOf.get(c);
    if (c.lean) { const before = traitWords(l); lean(l, c.lean); noticeShift(l, before); }
    if (!t) return;
    if (t.seed && (ok || !t.ok)) plant(l, t.seed, who(l, ctx)?.name);
    if (t.rumor) spread(l, t.rumor[0], t.rumor[1], t.rumor[2] ?? 35);
    if (t.world && (ok || !t.ok)) worldHook.fn?.(l, t.world[0], t.world[1]);
    if (t.mem) { const p = who(l, ctx); if (p) remember(l, p, t.mem[0], t.mem[1], t.mem[2], t.mem[3]); }
  });
  oddsHooks.push((l, c, _ctx, p) => (l.worldId === "fantasy" ? p + inCharacter(l, c) : p));
  // เรื่องที่ถึงเวลากลับมาแล้ว มีช่องของตัวเองทุกปี
  yearHooks.push((l) => {
    if (l.worldId !== "fantasy" || !l.ft || !l.alive || !chance(l, ECHO_CHANCE) || l.queue.some((q) => q.eventId.startsWith("ft.ec."))) return;
    const ready = seedsOf(l).filter((s) => s.done === undefined && l.age >= s.age + (SEEDS[s.id]?.delay[0] ?? 99)).sort((a, b) => a.age - b.age);
    if (ready.length) runEvent(l, `ft.ec.${ready[0].id}`);
  });
}
export const ECHO_CHANCE = 0.35;

/** ตัวเลือกที่สร้างเองใช้ป้ายเดียวกันได้ */
export function tagged(c: Choice, t: Tag): Choice { tagOf.set(c, t); const d: Record<string, number> = {}; for (const k of ["m", "h", "c", "f"] as const) if (t[k]) d[k] = t[k]!; if (Object.keys(d).length) c.lean = d; if (t.seed || (t.mem && t.mem[2] >= 2)) c.mark = MARK; if (t.seed) c.seed = t.seed; return c; }
export type { Res };
