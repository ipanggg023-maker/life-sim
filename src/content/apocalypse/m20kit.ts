// เครื่องมือเล็กๆ ที่ event ของ M20 ใช้ร่วมกัน
import type { Ctx, Outcome } from "../../engine/events";
import { kill } from "../../engine/game";
import { chance, pick, randInt } from "../../engine/rng";
import type { Life } from "../../engine/types";
import { addStat, clamp } from "../../engine/util";
import { fightOdds, survivalOdds } from "../hunter/power";
import { addResident, defMod, getBase, hasBase, inBase, leads, isTown, residentById, threatRank, withBase, type Role } from "./base";

export const good = (text: string, next?: string): Outcome => ({ text, kind: "good", next });
export const bad = (text: string, next?: string): Outcome => ({ text, kind: "bad", next });
export const meh = (text: string, next?: string): Outcome => ({ text, next });
export const big = (text: string, next?: string): Outcome => ({ text, kind: "milestone", next });

export const before = (l: Life) => !l.flags.doomed;
export const doomIn = (l: Life) => Number(l.flags.awakenAge ?? 99) - l.age;
export const ruins = (l: Life) => !!l.flags.doomed && !l.flags.rebuilt;
/** อยู่ในซากเมืองและมีระบบแล้ว */
export const R = (l: Life) => ruins(l) && !!l.power;
/** มีฐาน (ยังอยู่ในยุคซากเมือง) */
export const B = inBase;
/** มีฐานและเป็นผู้นำ */
export const L = leads;
/** เมืองหลังโลกฟื้น */
export const T = (l: Life) => !!l.flags.rebuilt && hasBase(l) && isTown(l);

/** แรงก์ศัตรูเทียบกับตัวคุณ */
export const foe = (l: Life, d = 0) => clamp((l.power?.rank ?? 0) + d, 0, 8);
/** แรงก์ศัตรูที่มาบุกฐาน */
export const threat = (l: Life, d = 0) => clamp(threatRank(l) + d, 0, 8);

/** สู้ทั่วไป */
export const fight = (d = 0, mod = 0) => (l: Life) => (l.power ? fightOdds(l, foe(l, d), mod) : 0.2);
export const live = (d = 0, mod = 0) => (l: Life) => (l.power ? survivalOdds(l, foe(l, d), mod) : 0.5);
/** สู้ป้องกันฐาน — กำแพง หอสังเกตการณ์ และทหารช่วย */
export const defend = (d = 0) => (l: Life) => (l.power ? fightOdds(l, threat(l, d), defMod(l)) : 0.2);
export const defendLive = (d = 0) => (l: Life) => (l.power ? survivalOdds(l, threat(l, d), defMod(l)) : 0.5);

export function hurt(l: Life, min: number, max: number, cause: string): string {
  const d = randInt(l, min, max);
  addStat(l, "health", -d);
  if (l.stats.health <= 0) {
    kill(l, cause);
    return " …ร่างกายคุณทนไม่ไหวอีกต่อไป";
  }
  return ` (สุขภาพ -${d})`;
}

/** แพ้แล้วอาจตาย: ทอยรอดตาม survival ถ้าไม่รอดก็ตาย คืน true ถ้าตาย */
export function mayDie(l: Life, odds: number, cause: string): boolean {
  if (chance(l, odds)) return false;
  kill(l, cause);
  return true;
}

export const baseName = (l: Life) => getBase(l)?.name ?? "ฐาน";
/** ชื่อชาวฐานจาก ctx (ถ้าคนนั้นยังอยู่) */
export const who = (l: Life, c: Ctx) => residentById(getBase(l)!, Number(c.rid))?.n ?? String(c.name ?? "ใครบางคน");

/** มีชาวฐานบทบาทนี้ไหม (ไม่ใช้ rng — ใช้ใน when ได้) */
export const hasRole = (l: Life, roles?: string[]) => !!getBase(l)?.res.some((r) => !r.tag && (!roles || roles.includes(r.role)));

/** เลือกชาวฐานคนสำคัญหนึ่งคนใส่ ctx (ถ้าไม่มีบทบาทนั้น จะมีคนใหม่มาถึงพอดี) */
export function pickRes(l: Life, roles?: Role[]): Ctx {
  const b = getBase(l)!;
  const pool = b.res.filter((r) => !r.tag && (!roles || roles.includes(r.role)));
  const r = pool.length ? pick(l, pool) : withBase(l, (x) => { x.pop += 1; return addResident(l, x, roles?.[0]); })!;
  return { rid: r.id, name: r.n, role: r.role };
}
