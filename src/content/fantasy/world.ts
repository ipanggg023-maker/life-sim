// โลกเดินต่อทุกปี: กษัตริย์แก่และผลัดรุ่น สงคราม โรคระบาด มังกร และคนอื่นออกล่าอาวุธตำนาน
import { chance, pick, randInt } from "../../engine/rng";
import type { Life } from "../../engine/types";
import { clamp } from "../../engine/util";
import { advanceWorld, recordChronicle, type WorldState } from "../../engine/worldState";
import type { FData, Kingdom } from "./state";

type Rng = Pick<Life, "rng">;
const HEIRS = ["เจ้าชายคาเอล", "เจ้าหญิงไอลีน", "ลอร์ดโรวาน", "เลดี้เอลาร่า", "แม่ทัพกาเรธ", "ท่านหญิงมิร่า"];
const SEEKERS = ["อัศวินดำโอริน", "นักล่าสมบัติเซล", "จอมเวทมัลคอร์", "ทหารรับจ้างบรานน์"];

function tickKingdom(w: WorldState, d: FData, k: Kingdom, r: Rng) {
  k.rulerAge++;
  k.stability = clamp(k.stability + randInt(r, -3, 3) - (k.war ? 2 : 0) - (k.plague ? 2 : 0), 5, 95);
  if (k.plague && --k.plague <= 0) { k.plague = undefined; recordChronicle(w, `โรคระบาดใน${k.name}สงบลง`); }
  if (k.rulerAge > 62 && chance(r, 0.08 + (k.rulerAge - 62) * 0.015)) {
    const old = k.ruler;
    k.ruler = pick(r, HEIRS);
    k.rulerAge = randInt(r, 22, 45);
    k.stability = clamp(k.stability - 12, 5, 95);
    recordChronicle(w, `${old}สิ้นพระชนม์ ${k.ruler}ขึ้นครอง${k.name}`);
  }
  if (!k.plague && chance(r, 0.012)) { k.plague = randInt(r, 2, 4); recordChronicle(w, `โรคระบาดแพร่ไปทั่ว${k.name}`); }
  if (!k.war && chance(r, 0.03)) {
    const foe = pick(r, d.kingdoms.filter((x) => x.id !== k.id && !x.war));
    if (foe) { k.war = foe.id; foe.war = k.id; recordChronicle(w, `${k.name}ประกาศสงครามกับ${foe.name}`); }
  } else if (k.war && chance(r, 0.22)) {
    const foe = d.kingdoms.find((x) => x.id === k.war);
    k.war = undefined;
    if (foe) {
      foe.war = undefined;
      const won = k.power + randInt(r, -15, 15) >= foe.power;
      const [a, b] = won ? [k, foe] : [foe, k];
      a.power = clamp(a.power + 6, 15, 95); b.power = clamp(b.power - 6, 15, 95);
      recordChronicle(w, `${a.name}ชนะสงครามต่อ${b.name}`);
    }
  }
}

export function tickWorld(w: WorldState, r: Rng) {
  const d = w.data as unknown as FData;
  for (const k of d.kingdoms) tickKingdom(w, d, k, r);
  const dr = d.dragon;
  if (dr.alive) {
    dr.age++;
    dr.mood = clamp(dr.mood + randInt(r, -2, 2), -100, 100);
    if (dr.mood < -30 && chance(r, 0.06)) {
      const k = d.kingdoms.find((x) => x.id === dr.home)!;
      k.power = clamp(k.power - 5, 15, 95);
      recordChronicle(w, `มังกร${dr.name}เผาเมืองชายแดนของ${k.name}`);
    }
  }
  for (const rl of d.relics) {
    if (rl.holder === "player") continue;
    if (rl.holder === "lost" ? chance(r, 0.006) : chance(r, 0.02)) {
      const by = rl.holder === "lost" ? pick(r, SEEKERS) : "lost";
      recordChronicle(w, by === "lost" ? `${rl.name}หายไปจากมือ${rl.holder}อีกครั้ง` : `${by}พบ${rl.name}`);
      rl.holder = by;
      rl.at = pick(r, d.kingdoms).id;
    }
  }
}

/** เดินเวลาโดยไม่มีผู้เล่น ใช้ตอนตัวละครใหม่เกิดหลังคนเก่าหลายสิบปี */
export const fastForward = (w: WorldState, years: number, r: Rng) => advanceWorld(w, years, (x) => tickWorld(x, r));
