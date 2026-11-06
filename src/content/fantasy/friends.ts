// มิตรภาพต้องใช้เวลา: คนที่เพิ่งเจอครั้งเดียวเป็นแค่คนรู้จัก
// ต้องสนิทกันขึ้น (ความผูกพัน 45) และรู้จักกันมาอย่างน้อยหนึ่งปีถึงเป็นเพื่อน · 72 และสามปีถึงเป็นเพื่อนสนิท (engine/util.ts friendStage)
import { personCreatedHooks } from "../../engine/util";

/** ความผูกพันเริ่มต้นของคนที่เพิ่งรู้จัก · ความผูกพันพิเศษตั้งแต่ 70 ขึ้นไป (ผู้อุปการะ พ่อแม่อุปถัมภ์ ญาติ) ไม่ถูกจำกัด */
export const NEW_FACE_BOND = 30;
let loaded = false;
export function loadFriends() {
  if (loaded) return;
  loaded = true;
  personCreatedHooks.push((l, p, bond) => {
    if (l.worldId === "fantasy" && p.relation === "friend" && (bond ?? 50) < 70) p.bond = Math.min(p.bond, NEW_FACE_BOND);
  });
}
