// กลุ่ม 5 — ราชสำนักและวังหลัง (MURIM_EXPANSION §8.5 · MURIM_PLAN §18.8)
// คนในวังมีเป้าหมาย ความกลัว ความทะเยอทะยาน และหนุนหลังใครสักคน — อำนาจมาจากเครือข่าย ไม่ใช่คะแนนเดียว
// การสืบราชบัลลังก์คำนวณจากแรงหนุน ความชอบธรรม อายุ และแรงกดดันที่สะสม (มีทางออก 6 แบบ)
// ผู้เล่นเข้าวังได้จากอาชีพ/ราชโองการเท่านั้น และถอนตัวจากการเมืองได้ — โลกยังเดินต่อ
import type { Ctx, GameEvent } from "../../../engine/events";
import { yearHooks } from "../../../engine/game";
import { chance, pick, randInt } from "../../../engine/rng";
import type { Life } from "../../../engine/types";
import { clamp, log } from "../../../engine/util";
import { ab, B, BIG, C, E, FIGHT, G, K, N, P, PAY, near, type Res } from "../story/kit";
import { MURIM_FEMALE, MURIM_MALE, NOBLE_CLANS, titledName } from "../names";
import { courtHooks, courtOf, palaceAccess, type Court, type Temper } from "./court";

export type PRole = "empress" | "dowager" | "consort" | "eunuch" | "minister" | "general";
export interface Standing { trust: number; debt: number; grudge: number }
export interface PNpc {
  id: string;
  role: PRole;
  name: string;
  /** ตำแหน่ง เช่น "ฮองเฮา" "หัวหน้าขันทีฝ่ายเอกสาร" */
  title: string;
  clan?: string;
  goal: string;
  fear: string;
  /** หนุนใคร: id ขององค์ชาย · "emperor" · "self" */
  backs: string;
  /** ความทะเยอทะยาน และอิทธิพล 0–100 */
  amb: number;
  inf: number;
  alive: boolean;
  /** ถูกปลด/โยกย้าย/ออกจากวัง */
  out?: boolean;
  /** ความรู้สึกต่อผู้เล่น (คนละแกน ไม่รวมเป็นคะแนนเดียว) */
  you: Standing;
  /** ผู้เล่นเคยพบ/สืบรู้ว่าเขาหนุนใคร */
  known?: boolean;
  secret?: string;
  /** ฮ่องเต้(ผู้เล่น)สืบแล้วว่าภักดีหรือคิดคด (world/emperorLife.ts) */
  vetted?: "loyal" | "traitor";
}
export interface Prince {
  id: string;
  name: string;
  age: number;
  /** id ของแม่ (ฮองเฮา/สนม) */
  mother: string;
  ability: number;
  health: number;
  legit: number;
  named: boolean;
  temper: Temper;
  alive: boolean;
}
export interface Palace {
  cast: PNpc[];
  princes: Prince[];
  /** แรงกดดันการสืบทอด 0–100 */
  pressure: number;
  /** ท้องพระคลัง 0–100 */
  treasury: number;
  seq: number;
}

export type Succession = "smooth" | "regency" | "compromise" | "branch" | "war" | "coup";
export const SUCCESSION_NAME: Record<Succession, string> = {
  smooth: "สืบราชสมบัติอย่างราบรื่น",
  regency: "ผู้สำเร็จราชการปกครองแทน",
  compromise: "ขุนนางไกล่เกลี่ย",
  branch: "เชื้อพระวงศ์สายรอง",
  war: "สงครามแย่งชิงบัลลังก์",
  coup: "รัฐประหาร",
};

const PNAMES = MURIM_MALE;
const LADY = MURIM_FEMALE;
const CLANS = NOBLE_CLANS;
const MIN_PREFIX = ["เสนาบดี", "ราชเลขาธิการ", "ขุนนางตรวจการ", "เสนาบดีกรมคลัง", "เสนาบดีกรมพิธี", "เสนาบดีกรมกลาโหม"];
const castNames = (p: Palace) => p.cast.map((n) => n.name);
const LADY_GOAL = ["ปกป้องลูกของนาง", "รักษาความสงบในวัง", "ยกตระกูลเดิมให้ยิ่งใหญ่", "เป็นที่โปรดปรานของฮ่องเต้", "แค่มีชีวิตรอดในวังนี้"];
const LADY_FEAR = ["กลัวลูกถูกวางยา", "กลัวตระกูลถูกกวาดล้าง", "กลัวถูกลืมในตำหนักเย็น", "กลัวความลับในอดีตถูกเปิดโปง"];
const EUN_GOAL = ["มีบ้านและที่ดินไว้ตอนแก่", "เป็นหัวหน้าขันทีทั้งวัง", "ปกป้องเจ้านายของตน", "ทำงานให้ครบแล้วกลับบ้านเกิด"];
const EUN_FEAR = ["กลัวถูกโยนความผิดเมื่อเจ้านายตาย", "กลัวถูกเปิดโปงเรื่องเงิน", "กลัวแก่ตายอย่างไร้ค่า"];
const MIN_GOAL = ["ปฏิรูปภาษีให้ราษฎร", "สร้างพวกพ้องในราชสำนัก", "รักษาราชวงศ์ให้มั่นคง", "ล้มคู่แข่งในกรมเดียวกัน"];
const MIN_FEAR = ["กลัวการตรวจสอบบัญชี", "กลัวฮ่องเต้องค์ต่อไป", "กลัวเสียชื่อในประวัติศาสตร์"];
const SECRETS = ["เคยรับเงินจากพ่อค้าเกลือเถื่อน", "ส่งจดหมายลับถึงแม่ทัพชายแดน", "ลูกชายคนโตไม่ใช่สายเลือดที่แท้จริง", "เคยปลอมลายมือในราชโองการฉบับหนึ่ง", "ซ่อนญาติที่เป็นกบฏไว้ในวังนอก"];

const newId = (p: Palace, pre: string) => `${pre}${++p.seq}`;
const fresh = (): Standing => ({ trust: 0, debt: 0, grudge: 0 });
/** ขุนนางคนใหม่ที่ฮ่องเต้(ผู้เล่น)แต่งตั้งเอง — ภักดีต่อคุณตั้งแต่วันแรก */
export function appointMinister(l: Life, name: string, title: string, amb: number, trust: number): PNpc {
  const p = palaceOf(l);
  const n: PNpc = { id: newId(p, "n"), role: "minister", name, title, clan: pick(l, CLANS), goal: pick(l, MIN_GOAL), fear: pick(l, MIN_FEAR), backs: "emperor", amb, inf: 30, alive: true, known: true, you: { trust, debt: 20, grudge: 0 } };
  p.cast.push(n);
  return n;
}

function makeLady(l: Life, p: Palace, role: "empress" | "consort", name?: string, clan?: string, goal?: string): PNpc {
  return {
    id: newId(p, "n"),
    role,
    name: name ?? `${role === "empress" ? "ฮองเฮา" : "สนม"}${pick(l, LADY)}`,
    title: role === "empress" ? "ฮองเฮา ประมุขฝ่ายใน" : pick(l, ["พระสนมเอก", "พระสนมชั้นสอง", "สนมคนโปรด"]),
    clan: clan ?? pick(l, CLANS),
    goal: goal ?? pick(l, LADY_GOAL),
    fear: pick(l, LADY_FEAR),
    backs: "emperor",
    amb: randInt(l, 15, 85),
    inf: role === "empress" ? randInt(l, 45, 75) : randInt(l, 20, 55),
    alive: true,
    you: fresh(),
    secret: chance(l, 0.4) ? pick(l, SECRETS) : undefined,
  };
}

function makePrince(l: Life, p: Palace, mother: string, age: number, named = false): Prince {
  const used = new Set(p.princes.map((x) => x.name));
  const free = PNAMES.filter((n) => !used.has(`องค์ชาย${n}`));
  return {
    id: newId(p, "p"),
    name: `องค์ชาย${pick(l, free.length ? free : PNAMES)}`,
    age,
    mother,
    ability: randInt(l, 25, 85),
    health: randInt(l, 55, 95),
    legit: named ? randInt(l, 60, 85) : randInt(l, 30, 60),
    named,
    temper: pick(l, ["wise", "wise", "tyrant", "puppet", "paranoid"] as Temper[]),
    alive: true,
  };
}

/** ใครในวังหนุนองค์ชายองค์ไหน — มาจากสายเลือด เป้าหมาย และนิสัย ไม่ใช่สุ่มลอยๆ */
function chooseBacking(_l: Life, p: Palace) {
  const live = p.princes.filter((x) => x.alive);
  const named = live.find((x) => x.named);
  const able = live.slice().sort((a, b) => b.ability - a.ability)[0];
  const eldest = live.slice().sort((a, b) => b.age - a.age)[0];
  const youngest = live.slice().sort((a, b) => a.age - b.age)[0];
  for (const n of p.cast) {
    if (!n.alive || n.out) continue;
    const son = live.find((x) => x.mother === n.id);
    if (n.role === "empress" || n.role === "consort" || n.role === "dowager") n.backs = son?.id ?? named?.id ?? "emperor";
    else if (n.role === "eunuch") n.backs = n.amb >= 70 ? youngest?.id ?? "self" : named?.id ?? "emperor";
    else if (n.role === "minister") n.backs = n.goal.includes("พวกพ้อง") || n.goal.includes("ล้มคู่แข่ง") ? youngest?.id ?? "emperor" : able?.id ?? "emperor";
    else if (n.role === "general") n.backs = n.amb >= 80 ? "self" : eldest?.id ?? "emperor";
  }
}

