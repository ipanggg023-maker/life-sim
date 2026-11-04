// ชุดเขียนเรื่องหลักของปี: ฉากหลายจังหวะ ทุกทางมีราคา และทุกตอนจบทิ้งร่องรอยสี่อย่าง
// (คนจำ · ข่าวลือหรือเมล็ด · ตัวคุณเปลี่ยน · โลกของคุณเปลี่ยน)
import type { Choice, Ctx, GameEvent, Outcome, Scene } from "../../engine/events";
import { remember, type RelAxes } from "../../engine/npc";
import { pick, randInt } from "../../engine/rng";
import type { Life, Person } from "../../engine/types";
import { clamp, createPerson, shortName } from "../../engine/util";
import { MARK, plant } from "./conseq";
import { apply, type Fx } from "./kit";
import type { Persona } from "./persona";
import { canCast, fightOdds } from "./power";
import { spread } from "./rumors";
import { addStanding, fl, homeKingdom } from "./state";
import { cityOf } from "./cities";
import { omenOf } from "./world2";
import { relOf } from "../../engine/npc";

/** จุดเชื่อมกับชีวิตคุณ · เรื่องที่ผูกกับชีวิตมากกว่าได้เป็นเรื่องหลักก่อน */
export type Hook = "spouse" | "kid" | "teen" | "adultChild" | "parent" | "sibling" | "friend" | "boss" | "foe" | "lover" | "job" | "rank" | "mage" | "rich" | "poor" | "famous" | "war" | "omen" | "elder" | "student" | "seed" | "ruler";
const alive = (l: Life, f: (p: Person) => boolean) => l.people.filter((p) => p.alive && !p.tags?.some((t) => t.startsWith("away:")) && f(p));
const PEOPLE: Partial<Record<Hook, (p: Person) => boolean>> = {
  spouse: (p) => p.relation === "spouse",
  kid: (p) => p.relation === "child" && p.age >= 4 && p.age <= 12,
  teen: (p) => p.relation === "child" && p.age >= 13 && p.age <= 19,
  adultChild: (p) => p.relation === "child" && p.age >= 20,
  parent: (p) => p.relation === "father" || p.relation === "mother",
  sibling: (p) => p.relation === "sibling",
  friend: (p) => p.relation === "friend" && p.age >= 10,
  boss: (p) => !!p.tags?.includes("boss"),
  foe: (p) => relOf(p).grudge >= 40,
  lover: (p) => p.relation === "partner",
};
const HAS: Record<Hook, (l: Life) => boolean> = {
  ...(Object.fromEntries(Object.entries(PEOPLE).map(([k, f]) => [k, (l: Life) => alive(l, f!).length > 0])) as Record<string, (l: Life) => boolean>),
  job: (l) => !!l.job,
  rank: (l) => Math.max(fl(l).bodyRank, fl(l).magicRank) >= 2,
  mage: (l) => canCast(l),
  rich: (l) => l.money >= 300 * 100,
  poor: (l) => l.money < 20 * 100,
  famous: (l) => l.fame >= 35,
  war: (l) => !!homeKingdom(l).war,
  omen: (l) => !!omenOf(l),
  elder: (l) => l.age >= 60,
  student: (l) => !!fl(l).school && !fl(l).graduated,
  seed: (l) => (fl(l).seeds ?? []).some((s) => s.done === undefined),
  ruler: (l) => !!fl(l).throne,
} as Record<Hook, (l: Life) => boolean>;

/** ตอนจบ: ข้อความ · ผล · ข่าวลือ [ข้อความ ดี/ร้าย] หรือเมล็ด · ความทรงจำของคนในเรื่อง */
export interface End { text: string | ((l: Life, c: Ctx) => string); fx?: Fx; rumor?: [string, 1 | -1]; seed?: string; mem: [string, Partial<RelAxes>]; then?: (l: Life, c: Ctx) => void; standing?: number }
export interface HChoice { label: string | ((l: Life, c: Ctx) => string); cost: string; lean: Partial<Persona>; odds?: (l: Life, c: Ctx) => number; show?: (l: Life, c: Ctx) => boolean; req?: (l: Life, c: Ctx) => string | undefined; go?: string; say?: string | ((l: Life, c: Ctx) => string); end?: End; fail?: End; failGo?: string }
export interface Beat { text: string | ((l: Life, c: Ctx) => string); choices: HChoice[] }
export interface Headline { id: string; title: string; ages: [number, number]; hooks: Hook[]; need?: Hook[]; when?: (l: Life) => boolean; who?: Hook | "new"; newAs?: { rel: Person["relation"]; job: string; age?: [number, number] }; beats: Record<string, Beat> & { start: Beat } }

/** แทนที่ {n} ชื่อคนในเรื่อง {k} แผ่นดิน {c} เมือง */
const fmt = (l: Life, c: Ctx, s: string) => { const p = l.people.find((x) => x.id === c.pid); return s.replace(/\{n\}/g, p ? shortName(p) : "เขา").replace(/\{k\}/g, homeKingdom(l).name).replace(/\{c\}/g, cityOf(l).name); };
const txt = (t: string | ((l: Life, c: Ctx) => string)) => (l: Life, c: Ctx) => fmt(l, c, typeof t === "string" ? t : t(l, c));

