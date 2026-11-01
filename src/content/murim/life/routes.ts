// เส้นทางชีวิต: นับจากสิ่งที่ทำจริง ไม่ต้องเลือกก่อนเกิด ชีวิตเดียวเดินได้หลายทาง
// ความคืบหน้าเก็บข้ามชีวิต หน้าจบชีวิตบอกว่าทางไหนขยับ และยังเหลือทางไหนให้ลอง
import type { Life, Soul, StatKey } from "../../../engine/types";
import { addStat, log, people } from "../../../engine/util";
import { TAEL } from "../story/kit";
import { mySect } from "../m17core";
import { palaceAccess } from "../world/court";

export interface Route {
  id: string;
  name: string;
  /** ขั้นที่ 1-3 */
  stages: [string, string, string];
  /** ถึงขั้นไหนแล้ว (0-3) */
  tier: (l: Life) => number;
  /** บอกตรงๆ ว่าไปทางนี้ต้องทำอะไร */
  how: string;
  /** พรเมื่อครบสามขั้น */
  gift: StatKey;
}

const rank = (l: Life) => l.power?.rank ?? 0;
const align = (l: Life) => Number(l.flags.m17Align ?? 0);
const kids = (l: Life) => people(l, "child", false).length;
const won = (l: Life, id: string) => !!l.goals?.some((g) => g.id === id && g.end === "won");
const count = (...xs: unknown[]) => { let n = 0; for (const x of xs) { if (!x) break; n++; } return n; };

const HOW: Record<string, string> = {
  "sword": "ตื่นพลังแล้วฝึกวิชาทุกปี กินยาดีและเลือกทะลวงคอขวดตอนพร้อม",
  "sect": "สมัครเข้าสำนักในแท็บอาชีพ ไต่ขั้นด้วยภารกิจ หรือชิงตำแหน่งเมื่อเจ้าสำนักแก่",
  "court": "สอบขุนนางในหมวดฝึกฝน หรือรับตำแหน่งเสมียนเมื่ออำเภอมาชวน",
  "throne": "เข้าวังผ่านงานขุนนางขั้นสูง หมอหลวง หรือองครักษ์ แล้วใช้วางแผนชิงอำนาจในหมวดราชสำนัก เกมจะบอกขั้นต่อไปในเมนูแผน",
  "harem": "ตัวละครหญิงโสดอายุไม่เกิน 28 สมัครคัดเลือกสนมในหมวดวังหลัง แล้วใช้เดินเกมในวังหลัง",
  "wealth": "ทำงานเงินดี ซื้อทรัพย์สินที่มีรายได้ และอย่าใช้เกินตัว",
  "estate": "เก็บเงินแล้วดูหมวดทรัพย์สินในแท็บทำ",
  "healer": "ฝึกวิชาแพทย์ ทำงานหมอยา หรือตั้งเป้าหมายเป็นหมอ",
  "good": "เลือกทางช่วยคน เปิดโรงทาน สร้างสะพาน แล้วทำให้คนรู้จัก",
  "dark": "เลือกทางโหดร้ายเรื่อยๆ ยิ่งลงมือเองยิ่งเร็ว",
  "turn": "เข้าสำนักธรรมะแล้วทำชั่ว หรือเข้าฝ่ายมารแล้วทำดี",
  "family": "แต่งงาน มีลูก แล้วเล่นต่อเป็นลูกหลาน",
  "teacher": "เก่งพอให้คนมาขอฝากตัว แล้วรับเป็นศิษย์",
  "road": "เลือกแผนชีวิตเดินทางในแถบแผนปีนี้",
  "outlaw": "ลองหมวดอาชญากรรม ลงมือจนคนเริ่มตามล่า",
  "tales": "รับเรื่องที่เข้ามาแล้วเล่นจนจบ ดูเรื่องที่ค้างได้เหนือบันทึก"
};

