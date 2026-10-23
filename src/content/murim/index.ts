import { registerEvents } from "../../engine/events";
import "./m17core"; // ระบบทำเนียบ ธรรมะ-มาร สมุดบุญคุณ สำนักของตัวเอง (ตัวระบบ ไม่ใช่เนื้อเรื่อง)
import "./careers"; // ลงทะเบียนอาชีพและกิจกรรมของยุทธภพ
import { BODY_EVENTS, CRISIS_EVENTS, DUEL_EVENTS, GOAL_EVENTS, HOUSEHOLD_EVENTS, NPC_EVENTS } from "./life";
import { MILESTONE_EVENTS } from "./life/milestones";
import { GOAL2_EVENTS } from "./life/goalEvents";
import { GOAL_CHANCE_EVENTS } from "./life/goalChances";
import { TURNING_EVENTS } from "./life/turningPoints";
import { ALL_SECT_LIFE_EVENTS } from "./martial/sectLife";
import { TREASURE_EVENTS } from "./martial/treasures";
import { THREE_KINGDOMS_EVENTS } from "./world/threeKingdoms";
import { WUXIA_FILM_EVENTS } from "./world/wuxiaFilm";
import { RUMOR_EVENTS } from "./life/rumors";
import { FAITH_EVENTS } from "./life/faith";
import { TORTURE_EVENTS } from "./life/torture";
import { RITE_EVENTS } from "./life/rites";
import { SEED_EVENTS } from "./life/seeds";
import { NPC_LIFE_EVENTS } from "./life/npcLife";
import { CALM_EVENTS } from "./story/calm";
import { JOB2A_EVENTS } from "./story/jobs2a";
import { JOB2B_EVENTS } from "./story/jobs2b";
import { JOB2C_EVENTS } from "./story/jobs2c";
import { DAILY3_EVENTS } from "./story/daily3";
import { DARK_EVENTS } from "./life/darkDeeds";
import { ROMANCE_EVENTS } from "./life/romance";
import { RIVAL_EVENTS } from "./life/npcMartial";
import { CRIME_EVENTS, FAMILY_RITE_EVENTS, TRAVEL_EVENTS } from "./life/law";
import "./life/activities"; // แท็บ "ทำ" ของยุทธภพ
import { GENERATION_EVENTS } from "./life/generations";
import { STORY_EVENTS } from "./story";
import { MARTIAL_EVENTS } from "./martial/training";
import { WORLD_EVENTS } from "./world";
import "./life/gifts";
import "./life/giftHooks";
import "./life/deathCause";
import { TALENT_ENGINE_EVENTS } from "./life/talentArcs";
import { TALENT_STORY_EVENTS } from "./life/talentStories";
import { TALENT_STORY2_EVENTS } from "./life/talentStories2";

let loaded = false;

export function loadMurimWorld() {
  if (loaded) return;
  loaded = true;
  registerEvents([...MILESTONE_EVENTS, ...CRISIS_EVENTS, ...GOAL_EVENTS, ...NPC_EVENTS, ...DUEL_EVENTS, ...BODY_EVENTS, ...STORY_EVENTS, ...MARTIAL_EVENTS, ...HOUSEHOLD_EVENTS, ...WORLD_EVENTS, ...GENERATION_EVENTS, ...CRIME_EVENTS, ...TRAVEL_EVENTS, ...FAMILY_RITE_EVENTS, ...GOAL2_EVENTS, ...GOAL_CHANCE_EVENTS, ...TURNING_EVENTS, ...ALL_SECT_LIFE_EVENTS, ...TREASURE_EVENTS, ...THREE_KINGDOMS_EVENTS, ...WUXIA_FILM_EVENTS, ...RUMOR_EVENTS, ...FAITH_EVENTS, ...TORTURE_EVENTS, ...RITE_EVENTS, ...SEED_EVENTS, ...NPC_LIFE_EVENTS, ...CALM_EVENTS, ...JOB2A_EVENTS, ...JOB2B_EVENTS, ...JOB2C_EVENTS, ...DAILY3_EVENTS, ...DARK_EVENTS, ...ROMANCE_EVENTS, ...RIVAL_EVENTS, ...TALENT_ENGINE_EVENTS, ...TALENT_STORY_EVENTS, ...TALENT_STORY2_EVENTS], "murim");
}
