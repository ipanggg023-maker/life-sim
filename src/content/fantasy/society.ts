// สังคมที่เดินเองโดยไม่ต้องมีผู้เล่น: บุคคลสำคัญ ฝ่ายอำนาจ เศรษฐกิจ และกฎหมาย
import { chance, pick, randInt, weightedPick } from "../../engine/rng";
import { boomPrice } from "./money2";
import type { Life } from "../../engine/types";
import { clamp } from "../../engine/util";
import { recordChronicle, type WorldState } from "../../engine/worldState";
import { tickGates } from "./realms";
import { LAWS, NOTABLE_CAP, newNotable, passRelic, ROLES, type Dragon, type FData, type Faction, type Good, type Kingdom, type LawId, type Notable } from "./state";

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
  m += boomPrice(k, g);
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
  if (k.playerRuled || k.stability >= 20 || !chance(r, 0.03)) return;
  const n = d.notables.filter((x) => x.kingdom === k.id && (x.role === "general" || x.role === "hero")).sort((a, b) => b.power - a.power)[0];
  if (!n) return;
  recordChronicle(w, `${n.name}ก่อรัฐประหาร โค่น${k.ruler}และยึด${k.name}`);
  k.ruler = n.name; k.rulerAge = n.age; k.stability = clamp(k.stability + 18, 5, 95);
  drop(d, n);
  reformLaws(w, k, r);
}