export const ROUTES: Route[] = ([
  { id: "sword", name: "ยอดฝีมือ", stages: ["ฝึกวิชาจนถึงชั้นสอง", "ถึงชั้นหนึ่ง", "แตะจุดสูงสุด"], gift: "health", tier: (l) => count(rank(l) >= 2, rank(l) >= 4, rank(l) >= 6) },
  { id: "sect", name: "คนของสำนัก", stages: ["เข้าสำนัก", "ขึ้นเป็นเจ้าสำนัก", "ตั้งสำนักของตัวเอง"], gift: "smarts", tier: (l) => count(!!l.power?.guild || !!l.flags.sectHead || !!mySect(l), !!l.flags.sectHead || !!mySect(l), !!mySect(l)) },
  { id: "court", name: "ขุนนาง", stages: ["สอบผ่านระดับอำเภอหรือเป็นเสมียน", "สอบได้จิ้นซื่อ", "มีอำนาจเหนือราชสำนัก"], gift: "smarts", tier: (l) => count(l.job?.careerId === "official" || !!l.flags.rtClerk || !!l.flags.xiucai || !!l.flags.jinshi || Number(l.flags.courtRank ?? 0) >= 1, !!l.flags.jinshi || Number(l.flags.courtRank ?? 0) >= 3, Number(l.flags.courtRank ?? 0) >= 5) },
  { id: "throne", name: "บัลลังก์", stages: ["เข้าออกวังหลวงได้", "ยืนใกล้บัลลังก์", "เป็นฮ่องเต้"], gift: "luck", tier: (l) => count(palaceAccess(l), Number(l.flags.courtRank ?? 0) >= 3, !!l.flags.emperorSelf) },
  { id: "harem", name: "วังหลัง", stages: ["เข้าวังเป็นสนม", "ขึ้นเป็นเฟย", "เป็นฮองเฮา"], gift: "looks", tier: (l) => { const r = Math.max(Number(l.flags.qnRank ?? -1), Number(l.flags.qnBest ?? -1)); return count(r >= 0, r >= 2, r >= 4); } },
  { id: "wealth", name: "พ่อค้าใหญ่", stages: ["มีเงินห้าร้อยตำลึง", "มีเงินห้าพันตำลึง", "มีเงินสองหมื่นตำลึง"], gift: "luck", tier: (l) => count(l.money >= 500 * TAEL, l.money >= 5000 * TAEL, l.money >= 20000 * TAEL) },
  { id: "estate", name: "เจ้าของกิจการ", stages: ["ซื้อที่นาหรือกิจการ", "สร้างคฤหาสน์หรือสะพาน", "มีครบทั้งนา โรงเตี๊ยม และคาราวาน"], gift: "luck", tier: (l) => count(l.flags.estate_farm !== undefined || l.flags.estate_inn !== undefined || l.flags.estate_caravan !== undefined, l.flags.estate_manor !== undefined || !!l.flags.builtBridge, l.flags.estate_farm !== undefined && l.flags.estate_inn !== undefined && l.flags.estate_caravan !== undefined) },
  { id: "healer", name: "หมอ", stages: ["รู้วิชาแพทย์", "เป็นหมอหลวงหรือหมอเทวดา", "ทำเป้าหมายหมอจนสำเร็จ"], gift: "health", tier: (l) => count(!!l.flags.medicKnow || won(l, "healer") || l.job?.careerId === "palace_physician", won(l, "healer") || l.job?.careerId === "palace_physician", won(l, "healer")) },
  { id: "good", name: "คนดีของแผ่นดิน", stages: ["เป็นฝ่ายธรรมะ", "ธรรมะผู้ยิ่งใหญ่", "ทั้งธรรมะและโด่งดัง"], gift: "looks", tier: (l) => count(align(l) >= 20, align(l) >= 60, align(l) >= 60 && l.fame >= 50) },
  { id: "dark", name: "ทางมาร", stages: ["ตกเป็นฝ่ายอธรรม", "ถูกเรียกว่ามาร", "มารที่มีเลือดติดมือ"], gift: "smarts", tier: (l) => count(align(l) <= -20, align(l) <= -60, align(l) <= -60 && Number(l.flags.mwKills ?? 0) >= 2) },
  { id: "turn", name: "คนสองฝั่ง", stages: ["ปิดบังตัวตนในสำนัก", "ถูกล่าหรือถูกชำระล้าง", "กลับมาได้ในที่สุด"], gift: "luck", tier: (l) => count(!!l.flags.tnMode, !!l.flags.tnCleansed || !!l.flags.tnFrom, !!l.flags.tnReturned || !!l.flags.tnRedeemed || !!l.flags.tnCleansed) },
  { id: "family", name: "ต้นตระกูล", stages: ["มีลูก", "มีลูกสามคน", "ตระกูลสืบมาสามรุ่น"], gift: "health", tier: (l) => count(kids(l) >= 1, kids(l) >= 3, Number(l.flags.generation ?? 1) >= 3) },
  { id: "teacher", name: "อาจารย์", stages: ["มีศิษย์หนึ่งคน", "มีศิษย์สามคน", "เล่นต่อเป็นศิษย์ของตัวเอง"], gift: "smarts", tier: (l) => { const d = l.people.filter((p) => p.tags?.includes("disciple")).length; return count(d >= 1, d >= 3, l.flags.plHow === "disciple"); } },
  { id: "road", name: "คนเดินทาง", stages: ["ออกเดินทางหนึ่งปี", "เดินทางห้าปี", "เดินทางสิบห้าปี"], gift: "looks", tier: (l) => { const y = Number(l.flags.mwWanderYears ?? 0); return count(y >= 1, y >= 5, y >= 15); } },
  { id: "outlaw", name: "คนนอกกฎหมาย", stages: ["ลงมือฆ่าคน", "ถูกประกาศจับ", "ถูกจับแล้วยังรอด"], gift: "luck", tier: (l) => count(Number(l.flags.mwKills ?? 0) >= 1, !!l.flags.wanted, l.flags.jailUntil !== undefined) },
  { id: "tales", name: "คนมีเรื่องเล่า", stages: ["จบเรื่องค้างหนึ่งเรื่อง", "จบสองเรื่องในชีวิตเดียว", "จบสามเรื่องในชีวิตเดียว"], gift: "looks", tier: (l) => { const n = Object.keys(l.flags).filter((k) => k.startsWith("ssE_")).length; return count(n >= 1, n >= 2, n >= 3); } },
] as Omit<Route, "how">[]).map((r) => ({ ...r, how: HOW[r.id] }));