/** วังหลังของราชสำนักนี้ (สร้างจากราชสำนักเดิมครั้งแรก — เซฟเก่าได้ทั้งชุด) */
export function palaceOf(l: Life): Palace {
  const c = courtOf(l);
  if (c.palace) return c.palace;
  const p: Palace = { cast: [], princes: [], pressure: randInt(l, 5, 25), treasury: randInt(l, 40, 70), seq: 0 };
  c.palace = p;
  const empress = makeLady(l, p, "empress", c.empress.name, c.empress.clan, c.empress.goal);
  p.cast.push(empress);
  const consorts = [makeLady(l, p, "consort"), makeLady(l, p, "consort")];
  p.cast.push(...consorts);
  // รัชทายาทเดิม (ถ้ามี) + องค์ชายอื่นจากสนม
  if (c.heir) {
    const mom = c.heir.backer === "empress" ? empress : consorts[0];
    const pr = makePrince(l, p, mom.id, c.heir.age, true);
    pr.name = c.heir.name;
    pr.legit = c.heir.legit;
    p.princes.push(pr);
  }
  for (const m of [consorts[0], consorts[1], empress]) {
    if (p.princes.length >= 3 || !chance(l, 0.55)) continue;
    const top = Math.max(1, Math.min(30, c.emperor.age - 16));
    p.princes.push(makePrince(l, p, m.id, randInt(l, 1, top)));
  }
  const loyal = c.eunuch.loyal;
  p.cast.push({ id: newId(p, "n"), role: "eunuch", name: c.eunuch.name, title: "หัวหน้าขันทีฝ่ายเอกสารและการเข้าเฝ้า", goal: pick(l, EUN_GOAL), fear: pick(l, EUN_FEAR), backs: "emperor", amb: loyal === "self" ? randInt(l, 70, 95) : randInt(l, 20, 60), inf: c.eunuch.power, alive: true, you: fresh(), secret: chance(l, 0.5) ? pick(l, SECRETS) : undefined });
  p.cast.push({ id: newId(p, "n"), role: "eunuch", name: titledName(l, "ขันที", [c.eunuch.name]), title: "ขันทีคุมประตูวังชั้นใน", goal: pick(l, EUN_GOAL), fear: pick(l, EUN_FEAR), backs: "emperor", amb: randInt(l, 10, 70), inf: randInt(l, 15, 40), alive: true, you: fresh() });
  for (const n of [titledName(l, "เสนาบดี"), titledName(l, pick(l, MIN_PREFIX.slice(1)))]) p.cast.push({ id: newId(p, "n"), role: "minister", name: n, title: n.startsWith("ขุนนางตรวจการ") ? "ขุนนางตรวจการ" : "ขุนนางชั้นผู้ใหญ่", clan: pick(l, CLANS), goal: pick(l, MIN_GOAL), fear: pick(l, MIN_FEAR), backs: "emperor", amb: randInt(l, 20, 85), inf: Math.round(c.ministers * randInt(l, 6, 10) / 10), alive: true, you: fresh(), secret: chance(l, 0.35) ? pick(l, SECRETS) : undefined });
  p.cast.push({ id: newId(p, "n"), role: "general", name: titledName(l, "แม่ทัพ", castNames(p)), title: "แม่ทัพรักษาชายแดน", goal: pick(l, ["ปกป้องชายแดน", "ได้ทัพหลวงมาอยู่ในมือ", "ล้างแค้นให้ทหารที่ตายเพราะคำสั่งผิด"]), fear: pick(l, ["กลัวถูกเรียกตัวกลับไปรับโทษ", "กลัวทหารอดตายเพราะเสบียงไม่มา"]), backs: "emperor", amb: randInt(l, 20, 90), inf: Math.round(c.military * randInt(l, 7, 10) / 10), alive: true, you: fresh() });
  chooseBacking(l, p);
  syncHeir(c, p);
  return p;
}

export const castOf = (l: Life) => palaceOf(l).cast.filter((n) => n.alive && !n.out);
export const princesOf = (l: Life) => palaceOf(l).princes.filter((x) => x.alive);
export const npcById = (l: Life, id: unknown) => palaceOf(l).cast.find((n) => n.id === id);
export const princeById = (l: Life, id: unknown) => palaceOf(l).princes.find((x) => x.id === id);
const W: Record<PRole, number> = { empress: 1.1, dowager: 1.2, consort: 0.7, eunuch: 0.9, minister: 1, general: 1.3 };

/** น้ำหนักของผู้เล่นในการเมืองวัง: ชื่อเสียง ฝีมือ ตำแหน่ง */
export const playerWeight = (l: Life) => clamp(8 + l.fame / 5 + (l.power?.rank ?? 0) * 3 + (l.job && ["official", "imperial_guard", "jinyiwei"].includes(l.job.careerId) ? l.job.level * 3 : 0), 5, 40);

/** แรงหนุนรวมขององค์ชาย: ความชอบธรรม + คนที่หนุน (ตามอิทธิพลและบทบาท) + ผู้เล่น */
export function support(l: Life, pr: Prince): number {
  let s = pr.legit * 0.5 + (pr.named ? 15 : 0) + pr.ability * 0.1;
  for (const n of castOf(l)) if (n.backs === pr.id) s += n.inf * W[n.role] * 0.5;
  if (l.flags.palaceBack === pr.id && !l.flags.palaceWithdrawn) s += playerWeight(l);
  return Math.round(s);
}

function syncHeir(c: Court, p: Palace) {
  const h = p.princes.find((x) => x.alive && x.named);
  const empress = p.cast.find((n) => n.role === "empress" && n.alive);
  c.heir = h ? { name: h.name, age: h.age, legit: h.legit, backer: h.mother === empress?.id ? "empress" : "consort" } : undefined;
}

export const PRESSURE_LABEL = (v: number) => (v >= 75 ? "ใกล้ปะทุ" : v >= 50 ? "ระอุ" : v >= 25 ? "เริ่มตึงเครียด" : "สงบ");

/** ข่าวในวัง: คนที่เข้าวังได้รู้ชัด · คนนอกได้ยินแค่ข่าวลือบางเรื่อง */
function news(l: Life, inside: string, outside?: string) {
  if (palaceAccess(l)) log(l, `🏯 ${inside}`);
  else if (outside && chance(l, 0.35)) log(l, `🗞️ ข่าวลือจากเมืองหลวง: ${outside}`);
}

