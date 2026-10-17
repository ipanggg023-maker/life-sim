// M19 — ตัวช่วยร่วมของ event ชุดใหม่ในโลกหอคอย
import type { Ctx, Outcome } from "../../engine/events";
import { kill } from "../../engine/game";
import { chance, pick, randInt } from "../../engine/rng";
import type { Life, Person } from "../../engine/types";
import { addStat, clamp, countryIn, createPerson, randomName, shortName } from "../../engine/util";
import { ROLES, addMate, removeMate, team, type Member, type RoleId } from "./m19sys";

export const good = (text: string): Outcome => ({ text, kind: "good" });
export const bad = (text: string): Outcome => ({ text, kind: "bad" });
export const meh = (text: string): Outcome => ({ text });
export const big = (text: string): Outcome => ({ text, kind: "milestone" });

export const rank = (l: Life) => l.power?.rank ?? -1;
export const floor = (l: Life) => Number(l.flags.floor ?? 0);
export const climbing = (l: Life) => !!l.power && l.job?.careerId === "climber";
/** ยังไม่ได้รับคำเชิญ (และยังมีโอกาส) */
export const waiting = (l: Life) => !l.power && !l.flags.awakenDone;
/** คนที่ไม่ได้ขึ้นหอคอย: ปฏิเสธ หรือไม่ผ่านเกณฑ์ */
export const grounded = (l: Life) => !l.power && !!l.flags.awakenDone;
export const refused = (l: Life) => !l.power && !!l.flags.refusedTower;
/** เคยขึ้นหอคอยแต่ตอนนี้ไม่ได้ปีนแล้ว */
export const retired = (l: Life) => !!l.power && l.job?.careerId !== "climber";
export const foe = (l: Life, d = 0) => clamp(rank(l) + d, 0, 8);
export const family = (l: Life) => l.people.filter((p) => p.alive && ["father", "mother", "sibling", "spouse", "child"].includes(p.relation));
export const bondAll = (ps: Person[], d: number) => { for (const p of ps) p.bond = clamp(p.bond + d, 0, 100); };
export const byId = (l: Life, c: Ctx) => l.people.find((p) => p.id === c.id && p.alive);
export const flagN = (l: Life, k: string) => Number(l.flags[k] ?? 0);

export function hurt(l: Life, min: number, max: number, cause: string): string {
  const d = randInt(l, min, max);
  addStat(l, "health", -d);
  if (l.stats.health <= 0) {
    kill(l, cause);
    return " …ร่างกายคุณทนไม่ไหวอีกต่อไป";
  }
  return ` (สุขภาพ -${d})`;
}

/** เตรียมชื่อคนแปลกหน้าที่อาจกลายเป็นเพื่อนร่วมทีม (ยังไม่สร้างคนจริง) */
export function prepStranger(l: Life): Ctx {
  const g = chance(l, 0.5) ? "m" : "f";
  const n = randomName(l, g);
  const c = countryIn(l);
  const kj = c === "kr" || c === "jp";
  return { g, full: kj ? `${n.last} ${n.first}` : `${n.first} (${n.nick}) ${n.last}`, name: kj ? n.first : n.nick };
}

/** สร้างเพื่อนร่วมทีมจากชื่อที่เตรียมไว้ */
export function makeMate(l: Life, c: Ctx, role: RoleId, arch: string, lv = 1, bond = 45, ageD = 0): Person {
  const p = createPerson(l, "ally", { gender: c.g as "m" | "f", age: Math.max(16, l.age + ageD + randInt(l, -3, 3)), bond, job: arch });
  p.name = String(c.full);
  p.short = String(c.name);
  addMate(l, p, role, lv);
  return p;
}

/** เลือกสมาชิกทีมหนึ่งคนสำหรับ event */
export function prepMember(l: Life, filter: (x: Member) => boolean = () => true): Ctx {
  const pool = team(l).filter(filter);
  const x = pick(l, pool.length ? pool : team(l));
  return { id: x.p.id, name: shortName(x.p), role: ROLES[x.m.role].name, lv: x.m.lv };
}
export const memberOf = (l: Life, c: Ctx) => team(l).find((x) => x.p.id === c.id);

/** สมาชิกออกจากทีม (ไม่ถูกดึงกลับเข้าทีมอัตโนมัติอีก) */
export function leaveTeam(l: Life, p: Person, as: "friend" | "rival", job?: string) {
  removeMate(l, p.id);
  p.relation = as;
  if (job) p.job = job;
}
export function killMate(l: Life, p: Person) {
  p.alive = false;
  removeMate(l, p.id);
  l.flags.t19fallen = flagN(l, "t19fallen") + 1;
  l.flags.lossAge = l.age;
}
