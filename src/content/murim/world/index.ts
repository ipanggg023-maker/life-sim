// Phase 6 — โลกยุทธภพที่มีชีวิต: สำนัก/ฝ่าย · ราชสำนักและวังหลัง · ตัวตนระดับตำนาน · ทำเนียบยอดฝีมือ · สำนักของตัวเอง
import type { GameEvent } from "../../../engine/events";
import { COURT_EVENTS } from "./court";
import { FACTION_EVENTS } from "./factions";
import { LEGEND_EVENTS } from "./legends";
import { MYSECT_EVENTS } from "./mysect";
import { RANKING_EVENTS } from "./ranking";
import { WAR_EVENTS } from "./war";
import { JIANGHU_EVENTS } from "./jianghu";
import { PALACE_EVENTS } from "./palace";

export const WORLD_EVENTS: GameEvent[] = [...FACTION_EVENTS, ...COURT_EVENTS, ...LEGEND_EVENTS, ...RANKING_EVENTS, ...MYSECT_EVENTS, ...WAR_EVENTS, ...JIANGHU_EVENTS, ...PALACE_EVENTS];