/** เรื่องหลักเกิดเกือบทุกปี · ความเจ็บจากตอนจบเบาลงให้รวมทั้งชีวิตใกล้ของเดิม (ข้อความยังเล่าเต็ม) */
export const HL_HURT = 0.2;
function finish(l: Life, c: Ctx, e: End): Outcome {
  if (e.fx) { const fx = { ...e.fx }; if (fx.hp && fx.hp < 0) fx.hp = Math.round(fx.hp * HL_HURT); if (fx.joy && fx.joy < 0) fx.joy = Math.round(fx.joy * 0.6); apply(l, fx); }
  if (e.standing) addStanding(l, e.standing);
  const p = l.people.find((x) => x.id === c.pid);
  if (p) remember(l, p, `hl`, fmt(l, c, e.mem[0]), 3, e.mem[1]);
  if (e.rumor) spread(l, fmt(l, c, e.rumor[0]), e.rumor[1], 40);
  if (e.seed) plant(l, e.seed, p?.name);
  e.then?.(l, c);
  const t = txt(e.text)(l, c);
  const kind = (e.fx?.joy ?? 0) + (e.fx?.gold ?? 0) / 5 + (e.fx?.fame ?? 0) >= 0 ? "good" : "bad";
  return { text: t, kind };
}
function toChoice(h: HChoice): Choice {
  const c: Choice = {
    label: (l, ctx) => fmt(l, ctx, typeof h.label === "string" ? h.label : h.label(l, ctx)),
    cons: (l, ctx) => fmt(l, ctx, h.cost),
    lean: h.lean as Record<string, number>,
    show: h.show,
    req: h.req,
    run: (l, ctx, ok) => {
      if (h.odds && !ok) { if (h.failGo) return { text: h.say ? txt(h.say)(l, ctx) : "", next: h.failGo }; if (h.fail) return finish(l, ctx, h.fail); }
      if (h.go) return { text: h.say ? txt(h.say)(l, ctx) : "", next: h.go };
      return finish(l, ctx, h.end!);
    },
  };
  if (h.odds) c.odds = (l, ctx) => clamp(h.odds!(l, ctx), 0.05, 0.95);
  if (h.end?.seed || h.fail?.seed) c.mark = MARK;
  return c;
}
const scene = (b: Beat, title: string): Scene => ({ title, text: txt(b.text), choices: b.choices.map(toChoice) });

export const HEADLINES: Headline[] = [];
const META = new Map<string, Headline>();
export function HL(h: Headline): GameEvent {
  HEADLINES.push(h);
  META.set(`ft.hl.${h.id}`, h);
  const scenes: Record<string, Scene> = {};
  for (const [k, b] of Object.entries(h.beats)) if (k !== "start") scenes[k] = scene(b, h.title);
  return {
    id: `ft.hl.${h.id}`, world: "fantasy", minAge: h.ages[0], maxAge: h.ages[1], title: h.title, manual: true, maxTimes: 1,
    text: txt(h.beats.start.text), choices: h.beats.start.choices.map(toChoice), scenes,
    when: (l) => ready(l, h),
    prepare: (l) => ({ pid: personFor(l, h)?.id ?? "" }),
  };
}
const ready = (l: Life, h: Headline) => (h.need ?? []).every((k) => HAS[k](l)) && (!h.who || h.who === "new" || HAS[h.who](l)) && (!h.when || h.when(l));
function personFor(l: Life, h: Headline): Person | undefined {
  if (h.who === "new") {
    const a = h.newAs ?? { rel: "friend" as const, job: "คนแปลกหน้า" };
    const p = createPerson(l, a.rel, { age: a.age ? randInt(l, a.age[0], a.age[1]) : Math.max(8, l.age + randInt(l, -10, 10)), bond: 30 });
    p.job = a.job;
    return p;
  }
  const f = h.who && PEOPLE[h.who];
  return f ? pick(l, alive(l, f)) : undefined;
}
/** คะแนนเรื่องหลัก: ยิ่งมีจุดเชื่อมกับชีวิตคุณมาก ยิ่งได้ขึ้นก่อน */
export const hookScore = (l: Life, h: Headline) => h.hooks.filter((k) => HAS[k](l)).length + (h.who && h.who !== "new" && HAS[h.who](l) ? 1 : 0);
export function pickHeadline(l: Life): { id: string; score: number } | undefined {
  const ok = HEADLINES.filter((h) => l.age >= h.ages[0] && l.age <= h.ages[1] && (l.seen[`ft.hl.${h.id}`] ?? 0) < 1 && ready(l, h));
  if (!ok.length) return;
  const scored = ok.map((h) => ({ h, s: 2 + hookScore(l, h) * 1.5 }));
  scored.sort((a, b) => b.s - a.s);
  const top = scored.filter((x) => x.s >= scored[0].s - 1.5);
  const h = pick(l, top).h;
  return { id: `ft.hl.${h.id}`, score: 2 + hookScore(l, h) * 1.5 };
}
export const fight = (threat: number) => (l: Life) => fightOdds(l, threat);
