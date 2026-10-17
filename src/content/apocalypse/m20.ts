// M20 — รวม event ของ "ฐานของคุณ"
import type { GameEvent } from "../../engine/events";
import "./base"; // ระบบฐาน (yearHook)
import { M20_CORE } from "./m20core";
import { M20_LIFE } from "./m20life";
import { M20_PEOPLE } from "./m20people";
import { M20_PRE } from "./m20pre";
import { M20_RUINS } from "./m20ruins";
import { M20_TOWN } from "./m20town";

export const M20_EVENTS: GameEvent[] = [...M20_CORE, ...M20_PRE, ...M20_RUINS, ...M20_LIFE, ...M20_PEOPLE, ...M20_TOWN];
