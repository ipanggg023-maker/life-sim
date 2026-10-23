// Phase 6 — โลกยุทธภพที่มีชีวิต: สำนัก/ฝ่าย · ราชสำนักและวังหลัง · ตัวตนระดับตำนาน · ทำเนียบยอดฝีมือ · สำนักของตัวเอง
import type { GameEvent } from "../../../engine/events";
import { COURT_EVENTS } from "./court";
import { FACTION_EVENTS } from "./factions";
import { LEGEND_EVENTS } from "./legends";
import { MYSECT_EVENTS } from "./mysect";
import { RANK_CHALLENGE_EVENTS, RANKING_EVENTS } from "./ranking";
import { WAR_EVENTS } from "./war";
import { JIANGHU_EVENTS } from "./jianghu";
import { PALACE_EVENTS } from "./palace";
import { SCHEME_EVENTS } from "./palaceSchemes";
import { WAR_EVENTS2 } from "./sectWar";
import { KINGDOM_COURT_EVENTS } from "./kingdomCourt";
import { EMPEROR_EVENTS } from "./emperor";
import { HAREM_EVENTS } from "./harem";
import { KING_EVENTS } from "./regionKings";
import { EDICT_EVENTS } from "./edicts";
import { EMPEROR_LIFE_EVENTS } from "./emperorLife";

export const WORLD_EVENTS: GameEvent[] = [...FACTION_EVENTS, ...COURT_EVENTS, ...LEGEND_EVENTS, ...RANKING_EVENTS, ...MYSECT_EVENTS, ...WAR_EVENTS, ...JIANGHU_EVENTS, ...PALACE_EVENTS, ...SCHEME_EVENTS, ...WAR_EVENTS2, ...KINGDOM_COURT_EVENTS, ...EMPEROR_EVENTS, ...HAREM_EVENTS, ...KING_EVENTS, ...EDICT_EVENTS, ...RANK_CHALLENGE_EVENTS, ...EMPEROR_LIFE_EVENTS];
