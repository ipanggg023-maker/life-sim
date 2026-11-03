// เวทมนตร์เชิงลึก: ธาตุ สมุดเวท มานารายปี บทสวด วงเวท อักษรรูน · ทุกคนจึงสู้ไม่เหมือนกัน
import { ACTIVITIES, type Activity } from "../../engine/activities";
import type { Choice, Ctx, GameEvent } from "../../engine/events";
import { runEvent } from "../../engine/game";
import { pick } from "../../engine/rng";
import type { Life } from "../../engine/types";
import { addMoney, clamp } from "../../engine/util";
import { B, C, G, GOLD, K, N, P, SCENE, type Res } from "./kit";
import { canCast, fightOdds } from "./power";
import { fl, type Element } from "./state";

export const ELEMENTS: Record<Element, { name: string; beats: Element }> = {
  fire: { name: "ไฟ", beats: "wind" },
  water: { name: "น้ำ", beats: "fire" },
  earth: { name: "ดิน", beats: "water" },
  wind: { name: "ลม", beats: "earth" },
  light: { name: "แสง", beats: "dark" },
  dark: { name: "ความมืด", beats: "light" },
};
const IDS = Object.keys(ELEMENTS) as Element[];

export interface Spell { id: string; name: string; element: Element; tier: 1 | 2 | 3 }
const NAMES: Record<Element, [string, string, string]> = {
  fire: ["ลูกไฟ", "กำแพงเพลิง", "พายุเพลิงสุริยะ"],
  water: ["หอกน้ำแข็ง", "คลื่นยักษ์", "ธารน้ำแข็งนิรันดร์"],
  earth: ["หนามศิลา", "ปราการดิน", "แผ่นดินแยก"],
  wind: ["ใบมีดลม", "เกราะพายุ", "มังกรลมกรด"],
  light: ["ศรแสง", "โล่ศักดิ์สิทธิ์", "รุ่งอรุณพิพากษา"],
  dark: ["เงาตรึงร่าง", "คำสาปอ่อนแรง", "เหวไร้แสง"],
};
export const SPELLS: Spell[] = IDS.flatMap((e) => NAMES[e].map((name, i) => ({ id: `${e}${i + 1}`, name, element: e, tier: (i + 1) as 1 | 2 | 3 })));
export const spellById = (id: string) => SPELLS.find((s) => s.id === id)!;

export const rollElement = (l: Life): Element => pick(l, IDS);
export const spellsOf = (l: Life) => (fl(l).spells ?? []).map(spellById);
export const manaMax = (l: Life) => { const f = fl(l); return 2 + f.magicRank * 2 + f.potential; };
export const manaLeft = (l: Life) => Math.max(0, manaMax(l) - (fl(l).manaUsed ?? 0));
const learned = (l: Life, s: Spell) => !!fl(l).spells?.includes(s.id);
/** เรียนได้ถึงขั้นเท่าระดับเวท · ธาตุของตัวเองเรียนถูกกว่า */
export const spellPrice = (l: Life, s: Spell) => s.tier * s.tier * (s.element === fl(l).element ? 12 : 25);
const available = (l: Life) => SPELLS.filter((s) => !learned(l, s) && s.tier <= Math.max(1, fl(l).magicRank));
export function learnSpell(l: Life, id: string) {
  const f = fl(l);
  f.spells = [...(f.spells ?? []), id];
}

/** โอกาสเมื่อร่ายใส่ศัตรู: ถูกธาตุแรงขึ้นมาก ผิดธาตุแย่ลง บทสวดช่วยให้แม่น */
export function spellOdds(l: Life, s: Spell, threat: number, weak?: Element, strong?: Element) {
  const f = fl(l);
  let o = fightOdds(l, threat) + s.tier * 0.04 + (f.chant ?? 0) * 0.03;
  if (s.element === f.element) o += 0.05;
  if (weak && s.element === weak) o += 0.25;
  if (strong && s.element === strong) o -= 0.2;
  return clamp(o, 0.04, 0.97);
}

/** ปุ่มเวทในฉากต่อสู้: แสดงสูงสุดสามเวทที่แรงสุด */
export function spellChoices(threat: (l: Life, c: Ctx) => number, weak: (l: Life, c: Ctx) => Element | undefined, strong: (l: Life, c: Ctx) => Element | undefined, ok: (s: Spell) => Res, fail: Res): Choice[] {
  const slot = (l: Life, i: number) => spellsOf(l).slice().sort((a, b) => b.tier - a.tier)[i];
  return [0, 1, 2].map((i) => P(
    (l) => `ร่าย${slot(l, i)?.name ?? "เวท"} (${ELEMENTS[slot(l, i)?.element ?? "fire"].name} · มานา ${slot(l, i)?.tier ?? 1})`,
    (l, c) => spellOdds(l, slot(l, i), threat(l, c), weak(l, c), strong(l, c)),
    (l, c) => { const s = slot(l, i); spend(l, s); return ok(s)(l, c); },
    (l, c) => { spend(l, slot(l, i)); return fail(l, c); },
    { show: (l) => canCast(l) && !!slot(l, i) && manaLeft(l) >= slot(l, i).tier },
  ));
}
const spend = (l: Life, s: Spell) => { const f = fl(l); f.manaUsed = (f.manaUsed ?? 0) + s.tier; };

const M = (a: Omit<Activity, "world">): Activity => ({ ...a, world: "fantasy", group: "เวทมนตร์" });
const WAIT = 3;
const ready = (l: Life) => l.age >= Number(l.flags.ftArtNext ?? 0);

