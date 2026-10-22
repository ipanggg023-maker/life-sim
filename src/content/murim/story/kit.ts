// ชุดเครื่องมือเขียนเรื่องยุทธภพแบบใหม่ (MURIM_PLAN §14, §17, §18)
// ทุกตัวเลือกมี: ข้อดี/ข้อเสีย · โอกาสจริงตามความสามารถ · ผลทันที (ค่าสถานะ เงิน ชื่อเสียง ธรรมะ-มาร)
// · ผลระยะยาว (ธง ความทรงจำของ NPC บาดแผล เป้าหมาย) · ห้ามเกิดซ้ำโดยไม่มีเหตุผล
import { injure, type InjuryKind, type Part } from "../../../engine/body";
import type { Choice, Ctx, GameEvent, Outcome } from "../../../engine/events";
import { kill } from "../../../engine/game";
import { feel, remember, type RelAxes } from "../../../engine/npc";
import { chance, pick, randInt } from "../../../engine/rng";
import type { Life, Person, Relation, StatKey } from "../../../engine/types";
import { addFame, addMoney, addStat, clamp, createPerson, people, relationLabel, shortName } from "../../../engine/util";
import { gainExp } from "../../hunter/power";
import { shiftAlign } from "../m17core";
import { startDuel } from "../life/duel";
import { setGoal } from "../life/goals";

/** เงินในยุทธภพ: 1 ตำลึง = 1000 หน่วยภายใน */
export const TAEL = 1000;

/** ผลของตัวเลือก */
export interface Fx {
  /** สุขภาพ · ความสุข · สติปัญญา · รูปลักษณ์ · โชค */
  hp?: number; joy?: number; iq?: number; look?: number; luck?: number;
  /** เงินเป็นตำลึง (ติดลบได้) */
  tael?: number;
  fame?: number;
  /** ธรรมะ(+)/มาร(−) */
  align?: number;
  /** ประสบการณ์วิชา (ถ้าฝึกลมปราณแล้ว) / ฝึกร่างกายพื้นฐาน (ถ้ายังไม่ได้ฝึก) */
  exp?: number;
  basics?: number;
  /** ตั้งธง */
  flag?: string | string[];
  /** ความรู้สึกของคนในฉาก (ctx.pid) */
  feel?: Partial<RelAxes>;
  /** ความทรงจำของคนในฉาก: [ชนิด, ข้อความ, น้ำหนัก, เขารู้ไหม] */
  mem?: [string, string, 1 | 2 | 3, boolean?];
  /** บาดแผล */
  wound?: [Part, InjuryKind, 1 | 2 | 3];
  /** คนใหม่ในชีวิต */
  meet?: { rel: Relation; age?: number; gender?: "m" | "f"; bond?: number; tag?: string };
  /** ตั้งเป้าหมายชีวิตใหม่ */
  goal?: [string, string];
  /** ตาย (สาเหตุ) */
  die?: string;
}

const STATS: [keyof Fx, StatKey][] = [["hp", "health"], ["joy", "happiness"], ["iq", "smarts"], ["look", "looks"], ["luck", "luck"]];

/** คนในฉาก (ctx.pid) */
export const who = (l: Life, c: Ctx): Person | undefined => l.people.find((p) => p.id === c.pid);
/** ชื่อคนในฉาก */
export const nm = (l: Life, c: Ctx) => { const p = who(l, c); return p ? shortName(p) : "เขา"; };
/** คำเรียกตามความสัมพันธ์ + ชื่อ เช่น "ท่านแม่ (หลิวเยว่)" */
export const call = (l: Life, c: Ctx) => { const p = who(l, c); return p ? relationLabel(p, l) : "เขา"; };

