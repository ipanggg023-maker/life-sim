// M19 — รวม event ใหม่ของโลกหอคอย (id ขึ้นต้น t19.)
import type { GameEvent } from "../../engine/events";
import { M19_CLIMB } from "./m19climb";
import { M19_EARTH } from "./m19earth";
import { M19_ELDER } from "./m19elder";
import { M19_INVITE } from "./m19invite";
import { M19_STARS } from "./m19stars";
import { M19_TEAM } from "./m19team";
import { M19_TOWN } from "./m19town";
import { M19_YOUNG } from "./m19young";

export const M19_EVENTS: GameEvent[] = [...M19_YOUNG, ...M19_INVITE, ...M19_TEAM, ...M19_STARS, ...M19_TOWN, ...M19_CLIMB, ...M19_EARTH, ...M19_ELDER];