/** ทางที่ชีวิตนี้ขยับเกินสถิติเดิม */
export function routeGains(s: Soul, l: Life) {
  return ROUTES.flatMap((r) => { const t = r.tier(l), had = s.routes?.[r.id] ?? 0; return t > had ? [{ r, tier: t }] : []; });
}

export function recordRoutes(s: Soul, l: Life) {
  const routes = { ...s.routes };
  for (const { r, tier } of routeGains(s, l)) routes[r.id] = tier;
  s.routes = routes;
  const ends = Object.keys(l.flags).filter((k) => k.startsWith("ssE_")).map((k) => `${k.slice(4)}:${l.flags[k]}`);
  if (ends.length) s.arcEnds = [...new Set([...(s.arcEnds ?? []), ...ends])];
}

/** ทางที่ยังไม่เคยเดินไกล ไว้แนะนำชาติหน้า (สุ่มตาม seed ให้ไม่ซ้ำทุกครั้ง) */
export function routeHints(s: Soul, l: Life, n = 3) {
  const after = (r: Route) => Math.max(s.routes?.[r.id] ?? 0, r.tier(l));
  const open = ROUTES.filter((r) => after(r) < 3 && (r.id !== "harem" || l.gender === "f")).sort((a, b) => after(a) - after(b) || (a.id.charCodeAt(0) * 7 + l.seed) % 11 - (b.id.charCodeAt(0) * 7 + l.seed) % 11);
  return open.slice(0, n).map((r) => ({ name: r.name, next: r.stages[after(r)], how: r.how }));
}

/** พรของทางที่เดินครบ: ค่าเริ่มต้น +2 ต่อทาง ไม่เกิน +6 ต่อค่า */
export function routeGifts(s: Soul) {
  const g: Partial<Record<StatKey, number>> = {};
  for (const r of ROUTES) if ((s.routes?.[r.id] ?? 0) >= 3) g[r.gift] = Math.min(6, (g[r.gift] ?? 0) + 2);
  return g;
}
export function applyRouteGifts(l: Life, s: Soul) {
  if (l.worldId !== "murim") return;
  const g = routeGifts(s);
  for (const [k, v] of Object.entries(g)) addStat(l, k as StatKey, v);
  if (Object.keys(g).length) log(l, "ชีวิตก่อนๆ ทิ้งบางอย่างไว้ในตัวคุณ คุณเกิดมาพร้อมพรเล็กๆ จากทางที่เคยเดินจนสุด", "good");
}
