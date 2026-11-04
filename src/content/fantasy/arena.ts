// สังเวียนแห่งแผ่นดิน: ไต่อันดับกับยอดฝีมือตัวจริงของโลก (บุคคลสำคัญที่แก่ ตาย และเก่งขึ้นเอง) · แพ้แค่เจ็บ ไม่ตาย
// แผนอยู่ที่ design/SYSTEMS_UPDATE.md (Release 3)
import { ACTIVITIES, type Activity } from "../../engine/activities";
import type { GameEvent } from "../../engine/events";
import { factorHooks, runEvent, yearHooks } from "../../engine/game";
import { chance, randInt } from "../../engine/rng";
import type { Life } from "../../engine/types";
import { addFame, addMoney, addStat, clamp } from "../../engine/util";
import { BIG, B, C, E, G, GOLD, N, P } from "./kit";
import { fightOdds, powerParts, skipPart } from "./power";
import { addStanding, dataOf, deed, fl, homeKingdom, type Notable } from "./state";

export const LADDER = 10;
const FIGHTERS = new Set(["hero", "general", "rogue"]);
/** สิบยอดฝีมือของแผ่นดินที่คุณอยู่ เรียงจากเก่งที่สุด */
export function ladderOf(l: Life): Notable[] {
  const k = homeKingdom(l).id;
  return dataOf(l).notables.filter((n) => n.kingdom === k && FIGHTERS.has(n.role) && n.age < 90).sort((a, b) => b.power - a.power).slice(0, LADDER);
}
/** อันดับของคุณ (1 = แชมป์) · ไม่มีอันดับ = ยังไม่เคยขึ้นสังเวียนแห่งนี้ */
export const arenaRank = (l: Life) => { const a = fl(l).arena; return a && a.kingdom === homeKingdom(l).id ? a.rank : undefined; };
/** คู่ต่อสู้คนถัดไป: คนที่อยู่เหนือคุณหนึ่งอันดับ */
export function nextFoe(l: Life): Notable | undefined {
  const lad = ladderOf(l), r = arenaRank(l) ?? LADDER + 1;
  return r <= 1 ? undefined : lad[Math.min(r, lad.length + 1) - 2];
}
const prize = (rank: number) => (LADDER + 1 - rank) * 4;
const setRank = (l: Life, rank: number) => { fl(l).arena = { kingdom: homeKingdom(l).id, rank }; };
/** คู่ต่อสู้ตามที่นัดไว้ · ถ้าเขาตายหรือหายไปก่อนวันแข่ง สมาคมส่งคนแทนมา */
const foeOf = (l: Life, id: unknown): Notable => dataOf(l).notables.find((n) => n.id === Number(id)) ?? { id: -1, name: "นักสู้ตัวแทนจากสมาคม", role: "hero", age: 30, power: nextFoe(l)?.power ?? 40, kingdom: homeKingdom(l).id, fame: 0 };

function win(l: Life, n: Notable, rank: number) {
  setRank(l, rank);
  addFame(l, rank === 1 ? 8 : 2);
  addMoney(l, prize(rank) * GOLD);
  n.fame = Math.max(0, n.fame - 1);
  fl(l).body += 6;
  if (rank === 1) { addStanding(l, 3); deed(l, `แชมป์สังเวียนแห่ง${homeKingdom(l).name}`); }
}
function lose(l: Life) { addStat(l, "health", -randInt(l, 4, 9)); addStat(l, "happiness", -3); }

const CHALLENGE: GameEvent = {
  ...E("ft.ar.bout", [14, 900], (l, c) => { const n = foeOf(l, c.foe)!; const r = arenaRank(l); return `${r ? `คุณอยู่อันดับ ${r}` : "คุณยังไม่มีอันดับ"}ในสังเวียนแห่ง${homeKingdom(l).name} คู่ต่อสู้คือ${n.name} อันดับ ${ladderOf(l).indexOf(n) + 1} อายุ ${n.age} ปี พลัง ${n.power} · ฝูงชนเต็มอัฒจันทร์`; }, [
    P("สู้เต็มกำลัง", (l, c) => fightOdds(l, foeOf(l, c.foe)!.power), BIG((l, c) => { const n = foeOf(l, c.foe)!; const rank = Math.max(1, (ladderOf(l).indexOf(n) + 1) || (arenaRank(l) ?? LADDER + 1) - 1); win(l, n, rank); return rank === 1 ? `${n.name}ล้มลงกลางสังเวียน คุณคือแชมป์คนใหม่แห่ง${homeKingdom(l).name}` : `${n.name}ยอมรับความพ่ายแพ้ คุณขึ้นเป็นอันดับ ${rank} และได้รางวัล ${prize(rank)} เหรียญทอง`; }),
      B((l, c) => `${foeOf(l, c.foe)!.name}เก่งกว่าที่ทุกคนคิด คุณถูกหามออกจากสังเวียน แต่ยังมีชีวิตและอันดับเดิม`, {}, lose), { cons: "แพ้แล้วบาดเจ็บ แต่ไม่ตาย" }),
    P("สู้ระวังตัว รอจังหวะ", (l, c) => fightOdds(l, foeOf(l, c.foe)!.power) - 0.08, G((l, c) => { const n = foeOf(l, c.foe)!; const rank = Math.max(1, (ladderOf(l).indexOf(n) + 1) || (arenaRank(l) ?? LADDER + 1) - 1); win(l, n, rank); return `คุณรอจนเขาพลาดเพียงครั้งเดียว แล้วจบเรื่องในดาบเดียว อันดับ ${rank} เป็นของคุณ`; }),
      N((l, c) => `${foeOf(l, c.foe)!.name}ไม่เคยพลาดเลยทั้งยก กรรมการให้เขาชนะคะแนน คุณเจ็บเพียงเล็กน้อย`, { hp: -3 }), { cons: "โอกาสชนะลดลงเล็กน้อย แต่แพ้ก็เจ็บน้อย" }),
    C("ถอนตัวก่อนขึ้นสังเวียน", N("ฝูงชนโห่ แต่คุณกลับบ้านโดยไม่มีแผล", { joy: -2 })),
  ], { title: "สังเวียนแห่งแผ่นดิน" }),
  manual: true,
};

