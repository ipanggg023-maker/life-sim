// เป้าหมายของสายตระกูล: นับเฉพาะรุ่นที่สืบต่อกันเป็นลูกหรือศิษย์ · ตายแล้วเริ่มสายใหม่ก็เริ่มนับใหม่
import type { Life, Soul } from "../../../engine/types";
import { TAEL } from "../story/kit";
import { ARCS } from "./sideStories";
import { routeHints } from "./routes";

export interface DynTally { gens: number; fighters: number; scholars: number; rulers: number; rich: number }
const KEYS = ["gens", "fighters", "scholars", "rulers", "rich"] as const;
const FLAG: Record<(typeof KEYS)[number], string> = { gens: "dynGens", fighters: "dynFighters", scholars: "dynScholars", rulers: "dynRulers", rich: "dynRich" };

export const DYN_REWARD = 40;
export const DYN_GOALS: { id: string; name: string; key: (typeof KEYS)[number]; need: number; how: string }[] = [
  { id: "gens3", name: "สืบสามรุ่น", key: "gens", need: 3, how: "เล่นต่อเป็นลูกหรือศิษย์ให้ครบสามรุ่น" },
  { id: "gens5", name: "ห้ารุ่นไม่ขาดสาย", key: "gens", need: 5, how: "เล่นต่อเป็นลูกหรือศิษย์ให้ครบห้ารุ่น" },
  { id: "fighters3", name: "ยอดฝีมือสามรุ่น", key: "fighters", need: 3, how: "ให้สามรุ่นในสายเดียวกันฝีมือถึงขั้น 4" },
  { id: "scholars3", name: "บัณฑิตสามรุ่น", key: "scholars", need: 3, how: "ให้สามรุ่นสอบผ่านระดับมณฑลหรือเป็นขุนนาง" },
  { id: "rulers2", name: "ราชวงศ์สืบบัลลังก์", key: "rulers", need: 2, how: "ให้สองรุ่นติดกันได้นั่งบัลลังก์" },
  { id: "rich3", name: "มั่งคั่งสามชั่วคน", key: "rich", need: 3, how: "ให้สามรุ่นตายโดยมีทรัพย์ 3,000 ตำลึงขึ้นไป" },
];

/** ยอดของสายนี้นับรวมชีวิตปัจจุบัน */
export function dynTally(l: Life): DynTally {
  const base = (k: (typeof KEYS)[number]) => Number(l.flags[FLAG[k]] ?? 0);
  return {
    gens: base("gens") + 1,
    fighters: base("fighters") + Number((l.power?.rank ?? 0) >= 4),
    scholars: base("scholars") + Number(!!l.flags.juren || l.job?.careerId === "official"),
    rulers: base("rulers") + Number(!!l.flags.emperorSelf),
    rich: base("rich") + Number(l.money - l.debt >= 3000 * TAEL),
  };
}

/** รุ่นถัดไปรับยอดของสายต่อ */
export function carryDyn(dead: Life, next: Life) {
  const t = dynTally(dead);
  for (const k of KEYS) next.flags[FLAG[k]] = t[k];
}

/** เป้าหมายที่สายนี้เพิ่งทำได้ · ให้แต้มวิญญาณ */
export function recordDynasty(s: Soul, l: Life) {
  const t = dynTally(l);
  const had = new Set(s.dynGoals ?? []);
  const fresh = DYN_GOALS.filter((g) => !had.has(g.id) && t[g.key] >= g.need);
  if (!fresh.length) return [];
  s.dynGoals = [...had, ...fresh.map((g) => g.id)];
  s.points += fresh.length * DYN_REWARD;
  s.totalPoints += fresh.length * DYN_REWARD;
  return fresh;
}

/** ความคืบหน้าของเป้าหมายที่ยังไม่สำเร็จ ใกล้สุดก่อน */
export function dynProgress(s: Soul, l: Life) {
  const t = dynTally(l);
  return DYN_GOALS.filter((g) => !s.dynGoals?.includes(g.id) && t[g.key] < g.need).map((g) => ({ ...g, at: t[g.key] })).sort((a, b) => b.at / b.need - a.at / a.need);
}

/** เป้าหมายที่ชีวิตนี้เป็นคนทำให้ครบ (โชว์ตอนจบชีวิต) */
export const dynReached = (l: Life) => { const t = dynTally(l); return DYN_GOALS.filter((g) => t[g.key] >= g.need && Number(l.flags[FLAG[g.key]] ?? 0) < g.need); };

/** หน้า "ชีวิตหน้าลองอะไร": เส้นทาง เรื่องเล่า และเป้าหมายตระกูลรวมกัน */
export function nextTries(s: Soul, l: Life) {
  const out: { kind: string; title: string; note: string }[] = [];
  for (const r of routeHints(s, l, 2)) out.push({ kind: "เส้นทาง", title: `${r.name} · ${r.next}`, note: r.how });
  const open = ARCS.map((a) => ({ a, seen: (s.arcEnds ?? []).filter((e) => e.startsWith(`${a.id}:`)).length })).filter((x) => x.seen < x.a.ends).sort((x, y) => x.seen / x.a.ends - y.seen / y.a.ends);
  const pick = open[l.seed % Math.max(1, Math.min(3, open.length))];
  if (pick) out.push({ kind: "เรื่องเล่า", title: `${pick.a.name} · เห็นตอนจบแล้ว ${pick.seen}/${pick.a.ends}`, note: pick.seen ? "ลองเลือกต่างจากเดิมเพื่อดูตอนจบอื่น" : pick.a.blurb });
  const d = dynProgress(s, l)[0];
  if (d) out.push({ kind: "ตระกูล", title: `${d.name} · ${d.at}/${d.need}`, note: d.how });
  return out;
}
