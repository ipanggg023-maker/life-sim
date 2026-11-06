// โลกเดินต่อทุกปี: กษัตริย์แก่และผลัดรุ่น สงคราม โรคระบาด มังกร และคนอื่นออกล่าอาวุธตำนาน
import { chance, pick, randInt } from "../../engine/rng";
import type { Life } from "../../engine/types";
import { clamp } from "../../engine/util";
import { advanceWorld, recordChronicle, type WorldState } from "../../engine/worldState";
import { free, rollWar, settleWar, tickEmpire } from "./empire";
import { reformLaws, seekerOf, tickSociety } from "./society";
import { ensureSociety, passRelic, type FData, type Kingdom } from "./state";

type Rng = Pick<Life, "rng">;
const HEIR_M = ["คาเอล", "โรวาน", "กาเรธ", "ลูเซียน", "ดาริอัส", "ฮาเดรียน", "เอลวิน", "ธาเดียส", "ออเรลิอัส", "ซีเดริค"];
const HEIR_F = ["ไอลีน", "เอลาร่า", "มิร่า", "อิโซลด์", "คาลิสตา", "โรเวนา", "เซรีน", "วาเลเรีย", "เบียทริซ", "ออโรร่า"];
/** ทายาทแต่ละแผ่นดินไม่ซ้ำกับผู้ครองคนอื่นที่ยังอยู่ */
export function newRuler(d: FData, r: Rng) {
  const roll = () => (chance(r, 0.5) ? `${pick(r, ["เจ้าชาย", "ลอร์ด", "ดยุก"])}${pick(r, HEIR_M)}` : `${pick(r, ["เจ้าหญิง", "เลดี้", "ดัชเชส"])}${pick(r, HEIR_F)}`);
  let name = roll();
  for (let i = 0; i < 8 && d.kingdoms.some((k) => k.ruler.endsWith(name.replace(/^(เจ้าชาย|ลอร์ด|ดยุก|เจ้าหญิง|เลดี้|ดัชเชส)/, ""))); i++) name = roll();
  return name;
}
const SEEKERS = ["อัศวินดำโอริน", "นักล่าสมบัติเซล", "จอมเวทมัลคอร์", "ทหารรับจ้างบรานน์"];

function tickKingdom(w: WorldState, d: FData, k: Kingdom, r: Rng) {
  k.rulerAge++;
  k.stability = clamp(k.stability + randInt(r, -3, 3) - (k.war ? 2 : 0) - (k.plague ? 2 : 0), 5, 95);
  if (k.plague && --k.plague <= 0) { k.plague = undefined; recordChronicle(w, `โรคระบาดใน${k.name}สงบลง`); }
  if (!k.playerRuled && !k.elective && k.rulerAge > 62 && chance(r, 0.08 + (k.rulerAge - 62) * 0.015)) {
    const old = k.ruler;
    k.ruler = k.consortHeir ?? newRuler(d, r);
    if (k.consortHeir) { k.playerRuled = true; k.consortHeir = undefined; }
    k.rulerAge = randInt(r, 22, 45);
    k.stability = clamp(k.stability - 12, 5, 95);
    recordChronicle(w, `${old}สิ้นพระชนม์ ${k.ruler}ขึ้นครอง${k.name}`);
    reformLaws(w, k, r);
  }
  // สภาเลือกผู้นำใหม่ทุกรอบ หลังเปิดรับสมัครไปหนึ่งปีให้ผู้เล่นลงแข่งก่อน · ผู้เล่นที่นั่งตำแหน่งอยู่ต้องลงเลือกตั้งเอง
  if (k.elective && !k.playerRuled && w.year > (k.nextElection ?? 0)) {
    const m = d.notables.find((n) => n.kingdom === k.id && n.role === "merchant");
    const old = k.ruler;
    k.ruler = m?.name ?? newRuler(d, r); k.rulerAge = m?.age ?? randInt(r, 35, 60); k.nextElection = w.year + 8;
    if (old !== k.ruler) recordChronicle(w, `สภาของ${k.name}เลือก${k.ruler}เป็นผู้นำแทน${old}`);
  }
  if (!k.plague && chance(r, 0.012)) { k.plague = randInt(r, 2, 4); recordChronicle(w, `โรคระบาดแพร่ไปทั่ว${k.name}`); }
  if (!k.war && !k.playerRuled && free(k) && chance(r, 0.03)) rollWar(w, d, k, r);
  else if (k.war && chance(r, 0.22)) {
    const foe = d.kingdoms.find((x) => x.id === k.war);
    k.war = undefined;
    if (foe) {
      if (foe.war === k.id) foe.war = undefined;
      const won = k.power + randInt(r, -15, 15) >= foe.power;
      const [a, b] = won ? [k, foe] : [foe, k];
      settleWar(w, d, a, b, r);
    }
  }
}

export function tickWorld(w: WorldState, r: Rng) {
  const d = ensureSociety(w);
  for (const k of d.kingdoms) tickKingdom(w, d, k, r);
  tickEmpire(w, d, r);
  tickSociety(w, d, r);
  for (const rl of d.relics) {
    // ดาบในหินอยู่ในหินจนกว่าผู้คู่ควรจะดึงออก ไม่หายไปเอง
    if (rl.holder === "player" || rl.holder === "stone") continue;
    if (rl.holder === "lost" ? chance(r, 0.006) : chance(r, 0.02)) {
      const by = rl.holder === "lost" ? seekerOf(d, r)?.name ?? pick(r, SEEKERS) : "lost";
      recordChronicle(w, by === "lost" ? `${rl.name}หายไปจากมือ${rl.holder}อีกครั้ง` : `${by}พบ${rl.name}`);
      passRelic(w, rl, by === "lost" ? "สูญหาย" : by);
      rl.holder = by;
      rl.at = pick(r, d.kingdoms).id;
    }
  }
}

/** เดินเวลาโดยไม่มีผู้เล่น ใช้ตอนตัวละครใหม่เกิดหลังคนเก่าหลายสิบปี */
export const fastForward = (w: WorldState, years: number, r: Rng) => advanceWorld(w, years, (x) => tickWorld(x, r));