const DEFEND: GameEvent = {
  ...E("ft.ar.defend", [14, 900], (l, c) => `${foeOf(l, c.foe)!.name}ประกาศกลางจัตุรัสว่าจะชิงตำแหน่งแชมป์สังเวียนจากคุณ ทั้งเมืองรอดูวันนั้น`, [
    P("รับคำท้า", (l, c) => fightOdds(l, foeOf(l, c.foe)!.power) + 0.05, BIG((l, c) => `${foeOf(l, c.foe)!.name}ล้มลงต่อหน้าทั้งเมือง คุณยังเป็นแชมป์`, { fame: 4 }, (l) => addMoney(l, 15 * GOLD)), B((l, c) => `${foeOf(l, c.foe)!.name}ชนะ คุณตกลงไปอันดับสอง และได้แผลกลับบ้าน`, {}, (l) => { setRank(l, 2); lose(l); }), { cons: "แพ้แล้วเสียตำแหน่งแชมป์" }),
    C("สละตำแหน่งอย่างมีเกียรติ", N((l, c) => `คุณมอบเข็มขัดแชมป์ให้${foeOf(l, c.foe)!.name}ด้วยมือตัวเอง ทั้งสังเวียนปรบมือให้คุณ`, { fame: 1 }, (l) => setRank(l, 2))),
  ], { title: "คำท้าชิงแชมป์", forced: true }),
  manual: true,
};

const ACTS: Activity[] = [
  { id: "ft_arena", emoji: "", name: "ขึ้นสังเวียน", desc: "ไต่อันดับสิบยอดฝีมือของแผ่นดิน · แพ้แค่บาดเจ็บ · ต้องมีสุขภาพ 50 ขึ้นไป", minAge: 16, time: 1, world: "fantasy", group: "ฝึกฝน",
    available: (l) => !!nextFoe(l) && l.stats.health >= 50,
    run: (l) => { const n = nextFoe(l)!; runEvent(l, "ft.ar.bout", { foe: n.id }); return { text: "" }; } },
];

export const ARENA_EVENTS: GameEvent[] = [CHALLENGE, DEFEND];

export function loadArena() {
  ACTIVITIES.push(...ACTS);
  // แชมป์ถูกท้าชิงเป็นระยะโดยคนที่เก่งที่สุดในแผ่นดินที่ยังไม่ใช่คุณ
  yearHooks.push((l) => {
    if (l.worldId !== "fantasy" || !l.ft || !l.alive || arenaRank(l) !== 1 || l.queue.length > 2) return;
    const top = ladderOf(l)[0];
    if (top && chance(l, 0.3)) runEvent(l, "ft.ar.defend", { foe: top.id });
  });
  // หน้าต่าง "อะไรขยับโอกาสนี้": แยกพลังต่อสู้ตามที่มา เช่น อาวุธ สายอาวุธ บาดเจ็บ
  factorHooks.push({ neutral: (l) => { if (l.worldId !== "fantasy" || !l.ft) return () => {}; skipPart.all = true; return () => { skipPart.all = false; }; }, rows: (l, odds) => {
    if (l.worldId !== "fantasy" || !l.ft) return [];
    const base = odds();
    const rows: { label: string; delta: number }[] = [];
    for (const [label] of powerParts(l)) {
      skipPart.label = label;
      const d = base - odds();
      skipPart.label = undefined;
      if (Math.abs(d) >= 0.01) rows.push({ label, delta: clamp(d, -1, 1) });
    }
    return rows;
  } });
}
