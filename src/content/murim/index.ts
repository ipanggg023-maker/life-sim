import { registerEvents } from "../../engine/events";
import { MURIM_EVENTS } from "./events";
import { MURIM_MORE } from "./more";
import { MURIM_QUEST } from "./quest";
import { M17_EVENTS } from "./m17";
import { MURIM23_EVENTS } from "./m23";
import "./careers"; // ลงทะเบียนอาชีพและกิจกรรมของยุทธภพ
import { BODY_EVENTS, CRISIS_EVENTS, DUEL_EVENTS, GOAL_EVENTS, NPC_EVENTS } from "./life"; // Phase 1: แผนหลักของปี + สภาพโลก/วิกฤต

let loaded = false;

export function loadMurimWorld() {
  if (loaded) return;
  loaded = true;
  registerEvents([...MURIM_EVENTS, ...MURIM_MORE, MURIM_QUEST, ...M17_EVENTS, ...MURIM23_EVENTS, ...CRISIS_EVENTS, ...GOAL_EVENTS, ...NPC_EVENTS, ...DUEL_EVENTS, ...BODY_EVENTS], "murim");
}
