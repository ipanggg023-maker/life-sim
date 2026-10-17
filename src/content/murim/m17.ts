// M17 — รวม event ของระบบประจำยุทธภพ
import type { GameEvent } from "../../engine/events";
import "./m17core";
import { M17_ALIGN } from "./m17align";
import { M17_LEDGER } from "./m17ledger";
import { M17_LIFE } from "./m17life";
import { M17_RANK } from "./m17rank";
import { M17_SECT } from "./m17sect";

export const M17_EVENTS: GameEvent[] = [...M17_RANK, ...M17_ALIGN, ...M17_LEDGER, ...M17_SECT, ...M17_LIFE];
