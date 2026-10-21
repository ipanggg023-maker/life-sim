import { registerEvents } from "../../engine/events";
import { MURIM_EVENTS } from "./events";
import { MURIM_MORE } from "./more";
import { MURIM_QUEST } from "./quest";
import { M17_EVENTS } from "./m17";
import { MURIM23_EVENTS } from "./m23";
import "./careers"; // ลงทะเบียนอาชีพและกิจกรรมของยุทธภพ
import { BODY_EVENTS, CRISIS_EVENTS, DUEL_EVENTS, GOAL_EVENTS, HOUSEHOLD_EVENTS, NPC_EVENTS } from "./life";
import { STORY_EVENTS } from "./story";
import { MARTIAL_EVENTS } from "./martial/training";
import { GENERATION_EVENTS } from "./life/generations";
import { WORLD_EVENTS } from "./world"; // Phase 6: สำนัก ราชสำนัก ตำนาน // Phase 4: วิชา ลมปราณ ความเข้าใจ วิธีฝึก // เนื้อเรื่องเขียนใหม่ทั้งหมด (เรื่องเก่าถูกปลดในยุทธภพ) // Phase 1: แผนหลักของปี + สภาพโลก/วิกฤต

let loaded = false;

export function loadMurimWorld() {
  if (loaded) return;
  loaded = true;
  registerEvents([...MURIM_EVENTS, ...MURIM_MORE, MURIM_QUEST, ...M17_EVENTS, ...MURIM23_EVENTS, ...CRISIS_EVENTS, ...GOAL_EVENTS, ...NPC_EVENTS, ...DUEL_EVENTS, ...BODY_EVENTS, ...STORY_EVENTS, ...MARTIAL_EVENTS, ...HOUSEHOLD_EVENTS, ...WORLD_EVENTS, ...GENERATION_EVENTS], "murim");
}