const ACTS: Activity[] = [
  M({ id: "ft_spell", emoji: "", name: "เรียนเวทบทใหม่", desc: "ร้านตำรา · ธาตุของคุณถูกกว่า", minAge: 10, available: (l) => canCast(l) && available(l).length > 0, run: (l) => { runEvent(l, "ft.spellshop"); return { text: "" }; } }),
  M({ id: "ft_art", emoji: "", name: "ศึกษาศาสตร์เวท", desc: "บทสวด วงเวท อักษรรูน · ทุก 3 ปี", minAge: 12, available: (l) => canCast(l) && fl(l).magicRank >= 1 && ready(l), run: (l) => { l.flags.ftArtNext = l.age + WAIT; runEvent(l, "ft.arts"); return { text: "" }; } }),
  M({ id: "ft_circle", emoji: "", name: "ทำพิธีวงเวท", desc: "เวทใหญ่ปีละครั้ง", minAge: 14, available: (l) => (fl(l).circle ?? 0) >= 1, run: (l) => { runEvent(l, "ft.ritual"); return { text: "" }; } }),
];

/** ร้านแสดงสี่บทที่ถูกที่สุด จึงไม่ต้องเลื่อนยาว */
const offer = (l: Life, i: number) => available(l).sort((a, b) => spellPrice(l, a) - spellPrice(l, b))[i];
const buy = (i: number): Choice => ({
  label: (l) => { const s = offer(l, i); return s ? `${s.name} · ธาตุ${ELEMENTS[s.element].name} ขั้น ${s.tier} (${spellPrice(l, s)} เหรียญทอง)` : "—"; },
  show: (l) => !!offer(l, i),
  req: (l) => { const s = offer(l, i); return s && l.money < spellPrice(l, s) * GOLD ? `ต้องมี ${spellPrice(l, s)} เหรียญทอง` : undefined; },
  run: (l) => { const s = offer(l, i); addMoney(l, -spellPrice(l, s) * GOLD); learnSpell(l, s.id); return { text: `คุณท่องบท${s.name}จนขึ้นใจ`, kind: "good" }; },
});

const up = (key: "chant" | "circle" | "rune") => (l: Life) => { const f = fl(l); f[key] = Math.min(3, (f[key] ?? 0) + 1); };

export const MAGIC_EVENTS: GameEvent[] = [
  SCENE("ft.spellshop", "ร้านตำรา", (l) => `ชั้นหนังสือเก่าเรียงถึงเพดาน ธาตุของคุณคือ${f(l)}`, [buy(0), buy(1), buy(2), buy(3), C("ยังไม่ซื้อ", N("คุณอ่านฟรีไปครึ่งเล่มแล้วถูกไล่ออกจากร้าน"))]),
  SCENE("ft.arts", "ศาสตร์เวท", "คุณจะลงลึกเรื่องใดในอีกหลายปีข้างหน้า", [
    K("บทสวด: ร่ายแม่นขึ้น", "smarts", 45, G("เสียงคุณเข้าจังหวะกับมานาในที่สุด", { magic: 5 }, up("chant")), N("คุณท่องผิดจังหวะจนเปลวไฟเย็นลง"), { show: (l) => (fl(l).chant ?? 0) < 3 }),
    K("วงเวท: พิธีขนาดใหญ่", "smarts", 50, G("เส้นชอล์กของคุณเรืองแสงครบทุกวง", { magic: 5 }, up("circle")), N("เส้นหนึ่งไม่ปิด พิธีจึงไม่เกิดอะไรขึ้น"), { show: (l) => (fl(l).circle ?? 0) < 3 }),
    K("อักษรรูน: ฝังพลังในอาวุธ", "health", 45, G("อักษรบนใบดาบคุณยังเรืองแสงจางๆ หลังเย็นลง", { body: 5 }, up("rune")), N("เหล็กไม่ยอมรับรอยสลักของคุณ"), { show: (l) => (fl(l).rune ?? 0) < 3 }),
    C("พักไว้ก่อน", N("คุณปิดตำราแล้วออกไปตากแดด")),
  ]),
  SCENE("ft.ritual", "พิธีวงเวท", (l) => `วงเวทระดับ ${fl(l).circle} ของคุณพร้อมแล้ว จะใช้พลังนี้ทำอะไร`, [
    C("เรียกพลังรักษา", G("แผลเก่าทั้งหมดสมานขึ้นในคืนเดียว", { hp: 12 })),
    K("อวยพรที่นาและบ้านเรือน", "luck", 45, G("ทั้งหมู่บ้านเก็บเกี่ยวได้ดีเป็นประวัติการณ์ และส่งเงินมาขอบคุณ", { gold: 20, fame: 3 }), B("พิธีเหวี่ยงกลับ พืชผลในไร่เหี่ยวไปหนึ่งแถว", { fame: -1 })),
    P("เปิดประตูมิติเล็กๆ", (l) => 0.25 + (fl(l).circle ?? 0) * 0.15 + (l.stats.smarts - 50) / 200, G("มีของบางอย่างจากอีกโลกหล่นผ่านช่องนั้นก่อนจะปิด", { gold: 45, magic: 8 }), B("บางอย่างจากอีกโลกมองกลับมาหาคุณ", { hp: -14 }), { tone: "danger" }),
  ]),
];

function f(l: Life) { return ELEMENTS[fl(l).element ?? "fire"].name; }
export const loadMagic = () => { ACTIVITIES.push(...ACTS); };