export function apply(l: Life, c: Ctx, fx: Fx): string {
  let extra = "";
  for (const [k, s] of STATS) if (fx[k]) addStat(l, s, fx[k] as number);
  if (fx.tael) addMoney(l, fx.tael * TAEL);
  if (fx.fame) addFame(l, fx.fame);
  if (fx.align) shiftAlign(l, fx.align);
  if (fx.exp) { if (l.power) gainExp(l, fx.exp); else l.flags.mwBasics = Number(l.flags.mwBasics ?? 0) + Math.max(1, Math.round(fx.exp / 100)); }
  if (fx.basics) l.flags.mwBasics = Number(l.flags.mwBasics ?? 0) + fx.basics;
  for (const f of [fx.flag ?? []].flat()) l.flags[f] = true;
  const p = who(l, c);
  if (p && fx.feel) feel(p, fx.feel);
  if (p && fx.mem) remember(l, p, fx.mem[0], fx.mem[1], fx.mem[2], {}, fx.mem[3] ?? true);
  if (fx.meet) {
    const m = fx.meet;
    const np = createPerson(l, m.rel, { age: Math.max(0, m.age ?? l.age + randInt(l, -2, 2)), gender: m.gender, bond: m.bond ?? 50 });
    if (m.tag) np.tags = [m.tag];
    c.pid = np.id;
    extra += ` (${relationLabel(np, l)}ใหม่: ${shortName(np)})`;
  }
  if (fx.wound) extra += injure(l, fx.wound[0], fx.wound[1], fx.wound[2]);
  if (fx.goal) setGoal(l, fx.goal[0], fx.goal[1]);
  if (fx.die || l.stats.health <= 0) {
    kill(l, fx.die ?? "บาดเจ็บสาหัส");
    return extra + " …และนั่นคือเรื่องสุดท้ายของชีวิตนี้";
  }
  return extra;
}

/** ผลลัพธ์ (แนบ fx ไว้ให้ตัวเลือกสรุปข้อดี/ข้อเสียจากผลจริงได้) */
export type Res = ((l: Life, c: Ctx) => Outcome) & { fx?: Fx };
type Txt = string | ((l: Life, c: Ctx) => string);
const txt = (t: Txt, l: Life, c: Ctx) => (typeof t === "string" ? t : t(l, c));
const withFx = (f: (l: Life, c: Ctx) => Outcome, fx: Fx): Res => Object.assign(f, { fx });

/** ผลดี · ผลร้าย · ธรรมดา · จุดเปลี่ยนสำคัญ */
// ผลจริงที่เกิดขึ้น (ได้/เสีย) แสดงหลังเลือก — ก่อนเลือกผู้เล่นเห็นแค่ % สำเร็จ
const out = (t: Txt, fx: Fx, kind?: Outcome["kind"]) => withFx((l, c) => ({ text: txt(t, l, c) + apply(l, c, fx), kind, effects: fxHints(fx) }), fx);
export const G = (t: Txt, fx: Fx = {}): Res => out(t, fx, "good");
export const B = (t: Txt, fx: Fx = {}): Res => out(t, fx, "bad");
export const N = (t: Txt, fx: Fx = {}): Res => out(t, fx);
export const BIG = (t: Txt, fx: Fx = {}): Res => out(t, fx, "milestone");
/** ไปฉากถัดไปของเรื่องเดียวกัน */
export const NEXT = (scene: string, t: Txt, fx: Fx = {}): Res => withFx((l, c) => ({ text: txt(t, l, c) + apply(l, c, fx), next: scene, effects: fxHints(fx) }), fx);

/** โอกาสตามความสามารถจริงของตัวละคร: ฐาน + ค่าสถานะ (50 = ไม่บวกไม่ลบ) + ขั้นฝีมือ */
export const ab = (base: number, stat: StatKey = "smarts", w = 0.4) => (l: Life) => clamp(base + ((l.stats[stat] - 50) / 100) * w + (l.power?.rank ?? 0) * 0.02, 0.05, 0.95);

/** สรุปผลจริงของตัวเลือกเป็นข้อดี/ข้อเสียสั้นๆ (ไม่แต่งเพิ่ม — มาจาก fx ที่จะเกิดจริง) */
export function fxHints(fx: Fx | undefined): { good: string[]; bad: string[] } {
  const good: string[] = [], bad: string[] = [];
  if (!fx) return { good, bad };
  const put = (v: number | undefined, name: string) => { if (v) (v > 0 ? good : bad).push(`${name}${v > 0 ? " +" : " −"}`); };
  put(fx.hp, "สุขภาพ"); put(fx.joy, "ความสุข"); put(fx.iq, "สติปัญญา"); put(fx.look, "รูปลักษณ์"); put(fx.luck, "โชค");
  put(fx.tael, "เงิน"); put(fx.fame, "ชื่อเสียง");
  if (fx.align) (fx.align > 0 ? good : bad).push(fx.align > 0 ? "ธรรมะ +" : "ทางมาร");
  if (fx.exp || fx.basics) good.push("ฝีมือ +");
  if (fx.feel) {
    const f = fx.feel;
    const warm = (f.love ?? 0) + (f.trust ?? 0) + (f.loyalty ?? 0) + (f.respect ?? 0) + (f.debt ?? 0);
    const cold = (f.grudge ?? 0) + (f.jealousy ?? 0) + (f.fear ?? 0);
    if (warm - cold > 0) good.push("ความสัมพันธ์ดีขึ้น"); else if (warm - cold < 0) bad.push("ความสัมพันธ์แย่ลง");
  }
  if (fx.meet) good.push("ได้พบคนใหม่");
  if (fx.wound) bad.push(fx.wound[2] === 3 ? "อาจพิการถาวร" : "บาดเจ็บ");
  if (fx.goal) good.push("ชีวิตเปลี่ยนทิศ");
  if (fx.die) bad.push("ถึงตาย");
  return { good, bad };
}
const join = (xs: string[]) => (xs.length ? xs.slice(0, 4).join(" · ") : undefined);
/** สุ่มหนึ่งในหลายผล */
export const ONE = (...rs: Res[]): Res => (l, c) => pick(l, rs)(l, c);

