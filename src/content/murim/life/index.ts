// ชีวิตรายปีแบบใหม่ของยุทธภพ: Phase 1 แผนหลักของปี + สภาพโลก/วิกฤต · Phase 2 เป้าหมายชีวิต + NPC มีความรู้สึก/ความทรงจำ
import { kinDeathHooks, yearHooks } from "../../../engine/game";
import { tickNpcs } from "../../../engine/npc";
import { noteKinDeath, tickGoals } from "./goals";
import { applyPlan } from "./plan";
import { tickWorld } from "./world";

export { CRISIS_EVENTS } from "./crisisEvents";
export { GOAL_EVENTS } from "./goals";
export { NPC_EVENTS } from "./npcEvents";

yearHooks.push(applyPlan, tickWorld, tickNpcs, tickGoals);
kinDeathHooks.push((l, p, violent, killer) => {
  if (l.worldId === "murim") noteKinDeath(l, p, violent, killer);
});