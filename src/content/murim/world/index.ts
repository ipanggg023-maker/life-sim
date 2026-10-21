// Phase 6 — โลกยุทธภพที่มีชีวิต: สำนัก/ฝ่าย · ราชสำนักและวังหลัง · ตัวตนระดับตำนาน
import type { GameEvent } from "../../../engine/events";
import { COURT_EVENTS } from "./court";
import { FACTION_EVENTS } from "./factions";
import { LEGEND_EVENTS } from "./legends";

export const WORLD_EVENTS: GameEvent[] = [...FACTION_EVENTS, ...COURT_EVENTS, ...LEGEND_EVENTS];
