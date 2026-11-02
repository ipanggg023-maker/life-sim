// ตอนนี้คุณอยู่ที่ไหน: คุก ตำหนักเย็น วังหลัง ปิดด่าน · แท็บทำแสดงเฉพาะสิ่งที่ทำได้จากตรงนั้น
import { ACTIVITIES, activityFilters, type Activity } from "../../../engine/activities";
import { runEvent } from "../../../engine/game";
import { chance, randInt } from "../../../engine/rng";
import type { Life } from "../../../engine/types";
import { addMoney, addStat, checkChance, createPerson, shortName } from "../../../engine/util";
import { gainExp } from "../../hunter/power";
import { TAEL } from "../story/kit";
import { jailed } from "./law";

export interface Place { id: "jail" | "cold" | "harem" | "seclusion"; name: string; note: string; group?: string }

const inHarem = (l: Life) => l.flags.qnRank !== undefined && !l.flags.emperorSelf;
const secluded = (l: Life) => Number(l.flags.secludeUntil ?? 0) > l.age;

/** undefined = อยู่ข้างนอก ไปไหนก็ได้ */
export function placeOf(l: Life): Place | undefined {
  if (l.worldId !== "murim") return;
  if (jailed(l)) return { id: "jail", name: "ในคุก", note: `เหลืออีก ${Number(l.flags.jailUntil) - l.age} ปี ทำได้แค่สิ่งที่อยู่หลังลูกกรง`, group: "ในคุก" };
  if (inHarem(l) && l.flags.qnCold) return { id: "cold", name: "ตำหนักเย็น", note: "ประตูปิดจากด้านนอก จะออกไปได้ต้องมีคนเปิดให้" };
  if (inHarem(l)) return { id: "harem", name: "ในวังหลัง", note: "กำแพงวังกั้นคุณจากโลกข้างนอก เรื่องในยุทธภพ ตลาด และโรงเตี๊ยมไปไม่ถึงที่นี่", group: "ในวัง" };
  if (secluded(l)) return { id: "seclusion", name: "ปิดด่าน", note: "คุณตัดขาดจากโลกจนกว่าจะออกจากด่าน" };
}

const BASIC = /^(mw_rest|mw_meditate|mw_manual|mw_body|.*goal.*)$/;
const OUTSIDE_GROUPS = new Set(["ยุทธภพ", "อาชญากรรม", "ทรัพย์สิน"]);
const OUTSIDE = new Set(["mw_tavern", "mw_gamble", "mw_gear", "mw_pill", "mw_beauty", "mw_wander", "mw_spar", "mw_exam", "mw_matchmaker", "mw_adopt", "mw_disown"]);

export function placeAllows(l: Life, a: Activity): boolean {
  const p = placeOf(l);
  if (a.group === "ในคุก") return p?.id === "jail";
  if (a.group === "ในวัง") return p?.id === "harem";
  if (a.group === "ตำหนักเย็น") return p?.id === "cold";
  if (!p) return true;
  if (p.id === "harem") return !OUTSIDE.has(a.id) && !OUTSIDE_GROUPS.has(a.group ?? "");
  return BASIC.test(a.id);
}
activityFilters.push(placeAllows);

const RENAME: Partial<Record<Place["id"], Record<string, string>>> = {
  jail: { mw_rest: "พักในห้องขัง", mw_body: "ฝึกร่างกายในห้องขัง" },
  cold: { mw_rest: "พักในตำหนักเย็น", mw_body: "ฝึกร่างกายหลังตำหนัก" },
  harem: { mw_rest: "พักในตำหนัก", mw_body: "ฝึกร่างกายในลานตำหนัก" },
  seclusion: { mw_rest: "พักในห้องปิดด่าน", mw_body: "ฝึกร่างกายในห้องปิดด่าน" },
};
/** ชื่อปุ่มให้ตรงกับที่อยู่ */
export const placeName = (l: Life, a: Activity) => { const p = placeOf(l); return (p && RENAME[p.id]?.[a.id]) ?? a.name; };

/** จำนวนกิจกรรมที่ที่นี่เข้าไม่ถึง (บอกผู้เล่นว่าไม่ได้หายไปเฉยๆ) */
export const placeHidden = (l: Life) => ACTIVITIES.filter((a) => a.world === "murim" && !placeAllows(l, a) && !["ในคุก", "ในวัง", "ตำหนักเย็น"].includes(a.group ?? "") && l.age >= a.minAge && (!a.available || a.available(l))).length;

const J = (a: Omit<Activity, "world" | "group">): Activity => ({ ...a, world: "murim", group: "ในคุก" });
const ok = (text: string) => ({ text, kind: "good" as const });
const meh = (text: string) => ({ text });
const bad = (text: string) => ({ text, kind: "bad" as const });
const BRIBE = 25;

ACTIVITIES.push(
  J({ id: "mw_j_bribe", emoji: "🪙", name: "ติดสินบนผู้คุม", desc: "ลดโทษ", minAge: 12, cost: BRIBE * TAEL, odds: (l) => checkChance(l, "smarts", 50), run: (l) => {
    addMoney(l, -BRIBE * TAEL);
    if (!chance(l, checkChance(l, "smarts", 50))) return bad("ผู้คุมรับเงินแล้วบอกว่าไม่เคยเห็นคุณ");
    l.flags.jailUntil = Number(l.flags.jailUntil) - randInt(l, 1, 2);
    return ok("ชื่อคุณถูกย้ายไปอีกบรรทัดในทะเบียน โทษของคุณสั้นลง");
  } }),
  J({ id: "mw_j_cell", emoji: "🤝", name: "ผูกมิตรในห้องขัง", desc: "ได้คนรู้จักจากด้านมืด", minAge: 12, available: (l) => !l.people.some((p) => p.tags?.includes("cellmate")), run: (l) => {
    const p = createPerson(l, "friend", { age: l.age + randInt(l, -5, 15), gender: "m", bond: 40, job: "นักโทษ" });
    p.tags = [...(p.tags ?? []), "cellmate"];
    return ok(`${shortName(p)}แบ่งข้าวในชามให้คุณ แล้วบอกว่าถ้าออกไปได้ให้ไปหาเขาที่ท่าเรือ`);
  } }),
  J({ id: "mw_j_break", emoji: "🗝️", name: "วางแผนแหกคุก", desc: "เปิดฉากในคุก เลือกจะหนีหรือไม่", minAge: 12, run: (l) => { runEvent(l, "cr.prison"); return { text: "" }; } }),
  J({ id: "mw_j_learn", emoji: "🥋", name: "ขอเรียนจากนักโทษชรา", desc: "วิชาจากคนที่โลกลืม", minAge: 12, available: (l) => !!l.power, odds: (l) => checkChance(l, "smarts", 55), run: (l) => {
    if (!chance(l, checkChance(l, "smarts", 55))) return meh("ชายชราหัวเราะจนไอ แล้วหันหน้าเข้ากำแพง");
    gainExp(l, 500); addStat(l, "smarts", 1);
    return ok("เขาวาดท่าเดียวบนพื้นคุกด้วยน้ำลาย คุณใช้เวลาทั้งปีกว่าจะเข้าใจ");
  } }),
);