/** ทุกปี: องค์ชายโตขึ้น คนในวังขยับอิทธิพล แรงกดดันสะสม ท้องพระคลังเปลี่ยนตามนโยบาย */
function tickPalace(l: Life) {
  if (l.worldId !== "murim" || !l.alive || !l.mw) return;
  const c = courtOf(l);
  const p = palaceOf(l);
  const w = l.mw;
  for (const pr of p.princes) {
    if (!pr.alive) continue;
    pr.age++;
    pr.health = clamp(pr.health + randInt(l, -4, 3), 0, 100);
    if (pr.health <= 0 || chance(l, pr.age < 6 ? 0.01 : 0.004)) {
      pr.alive = false;
      news(l, `${pr.name}สิ้นพระชนม์ด้วยพระอาการประชวร — หมอหลวงสามคนถูกสอบสวน`, `ว่ากันว่า${pr.name}ถูกวางยา`);
    }
  }
  // ฮ่องเต้ตั้งรัชทายาทตามนิสัย (ปรีชา = คนเก่ง · ทรราช/ระแวง = ลูกสนมคนโปรด · หุ่นเชิด = คนที่มีแรงหนุนมาก)
  const live = p.princes.filter((x) => x.alive);
  if (!live.some((x) => x.named) && c.emperor.age >= 35 && live.some((x) => x.age >= 8) && chance(l, 0.15)) {
    const pool = live.filter((x) => x.age >= 8);
    const fav = p.cast.find((n) => n.role === "consort" && n.alive && !n.out && n.title === "สนมคนโปรด");
    const pickP =
      c.emperor.temper === "wise" ? pool.sort((a, b) => b.ability - a.ability)[0]
      : c.emperor.temper === "puppet" ? pool.sort((a, b) => support(l, b) - support(l, a))[0]
      : pool.find((x) => x.mother === fav?.id) ?? pool[0];
    pickP.named = true;
    pickP.legit = clamp(pickP.legit + 25, 0, 100);
    chooseBacking(l, p);
    news(l, `${c.emperor.name}ทรงแต่งตั้ง${pickP.name}เป็นรัชทายาท`, `ได้ยินว่ามีการตั้งรัชทายาทแล้ว`);
  }
  // อิทธิพลขยับ: ขันทีที่ทะเยอทะยานโตเมื่อฮ่องเต้อ่อนแอ · ขุนนางที่โกงเสื่อมเมื่อถูกตรวจ
  for (const n of p.cast) {
    if (!n.alive || n.out) continue;
    const weak = c.emperor.temper === "puppet" || c.emperor.health < 40;
    n.inf = clamp(n.inf + randInt(l, -3, 3) + (n.role === "eunuch" && n.amb >= 70 && weak ? 2 : 0), 5, 100);
    if (n.role !== "empress" && chance(l, 0.012)) {
      n.alive = false;
      news(l, `${n.name}ถึงแก่กรรม — ตำแหน่ง${n.title}ว่างลง`);
    }
  }
  // คนใหม่เข้ามาแทนที่ว่าง (ไม่ให้วังร้าง)
  for (const role of (l.flags.emperorSelf ? ["eunuch", "minister", "general"] : ["eunuch", "minister", "general", "consort"]) as PRole[]) {
    const have = p.cast.filter((n) => n.role === role && n.alive && !n.out).length;
    const need = role === "eunuch" || role === "minister" || role === "consort" ? 2 : 1;
    if (have < need && chance(l, 0.5)) {
      const n: PNpc =
        role === "consort" ? makeLady(l, p, "consort")
        : { id: newId(p, "n"), role, name: titledName(l, role === "eunuch" ? "ขันที" : role === "minister" ? pick(l, MIN_PREFIX) : "แม่ทัพ", castNames(p)), title: role === "eunuch" ? "ขันทีคุมประตูวังชั้นใน" : role === "minister" ? "ขุนนางชั้นผู้ใหญ่" : "แม่ทัพรักษาชายแดน", goal: pick(l, role === "minister" ? MIN_GOAL : EUN_GOAL), fear: pick(l, role === "minister" ? MIN_FEAR : EUN_FEAR), backs: "emperor", amb: randInt(l, 15, 80), inf: randInt(l, 20, 45), alive: true, you: fresh() };
      p.cast.push(n);
      chooseBacking(l, p);
    }
  }
  if (p.cast.length > 24) p.cast = p.cast.filter((n) => n.alive && !n.out).concat(p.cast.filter((n) => !n.alive || n.out).slice(-6));
  // แรงกดดันการสืบทอดสะสมจากเหตุจริง
  const sorted = live.map((x) => support(l, x)).sort((a, b) => b - a);
  const close = sorted.length >= 2 && sorted[0] - sorted[1] < 15;
  p.pressure = clamp(
    p.pressure - 5 +
      (c.emperor.health < 40 ? 8 : 0) +
      (c.emperor.age > 60 ? 4 : 0) +
      (!live.some((x) => x.named) && c.emperor.age > 40 ? 6 : 0) +
      (close ? 6 : 0) +
      (c.emperor.temper === "paranoid" ? 3 : 0) +
      (p.cast.some((n) => n.backs === "self" && n.inf >= 60 && n.alive && !n.out) ? 4 : 0) -
      (c.emperor.temper === "wise" && live.some((x) => x.named && x.legit >= 70) ? 4 : 0),
    0,
    100,
  );
  // ท้องพระคลัง: ภาษีหนักเพิ่ม · ขุนนางโกงกินลด · คลังว่าง = ช่วยราษฎรไม่ได้
  const greedy = p.cast.filter((n) => n.role === "minister" && n.alive && !n.out && n.amb >= 70).length;
  p.treasury = clamp(p.treasury + (c.edict === "heavy_tax" ? 6 : 1) - greedy * 2 - (w.era === "chaos" || w.era === "war" ? 4 : 0) - (w.crisis ? 3 : 0), 0, 100);
  if (p.treasury < 25) w.unrest = clamp(w.unrest + 2, 0, 100);
  if (p.treasury > 70 && w.crisis) w.food = clamp(w.food + 3, 0, 100);
  if (p.pressure >= 75) w.legitimacy = clamp(w.legitimacy - 1, 0, 100);
  syncHeir(c, p);
}

/** การสืบราชบัลลังก์: คำนวณจากแรงหนุน ความชอบธรรม อายุ และแรงกดดัน (EXPANSION §8.5.4) */
export function succeed(l: Life, c: Court, yr: number): string {
  const p = palaceOf(l);
  const w = l.mw!;
  const ps = p.princes.filter((x) => x.alive).map((x) => ({ x, s: support(l, x) })).sort((a, b) => b.s - a.s);
  const top = ps[0], second = ps[1];
  const gap = top ? top.s - (second?.s ?? 0) : 0;
  const strongman = castOf(l).filter((n) => (n.role === "eunuch" || n.role === "general") && n.backs === "self" && n.amb >= 75 && n.inf >= 60).sort((a, b) => b.inf - a.inf)[0];
  const general = castOf(l).find((n) => n.role === "general");
  let kind: Succession;
  let winner: Prince | undefined = top?.x;
  let loser: Prince | undefined;
  let regent: PNpc | undefined;
  if (!top) kind = "branch";
  else if (strongman && (p.pressure >= 70 || c.emperor.temper === "tyrant" || c.emperor.temper === "paranoid")) kind = "coup";
  else if (second && gap < 12 && p.pressure >= 60 && (general?.backs === top.x.id || general?.backs === second.x.id || c.military >= 60)) kind = "war";
  else if (top.x.age < 16) kind = "regency";
  else if (second && gap < 12) kind = "compromise";
  else kind = "smooth";

  let how = SUCCESSION_NAME[kind];
  const backersOf = (pr?: Prince) => castOf(l).filter((n) => pr && n.backs === pr.id);
  if (kind === "branch") {
    const council = castOf(l).filter((n) => n.role === "minister").sort((a, b) => b.inf - a.inf)[0];
    how = `${how} — ราชวงศ์ไร้โอรส ${council?.name ?? "สภาขุนนาง"}เลือกเชื้อพระวงศ์สายรองขึ้นครองราชย์`;
    w.legitimacy = clamp(w.legitimacy - 10, 0, 100);
    c.emperor = { name: `ฮ่องเต้${pick(l, PNAMES)}`, age: randInt(l, 25, 50), temper: pick(l, ["puppet", "wise", "paranoid"] as Temper[]), health: 75, since: yr };
    if (council) council.inf = clamp(council.inf + 15, 0, 100);
  } else if (kind === "coup") {
    const puppet = ps.slice().sort((a, b) => a.x.age - b.x.age)[0].x;
    winner = puppet;
    regent = strongman;
    how = `${how} — ${strongman!.name}ยึดประตูวังในคืนเดียว แล้วยก${puppet.name}ที่ยังเยาว์ขึ้นครองราชย์ ตัวเองกุมอำนาจทั้งหมด`;
    w.legitimacy = clamp(w.legitimacy - 20, 0, 100);
    w.unrest = clamp(w.unrest + 15, 0, 100);
  } else if (kind === "war") {
    // ฝ่ายที่มีกองทัพหนุนได้เปรียบ แต่ไม่แน่นอน
    const aMil = general?.backs === top.x.id ? 15 : 0, bMil = general?.backs === second!.x.id ? 15 : 0;
    const aWin = chance(l, clamp(0.5 + (top.s + aMil - second!.s - bMil) / 80, 0.15, 0.85));
    winner = aWin ? top.x : second!.x;
    loser = aWin ? second!.x : top.x;
    loser.alive = false;
    how = `${how} — ${top.x.name}กับ${second!.x.name}ยกทัพเข้าหากัน สามปีที่แผ่นดินลุกเป็นไฟ ${winner.name}เป็นฝ่ายชนะ`;
    w.unrest = clamp(w.unrest + 30, 0, 100);
    w.legitimacy = clamp(w.legitimacy - 25, 0, 100);
    w.food = clamp(w.food - 15, 0, 100);
    p.treasury = clamp(p.treasury - 30, 0, 100);
  } else if (kind === "regency") {
    regent = backersOf(top.x).filter((n) => n.role !== "consort").sort((a, b) => b.inf - a.inf)[0] ?? backersOf(top.x)[0];
    how = `${how} — ${top.x.name}ยังทรงพระเยาว์ ${regent?.name ?? "ไทเฮา"}สำเร็จราชการแทน`;
  } else if (kind === "compromise") {
    loser = second!.x;
    how = `${how} — แรงหนุนของ${top.x.name}กับ${second!.x.name}สูสี ขุนนางยอมรับ${top.x.name} แลกกับการแต่งตั้ง${second!.x.name}เป็นอ๋องครองหัวเมือง`;
    w.legitimacy = clamp(w.legitimacy - 5, 0, 100);
  } else how = `${how} — ${top.x.name}ขึ้นครองราชย์ตามพระราชประสงค์`;

  if (winner) {
    c.emperor = { name: `ฮ่องเต้${winner.name.replace("องค์ชาย", "")}`, age: winner.age, temper: winner.temper, health: Math.max(60, winner.health), since: yr };
    if (kind === "smooth") c.edict = "amnesty";
    // ผู้ชนะที่ได้บัลลังก์ด้วยดาบและระแวงทุกคน มักกวาดล้างสำนักยุทธ์ที่เคยเลือกข้าง
    else if ((kind === "war" || kind === "coup") && (c.emperor.temper === "paranoid" || c.emperor.temper === "tyrant") && chance(l, 0.5)) c.edict = "ban_sects";
  }
  c.regent = regent?.name;
  // คนที่หนุนผู้ชนะได้ดี · คนที่หนุนฝ่ายแพ้เสื่อม (ฮ่องเต้ระแวง/ทรราช = ถูกกวาดล้าง)
  const harsh = c.emperor.temper === "tyrant" || c.emperor.temper === "paranoid" || kind === "war" || kind === "coup";
  for (const n of castOf(l)) {
    if (winner && n.backs === winner.id) n.inf = clamp(n.inf + 15, 0, 100);
    else if (n.backs !== "emperor" && n.backs !== "self" && n !== regent) { n.inf = clamp(n.inf - 20, 0, 100); if (harsh && chance(l, 0.6)) n.out = true; }
  }
  if (regent) regent.inf = clamp(regent.inf + 20, 0, 100);
  // ผลต่อผู้เล่นที่เลือกข้าง → เหตุการณ์หลังผลัดแผ่นดิน
  const backed = !l.flags.palaceWithdrawn && l.flags.palaceBack ? String(l.flags.palaceBack) : "";
  if (backed) l.flags.palaceAfter = JSON.stringify({ won: backed === winner?.id, kind, name: princeById(l, backed)?.name ?? "", harsh });
  delete l.flags.palaceBack;
  // วังรุ่นใหม่: แม่ของผู้ชนะเป็นไทเฮา · ฮองเฮาและสนมชุดใหม่ · องค์ชายรุ่นใหม่
  const mom = p.cast.find((n) => n.id === winner?.mother && n.alive);
  for (const n of p.cast) if (n.role === "empress" || n.role === "consort" || n.role === "dowager") { if (n === mom) { n.role = "dowager"; n.title = "ไทเฮา พระพันปีหลวง"; } else n.out = true; }
  const emp = makeLady(l, p, "empress");
  p.cast.push(emp, makeLady(l, p, "consort"));
  c.empress = { name: emp.name, clan: emp.clan!, goal: emp.goal };
  p.princes = p.princes.filter((x) => x.alive && x !== winner && x !== loser);
  const kids = c.emperor.age >= 18 ? randInt(l, 0, 2) : 0;
  for (let i = 0; i < kids; i++) p.princes.push(makePrince(l, p, emp.id, randInt(l, 0, Math.max(0, Math.min(10, c.emperor.age - 17)))));
  p.pressure = kind === "war" || kind === "coup" ? 45 : kind === "compromise" ? 30 : 10;
  chooseBacking(l, p);
  syncHeir(c, p);
  return how;
}
courtHooks.succeed = succeed;
yearHooks.push(tickPalace);
// ถอนตัวจากการเมือง 8 ปีแล้ว กลับเข้าวังได้อีกถ้ายังมีตำแหน่ง/ช่องทาง
yearHooks.push((l) => {
  if (l.worldId !== "murim" || !l.flags.palaceWithdrawn) return;
  if (l.flags.palaceWithdrawn === true) l.flags.palaceWithdrawn = l.age || 1;
  else if (l.age - Number(l.flags.palaceWithdrawn) >= 8) delete l.flags.palaceWithdrawn;
});

