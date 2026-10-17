// M16 — รวม event ชุดใหม่ของโลก Hunter (id ขึ้นต้นด้วย h16.)
import type { GameEvent } from "../../../engine/events";
import { BREAK_EVENTS } from "./m16Break";
import { ADULT16_EVENTS } from "./m16Adult";
import { HUNTER16_EVENTS } from "./m16Hunter";
import { WORLD16_EVENTS } from "./m16World";
import { CHILD_EVENTS } from "./m16Child";
import { SCHOOL16_EVENTS } from "./m16School";
import { GUILD_EVENTS } from "./m16Guild";
import { MARKET_EVENTS } from "./m16Market";

export const M16_EVENTS: GameEvent[] = [...BREAK_EVENTS, ...MARKET_EVENTS, ...GUILD_EVENTS, ...CHILD_EVENTS, ...SCHOOL16_EVENTS, ...ADULT16_EVENTS, ...HUNTER16_EVENTS, ...WORLD16_EVENTS];
