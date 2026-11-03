// โลกแฟนตาซี: โครงว่างของ Milestone 0 · ระบบจริงมาตาม design/FANTASY_PLAN.md
import { activityFilters } from "../../engine/activities";
import { eligibilityFilters } from "../../engine/events";
import { registerWorld } from "../../engine/worldModule";
import { addLegend, advanceWorld, newWorldState, recordChronicle, type WorldState } from "../../engine/worldState";
import type { Life } from "../../engine/types";
import { displayName } from "../../engine/util";

export const FANTASY_START_YEAR = 1000;
/** ตัวละครใหม่ที่ไม่เกี่ยวกับคนเก่า เกิดหลังจากนั้นกี่ปี */
export const STRANGER_GAP: [number, number] = [20, 60];

export const newFantasyWorld = (seed: number) => newWorldState("fantasy", seed, FANTASY_START_YEAR);

/** เมื่อจบชีวิต: โลกจดจำชื่อคนนี้ไว้ และคนดังกลายเป็นตำนาน */
export function rememberLife(w: WorldState, l: Life) {
  recordChronicle(w, `${displayName(l)} จากโลกไปเมื่ออายุ ${l.age} ปี`);
  if (l.fame >= 40) addLegend(w, { name: displayName(l), deed: "ชื่อเสียงที่ผู้คนยังเล่าขาน", lifeId: l.id });
}

/** ปีเกิดของตัวละครใหม่ในโลกเดิม */
export function strangerBirth(w: WorldState, gap: number) {
  advanceWorld(w, gap);
  return w.year;
}

let loaded = false;
export function loadFantasyWorld() {
  if (loaded) return;
  loaded = true;
  // โลกนี้ใช้เนื้อหาของตัวเองเท่านั้น ไม่รับเหตุการณ์และกิจกรรมชุดเก่า
  eligibilityFilters.push((l, e) => l.worldId !== "fantasy" || e.world === "fantasy");
  activityFilters.push((l, a) => l.worldId !== "fantasy" || a.world === "fantasy");
  registerWorld({
    id: "fantasy",
    traits: { body: true, npcLife: true, hiddenTalents: true, repeatActs: true, surnameFirst: false, classicKinTerms: true },
  });
}