// ───────── ผู้เล่นในวัง ─────────

export type PalaceRole = "guard" | "physician" | "official" | "supplier" | "spy" | "guest";
export function palaceRoleOf(l: Life): PalaceRole | undefined {
  if (!palaceAccess(l)) return;
  const j = l.job?.careerId;
  if (j === "jinyiwei" || l.flags.palaceSpy) return "spy";
  if (j === "imperial_guard") return "guard";
  if (j === "palace_physician" || j === "herbalist") return "physician";
  if (j === "official") return "official";
  if (j === "merchant") return "supplier";
  return "guest";
}
export const ROLE_NAME: Record<PalaceRole, string> = { guard: "องครักษ์ในวัง", physician: "หมอที่เข้าวังได้", official: "ขุนนาง", supplier: "พ่อค้าส่งของเข้าวัง", spy: "สายข่าวของราชสำนัก", guest: "แขกที่ฮ่องเต้เรียกตัว" };
const inPolitics = (l: Life) => palaceAccess(l) && !l.flags.palaceWithdrawn;
/** ผู้อุปถัมภ์ของผู้เล่น */
export const patronOf = (l: Life) => (l.flags.palacePatron ? npcById(l, l.flags.palacePatron) : undefined);

const NPC = (l: Life, c: Ctx) => npcById(l, c.nid);
const PR = (l: Life, c: Ctx) => princeById(l, c.prid);
const nName = (l: Life, c: Ctx) => NPC(l, c)?.name ?? "คนในวัง";
const prName = (l: Life, c: Ctx) => PR(l, c)?.name ?? "องค์ชาย";
/** เปลี่ยนความรู้สึกของคนในวังต่อผู้เล่น */
function stand(l: Life, id: unknown, d: Partial<Standing>) {
  const n = npcById(l, id);
  if (!n) return;
  n.known = true;
  n.you.trust = clamp(n.you.trust + (d.trust ?? 0), -100, 100);
  n.you.debt = clamp(n.you.debt + (d.debt ?? 0), 0, 100);
  n.you.grudge = clamp(n.you.grudge + (d.grudge ?? 0), 0, 100);
}
/** ผลลัพธ์ที่ขยับคนในวังด้วย (คนในฉาก = nid · คนที่สอง = nid2) */
const with2 = (r: Res, f: (l: Life, c: Ctx) => void): Res => Object.assign((l: Life, c: Ctx) => { f(l, c); return r(l, c); }, { fx: r.fx });

const pickNpc = (l: Life, f: (n: PNpc) => boolean) => { const xs = castOf(l).filter(f); return xs.length ? pick(l, xs) : undefined; };
const rivalOf = (l: Life, n: PNpc) => castOf(l).find((x) => x !== n && x.backs !== n.backs && x.backs !== "emperor" && (x.role === n.role || x.inf >= n.inf - 10));

/** ปิดเรื่องหลังผลัดแผ่นดิน (ล้างธงที่รอ) · jail = ติดคุกกี่ปี */
const settle = (r: Res, jail = 0): Res =>
  with2(r, (l) => {
    delete l.flags.palaceAfter;
    if (jail) l.flags.jailUntil = Math.max(Number(l.flags.jailUntil ?? -1), l.age + jail);
  });

