// นิสัยที่หล่อหลอมจากทางเลือก: เมตตา–โหดเหี้ยม ซื่อตรง–เจ้าเล่ห์ กล้า–รอบคอบ ศรัทธา–อิสระ · แผนอยู่ที่ design/CONSEQUENCES_PLAN.md
// ทุกตัวเลือกที่มี lean ขยับนิสัย · ยิ่งแก่ยิ่งเปลี่ยนยาก · ทำตามนิสัยตัวเองสำเร็จง่ายขึ้นเล็กน้อย
import type { Choice, Ctx, GameEvent } from "../../engine/events";
import { chance } from "../../engine/rng";
import type { Life, Person } from "../../engine/types";
import { clamp, log } from "../../engine/util";
import { feel, hasTrait } from "../../engine/npc";
import { BIG, C, E, N } from "./kit";
import { deed, fl } from "./state";

export type Axis = "m" | "h" | "c" | "f";
export type Persona = Record<Axis, number>;
export const AXES: Axis[] = ["m", "h", "c", "f"];
export const PERSONA: Record<Axis, { pos: string; neg: string; strongPos: string; strongNeg: string; name: string }> = {
  m: { name: "ใจ", pos: "เมตตา", neg: "โหดเหี้ยม", strongPos: "ผู้มีใจเมตตา", strongNeg: "ผู้ไร้ปรานี" },
  h: { name: "วาจา", pos: "ซื่อตรง", neg: "เจ้าเล่ห์", strongPos: "ผู้ไม่เคยโกหก", strongNeg: "จิ้งจอกเจ้าเล่ห์" },
  c: { name: "ความกล้า", pos: "กล้าหาญ", neg: "รอบคอบ", strongPos: "ผู้ไม่รู้จักกลัว", strongNeg: "ผู้คิดก่อนก้าว" },
  f: { name: "ศรัทธา", pos: "ศรัทธา", neg: "อิสระ", strongPos: "ผู้ศรัทธาแรงกล้า", strongNeg: "ผู้ไม่คุกเข่าต่อเทพ" },
};
/** นิสัยที่เด่นพอให้คนรอบตัวเห็น */
export const SHOWN = 25;
export const STRONG = 60;

export const personaOf = (l: Life): Persona => (fl(l).persona ??= { m: 0, h: 0, c: 0, f: 0 });
export const tr = (l: Life, k: Axis) => personaOf(l)[k];

/** เด็กเปลี่ยนง่าย ผู้ใหญ่เปลี่ยนยาก · ใกล้สุดขั้วแล้วขยับต่อช้าลง */
const hardening = (age: number) => (age < 16 ? 1.25 : age < 30 ? 1 : age < 50 ? 0.7 : 0.5);
export function lean(l: Life, d: Partial<Persona>, force = false) {
  const p = personaOf(l);
  for (const k of AXES) {
    const v = d[k];
    if (!v) continue;
    const same = Math.sign(v) === Math.sign(p[k]);
    const step = force ? v : v * hardening(l.age) * (same ? 1 - Math.abs(p[k]) / 140 : 1);
    // || 0 กัน -0 ซึ่งเซฟเป็น JSON แล้วไม่เท่าเดิม
    p[k] = clamp(Math.round(p[k] + step), -100, 100) || 0;
  }
}

