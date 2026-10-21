// เนื้อเรื่องยุทธภพฉบับเขียนใหม่ทั้งหมด (MURIM_PLAN §13 Rebuild policy, §17 Story catalogue)
// เรื่องเก่าที่ถูกแทนที่แล้วจะไม่เกิดในยุทธภพอีก — เหลือไว้เฉพาะกลไก (คัดศิษย์ ทะลวงขั้น ทำเนียบยอดฝีมือ ตั้งสำนัก มรดกข้ามรุ่น)
import { eligibilityFilters, type GameEvent } from "../../../engine/events";
import { CHILDHOOD_EVENTS } from "./childhood";
import { DAILY_EVENTS } from "./daily";
import { PRIME_EVENTS } from "./prime";
import { TEEN_EVENTS } from "./teen";
import { YOUNG_EVENTS } from "./young";

export const STORY_EVENTS: GameEvent[] = [...CHILDHOOD_EVENTS, ...TEEN_EVENTS, ...YOUNG_EVENTS, ...PRIME_EVENTS, ...DAILY_EVENTS];

/** เรื่องเก่าของยุทธภพที่ยังใช้ต่อ (เป็นกลไก ไม่ใช่เรื่องเล่า) */
const KEEP_OLD = /^(murim\.(assessment|breakthrough|quest)$|m17\.r\.|m17\.s\.|m\.legacy\.)/;
/** เรื่องเก่าที่ปลดแล้ว: เรื่องยุทธภพชุดเดิม + เรื่องกลางของทุกโลกที่ยุทธภพมีฉบับใหม่แทน */
const OLD_MURIM = /^(m\.|m2\.|m17\.|m23\.|q\.)/;
const OLD_SHARED = /^(l23\.|party\.|fate\.(trigger|sss_news|assassins|rank_reveal|second_awakening|rage|black_pill|devour|pact|master|arc_rival)$)/;

export const isRetiredInMurim = (id: string) => !KEEP_OLD.test(id) && (OLD_MURIM.test(id) || OLD_SHARED.test(id));

eligibilityFilters.push((l, e) => l.worldId !== "murim" || !isRetiredInMurim(e.id));