let dropWorld: WorldState | undefined;
const drop = (d: FData, n: Notable) => {
  d.notables = d.notables.filter((x) => x !== n);
  for (const rl of d.relics) if (rl.holder === n.name) { rl.holder = "lost"; if (dropWorld) passRelic(dropWorld, rl, `หายไปหลัง${n.name}ตาย`); }
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
    // โตจนถึงเพดานของตัวเองก่อนอายุสี่สิบห้า แล้วทรง และแก่ลงหลังหกสิบ
    const peak = n.peak ?? n.power + 10;
    n.power = clamp(n.power + (n.age < 45 && n.power < peak ? randInt(r, 1, 3) : n.age < 60 ? randInt(r, -1, 1) : -1), 5, 99);
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

const ROLE_OF_KIND: Record<string, Notable["role"]> = { silver: "hero", conclave: "mage", league: "merchant", night: "rogue", dawn: "priest" };

function tickFaction(w: WorldState, d: FData, x: Faction, r: Rng) {
  x.power = clamp(Math.round(x.power + randInt(r, -2, 2) + (50 - x.power) * 0.04), 10, 90);
  if (!x.playerLed && !d.notables.some((n) => n.name === x.leader)) {
    const top = d.notables.filter((n) => n.faction === x.id).sort((a, b) => b.power - a.power)[0];
    if (top) { x.leader = top.name; if (top.fame >= 3) recordChronicle(w, `${top.name}ขึ้นเป็นผู้นำ${x.name}`); }
    // ภาคีที่ผู้เล่นตั้งไว้ไม่ตายตามผู้ก่อตั้ง: รับคนที่ใจตรงกันเข้ามานำต่อ
    else if (x.kind) { const n = d.notables.filter((y) => ROLE_OF_KIND[x.kind!] === y.role && !d.factions.some((o) => o.leader === y.name)).sort((a, b) => (a.faction ? 1 : 0) - (b.faction ? 1 : 0))[0]; if (n) { n.faction = x.id; x.leader = n.name; recordChronicle(w, `${n.name}รับช่วงนำ${x.name}`); } }
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

const MAX_DRAGONS = 8;
const HATCH_YEARS = 15;
const YOUNG = ["ไซรัส", "อิกนิส", "เทอร์รา", "เวเนธ", "โนคทิส", "ออรัม", "คาลิกซ์", "เซฟิรา", "พีรอส", "ไอลา", "ดราวาร์", "เมเรธ"];
const TITLE: Record<Dragon["element"], string> = { fire: "เปลวไฟหนุ่ม", water: "แห่งคลื่น", earth: "เกล็ดหิน", wind: "ปีกพายุ", light: "เกล็ดแสง", dark: "เงาอ่อน" };

/** มังกรแก่ ต่อสู้กันเอง วางไข่ ไข่ฟัก และวีรบุรุษออกล่า */
export function tickDragons(w: WorldState, d: FData, r: Rng) {
  for (const x of d.dragons) {
    if (!x.alive) continue;
    x.age++;
    if (x.age < 200) x.power = Math.min(100, x.power + 1);
    x.mood = clamp(x.mood + randInt(r, -2, 2) + (x.mood < -60 ? 1 : 0), -100, 100);
    const k = d.kingdoms.find((y) => y.id === x.home);
    if (k && x.mood < -30 && chance(r, 0.06)) { k.power = clamp(k.power - 5, 15, 95); recordChronicle(w, `มังกร${x.name}เผาเมืองชายแดนของ${k.name}`); }
    if (x.age > 2500 && chance(r, 0.02)) { x.alive = false; recordChronicle(w, `มังกร${x.name}หลับใหลครั้งสุดท้ายในวัย ${x.age} ปี`); continue; }
    const hero = d.notables.find((n) => (n.role === "hero" || n.role === "general") && n.power >= 80 && n.kingdom === x.home);
    if (hero && chance(r, 0.01)) {
      if (hero.power + randInt(r, -20, 20) > x.power) { x.alive = false; x.slainBy = hero.name; hero.fame += 6; recordChronicle(w, `${hero.name}สังหารมังกร${x.name}`); for (const o of d.dragons) if (o.alive) o.mood = clamp(o.mood - 10, -100, 100); continue; }
      recordChronicle(w, `${hero.name}ขึ้นเขาไปล่ามังกร${x.name} และไม่ได้กลับลงมา`);
      drop(d, hero);
    }
    const alive = d.dragons.filter((y) => y.alive).length;
    if (x.age >= 300 && alive + d.eggs.length < MAX_DRAGONS && chance(r, 0.012)) { d.eggs.push({ mother: x.id, element: x.element, laid: w.year }); recordChronicle(w, `มีข่าวว่ามังกร${x.name}วางไข่ในรัง`); }
  }
  for (const e of [...d.eggs]) {
    if (w.year - e.laid < HATCH_YEARS) continue;
    d.eggs = d.eggs.filter((y) => y !== e);
    const mom = d.dragons.find((y) => y.id === e.mother);
    if (!mom?.alive && chance(r, 0.5)) continue;
    const name = pick(r, YOUNG.filter((n) => !d.dragons.some((y) => y.name === n))) ?? pick(r, YOUNG);
    d.dragons.push({ id: `d${w.year}${name}`, name, title: TITLE[e.element], element: e.element, home: mom?.home ?? pick(r, d.kingdoms).id, age: 0, mood: randInt(r, -10, 20), alive: true, power: 40 });
    recordChronicle(w, `ไข่ของ${mom?.name ?? "มังกรที่ตายไปแล้ว"}ฟักเป็นมังกร${name}`);
  }
  const alive = d.dragons.filter((y) => y.alive);
  if (alive.length >= 2 && chance(r, 0.01)) {
    const a = pick(r, alive), b = pick(r, alive.filter((y) => y !== a));
    const [win, lose] = a.power + randInt(r, -25, 25) >= b.power ? [a, b] : [b, a];
    lose.power -= 15;
    if (lose.power < 45) { lose.alive = false; lose.slainBy = `มังกร${win.name}`; recordChronicle(w, `มังกร${win.name}ฆ่ามังกร${lose.name}กลางฟ้า`); }
    else recordChronicle(w, `มังกร${win.name}กับ${lose.name}สู้กันจนฟ้าแดงทั้งคืน`);
  }
  // ซากมังกรเก่าไม่ต้องเก็บไว้นาน · เก็บตัวที่ตายไว้ไม่เกินสี่ตัวเพื่อเล่าเรื่อง
  const dead = d.dragons.filter((y) => !y.alive);
  if (dead.length > 4) d.dragons = d.dragons.filter((y) => y.alive || dead.slice(-4).includes(y));
}

export function tickSociety(w: WorldState, d: FData, r: Rng) {
  dropWorld = w;
  tickGates(d, w.year, r, (t) => recordChronicle(w, t));
  tickDragons(w, d, r);
  for (const k of d.kingdoms) { tickEconomy(w, k, r); tickCoup(w, d, k, r); }
  tickNotables(w, d, r);
  for (const x of d.factions) tickFaction(w, d, x, r);
}

/** ผู้ได้อาวุธตำนาน: คนเก่งในบรรดาบุคคลสำคัญ */
export function seekerOf(d: FData, r: Rng) {
  const top = d.notables.slice().sort((a, b) => b.power - a.power).slice(0, 12);
  return top.length ? pick(r, top) : undefined;
}
