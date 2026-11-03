// สังคมที่เดินเองโดยไม่ต้องมีผู้เล่น: บุคคลสำคัญ ฝ่ายอำนาจ เศรษฐกิจ และกฎหมาย
import { chance, pick, randInt, weightedPick } from "../../engine/rng";
import type { Life } from "../../engine/types";
import { clamp } from "../../engine/util";
import { recordChronicle, type WorldState } from "../../engine/worldState";
import { LAWS, NOTABLE_CAP, newNotable, ROLES, type FData, type Faction, type Good, type Kingdom, type LawId, type Notable } from "./state";

type Rng = Pick<Life, "rng">;

export const GOODS: Record<Good, { name: string; base: number }> = {
  grain: { name: "ธัญพืช", base: 100 },
  iron: { name: "เหล็ก", base: 140 },
  herbs: { name: "สมุนไพร", base: 120 },
};

/** ราคาขึ้นตามเหตุการณ์จริงในอาณาจักร ผู้เล่นจึงอ่านข่าวแล้วหากำไรได้ */
export function priceOf(k: Kingdom, g: Good) {
  let m = (k.prosperity ?? 100) / 100;
  if (g === "iron" && k.war) m += 0.6;
  if (g === "herbs" && k.plague) m += 0.8;
  if (g === "grain" && k.famine) m += 0.8;
  return Math.round(GOODS[g].base * m);
}

export function reformLaws(w: WorldState, k: Kingdom, r: Rng) {
  if (!chance(r, 0.5)) return;
  const id = pick(r, Object.keys(LAWS) as LawId[]);
  setLaw(w, k, id, !k.laws?.includes(id));
}
export function setLaw(w: WorldState, k: Kingdom, id: LawId, on: boolean) {
  const laws = k.laws ?? [];
  k.laws = on ? [...laws.filter((x) => x !== id), id] : laws.filter((x) => x !== id);
  recordChronicle(w, `${k.name}${on ? "ประกาศใช้" : "ยกเลิก"}กฎหมาย${LAWS[id].name}`);
}

function tickEconomy(w: WorldState, k: Kingdom, r: Rng) {
  const p = k.prosperity ?? 100;
  const drag = (k.war ? 3 : 0) + (k.plague ? 4 : 0) + (k.famine ? 6 : 0);
  k.prosperity = clamp(Math.round(p + randInt(r, -4, 4) - drag + (100 - p) * 0.03 + (k.laws?.includes("freeTrade") ? 1 : 0)), 40, 140);
  if (k.famine && --k.famine <= 0) { k.famine = undefined; recordChronicle(w, `ทุพภิกขภัยใน${k.name}ผ่านพ้นไป`); }
  else if (!k.famine && chance(r, 0.012)) { k.famine = randInt(r, 2, 3); recordChronicle(w, `ทุพภิกขภัยแผ่ไปทั่ว${k.name}`); }
}

/** กองทัพก่อรัฐประหารเมื่อบ้านเมืองปั่นป่วน */
function tickCoup(w: WorldState, d: FData, k: Kingdom, r: Rng) {
  if (k.stability >= 20 || !chance(r, 0.06)) return;
  const n = d.notables.filter((x) => x.kingdom === k.id && (x.role === "general" || x.role === "hero")).sort((a, b) => b.power - a.power)[0];
  if (!n) return;
  recordChronicle(w, `${n.name}ก่อรัฐประหาร โค่น${k.ruler}และยึด${k.name}`);
  k.ruler = n.name; k.rulerAge = n.age; k.stability = clamp(k.stability + 18, 5, 95);
  drop(d, n);
  reformLaws(w, k, r);
}

const drop = (d: FData, n: Notable) => {
  d.notables = d.notables.filter((x) => x !== n);
  for (const rl of d.relics) if (rl.holder === n.name) rl.holder = "lost";
};

const DEEDS: Record<Notable["role"], [string, (k: Kingdom) => void][]> = {
  hero: [["ปราบสัตว์อสูรที่ชายแดน", (k) => { k.stability = clamp(k.stability + 2, 5, 95); }]],
  mage: [["ค้นพบเวทบทที่สาบสูญ", () => {}]],
  merchant: [["สร้างท่าเรือแห่งใหม่", (k) => { k.prosperity = clamp((k.prosperity ?? 100) + 4, 40, 140); }]],
  rogue: [["ขโมยมงกุฎจากท้องพระคลัง", (k) => { k.stability = clamp(k.stability - 4, 5, 95); }]],
  priest: [["เปิดโรงทานทั่วเมือง", (k) => { k.stability = clamp(k.stability + 2, 5, 95); }]],
  general: [["ชนะศึกชายแดน", (k) => { k.power = clamp(k.power + 2, 15, 95); }]],
};

