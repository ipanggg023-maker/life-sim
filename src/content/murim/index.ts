import { registerEvents } from "../../engine/events";
import "./m17core"; // ระบบทำเนียบ ธรรมะ-มาร สมุดบุญคุณ สำนักของตัวเอง (ตัวระบบ ไม่ใช่เนื้อเรื่อง)
import "./careers"; // ลงทะเบียนอาชีพและกิจกรรมของยุทธภพ
import { BODY_EVENTS, CRISIS_EVENTS, DUEL_EVENTS, GOAL_EVENTS, HOUSEHOLD_EVENTS, NPC_EVENTS } from "./life";
import { MILESTONE_EVENTS } from "./life/milestones";
import { GOAL2_EVENTS } from "./life/goalEvents";
import { CRIME_EVENTS, FAMILY_RITE_EVENTS, TRAVEL_EVENTS } from "./life/law";
import "./life/activities"; // แท็บ "ทำ" ของยุทธภพ
import { GENERATION_EVENTS } from "./life/generations";
import { STORY_EVENTS } from "./story";
import { MARTIAL_EVENTS } from "./martial/training";
import { WORLD_EVENTS } from "./world";

let loaded = false;

export function loadMurimWorld() {
  if (loaded) return;
  loaded = true;
  registerEvents([...MILESTONE_EVENTS, ...CRISIS_EVENTS, ...GOAL_EVENTS, ...NPC_EVENTS, ...DUEL_EVENTS, ...BODY_EVENTS, ...STORY_EVENTS, ...MARTIAL_EVENTS, ...HOUSEHOLD_EVENTS, ...WORLD_EVENTS, ...GENERATION_EVENTS, ...CRIME_EVENTS, ...TRAVEL_EVENTS, ...FAMILY_RITE_EVENTS, ...GOAL2_EVENTS], "murim");
}