export const PALACE_EVENTS: GameEvent[] = [
  E("ct.p_patron", [18, 75], (l, c) => { const n = NPC(l, c)!; return `${n.name} (${n.title}) ส่งคนนำกล่องไม้จันทน์มาให้ถึงบ้าน ข้างในคือหยกหนึ่งชิ้นกับข้อความสั้นๆ "วังนี้กว้าง คนที่ไม่มีใครคุ้มหัวมักหายไปเงียบๆ"`; }, [
    C("รับไว้ เป็นคนของเขา", with2(G((l, c) => `คุณกลายเป็นคนของ${nName(l, c)} — ประตูหลายบานเปิดง่ายขึ้น แต่ศัตรูของเขาก็เป็นศัตรูของคุณแล้ว`, { tael: 30, fame: 2 }), (l, c) => { l.flags.palacePatron = String(c.nid); stand(l, c.nid, { trust: 25, debt: 10 }); const n = NPC(l, c); if (n && n.backs !== "emperor" && n.backs !== "self") l.flags.palaceBack = n.backs; })),
    K("ปฏิเสธอย่างนุ่มนวล คืนของพร้อมคำขอบคุณ", "smarts", 55, with2(N("เขาส่งคนมาบอกว่า \"ฉลาดดี\" — คุณยังเป็นของตัวเอง"), (l, c) => stand(l, c.nid, { trust: 5 })), with2(B("คำปฏิเสธฟังเหมือนดูหมิ่น — เขาจดชื่อคุณไว้แล้ว", { joy: -3 }), (l, c) => stand(l, c.nid, { grudge: 20 }))),
    C("นำของไปแจ้งฝ่ายตรงข้ามของเขา", with2(N((l, c) => `ฝ่ายตรงข้ามของ${nName(l, c)}ขอบใจคุณ — และตอนนี้ทั้งวังรู้ว่าคุณเลือกข้างแล้ว`, { align: -1 }), (l, c) => { const n = NPC(l, c); const r = n && rivalOf(l, n); stand(l, c.nid, { grudge: 30 }); if (r) { stand(l, r.id, { trust: 20, debt: 10 }); l.flags.palacePatron = r.id; if (r.backs !== "emperor" && r.backs !== "self") l.flags.palaceBack = r.backs; } })),
  ], { when: (l) => inPolitics(l) && !patronOf(l), prepare: (l) => ({ nid: pickNpc(l, (n) => n.amb >= 40 && n.role !== "general")?.id ?? castOf(l)[0].id }), weight: 9, maxTimes: 3, title: "ผู้อุปถัมภ์" }),

  E("ct.p_appoint", [20, 80], (l, c) => `${nName(l, c)}เสนอชื่อหลานชายของตนเข้ารับตำแหน่งข้าหลวงกรมเสบียง — ทุกคนรู้ว่าเด็กคนนั้นนับเลขไม่เป็น แต่ไม่มีใครกล้าค้าน แล้วสายตาทุกคู่ก็หันมาที่คุณ`, [
    C("สนับสนุน", with2(N((l, c) => `หลานของ${nName(l, c)}ได้ตำแหน่ง เขาติดหนี้คุณหนึ่งครั้ง — แต่ขุนนางตรวจการจดชื่อคุณไว้ในบัญชีพวกพ้อง`, { align: -2, tael: 15 }), (l, c) => { stand(l, c.nid, { debt: 25, trust: 10 }); l.mw!.legitimacy = clamp(l.mw!.legitimacy - 2, 0, 100); palaceOf(l).treasury = clamp(palaceOf(l).treasury - 4, 0, 100); })),
    C("คัดค้านต่อหน้าที่ประชุม", with2(G("ที่ประชุมเงียบไปครู่หนึ่ง แล้วขุนนางตรวจการพยักหน้าให้คุณ — แต่คนที่ถูกหักหน้าไม่ลืม", { fame: 3, align: 2 }), (l, c) => { stand(l, c.nid, { grudge: 30 }); const cen = castOf(l).find((n) => n.title === "ขุนนางตรวจการ"); if (cen) stand(l, cen.id, { trust: 15 }); })),
    K("เสนอชื่อคนที่เก่งกว่า พร้อมเหตุผล", "smarts", 62, with2(G("คุณเสนอเสมียนเก่าที่ทำบัญชีมายี่สิบปี — ทุกฝ่ายรับได้ เขาเองก็ยอมถอยอย่างไม่เสียหน้า", { fame: 4 }), (l, c) => { stand(l, c.nid, { trust: 5 }); palaceOf(l).treasury = clamp(palaceOf(l).treasury + 4, 0, 100); }), with2(B("เหตุผลของคุณฟังเหมือนกำลังดันคนของตัวเอง — ทั้งสองฝ่ายระแวงคุณ", { fame: -2 }), (l, c) => stand(l, c.nid, { grudge: 15 }))),
  ], { when: (l) => inPolitics(l) && (palaceRoleOf(l) === "official" || palaceRoleOf(l) === "guest"), prepare: (l) => ({ nid: pickNpc(l, (n) => n.role === "minister" || n.role === "empress")?.id ?? castOf(l)[0].id }), weight: 9, maxTimes: 3, title: "การแต่งตั้งที่ขัดแย้ง" }),

  E("ct.p_consort", [18, 80], (l, c) => { const n = NPC(l, c)!; return `${n.name}เชิญคุณไปตำหนักของนาง "ข้ากับฮองเฮาไม่ได้เป็นศัตรูกัน แต่คนรอบตัวพวกเราอยากให้เป็น — ${n.fear.replace("กลัว", "ข้ากลัว")}"`; }, [
    K("รับเป็นคนกลางไกล่เกลี่ย", "looks", 58, with2(G("คุณพาคนสนิทของทั้งสองฝ่ายมาดื่มชาโต๊ะเดียวกัน — วังเงียบลงไปทั้งฤดู", { fame: 3, joy: 3 }), (l, c) => { stand(l, c.nid, { trust: 20 }); const e = castOf(l).find((n) => n.role === "empress"); if (e) stand(l, e.id, { trust: 15 }); palaceOf(l).pressure = clamp(palaceOf(l).pressure - 12, 0, 100); }), with2(B("ข้อความที่คุณถือไปถูกตีความผิดทั้งสองทาง — ตอนนี้ทั้งคู่สงสัยคุณ", { joy: -3 }), (l, c) => { stand(l, c.nid, { trust: -10 }); const e = castOf(l).find((n) => n.role === "empress"); if (e) stand(l, e.id, { trust: -10 }); })),
    C("ถือหางนาง", with2(N("นางกุมมือคุณแน่น — คุณมีพันธมิตรในวังหลัง และมีศัตรูที่ตำหนักฮองเฮา", { tael: 10 }), (l, c) => { stand(l, c.nid, { trust: 25, debt: 10 }); const e = castOf(l).find((n) => n.role === "empress"); if (e) stand(l, e.id, { grudge: 15 }); const n = NPC(l, c); if (n && n.backs !== "emperor") l.flags.palaceBack = n.backs; })),
    C("บอกตรงๆ ว่าไม่ยุ่งเรื่องวังหลัง", N("นางยิ้มเศร้าๆ \"คนที่ไม่ยุ่งมักอยู่ได้นานที่สุด\"")),
  ], { when: (l) => inPolitics(l) && castOf(l).some((n) => n.role === "consort"), prepare: (l) => ({ nid: pickNpc(l, (n) => n.role === "consort")?.id ?? "" }), weight: 8, maxTimes: 3, title: "ตำหนักสนม" }),

  E("ct.p_physician", [25, 85], (l) => `จับชีพจรถวายเสร็จ มือคุณเย็นเฉียบ — พระอาการของ${courtOf(l).emperor.name}หนักกว่าที่ประกาศไว้มาก อาจเหลือไม่กี่ปี ${castOf(l).find((n) => n.role === "eunuch")?.name ?? "ขันที"}ยืนรออยู่หน้าประตู`, [
    C("ทูลความจริงต่อพระพักตร์", with2(G("ฮ่องเต้นิ่งไปนาน แล้วตรัสว่า \"อย่างน้อยก็มีคนไม่โกหกข้า\" — ปีนั้นมีการตั้งรัชทายาท", { fame: 3, align: 2 }), (l) => { const p = palaceOf(l); const live = p.princes.filter((x) => x.alive); if (live.length && !live.some((x) => x.named)) { const best = live.sort((a, b) => b.ability - a.ability)[0]; best.named = true; best.legit = clamp(best.legit + 20, 0, 100); chooseBacking(l, p); } p.pressure = clamp(p.pressure + 5, 0, 100); })),
    C("ทูลฮองเฮาเป็นการลับ", with2(N("ฮองเฮาขอบใจคุณด้วยแหวนหยก — และเริ่มเตรียมการบางอย่างในคืนนั้นเอง", { tael: 20 }), (l) => { const e = castOf(l).find((n) => n.role === "empress"); if (e) { stand(l, e.id, { trust: 20, debt: 15 }); e.inf = clamp(e.inf + 8, 0, 100); } palaceOf(l).pressure = clamp(palaceOf(l).pressure + 10, 0, 100); })),
    C("ขายข่าวให้ขันทีหน้าประตู", with2(N("ถุงทองหนักมือ — ข่าวนี้จะไปถึงคนที่จ่ายแพงที่สุดก่อนพระอาทิตย์ขึ้น", { tael: 60, align: -5 }), (l) => { const e = castOf(l).find((n) => n.role === "eunuch"); if (e) { stand(l, e.id, { debt: 20 }); e.inf = clamp(e.inf + 10, 0, 100); } palaceOf(l).pressure = clamp(palaceOf(l).pressure + 12, 0, 100); l.flags.soldEmperorSecret = true; })),
    C("เก็บเป็นความลับ", N("คุณเขียนตำรับยาบำรุงตามปกติ — ความลับนี้หนักกว่าหีบยาทั้งหีบ")),
  ], { when: (l) => inPolitics(l) && palaceRoleOf(l) === "physician" && courtOf(l).emperor.health < 55, weight: 10, maxTimes: 1, title: "ชีพจรของโอรสสวรรค์" }),

  E("ct.p_prince_ill", [20, 85], (l, c) => `${prName(l, c)}ประชวรหนัก หมอหลวงคนก่อนบอกว่าเป็นไข้หวัดลงปอด — แต่คุณเห็นเล็บพระหัตถ์เป็นสีม่วงคล้ำ`, [
    K("สืบว่าใครแตะต้องพระกระยาหาร", "smarts", 60, with2(BIG("ถ้วยน้ำแกงผ่านมือนางกำนัลคนเดียวกันทุกเย็น — นางรับเงินจากคนในวัง คุณส่งหลักฐานให้ราชสำนัก ผู้บงการถูกปลด", { fame: 6, align: 3 }), (l, c) => { const pr = PR(l, c); if (pr) pr.health = clamp(pr.health + 30, 0, 100); const v = pickNpc(l, (n) => n.backs !== pr?.id && n.backs !== "emperor" && n.amb >= 50); if (v) { v.out = true; stand(l, v.id, { grudge: 40 }); } }), with2(B("ร่องรอยถูกล้างหมดแล้ว — และมีคนรู้ว่าคุณกำลังสืบ", { joy: -4 }), (l) => { l.flags.palaceTarget = true; })),
    K("รักษาเงียบๆ ถอนพิษก่อน", "smarts", 50, with2(G("ยาถอนพิษได้ผล องค์ชายหายดี — พระองค์จำได้ว่าใครอยู่ข้างเตียงในคืนนั้น", { fame: 2 }), (l, c) => { const pr = PR(l, c); if (pr) { pr.health = clamp(pr.health + 35, 0, 100); l.flags.princeFavor = pr.id; } }), with2(B("พิษลงลึกเกินกว่าจะถอนได้ทัน", { joy: -6 }), (l, c) => { const pr = PR(l, c); if (pr) pr.health = clamp(pr.health - 30, 0, 100); })),
    C("รายงานตามที่หมอคนก่อนวินิจฉัย", N("ไม่มีใครถามอะไรคุณ — คุณบอกตัวเองว่านั่นคือความปลอดภัย", { align: -2 })),
  ], { when: (l) => inPolitics(l) && palaceRoleOf(l) === "physician" && princesOf(l).length > 0, prepare: (l) => ({ prid: pick(l, princesOf(l)).id }), weight: 8, maxTimes: 3, title: "เล็บสีม่วง" }),

  E("ct.p_guard", [18, 70], (l, c) => `ยามสามคืนเดือนมืด คุณเห็นเงาคนหนึ่งข้ามกำแพงเข้าไปทางตำหนักของ${prName(l, c)} — เท้าเบาเหมือนแมว มีดสั้นสะท้อนแสงคบไฟ`, [
    FIGHT("ขวางไว้ด้วยตัวเอง", "มือสังหารชุดดำ", near(0), { intro: "คุณกระโดดลงจากกำแพงขวางทาง — เขาหันมา ดวงตาไม่มีความกลัวเลย" }),
    K("แอบตามดูว่าเขามาหาใคร", "luck", 55, with2(BIG((l, c) => `เงานั้นไม่ได้ไปที่ตำหนัก${prName(l, c)} แต่ไปส่งจดหมายให้คนของ${nName(l, c)} — คุณรู้ความลับที่ไม่ควรรู้`, { fame: 2 }), (l, c) => { const n = NPC(l, c); if (n) { n.known = true; l.flags.palaceKnows = n.id; } }), B("เขารู้ตัวและหายไปในความมืด — คืนนั้นทั้งวังโดนตรวจค้น", { joy: -3 })),
    C("ตีกลองปลุกทั้งวัง", G("องครักษ์ทั้งกองตื่น เงานั้นหนีไป — ไม่มีใครเจ็บ และหัวหน้าองครักษ์ชมว่าคุณรู้หน้าที่", { fame: 2 })),
  ], { when: (l) => inPolitics(l) && (palaceRoleOf(l) === "guard" || palaceRoleOf(l) === "spy") && princesOf(l).length > 0, prepare: (l) => ({ prid: pick(l, princesOf(l)).id, nid: pickNpc(l, (n) => n.amb >= 50)?.id ?? castOf(l)[0].id }), weight: 9, maxTimes: 3, title: "เงาบนกำแพงวัง" }),

  E("ct.p_supplier", [20, 80], (l, c) => `${nName(l, c)}ยิ้มขณะตรวจบัญชีผ้าไหมที่คุณส่งเข้าวัง "ของดีมาก — แต่ต่อไปข้าต้องได้สามส่วนจากสิบ ไม่อย่างนั้นสัญญาปีหน้าคงหาย"`, [
    PAY("ยอมจ่ายส่วนแบ่ง", 40, with2(N("สัญญาปีหน้ายังอยู่ — คุณเพิ่งกลายเป็นส่วนหนึ่งของเครือข่ายที่คุณเคยด่า", { align: -2 }), (l, c) => { stand(l, c.nid, { debt: 15, trust: 10 }); palaceOf(l).treasury = clamp(palaceOf(l).treasury - 2, 0, 100); })),
    C("ปฏิเสธ ยอมเสียสัญญา", with2(N("สัญญาของคุณตกไปเป็นของพ่อค้าที่ยอมจ่าย — แต่คุณนอนหลับสนิท", { tael: -20, align: 2 }), (l, c) => { delete l.flags.palaceSupplier; stand(l, c.nid, { grudge: 15 }); })),
    K("ยื่นบัญชีให้ขุนนางตรวจการ", "smarts", 60, with2(BIG((l, c) => `${nName(l, c)}ถูกโยกไปคุมคอกม้าที่ชายแดน — พ่อค้าทั้งตลาดรู้ชื่อคุณ`, { fame: 5, align: 3 }), (l, c) => { const n = NPC(l, c); if (n) n.out = true; const cen = castOf(l).find((x) => x.title === "ขุนนางตรวจการ"); if (cen) stand(l, cen.id, { trust: 20 }); }), with2(B("บัญชีถูกส่งคืนมาที่โต๊ะของเขาเอง — คุณถูกขึ้นบัญชีดำห้ามส่งของเข้าวัง", { tael: -30 }), (l, c) => { delete l.flags.palaceSupplier; stand(l, c.nid, { grudge: 35 }); })),
  ], { when: (l) => inPolitics(l) && palaceRoleOf(l) === "supplier", prepare: (l) => ({ nid: pickNpc(l, (n) => n.role === "eunuch")?.id ?? castOf(l)[0].id }), weight: 9, maxTimes: 3, title: "สามส่วนจากสิบ" }),

  E("ct.p_letter", [18, 80], (l, c) => `คุณได้รับคำสั่งให้นำจดหมายประทับครั่งจาก${nName(l, c)}ไปส่งให้${castOf(l).find((n) => n.role === "general")?.name ?? "แม่ทัพชายแดน"} — ครั่งยังอุ่นอยู่ และเส้นทางไปชายแดนยาวสิบวัน`, [
    C("ส่งถึงมือโดยไม่เปิด", with2(G("เขารับจดหมายแล้วพยักหน้าให้คุณ — คนส่งสารที่ไม่อยากรู้มากเกินไปมักได้ใช้งานต่อ", { tael: 15 }), (l, c) => stand(l, c.nid, { trust: 15 }))),
    K("แกะครั่งอย่างแนบเนียนแล้วอ่าน", "luck", 55, with2(N((l, c) => `ในจดหมายมีชื่อ${prName(l, c)} กับคำว่า "เมื่อถึงเวลา กองทัพจะรู้ว่าต้องยืนข้างใคร" — คุณรู้แล้วว่าใครหนุนใคร`, { iq: 1 }), (l, c) => { const n = NPC(l, c); if (n) n.known = true; const g = castOf(l).find((x) => x.role === "general"); if (g) g.known = true; l.flags.palaceKnows = String(c.nid); }), with2(B("ครั่งแตกเป็นรอย — ผู้รับรู้ทันทีว่ามีคนเปิดอ่าน", { joy: -4 }), (l, c) => stand(l, c.nid, { grudge: 25, trust: -15 }))),
    C("คัดลอกไว้ขายให้ฝ่ายตรงข้าม", with2(N("ฝ่ายตรงข้ามจ่ายเป็นทองแท่ง — และตอนนี้มีสองคนในวังที่อยากให้คุณเงียบตลอดไป", { tael: 70, align: -4 }), (l) => { l.flags.palaceTarget = true; })),
  ], { when: (l) => inPolitics(l) && (palaceRoleOf(l) === "spy" || palaceRoleOf(l) === "guest" || palaceRoleOf(l) === "guard"), prepare: (l) => ({ nid: pickNpc(l, (n) => n.backs !== "emperor")?.id ?? castOf(l)[0].id, prid: princesOf(l)[0]?.id ?? "" }), weight: 7, maxTimes: 3, title: "จดหมายประทับครั่ง" }),

  E("ct.p_tutor", [22, 75], (l, c) => `${prName(l, c)} (${PR(l, c)?.age ?? "?"} พรรษา) ขอให้คุณเป็นอาจารย์สอน${(l.power?.rank ?? 0) >= 2 ? "วิชายุทธ์" : "ตำราและการปกครอง"}เป็นการส่วนพระองค์ — ใครๆ ในวังรู้ว่าอาจารย์ขององค์ชายคือคนของฝ่ายองค์ชาย`, [
    C("รับเป็นอาจารย์", with2(G((l, c) => `ทุกเช้าคุณสอน${prName(l, c)}ในลานหลังตำหนัก — ศิษย์คนนี้อาจเป็นฮ่องเต้ หรืออาจพาคุณลงหลุมไปด้วยกัน`, { fame: 4, tael: 20 }), (l, c) => { l.flags.palaceBack = String(c.prid); l.flags.princeFavor = String(c.prid); const pr = PR(l, c); if (pr) pr.ability = clamp(pr.ability + 8, 0, 100); })),
    C("ปฏิเสธอย่างถ่อมตน", N("องค์ชายผิดหวังเล็กน้อย — แต่คุณยังไม่ได้ผูกชีวิตไว้กับใคร")),
  ], { when: (l) => inPolitics(l) && ((l.power?.rank ?? 0) >= 2 || l.stats.smarts >= 65) && !l.flags.palaceBack && princesOf(l).some((x) => x.age >= 8 && x.age <= 20), prepare: (l) => ({ prid: pick(l, princesOf(l).filter((x) => x.age >= 8 && x.age <= 20)).id }), weight: 8, maxTimes: 1, title: "อาจารย์ขององค์ชาย" }),

  E("ct.p_side", [20, 85], (l) => `แรงกดดันในวังถึงจุดที่ทุกคนต้องเลือก — ${courtOf(l).emperor.name}${courtOf(l).emperor.health < 40 ? "ประชวรหนัก" : "ทรงชรา"} คนของแต่ละฝ่ายมาเคาะประตูบ้านคุณคืนละคน`, [
    ...[0, 1, 2].map((i) =>
      C(
        (l) => { const pr = princesOf(l).sort((a, b) => support(l, b) - support(l, a))[i]; return pr ? `หนุน${pr.name} (${pr.age} พรรษา${pr.named ? " · รัชทายาท" : ""})` : "-"; },
        with2(N("คุณให้คำมั่นแล้ว — จากนี้ชะตาของคุณผูกกับขององค์ชาย", { align: 0 }), (l) => { const pr = princesOf(l).sort((a, b) => support(l, b) - support(l, a))[i]; if (pr) l.flags.palaceBack = pr.id; }),
        { show: (l) => princesOf(l).length > i },
      ),
    ),
    C("วางตัวเป็นกลาง", N("คุณปิดประตูบ้านทุกคืน — ทั้งสองฝ่ายนับคุณเป็นคนที่ไม่ได้ช่วย", { joy: -2 })),
    C("ถอนตัวออกจากเมืองหลวง", with2(N("คุณขอลาออกด้วยเหตุผลเรื่องสุขภาพ แล้วพาครอบครัวออกจากเมืองหลวง — การเมืองในวังจะดำเนินต่อโดยไม่มีคุณ", { joy: 2 }), (l) => { l.flags.palaceWithdrawn = true; delete l.flags.palaceBack; })),
  ], { when: (l) => inPolitics(l) && palaceOf(l).pressure >= 55 && princesOf(l).length >= 2, weight: 9, maxTimes: 2, title: "เลือกข้าง" }),

  E("ct.p_aftermath", [16, 100], (l) => { const a = after(l); return a.won ? `${a.name}ที่คุณหนุนได้ครองราชย์ — ราชโองการฉบับแรกๆ มีชื่อของคุณอยู่ในนั้น` : `ฝ่ายของ${a.name}แพ้ — ${a.harsh ? "ทหารเริ่มไล่ล้อมบ้านคนที่หนุนฝ่ายแพ้ทีละหลัง" : "ราชสำนักใหม่เริ่มสะสางว่าใครอยู่ฝ่ายไหน"}`; }, [
    C("รับพระราชทานตำแหน่ง", settle(BIG("คุณได้ตราตำแหน่งใหม่ บ้านที่เมืองหลวง และศัตรูที่เกลียดคุณยิ่งกว่าเดิม", { fame: 10, tael: 120, flag: "courtHonored" })), { show: (l) => after(l).won }),
    C("ขอแค่ให้ครอบครัวปลอดภัย แล้วถอยออกมา", settle(G("ฮ่องเต้ใหม่ทรงพอพระทัยกับความไม่โลภ — ชื่อคุณถูกจดไว้ในฐานะผู้ภักดีที่ไม่ทวงบุญคุณ", { fame: 5, align: 3, flag: ["courtHonored", "palaceWithdrawn"] })), { show: (l) => after(l).won }),
    K("ทูลขอความเมตตา", "looks", 50, settle(G("ฮ่องเต้ใหม่ทรงเห็นว่าคุณเป็นแค่หมากตัวเล็ก — โทษคือปลดจากราชการ แต่ไม่ถึงชีวิต", { fame: -5, flag: "palaceWithdrawn" })), settle(B("คำวิงวอนไม่ได้ผล — โบยหกสิบทีและเนรเทศ", { hp: -18, fame: -8, flag: ["courtPurged", "palaceWithdrawn"] })), { show: (l) => !after(l).won }),
    P("หนีออกจากเมืองหลวงคืนนี้", ab(0.55, "luck"), settle(N("คุณออกประตูเมืองไปพร้อมกองคาราวานผ้า — ชื่อคุณอยู่ในบัญชีประหาร แต่ตัวคุณอยู่ไกลเกินมือ", { flag: ["courtPurged", "palaceWithdrawn"], tael: -30 })), settle(B("ด่านประตูเมืองจำหน้าคุณได้ — คุณถูกจับขังรอสอบสวนสามปี", { hp: -10, flag: ["courtPurged", "palaceWithdrawn"] }), 3), { show: (l) => !after(l).won, tone: "danger", survival: () => 0.9 }),
    C("รับผิดแทนผู้อื่น", settle(BIG("คุณรับว่าเป็นคนวางแผนทั้งหมดเพื่อให้คนอื่นรอด — ประวัติศาสตร์อาจจำคุณผิด แต่คนที่รอดจะจำถูก", { align: 8, fame: -10, flag: ["courtPurged", "palaceWithdrawn"] }), 5), { show: (l) => !after(l).won }),
  ], { forced: true, when: (l) => !!l.flags.palaceAfter, weight: 50, maxTimes: 0, title: "หลังผลัดแผ่นดิน" }),

  E("ct.p_frame", [20, 85], (l, c) => `เช้านี้มีฎีกากล่าวโทษคุณวางอยู่บนโต๊ะเสนาบดี — มีลายมือคุณ ตราประทับคุณ และเนื้อความที่คุณไม่เคยเขียน ${nName(l, c)}มองคุณอยู่จากอีกฝั่งห้อง`, [
    K("ตรวจหมึกและกระดาษว่าปลอม", "smarts", 62, with2(BIG((l, c) => `หมึกเป็นหมึกจากคลังของ${nName(l, c)} กระดาษเป็นล็อตที่คุณไม่เคยเบิก — เขาถูกปลดจากตำแหน่ง`, { fame: 6 }), (l, c) => { const n = NPC(l, c); if (n) { n.out = true; n.known = true; } delete l.flags.palaceTarget; }), B("หลักฐานไม่พอทั้งสองทาง — คดีค้างอยู่ และชื่อคุณมีราคีติดตัว", { fame: -6, joy: -5 })),
    C("ยอมรับผิดเพื่อให้เรื่องจบ", N("คุณถูกปรับหนักและลดตำแหน่ง — แต่ไม่มีใครต้องติดคุก", { tael: -80, fame: -8 })),
    C("ทิ้งตำแหน่งออกจากวังทันที", N("คุณออกจากวังโดยไม่หันหลัง — ศัตรูคิดว่าชนะ คุณคิดว่ารอด", { flag: "palaceWithdrawn", joy: -2 })),
  ], { when: (l) => inPolitics(l) && (!!l.flags.palaceTarget || castOf(l).some((n) => n.you.grudge >= 30)), prepare: (l) => ({ nid: castOf(l).slice().sort((a, b) => b.you.grudge - a.you.grudge)[0].id }), weight: 8, maxTimes: 2, title: "ฎีกาปลอม" }),

  E("ct.p_memorial", [20, 85], (l) => `คุณร่างฎีกาถวาย${courtOf(l).emperor.name} (${courtOf(l).emperor.temper === "wise" ? "ทรงฟังขุนนาง" : courtOf(l).emperor.temper === "tyrant" ? "ทรงเกลียดคนขัดพระทัย" : courtOf(l).emperor.temper === "paranoid" ? "ทรงระแวงทุกคำ" : "ไม่ได้ว่าราชการเอง"}) เรื่องความทุกข์ของราษฎร — จะเขียนตรงแค่ไหน`, [
    P("เขียนตรงไปตรงมา ขอให้ลดภาษี", (l) => clamp((courtOf(l).emperor.temper === "wise" ? 0.7 : courtOf(l).emperor.temper === "puppet" ? 0.45 : 0.25) + (l.stats.smarts - 50) / 250, 0.1, 0.9), with2(BIG("ฎีกาของคุณถูกอ่านในที่ประชุม — ภาษีลดลง ราษฎรตั้งศาลเล็กๆ ไว้ให้คุณที่หน้าหมู่บ้าน", { fame: 8, align: 4 }), (l) => { const c = courtOf(l); if (c.edict === "heavy_tax") c.edict = undefined; l.mw!.unrest = clamp(l.mw!.unrest - 8, 0, 100); palaceOf(l).treasury = clamp(palaceOf(l).treasury - 6, 0, 100); }), B("ฮ่องเต้กริ้ว — คุณถูกโบยกลางท้องพระโรงและลดตำแหน่ง", { hp: -15, fame: -3, align: 3 }), { survival: (l) => (courtOf(l).emperor.temper === "tyrant" ? 0.85 : 0.99) }),
    K("เขียนอ้อมๆ ผ่านนิทานโบราณ", "smarts", 55, G("ฎีกาของคุณเลี่ยงพระพิโรธได้ และขุนนางหลายคนเข้าใจความนัย — ภาษีลดลงเล็กน้อย", { fame: 3 }), N("ไม่มีใครเข้าใจว่าคุณจะสื่ออะไร")),
    C("ฉีกทิ้ง ไม่ถวาย", N("คุณเผาร่างฎีกาในเตา — คืนนั้นนอนไม่หลับ", { joy: -2 })),
  ], { when: (l) => inPolitics(l) && (palaceRoleOf(l) === "official" || l.fame >= 30), weight: 2, maxTimes: 0, title: "ฎีกา" }),

  E("ct.p_marriage", [35, 75], (l, c) => `${nName(l, c)}ส่งแม่สื่อมาทาบทามลูกของคุณให้แต่งงานกับหลานในตระกูล — สะใภ้/เขยจากตระกูลขุนนางคือประตูเข้าวัง และโซ่ที่ผูกคุณไว้กับฝ่ายของเขา`, [
    C("ตกลง", with2(G("งานแต่งจัดสามวันสามคืน — ตระกูลของคุณกับฝ่ายของเขากลายเป็นเครือญาติ", { fame: 4, tael: 40, joy: 3 }), (l, c) => { stand(l, c.nid, { trust: 25, debt: 10 }); const kid = l.people.find((p) => p.alive && p.relation === "child" && p.age >= 16 && p.age <= 28); if (kid) kid.tags = [...(kid.tags ?? []), "courtMarriage"]; const n = NPC(l, c); if (n && n.backs !== "emperor" && n.backs !== "self") l.flags.palaceBack = n.backs; })),
    C("ปฏิเสธ ให้ลูกเลือกเอง", with2(N("ลูกของคุณยิ้มกว้าง — แต่แม่สื่อกลับไปพร้อมสีหน้าที่ไม่ค่อยดี", { joy: 2 }), (l, c) => stand(l, c.nid, { grudge: 10 }))),
  ], { when: (l) => inPolitics(l) && l.people.some((p) => p.alive && p.relation === "child" && p.age >= 16 && p.age <= 28), prepare: (l) => ({ nid: pickNpc(l, (n) => n.role === "minister" || n.role === "general")?.id ?? castOf(l)[0].id }), weight: 6, maxTimes: 1, title: "เกี่ยวดองกับวัง" }),

  E("ct.p_patron_falls", [18, 90], (l) => `${patronOf(l)?.name ?? "ผู้อุปถัมภ์ของคุณ"}${patronOf(l)?.alive === false ? "ถึงแก่กรรม" : "ถูกปลดจากตำแหน่ง"} — คนที่เคยยิ้มให้คุณในทางเดินวัง วันนี้เดินเลี่ยง`, [
    C("หาผู้อุปถัมภ์คนใหม่", with2(N("คุณเริ่มส่งของขวัญไปตามตำหนักต่างๆ — ช้า แต่ก็มีคนเปิดประตูรับ", { tael: -20 }), (l) => { delete l.flags.palacePatron; const n = pickNpc(l, (x) => x.you.grudge < 20); if (n) { l.flags.palacePatron = n.id; stand(l, n.id, { trust: 10 }); } })),
    C("อยู่เงียบๆ ทำงานตามหน้าที่", with2(N("คุณกลายเป็นคนธรรมดาในวัง — ไม่มีใครคุ้มหัว แต่ก็ไม่มีใครจับตา"), (l) => { delete l.flags.palacePatron; })),
    C("ลาออกจากราชการ", with2(N("คุณคืนตราตำแหน่งแล้วกลับบ้าน — วังเงียบกว่าที่คิด", { joy: 3 }), (l) => { delete l.flags.palacePatron; l.flags.palaceWithdrawn = true; })),
  ], { when: (l) => { const p = patronOf(l); return palaceAccess(l) && !!p && (!p.alive || !!p.out); }, weight: 30, maxTimes: 0, title: "ผู้อุปถัมภ์ล้ม" }),

  // ───── ข้ามรุ่น: ลูกหลานได้รับผลจากการเมืองในวังของรุ่นก่อน ─────
  E("ct.p_inherit_stain", [16, 60], (l) => `นายอำเภอเปิดทะเบียนดูชื่อตระกูลคุณนานผิดปกติ — "${String(l.flags.plName ?? "บรรพบุรุษของเจ้า")}... เคยอยู่ฝ่ายกบฏในวังใช่ไหม" ใบสมัครสอบของคุณถูกวางไว้ข้างๆ`, [
    K("ยื่นหลักฐานว่าตระกูลถูกใส่ร้าย", "smarts", 60, G("หลักฐานเก่าในหีบของตระกูลพอให้นายอำเภอยอมรับใบสมัคร — มลทินจางลงหนึ่งชั้น", { fame: 3, flag: "stainCleared" }), B("หลักฐานไม่พอ — ทางราชการยังปิดสำหรับคุณ", { joy: -4 })),
    C("เปลี่ยนชื่อ ไปเริ่มใหม่ที่อื่น", N("คุณใช้แซ่ของแม่ ชีวิตใหม่เริ่มได้ แต่ป้ายบรรพบุรุษต้องซ่อนไว้ในตู้", { flag: "stainCleared" })),
    C("ยอมรับมัน", N("คุณไม่สอบ ไม่เข้ารับราชการ — ทางอื่นยังมีอีกมาก")),
  ], { when: (l) => l.flags.plCourt === "purged" && !l.flags.stainCleared, weight: 6, title: "มลทินของตระกูล" }),
  E("ct.p_inherit_favor", [16, 60], (l) => `ขันทีชราคนหนึ่งมาหาถึงบ้าน "ข้าเคยติดหนี้ชีวิต${String(l.flags.plName ?? "บรรพบุรุษของเจ้า")} — ตระกูลเจ้ายังมีชื่ออยู่ในใจฮ่องเต้องค์นี้" เขายื่นป้ายผ่านประตูวังให้`, [
    C("รับป้ายไว้", BIG("ประตูวังชั้นนอกเปิดให้คุณแล้ว ด้วยบุญของคนรุ่นก่อน", { flag: "palaceAccess", fame: 3 })),
    C("ขอบคุณ แต่ขอใช้ชีวิตไกลวัง", N("ขันทีชราพยักหน้า \"บรรพบุรุษเจ้าก็พูดแบบนี้ตอนแก่\"")),
  ], { when: (l) => l.flags.plCourt === "honored" && !l.flags.palaceAccess, weight: 6, title: "บุญของคนรุ่นก่อน" }),
];