/** คำบรรยายนิสัยที่เด่น เรียงจากเด่นมากไปน้อย */
export function traitWords(l: Life, max = 4): string[] {
  const p = personaOf(l);
  return AXES.filter((k) => Math.abs(p[k]) >= SHOWN)
    .sort((a, b) => Math.abs(p[b]) - Math.abs(p[a]))
    .slice(0, max)
    .map((k) => (p[k] > 0 ? (p[k] >= STRONG ? PERSONA[k].strongPos : PERSONA[k].pos) : p[k] <= -STRONG ? PERSONA[k].strongNeg : PERSONA[k].neg));
}
/** ฉายาจากนิสัยที่แรงที่สุด · ใช้เมื่อไม่มีฉายาจากผลงาน */
export function personaEpithet(l: Life): string | undefined {
  const p = personaOf(l);
  const k = [...AXES].sort((a, b) => Math.abs(p[b]) - Math.abs(p[a]))[0];
  if (Math.abs(p[k]) < STRONG) return undefined;
  return p[k] > 0 ? PERSONA[k].strongPos : PERSONA[k].strongNeg;
}
/** คำตัดสินบนหลุมศพ */
export function verdict(l: Life): string {
  const w = traitWords(l, 2);
  if (!w.length) return "คนธรรมดาที่ไม่มีใครเล่าถึงนิสัยนัก";
  return `คนจดจำว่าเป็นคน${w.join(" และ")}`;
}

/** ทำตามนิสัยตัวเอง สำเร็จง่ายขึ้น · ฝืนนิสัย ยากขึ้นนิดหน่อย */
export function inCharacter(l: Life, c: Choice): number {
  if (!c.lean || !l.ft) return 0;
  const p = personaOf(l);
  let s = 0;
  for (const k of AXES) s += (c.lean[k] ?? 0) * p[k];
  return clamp(s / 100 * 0.008, -0.05, 0.07);
}

/** ตัวเลือกเฉพาะนิสัย: ต้องเด่นพอ */
export const need = (k: Axis, min: number) => (l: Life) => (min > 0 ? tr(l, k) >= min : tr(l, k) <= min);

/** คนรอบตัวรู้สึกกับนิสัยของคุณ (ปีละนิด) */
const LIKES: { trait: string; axis: Axis; dir: 1 | -1 }[] = [
  { trait: "gentle", axis: "m", dir: 1 }, { trait: "generous", axis: "m", dir: 1 }, { trait: "devoted", axis: "m", dir: 1 },
  { trait: "honest", axis: "h", dir: 1 }, { trait: "cunning", axis: "h", dir: -1 }, { trait: "greedy", axis: "h", dir: -1 },
  { trait: "hotheaded", axis: "c", dir: 1 }, { trait: "ambitious", axis: "c", dir: 1 }, { trait: "timid", axis: "c", dir: -1 },
  { trait: "filial", axis: "f", dir: 1 },
];
export function personaYear(l: Life) {
  const p = personaOf(l);
  for (const x of l.people) {
    if (!x.alive) continue;
    for (const like of LIKES) {
      if (!hasTrait(x, like.trait)) continue;
      const v = p[like.axis] * like.dir;
      if (v >= SHOWN) feel(x, { respect: 1, love: v >= STRONG ? 1 : 0 });
      else if (v <= -STRONG) feel(x, { respect: -1, trust: -1 });
    }
    // คนขี้ขลาดกลัวคนโหดเหี้ยม
    if (p.m <= -STRONG && hasTrait(x, "timid")) feel(x, { fear: 2 });
  }
}
export const nearBy = (l: Life, f: (p: Person) => boolean) => l.people.filter((p) => p.alive && f(p));

