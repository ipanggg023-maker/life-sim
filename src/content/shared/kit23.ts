// ชุดเครื่องมือเขียน event แบบกระชับ (M23) — ใช้กับ event เรื่องราวสั้นๆ ที่มีผลเป็นค่าสถานะ
import type { Choice, GameEvent, Outcome } from "../../engine/events";
import { kill } from "../../engine/game";
import { randInt } from "../../engine/rng";
import type { Life, Relation, StatKey, WorldId } from "../../engine/types";
import { addFame, addMoney, addStat, createPerson, shortName } from "../../engine/util";

/** ผลของตัวเลือก: h สุขภาพ · hp ความสุข · sm สติปัญญา · lo รูปลักษณ์ · lk โชค · m เงิน · f ชื่อเสียง · k กรรมดี · p คนใหม่ · exp EXP ของพลัง */
export interface Fx {
  h?: number; hp?: number; sm?: number; lo?: number; lk?: number; m?: number; f?: number; k?: number;
  p?: Relation; exp?: number; flag?: string; die?: string;
}

const STAT: [keyof Fx, StatKey][] = [["h", "health"], ["hp", "happiness"], ["sm", "smarts"], ["lo", "looks"], ["lk", "luck"]];

export function apply(l: Life, fx: Fx): string {
  for (const [k, s] of STAT) if (fx[k]) addStat(l, s, fx[k] as number);
  if (fx.m) addMoney(l, fx.m);
  if (fx.f) addFame(l, fx.f);
  if (fx.k) l.flags.karma = Number(l.flags.karma ?? 0) + fx.k;
  if (fx.flag) l.flags[fx.flag] = true;
  if (fx.exp && l.power) l.power.exp += fx.exp;
  let extra = "";
  if (fx.p) {
    const sex = fx.p === "partner" ? (l.gender === "m" ? "f" : "m") : undefined;
    const p = createPerson(l, fx.p, { age: Math.max(0, l.age + randInt(l, -5, 5)), bond: fx.p === "rival" ? 15 : 55, gender: sex });
    extra = fx.p === "rival" ? ` (คู่แข่งใหม่: ${shortName(p)})` : fx.p === "partner" ? ` (คุณเริ่มคบกับ${shortName(p)})` : ` (${shortName(p)} กลายเป็นคนสำคัญในชีวิตคุณ)`;
  }
  if (fx.die || (fx.h && fx.h < 0 && l.stats.health <= 0)) {
    kill(l, fx.die ?? "บาดเจ็บสาหัส");
    return " …และนั่นคือเรื่องสุดท้ายของชีวิตนี้";
  }
  return extra;
}

type R = (l: Life) => Outcome;
/** ผลดี / ผลร้าย / เฉยๆ / จุดเปลี่ยน */
export const G = (text: string, fx: Fx = {}): R => (l) => ({ text: text + apply(l, fx), kind: "good" });
export const B = (text: string, fx: Fx = {}): R => (l) => ({ text: text + apply(l, fx), kind: "bad" });
export const M = (text: string, fx: Fx = {}): R => (l) => ({ text: text + apply(l, fx) });
export const BIG = (text: string, fx: Fx = {}): R => (l) => ({ text: text + apply(l, fx), kind: "milestone" });

/** ตัวเลือกธรรมดา */
export const C = (label: string, run: R, extra: Partial<Choice> = {}): Choice => ({ label, run: (l) => run(l), ...extra });
/** ตัวเลือกที่ต้องเช็กค่าสถานะ (แสดง %) */
export const K = (label: string, stat: StatKey, dc: number, ok: R, fail: R, extra: Partial<Choice> = {}): Choice => ({
  label,
  check: { stat, dc },
  run: (l, _c, s) => (s ? ok(l) : fail(l)),
  ...extra,
});

/** event เรื่องราว: ช่วงอายุ ข้อความ ตัวเลือก (+ เงื่อนไข/น้ำหนัก/โลก) */
export function E(
  id: string,
  minAge: number,
  maxAge: number,
  text: string | ((l: Life) => string),
  choices: Choice[],
  extra: { when?: (l: Life) => boolean; weight?: number | ((l: Life) => number); world?: WorldId | "modern"; title?: string } = {},
): GameEvent {
  // น้ำหนักเริ่มต้นต่ำกว่า event หลัก (10) — เติมช่องว่างโดยไม่เบียดระบบประจำโลก
  return { id, minAge, maxAge, weight: 6, text: typeof text === "string" ? () => text : (l) => text(l), choices, ...extra };
}
