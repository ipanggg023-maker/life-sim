// Phase 1 — ชีวิตรายปีแบบใหม่ของยุทธภพ: แผนหลักของปี + สภาพโลก/วิกฤต
import { yearHooks } from "../../../engine/game";
import { applyPlan } from "./plan";
import { tickWorld } from "./world";

export { CRISIS_EVENTS } from "./crisisEvents";

yearHooks.push(applyPlan, tickWorld);