/** จุดหักเห: คนที่สุดขั้วมีโอกาสกลับใจหรือแตกสลาย ครั้งเดียวต่อชีวิตต่อทาง */
const swing = (k: Axis, v: number, title: string): ((l: Life, c: Ctx) => { text: string; kind: "milestone" }) => (l) => { lean(l, { [k]: v }, true); deed(l, title); return { text: v > 0 ? `คุณไม่ใช่คนเดิมอีกต่อไป นิสัย${PERSONA[k].pos}เริ่มงอกขึ้นในที่ที่เคยแห้งแล้ง` : `บางอย่างในตัวคุณแตกแล้วไม่ประกอบคืน`, kind: "milestone" }; };
export const PERSONA_EVENTS: GameEvent[] = [
  E("ft.pe.redeem_m", [25, 400], "เด็กคนหนึ่งร้องไห้หน้าบ้านที่คุณเคยเผา แม่ของเขาจำหน้าคุณได้ แต่เธอไม่วิ่งหนี เธอถามแค่ว่าทำไม", [
    C("คุกเข่าขอโทษต่อหน้าทั้งหมู่บ้าน", swing("m", 55, "ผู้กลับใจจากความโหดเหี้ยม")),
    C("เดินผ่านไปโดยไม่ตอบ", N("คำถามนั้นตามคุณไปทุกคืน แต่คุณไม่เคยตอบ", {}, (l) => lean(l, { m: -5 }))),
  ], { when: (l) => tr(l, "m") <= -STRONG && !l.flags.ftRedeem_m, weight: 11, maxTimes: 1, title: "คำถามของแม่", prepare: (l) => { l.flags.ftRedeem_m = true; return {}; } }),
  E("ft.pe.fall_m", [20, 400], "คนที่คุณช่วยมาตลอดชีวิตขายข้อมูลของคุณให้ศัตรู ทั้งเพื่อนทั้งครอบครัวเกือบตาย เพราะความใจดีของคุณ", [
    C("สาบานว่าจะไม่ใจอ่อนอีก", swing("m", -55, "คนใจดีที่ถูกหักหลังจนใจแข็งเป็นหิน")),
    C("ให้อภัยแม้แต่ครั้งนี้", BIG("คุณร้องไห้ทั้งคืน แล้วตื่นมาเป็นคนเดิม", { joy: -6 }, (l) => lean(l, { m: 8 }))),
  ], { when: (l) => tr(l, "m") >= STRONG && !l.flags.ftFall_m, weight: 9, maxTimes: 1, title: "ความใจดีที่ถูกหักหลัง", prepare: (l) => { l.flags.ftFall_m = true; return {}; } }),
  E("ft.pe.redeem_h", [25, 400], "คำโกหกเล็กๆ ที่คุณพูดเมื่อหลายปีก่อนทำให้ชายบริสุทธิ์คนหนึ่งติดคุก วันนี้เขาได้ออกมา ผมขาวทั้งหัว", [
    C("ไปบอกความจริงกับศาล", swing("h", 55, "คนเจ้าเล่ห์ที่สารภาพต่อศาล")),
    C("ส่งเงินให้เขาโดยไม่บอกชื่อ", N("เงินซื้ออะไรได้หลายอย่าง แต่ไม่ใช่ทุกอย่าง", { gold: -20 }, (l) => lean(l, { h: -4, m: 4 }))),
  ], { when: (l) => tr(l, "h") <= -STRONG && !l.flags.ftRedeem_h, weight: 11, maxTimes: 1, title: "ชายผมขาว", prepare: (l) => { l.flags.ftRedeem_h = true; return {}; } }),
  E("ft.pe.fall_h", [20, 400], "ความซื่อตรงของคุณทำให้คนที่คุณรักต้องโทษประหาร พวกเขาพูดว่า ถ้าเจ้าโกหกสักครั้ง ข้าคงรอด", [
    C("เรียนรู้ที่จะโกหกเพื่อคนที่รัก", swing("h", -55, "คนซื่อที่เรียนรู้การโกหก")),
    C("ยืนยันว่าความจริงต้องมาก่อน", BIG("คุณแบกความเจ็บนี้ไปจนตาย แต่ไม่เคยโกหก", { joy: -8 }, (l) => lean(l, { h: 8 }))),
  ], { when: (l) => tr(l, "h") >= STRONG && !l.flags.ftFall_h, weight: 8, maxTimes: 1, title: "ราคาของความจริง", prepare: (l) => { l.flags.ftFall_h = true; return {}; } }),
  E("ft.pe.redeem_c", [18, 400], "ทุกครั้งที่ระฆังเตือนภัยดัง คุณเป็นคนแรกที่ปิดประตู คืนนี้เสียงที่ร้องขอความช่วยเหลืออยู่หน้าบ้านคุณเอง", [
    C("เปิดประตูแล้ววิ่งออกไป", swing("c", 55, "คนขลาดที่วิ่งเข้าหาไฟ")),
    C("ปิดหน้าต่างให้แน่น", N("เช้ามา หน้าบ้านคุณว่างเปล่า", { joy: -6 }, (l) => lean(l, { c: -5 }))),
  ], { when: (l) => tr(l, "c") <= -STRONG && !l.flags.ftRedeem_c, weight: 10, maxTimes: 1, title: "เสียงหน้าประตู", prepare: (l) => { l.flags.ftRedeem_c = true; return {}; } }),
  E("ft.pe.fall_c", [25, 400], "ความกล้าของคุณพาเพื่อนสามคนบุกเข้าถ้ำที่ไม่ควรเข้า คุณเดินออกมาคนเดียว", [
    C("สาบานว่าจะคิดก่อนก้าวทุกครั้ง", swing("c", -55, "คนกล้าที่เรียนรู้ความกลัว")),
    C("กลับเข้าไปตามหาพวกเขา", BIG("คุณไม่เจอใคร แต่ความกล้าของคุณไม่เคยหายไป", { hp: -10 }, (l) => lean(l, { c: 8 }))),
  ], { when: (l) => tr(l, "c") >= STRONG && !l.flags.ftFall_c, weight: 8, maxTimes: 1, title: "ถ้ำที่ไม่ควรเข้า", prepare: (l) => { l.flags.ftFall_c = true; return {}; } }),
  E("ft.pe.faith_find", [20, 400], "คุณไม่เคยเชื่อในเทพองค์ใด จนวันที่ลูกของเพื่อนรอดจากไข้ทั้งที่หมอทุกคนบอกว่าหมดหวัง เด็กบอกว่ามีผู้หญิงในชุดขาวนั่งข้างเตียงทั้งคืน", [
    C("ไปวิหารเป็นครั้งแรกในชีวิต", swing("f", 55, "ผู้ไร้ศรัทธาที่ได้พบเทพ")),
    C("บอกว่าเป็นไข้ลดเอง", N("คุณยังเชื่อในสิ่งที่จับต้องได้", {}, (l) => lean(l, { f: -4 }))),
  ], { when: (l) => tr(l, "f") <= -STRONG && !l.flags.ftFaith_find, weight: 10, maxTimes: 1, title: "หญิงชุดขาว", prepare: (l) => { l.flags.ftFaith_find = true; return {}; } }),
  E("ft.pe.faith_lose", [20, 400], "คุณสวดทุกเช้าตลอดชีวิต แต่วิหารที่คุณรักถูกเผาโดยนักบวชของมันเอง เพื่อเงินประกัน", [
    C("ไม่คุกเข่าให้ใครอีก", swing("f", -55, "ผู้ศรัทธาที่ทิ้งวิหาร")),
    C("สร้างวิหารเล็กๆ ขึ้นใหม่เอง", BIG("เทพไม่ได้อยู่ในหิน คุณรู้มาตลอด", { gold: -15 }, (l) => lean(l, { f: 8, m: 3 }))),
  ], { when: (l) => tr(l, "f") >= STRONG && !l.flags.ftFaith_lose, weight: 8, maxTimes: 1, title: "วิหารที่ถูกเผา", prepare: (l) => { l.flags.ftFaith_lose = true; return {}; } }),
];

/** นิสัยตอนเด็กส่งผลต่อพ่อแม่ทันที · ใช้เมื่อ log ต้องบอกว่าคนเห็นนิสัยใหม่ */
export function noticeShift(l: Life, before: string[]) {
  const now = traitWords(l, 4);
  const added = now.filter((w) => !before.includes(w));
  if (added.length && chance(l, 0.6)) log(l, `คนรอบตัวเริ่มพูดถึงคุณว่าเป็นคน${added[0]}`);
}