/** คนดังยิ่งมีข่าว ดาวเด่นจึงเกิดขึ้นเองท่ามกลางคนร้อยกว่าคน */
const star = (r: Rng, list: Notable[]) => weightedPick(r, list, (n) => 1 + n.fame * 4)!;

function tickNotables(w: WorldState, d: FData, r: Rng) {
  for (const n of [...d.notables]) {
    n.age++;
    n.power = clamp(n.power + (n.age < 35 ? randInt(r, 0, 2) : n.age < 60 ? randInt(r, -1, 1) : -1), 5, 99);
    const k = d.kingdoms.find((x) => x.id === n.kingdom);
    const odds = (n.age < 50 ? 0.006 : 0.02 + (n.age - 50) * 0.006) + (k?.war && (n.role === "hero" || n.role === "general") ? 0.01 : 0);
    if (chance(r, odds)) {
      if (n.fame >= 4) recordChronicle(w, `${ROLES[n.role]} ${n.name} เสียชีวิตในวัย ${n.age} ปี`);
      drop(d, n);
    }
  }
  for (let i = 0; i < 3 && d.notables.length < NOTABLE_CAP; i++) d.notables.push(newNotable(r, d));
  if (d.notables.length < 2) return;
  for (let i = 0; i < 2; i++) {
    const a = star(r, d.notables), b = star(r, d.notables.filter((x) => x !== a));
    const [win, lose] = a.power + randInt(r, -15, 15) >= b.power ? [a, b] : [b, a];
    win.fame++; win.power = clamp(win.power + 1, 5, 99);
    if (win.fame >= 4 && lose.fame >= 3) {
      recordChronicle(w, `${win.name}เอาชนะ${lose.name}ในการดวลที่คนพูดถึงทั้งแผ่นดิน`);
      if (chance(r, 0.25)) drop(d, lose);
    }
  }
  const n = star(r, d.notables);
  if (chance(r, 0.7)) {
    const [text, fx] = pick(r, DEEDS[n.role]);
    const k = d.kingdoms.find((x) => x.id === n.kingdom);
    n.fame++;
    if (k) fx(k);
    if (n.fame >= 4) recordChronicle(w, `${n.name}${text}`);
  }
}

function tickFaction(w: WorldState, d: FData, x: Faction, r: Rng) {
  x.power = clamp(Math.round(x.power + randInt(r, -2, 2) + (50 - x.power) * 0.04), 10, 90);
  if (!x.playerLed && !d.notables.some((n) => n.name === x.leader)) {
    const top = d.notables.filter((n) => n.faction === x.id).sort((a, b) => b.power - a.power)[0];
    if (top) { x.leader = top.name; if (top.fame >= 3) recordChronicle(w, `${top.name}ขึ้นเป็นผู้นำ${x.name}`); }
  }
  if (!x.feud && chance(r, 0.02)) {
    const foe = pick(r, d.factions.filter((o) => o !== x && !o.feud));
    if (foe) { x.feud = foe.id; foe.feud = x.id; recordChronicle(w, `${x.name}เปิดศึกกับ${foe.name}`); }
  } else if (x.feud && chance(r, 0.15)) {
    const foe = d.factions.find((o) => o.id === x.feud);
    x.feud = undefined;
    if (foe) {
      foe.feud = undefined;
      const [a, b] = x.power + randInt(r, -12, 12) >= foe.power ? [x, foe] : [foe, x];
      a.power = clamp(a.power + 6, 10, 90); b.power = clamp(b.power - 6, 10, 90);
      recordChronicle(w, `${a.name}มีชัยเหนือ${b.name}`);
    }
  }
}

export function tickSociety(w: WorldState, d: FData, r: Rng) {
  for (const k of d.kingdoms) { tickEconomy(w, k, r); tickCoup(w, d, k, r); }
  tickNotables(w, d, r);
  for (const x of d.factions) tickFaction(w, d, x, r);
}

/** ผู้ได้อาวุธตำนาน: คนเก่งในบรรดาบุคคลสำคัญ */
export function seekerOf(d: FData, r: Rng) {
  const top = d.notables.slice().sort((a, b) => b.power - a.power).slice(0, 12);
  return top.length ? pick(r, top) : undefined;
}
