// M18 — เอกลักษณ์ของโลกราชสำนัก: รวม event ทั้งหมด (ระบบอยู่ใน politics.ts)
import type { GameEvent } from "../../engine/events";
import "./politics"; // ลงทะเบียน yearHook ของดุลอำนาจและข่าวลือ
import { M18_CHILD } from "./m18child";
import { M18_ELDER } from "./m18elder";
import { M18_FACTIONS } from "./m18factions";
import { M18_MARRIAGE } from "./m18marriage";
import { M18_SCHEMES } from "./m18schemes";
import { M18_SOCIETY } from "./m18society";
import { M18_TEEN } from "./m18teen";

export const M18_EVENTS: GameEvent[] = [...M18_CHILD, ...M18_TEEN, ...M18_SOCIETY, ...M18_FACTIONS, ...M18_MARRIAGE, ...M18_SCHEMES, ...M18_ELDER];
