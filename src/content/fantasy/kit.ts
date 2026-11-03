// ชุดเขียนฉากของโลกแฟนตาซี: เล็กกว่าของยุทธภพ และไม่ขึ้นกับเนื้อหาโลกอื่น
import type { Choice, Ctx, GameEvent, Outcome } from "../../engine/events";
import { kill } from "../../engine/game";
import type { Life, LogKind, StatKey } from "../../engine/types";
import { addFame, addMoney, addStat, clamp } from "../../engine/util";
import { fl } from "./state";

export const GOLD = 100;

export interface Fx { hp?: number; joy?: number; iq?: number; look?: number; luck?: number; gold?: number; fame?: number; body?: number; magic?: number; flag?: string; die?: string }
export type Res = (l: Life, c: Ctx) => Outcome;
type Txt = string | ((l: Life, c: Ctx) => string);

const STATS: [keyof Fx, StatKey][] = [["hp", "health"], ["joy", "happiness"], ["iq", "smarts"], ["look", "looks"], ["luck", "luck"]];

export function apply(l: Life, fx: Fx) {
  for (const [k, s] of STATS) if (fx[k]) addStat(l, s, fx[k] as number);
  if (fx.gold) addMoney(l, fx.gold * GOLD);
  if (fx.fame) addFame(l, fx.fame);
  if (fx.body) fl(l).body += fx.body;
  if (fx.magic) fl(l).magic += fx.magic;
  if (fx.flag) l.flags[fx.flag] = true;
  if (fx.die) kill(l, fx.die);
}

const res = (kind: LogKind | undefined) => (text: Txt, fx: Fx = {}, then?: (l: Life, c: Ctx) => void): Res => (l, c) => {
  const t = typeof text === "string" ? text : text(l, c);
  apply(l, fx);
  if (l.alive) then?.(l, c);
  return { text: t, kind };
};
export const G = res("good");
export const B = res("bad");
export const N = res(undefined);
export const BIG = res("milestone");

export const C = (label: Txt, run: Res, o: Partial<Choice> = {}): Choice => ({ label, run: (l, c) => run(l, c), ...o });
export const K = (label: Txt, stat: StatKey, dc: number, ok: Res, fail: Res, o: Partial<Choice> = {}): Choice => ({ label, check: { stat, dc }, run: (l, c, s) => (s ? ok(l, c) : fail(l, c)), ...o });
export const P = (label: Txt, odds: (l: Life, c: Ctx) => number, ok: Res, fail: Res, o: Partial<Choice> = {}): Choice => ({ label, odds: (l, c) => clamp(odds(l, c), 0.03, 0.97), run: (l, c, s) => (s ? ok(l, c) : fail(l, c)), ...o });
/** จ่ายเป็นเหรียญทอง: เงินไม่พอปุ่มล็อกพร้อมบอกเหตุผล */
export const PAY = (label: string, gold: number, run: Res, o: Partial<Choice> = {}): Choice => ({
  label: `${label} (${gold} เหรียญทอง)`,
  req: (l) => (l.money < gold * GOLD ? `ต้องมี ${gold} เหรียญทอง` : undefined),
  run: (l, c) => { addMoney(l, -gold * GOLD); return run(l, c); },
  ...o,
});

interface EOpts { when?: (l: Life) => boolean; weight?: number | ((l: Life) => number); maxTimes?: number; forced?: boolean; title?: string; prepare?: (l: Life) => Ctx }
export const E = (id: string, ages: [number, number], text: Txt, choices: Choice[], o: EOpts = {}): GameEvent => ({
  id, world: "fantasy", minAge: ages[0], maxAge: ages[1], text: typeof text === "string" ? () => text : text, choices, ...o,
});
/** ฉากที่เปิดจากปุ่ม */
export const SCENE = (id: string, title: string, text: Txt, choices: Choice[]): GameEvent => ({ ...E(id, [0, 900], text, choices, { title, maxTimes: 0 }), manual: true });