interface ChOpts {
  pros?: string;
  cons?: string;
  show?: (l: Life, c: Ctx) => boolean;
  req?: (l: Life, c: Ctx) => string | undefined;
  tone?: "special" | "danger";
  /** โอกาสรอดชีวิตที่จะเตือน */
  survival?: (l: Life, c: Ctx) => number;
}

/** ตัวเลือกธรรมดา — ถ้าไม่ได้เขียนข้อดี/ข้อเสียเอง จะสรุปจากผลจริง */
export const C = (label: Txt, run: Res, o: ChOpts = {}): Choice => {
  const h = fxHints(run.fx);
  return { label: typeof label === "string" ? label : (l, c) => label(l, c), run: (l, c) => run(l, c), pros: join(h.good), cons: join(h.bad), ...o };
};

/** ข้อดีเมื่อสำเร็จ / ข้อเสียเมื่อพลาด */
const oddsHints = (ok: Res, fail: Res) => {
  const a = fxHints(ok.fx), b = fxHints(fail.fx);
  return { pros: a.good.length ? `สำเร็จ: ${join(a.good)}` : undefined, cons: b.bad.length ? `พลาด: ${join(b.bad)}` : undefined };
};

/** ตัวเลือกที่ต้องลุ้นตามค่าสถานะ (แสดง % จริง) */
export const K = (label: Txt, stat: StatKey, dc: number, ok: Res, fail: Res, o: ChOpts = {}): Choice => ({
  label: typeof label === "string" ? label : (l, c) => label(l, c),
  check: { stat, dc },
  run: (l, c, s) => (s ? ok(l, c) : fail(l, c)),
  ...oddsHints(ok, fail),
  ...o,
});

/** ตัวเลือกที่ใช้โอกาสคำนวณเอง (0–1) */
export const P = (label: Txt, odds: (l: Life, c: Ctx) => number, ok: Res, fail: Res, o: ChOpts = {}): Choice => ({
  label: typeof label === "string" ? label : (l, c) => label(l, c),
  odds,
  run: (l, c, s) => (s ? ok(l, c) : fail(l, c)),
  ...oddsHints(ok, fail),
  ...o,
});

/** ตัวเลือกที่ต้องจ่ายเงิน (ตำลึง) — เงินไม่พอจะล็อกพร้อมเหตุผล */
export const PAY = (label: Txt, tael: number | ((l: Life) => number), run: Res, o: ChOpts = {}): Choice => {
  const cost = (l: Life) => (typeof tael === "number" ? tael : tael(l));
  const { req, ...rest } = o;
  return {
    ...rest,
    label: (l, c) => `${txt(label, l, c)} (${cost(l)} ตำลึง)`,
    req: (l, c) => (l.money < cost(l) * TAEL ? `ต้องมีเงิน ${cost(l)} ตำลึง` : req?.(l, c)),
    run: (l, c) => { addMoney(l, -cost(l) * TAEL); return run(l, c); },
  };
};

/** ตัวเลือกที่เปิดฉากต่อสู้ */
export const FIGHT = (label: Txt, foe: Txt, rank: (l: Life) => number, opts: { lethal?: boolean; cruel?: boolean; on?: string; intro?: Txt } & ChOpts = {}): Choice => ({
  label: typeof label === "string" ? label : (l, c) => label(l, c),
  tone: opts.lethal ? "danger" : opts.tone,
  pros: opts.pros ?? "ชนะแล้วได้ทั้งชื่อเสียงและสิ่งที่ต้องการ",
  cons: opts.cons ?? (opts.lethal ? "สู้ถึงตาย — แพ้อาจไม่รอดหรือเสียอวัยวะ" : "อาจบาดเจ็บ"),
  show: opts.show,
  req: opts.req,
  run: (l, c) => {
    startDuel(l, { foe: txt(foe, l, c), rank: clamp(rank(l), 0, 8), lethal: opts.lethal, cruel: opts.cruel, on: opts.on, pid: c.pid ? String(c.pid) : undefined });
    return { text: opts.intro ? txt(opts.intro, l, c) : "คุณตั้งท่า สายตาจับจ้องคู่ต่อสู้" };
  },
});

