// จักรวรรดิในโลก: ผนวกดินแดน กบฏแยกตัว พันธมิตรในสงครามใหญ่ และอาณาจักรใหม่ที่เกิดจากวีรบุรุษ
import { chance, pick } from "../../engine/rng";
import type { Life } from "../../engine/types";
import { clamp } from "../../engine/util";
import { recordChronicle, type WorldState } from "../../engine/worldState";
import type { FData, Kingdom } from "./state";

type Rng = Pick<Life, "rng">;
export const MAX_KINGDOMS = 6;
const NEW_NAMES = ["ราชรัฐเหยี่ยวเหล็ก", "อาณาจักรหุบเขาเงิน", "แคว้นทะเลเหนือ", "นครรัฐอัศวินดำ", "ราชรัฐสายลม", "อาณาจักรรุ่งอรุณ", "แคว้นป่าหมอก"];

export const provincesOf = (d: FData, k: Kingdom) => d.kingdoms.filter((x) => x.overlord === k.id);
export const free = (k: Kingdom) => !k.overlord;
/** ชื่อที่แสดง: อาณาจักรที่มีเมืองขึ้นเรียกว่าจักรวรรดิ */
export const titleOf = (d: FData, k: Kingdom) => (provincesOf(d, k).length && !k.name.startsWith("จักรวรรดิ") ? `${k.name} (จักรวรรดิ)` : k.name);

/** ประกาศสงคราม: เพื่อนบ้านที่ไม่ชอบฝ่ายใดอาจเข้าร่วมเป็นสงครามใหญ่ */
export function declareWar(w: WorldState, d: FData, k: Kingdom, foe: Kingdom, r: Rng) {
  k.war = foe.id; foe.war = k.id;
  recordChronicle(w, `${k.name}ประกาศสงครามกับ${foe.name}`);
  const others = d.kingdoms.filter((x) => x !== k && x !== foe && !x.war && free(x));
  const joined = others.filter(() => chance(r, 0.3));
  for (const x of joined) {
    const side = chance(r, 0.5) ? k : foe;
    x.war = side === k ? foe.id : k.id;
  }
  if (joined.length) recordChronicle(w, `สงครามใหญ่: ${joined.map((x) => x.name).join(" และ ")}เข้าร่วมศึกระหว่าง${k.name}กับ${foe.name}`);
}

/** สงครามจบ: ชนะขาดผนวกผู้แพ้ เมืองขึ้นของผู้แพ้ย้ายไปอยู่กับผู้ชนะ */
export function settleWar(w: WorldState, d: FData, winner: Kingdom, loser: Kingdom, r: Rng) {
  winner.power = clamp(winner.power + 6, 15, 95); loser.power = clamp(loser.power - 6, 15, 95);
  recordChronicle(w, `${winner.name}ชนะสงครามต่อ${loser.name}`);
  if (winner.overlord || loser.playerRuled && !chance(r, 0.5)) return;
  if (winner.power - loser.power >= 25 && chance(r, 0.5)) {
    loser.overlord = winner.id;
    for (const p of provincesOf(d, loser)) p.overlord = winner.id;
    loser.stability = clamp(loser.stability - 15, 5, 95);
    recordChronicle(w, `${winner.name}ผนวก${loser.name}เข้าเป็นเมืองขึ้น`);
  }
}

export function tickEmpire(w: WorldState, d: FData, r: Rng) {
  for (const k of d.kingdoms) {
    // อำนาจไหลกลับสู่ตรงกลางช้าๆ ไม่มีใครติดเพดานหรือพื้นตลอดไป
    k.power = clamp(Math.round(k.power + (55 - k.power) * 0.02), 15, 95);
    const over = d.kingdoms.find((x) => x.id === k.overlord);
    if (!over) { k.overlord = undefined; continue; }
    if (over.overlord) k.overlord = over.overlord;
    const odds = 0.025 + Math.max(0, 50 - over.stability) / 800 + (over.war ? 0.02 : 0) + (k.playerRuled ? -0.02 : 0);
    if (!k.playerRuled && chance(r, odds)) {
      k.overlord = undefined; k.stability = 40;
      const rebel = d.notables.find((n) => n.kingdom === k.id && (n.role === "general" || n.role === "hero"));
      if (rebel) { k.ruler = rebel.name; k.rulerAge = rebel.age; d.notables = d.notables.filter((n) => n !== rebel); }
      recordChronicle(w, `${k.name}ลุกฮือแยกตัวจาก${over.name}${rebel ? ` นำโดย${rebel.name}` : ""}`);
    }
  }
  // โลกตั้งแผ่นดินใหม่ได้ไม่เกินห้า เหลือที่ไว้ให้ผู้เล่นก่อตั้งเองเสมอ
  if (d.kingdoms.length < MAX_KINGDOMS - 1 && chance(r, 0.02)) {
    const n = d.notables.find((x) => (x.role === "general" || x.role === "hero") && x.power >= 70);
    const name = NEW_NAMES.find((x) => !d.kingdoms.some((k) => k.name === x));
    if (n && name) {
      d.kingdoms.push(newKingdom(`k${w.year}`, name, n.name, n.age, w.year));
      d.notables = d.notables.filter((x) => x !== n);
      recordChronicle(w, `${n.name}ก่อตั้ง${name}บนดินแดนรกร้าง`);
    }
  }
}

export const newKingdom = (id: string, name: string, ruler: string, rulerAge: number, year: number): Kingdom =>
  ({ id, name, ruler, rulerAge, power: 35, stability: 55, prosperity: 90, laws: [], founded: year });

/** ศัตรูที่ใกล้มือที่สุด: อาณาจักรอิสระที่อ่อนที่สุด */
export const weakestFoe = (d: FData, k: Kingdom) => d.kingdoms.filter((x) => x !== k && free(x) && x.overlord !== k.id).sort((a, b) => a.power - b.power)[0];
export const rollWar = (w: WorldState, d: FData, k: Kingdom, r: Rng) => {
  const foe = pick(r, d.kingdoms.filter((x) => x.id !== k.id && !x.war && free(x)));
  if (foe) declareWar(w, d, k, foe, r);
};
