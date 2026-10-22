// เนื้อเรื่องยุทธภพฉบับเขียนใหม่ทั้งหมด (MURIM_PLAN §13 Rebuild policy, §17 Story catalogue)
// เรื่องเก่าที่ถูกแทนที่แล้วจะไม่เกิดในยุทธภพอีก — เหลือไว้เฉพาะกลไก (คัดศิษย์ ทะลวงขั้น ทำเนียบยอดฝีมือ ตั้งสำนัก มรดกข้ามรุ่น)
import { eligibilityFilters, type GameEvent } from "../../../engine/events";
import { CHILDHOOD_EVENTS } from "./childhood";
import { DAILY_EVENTS } from "./daily";
import { DAILY2_EVENTS } from "./daily2";
import { LINKED_EVENTS } from "./linked";
import { ELDER_EVENTS } from "./elder";
import { CHAIN_EVENTS } from "./chains";
import { RARE_EVENTS } from "./rare";
import { YOUTH_EVENTS } from "./youth";
import { ADULT_EVENTS } from "./adult";
import { SECTLIFE_EVENTS } from "./sectlife";
import { REGION_EVENTS } from "./regions";
import { JOB_EVENTS } from "./jobs";
import { RITE_EVENTS } from "./rites";
import { PRIME_EVENTS } from "./prime";
import { TEEN_EVENTS } from "./teen";
import { YOUNG_EVENTS } from "./young";
import { ERA_EVENTS } from "./eras";

export const STORY_EVENTS: GameEvent[] = [...CHILDHOOD_EVENTS, ...TEEN_EVENTS, ...YOUNG_EVENTS, ...PRIME_EVENTS, ...DAILY_EVENTS, ...DAILY2_EVENTS, ...LINKED_EVENTS, ...ELDER_EVENTS, ...CHAIN_EVENTS, ...RARE_EVENTS, ...YOUTH_EVENTS, ...ADULT_EVENTS, ...SECTLIFE_EVENTS, ...REGION_EVENTS, ...JOB_EVENTS, ...RITE_EVENTS, ...ERA_EVENTS];

/** ยุทธภพใช้เฉพาะเนื้อหาที่เขียนใหม่ (whitelist) — เรื่องเก่าทั้งหมด และเรื่องกลางของโลกอื่น ไม่เกิดในยุทธภพ */
const MURIM_NEW = /^(c|t|y|p|e|d|dl|sl|el|ch|rr|yt|ad|ms|rg|hh|goal|npc|duel|body|mw|fx|ct|lg|gen|md|mk|rk|sc|cr|tv|ft|fm|jb|jh|rm|iv|vw|tt|ca|dc|cm|dk|lv|rv|sw|er)\./;
const MURIM_KEEP = new Set(["duel", "talk.menu"]);

export const isRetiredInMurim = (id: string) => !MURIM_NEW.test(id) && !MURIM_KEEP.has(id);

eligibilityFilters.push((l, e) => l.worldId !== "murim" || !isRetiredInMurim(e.id));