/** ระดับฝีมือใกล้ตัวเรา (สำหรับศัตรูที่สมน้ำสมเนื้อ) */
export const near = (d = 0) => (l: Life) => clamp((l.power?.rank ?? 0) + d, 0, 8);

interface EvOpts {
  title?: string;
  weight?: number | ((l: Life) => number);
  when?: (l: Life) => boolean;
  prepare?: (l: Life) => Ctx;
  maxTimes?: number;
  forced?: boolean;
  scenes?: GameEvent["scenes"];
}

/** เรื่องหนึ่งเรื่อง: ช่วงอายุ ข้อความ ตัวเลือก — ค่าเริ่มต้นน้ำหนัก 8 เกิดครั้งเดียว */
export function E(id: string, ages: [number, number], text: Txt, choices: Choice[], o: EvOpts = {}): GameEvent {
  return {
    id,
    minAge: ages[0],
    maxAge: ages[1],
    weight: o.weight ?? 8,
    maxTimes: o.maxTimes ?? 1,
    when: mergeWhen(o.when, o.prepare as NeedPrep | undefined),
    prepare: o.prepare,
    forced: o.forced,
    title: o.title,
    text: (l, c) => txt(text, l, c),
    choices,
    scenes: o.scenes,
  };
}

/** เรื่องที่ "เกิดขึ้นกับคุณ" โดยไม่ต้องเลือก (เช่น ตอนยังเป็นทารก) */
export function A(id: string, ages: [number, number], text: Txt, fx: Fx | ((l: Life, c: Ctx) => Fx), o: EvOpts & { kind?: "good" | "bad" | "normal" | "milestone" } = {}): GameEvent {
  return {
    id,
    minAge: ages[0],
    maxAge: ages[1],
    weight: o.weight ?? 8,
    maxTimes: o.maxTimes ?? 1,
    when: mergeWhen(o.when, o.prepare as NeedPrep | undefined),
    prepare: o.prepare,
    forced: o.forced,
    title: o.title,
    text: (l, c) => txt(text, l, c),
    auto: (l, c) => { apply(l, c, typeof fx === "function" ? fx(l, c) : fx); return o.kind ?? "normal"; },
  };
}

/** ฉากต่อเนื่องในเรื่องเดียวกัน */
export const S = (text: Txt, choices: Choice[], title?: string) => ({ title, text: (l: Life, c: Ctx) => txt(text, l, c), choices });

// ───── ตัวช่วยเลือกคนในฉาก ─────

const aliveOf = (l: Life, rels: Relation[]) => l.people.filter((p) => p.alive && rels.includes(p.relation));
/** เลือกคนในครอบครัว/ความสัมพันธ์ที่ยังมีชีวิต ใส่ ctx.pid */
export const withPerson = (rels: Relation[], f: (p: Person, l: Life) => boolean = () => true) => {
  const when = (l: Life) => aliveOf(l, rels).some((p) => f(p, l));
  // prepare จำเงื่อนไขของตัวเองไว้ — E/A จะบังคับเงื่อนไขนี้เสมอ แม้ event จะเขียน when ของตัวเองทับ
  const prepare = Object.assign((l: Life): Ctx => { const ps = aliveOf(l, rels).filter((p) => f(p, l)); return { pid: pick(l, ps).id }; }, { need: when });
  return { when, prepare };
};
type NeedPrep = ((l: Life) => Ctx) & { need?: (l: Life) => boolean };
const mergeWhen = (when: ((l: Life) => boolean) | undefined, prepare: NeedPrep | undefined) => {
  const need = prepare?.need;
  if (!need) return when;
  return when ? (l: Life) => need(l) && when(l) : need;
};
export const hasKin = (l: Life, r: Relation) => people(l, r).length > 0;
export const poor = (l: Life) => l.wealth === "poor";
export const rich = (l: Life) => l.wealth === "rich" || l.wealth === "elite";
export const flagged = (f: string) => (l: Life) => !!l.flags[f];
export const notFlagged = (f: string) => (l: Life) => !l.flags[f];
export const both = (...fs: ((l: Life) => boolean)[]) => (l: Life) => fs.every((f) => f(l));
export const roll = chance;
export const rnd = randInt;