// คนที่อยู่ในวังทุกวันควรเจอการเมืองในวังบ่อยกว่าเรื่องทั่วไปของยุทธภพ (ราวหนึ่งในสามของปี)
for (const e of PALACE_EVENTS) if (typeof e.weight === "number" && !["ct.p_aftermath", "ct.p_patron_falls"].includes(e.id) && !e.id.startsWith("ct.p_inherit")) e.weight *= 3;

/** ผลหลังผลัดแผ่นดินที่รอผู้เล่นตัดสินใจ */
function after(l: Life): { won: boolean; kind: Succession; name: string; harsh: boolean } {
  try { return JSON.parse(String(l.flags.palaceAfter ?? "{}")); } catch { return { won: false, kind: "smooth", name: "", harsh: false }; }
}


/** สืบข่าวในวัง: รู้ว่าคนหนึ่งหนุนใคร (และบางทีความลับของเขา) */
export function spyPalace(l: Life): string {
  const n = pickNpc(l, (x) => !x.known) ?? pickNpc(l, () => true);
  if (!n) return "วังเงียบ ไม่มีอะไรให้สืบ";
  n.known = true;
  const backs = n.backs === "emperor" ? "ภักดีต่อฮ่องเต้" : n.backs === "self" ? "ไม่ได้หนุนใคร นอกจากตัวเอง" : `หนุน${princeById(l, n.backs)?.name ?? "องค์ชายองค์หนึ่ง"}`;
  const sec = n.secret && chance(l, 0.35) ? ` · และได้ยินมาว่าเขา${n.secret}` : "";
  return `${n.name} (${n.title}) ${backs}${sec}`;
}

/** ใช้ก่อนส่งต่อมรดก: ลูกหลานรู้ว่าตระกูลเคยได้ดีหรือถูกกวาดล้างในวัง */
export function courtLegacy(dead: Life): "honored" | "purged" | undefined {
  if (dead.flags.courtPurged) return "purged";
  if (dead.flags.courtHonored) return "honored";
  return undefined;
}

export const pressureOf = (l: Life) => palaceOf(l).pressure;
export const treasuryOf = (l: Life) => palaceOf(l).treasury;
