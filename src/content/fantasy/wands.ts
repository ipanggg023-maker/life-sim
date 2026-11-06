// คทาเลือกคุณ (Release 23 · ชื่อผ่านการอนุมัติใน design/WAND_NAMES.md)
// เนื้อไม้ตามนิสัย · แกนตามธาตุ · คุณภาพตามดาวเวท · คทาแรกเป็นฝ่ายเลือกคุณ คทาที่ผิดจะพ่นประกายใส่มือ
import { ACTIVITIES } from "../../engine/activities";
import { registerEvents, type Choice, type Ctx, type GameEvent } from "../../engine/events";
import { oddsHooks, runEvent, yearHooks } from "../../engine/game";
import { nextFloat, pick } from "../../engine/rng";
import type { Life } from "../../engine/types";
import { addMoney, addStat, clamp } from "../../engine/util";
import { C, GOLD, N, P, SCENE } from "./kit";
import { personaOf, type Axis } from "./persona";
import { fl, type Element } from "./state";

export interface Wood { id: string; name: string; axis: Axis; sign: 1 | -1; trait: string; perk: string }
export interface Core { id: string; name: string; elements: [Element, Element] }
export const WOODS: Wood[] = [
  { id: "oak", name: "ไม้โอ๊กเก่า", axis: "h", sign: 1, trait: "ความซื่อตรง", perk: "ทางที่ซื่อตรงสำเร็จง่ายขึ้น" },
  { id: "willow", name: "ไม้หลิวร้องไห้", axis: "m", sign: 1, trait: "ความเมตตา", perk: "ทางที่เมตตาสำเร็จง่ายขึ้น" },
  { id: "yew", name: "ไม้ยูดำ", axis: "m", sign: -1, trait: "ความไร้ปรานี", perk: "ทางที่ไม่ปรานีสำเร็จง่ายขึ้น" },
  { id: "ash", name: "ไม้แอชฟ้าคะนอง", axis: "c", sign: 1, trait: "ความกล้า", perk: "ทางที่กล้าบ้าบิ่นสำเร็จง่ายขึ้น" },
  { id: "elder", name: "ไม้เอลเดอร์เงา", axis: "h", sign: -1, trait: "ความเจ้าเล่ห์", perk: "ทางที่ใช้เล่ห์สำเร็จง่ายขึ้น" },
  { id: "birch", name: "ไม้เบิร์ชขาว", axis: "f", sign: 1, trait: "ศรัทธา", perk: "ทางแห่งศรัทธาสำเร็จง่ายขึ้น" },
  { id: "cedar", name: "ไม้ซีดาร์ภูเขา", axis: "c", sign: -1, trait: "ความรอบคอบ", perk: "ทางที่รอบคอบสำเร็จง่ายขึ้น" },
  { id: "blackthorn", name: "ไม้หนามดำ", axis: "f", sign: -1, trait: "ใจอิสระ", perk: "ทางที่ไม่ยอมใครสำเร็จง่ายขึ้น" },
];
export const CORES: Core[] = [
  { id: "phoenix", name: "ขนฟีนิกซ์", elements: ["fire", "light"] },
  { id: "serpent", name: "เกล็ดงูทะเลลึก", elements: ["water", "dark"] },
  { id: "griffin", name: "ขนกริฟฟิน", elements: ["wind", "earth"] },
];
/** ชื่อคทาตามเนื้อไม้ × แกน */
export const WAND_NAMES: Record<string, [string, string, string]> = {
  oak: ["ซอลเวริน", "ธาลอร์ธ", "เอเรนวาร์"],
  willow: ["ลูมิเอล", "มารีเซล", "เซฟีนา"],
  yew: ["มอร์เวกซ์", "นิกธาร์", "ครอว์เวล"],
  ash: ["วาลอเรน", "ทอเรนดิล", "สกายเรียน"],
  elder: ["ซิลเวกซ์", "มิราซ", "เวสเปอริน"],
  birch: ["ไซลาเรีย", "ออรีเธล", "เซเลสติน"],
  cedar: ["ดราเวน", "ฮัลเดร็ด", "ออสเทอริน"],
  blackthorn: ["คาร์ซิส", "โนวาร์", "เฟรย์ธ"],
};
const ELEMENT_NAME: Record<Element, string> = { fire: "ไฟ", water: "น้ำ", earth: "ดิน", wind: "ลม", light: "แสง", dark: "ความมืด" };
export const PRICE = [0, 30, 60, 120, 240, 400];
export const WOOD_EDGE = 0.04, CORE_EDGE = 0.06;

const on = (l: Life) => l.worldId === "fantasy" && !!l.ft;
export const woodOf = (id?: string) => WOODS.find((w) => w.id === id);
export const coreOf = (id?: string) => CORES.find((c) => c.id === id);
export const wandName = (wood: string, core: string) => WAND_NAMES[wood]?.[CORES.findIndex((c) => c.id === core)] ?? "คทาไร้ชื่อ";

/** ไม้ที่เข้ากับนิสัยที่สุด (มีสุ่มนิดหน่อยเมื่อนิสัยยังไม่ชัด) */
export function bestWood(l: Life): Wood {
  const p = personaOf(l);
  return WOODS.map((w) => ({ w, s: p[w.axis] * w.sign + nextFloat(l) * 8 })).sort((a, b) => b.s - a.s)[0].w;
}
/** แกนที่เข้ากับธาตุ · ยังไม่รู้ธาตุก็สุ่ม */
export function bestCore(l: Life): Core {
  const e = fl(l).element;
  return CORES.find((c) => e && c.elements.includes(e)) ?? pick(l, CORES);
}
/** นิสัยชัดแค่ไหนตามไม้ที่เลือก (0-1) · ใช้เป็นความแน่นของคทา */
export const fitOf = (l: Life, w: Wood) => clamp((personaOf(l)[w.axis] * w.sign) / 60, 0, 1);
/** คุณภาพตามดาวเวท 1-4 · นิสัยที่ชัดมากเพิ่มอีกหนึ่ง · สูงสุด 5 */
/** คุณภาพสูงสุดที่คทาจะยอมให้ตามดาวเวท: 0-2 ดาว 2 · 3-5 ดาว 3 · 6-8 ดาว 4 · 9-10 ดาว 5 */
export const qualityCap = (l: Life) => clamp(2 + Math.floor(fl(l).potential / 3), 2, 5);
export const qualityFor = (l: Life, w: Wood) => clamp(1 + Math.floor(fl(l).potential / 3) + (fitOf(l, w) >= 0.8 ? 1 : 0), 1, qualityCap(l));
export const priceOf = (q: number) => PRICE[clamp(q, 1, 5)];

function giveWand(l: Life, wood: string, core: string, quality: number) {
  const w = woodOf(wood)!, c = coreOf(core)!;
  fl(l).wand = { name: wandName(wood, core), quality, material: `${w.name} แกน${c.name}`, wood, core };
}
const W = (c: Ctx) => woodOf(String(c.wood))!;
const K = (c: Ctx) => coreOf(String(c.core))!;
const label = (c: Ctx) => `${wandName(String(c.wood), String(c.core))} · ${W(c).name} แกน${K(c).name}`;

/** ฉากคทาเลือกคุณ: คทาสองเล่มที่ผิดพ่นประกาย แล้วเล่มที่ใช่อุ่นขึ้นในมือ */
function chooseText(l: Life, c: Ctx) {
  const wrong = WOODS.filter((w) => w.id !== c.wood);
  const a = wrong[Number(c.miss1) % wrong.length], b = wrong[Number(c.miss2) % wrong.length];
  const e = fl(l).element;
  const where = c.free ? "ครูเวทของโรงเรียนวางกล่องคทาเรียงหน้าคุณ" : "เจ้าของร้านคทาแก่ๆ มองคุณครู่หนึ่ง แล้วหยิบกล่องลงจากชั้นทีละกล่อง";
  return `${where} ${wandName(a.id, String(c.core))}พ่นประกายจนแจกันหน้าร้านแตก ${wandName(b.id, String(c.core))}นิ่งสนิทราวกับไม้ธรรมดา แล้ว${label(c)}ก็อุ่นขึ้นในมือคุณ มันรู้สึกถึง${W(c).trait}ของคุณ${e ? ` และ${ELEMENT_NAME[e]}ในเลือดคุณ` : ""} คทาเล่มนี้เลือกคุณแล้ว (คุณภาพ ${c.q})`;
}
const firstChoices: Choice[] = [
  C((_l, c) => (c.free ? "รับคทาจากโรงเรียน" : `จ่ายแล้วรับคทาที่เลือกคุณ (${priceOf(Number(c.q))} เหรียญทอง)`), (l, c) => {
    if (!c.free) addMoney(l, -priceOf(Number(c.q)) * GOLD);
    giveWand(l, String(c.wood), String(c.core), Number(c.q));
    return { text: `${wandName(String(c.wood), String(c.core))}อยู่ในมือคุณแล้ว ประกายเล็กๆ วิ่งไปตามนิ้วเหมือนทักทาย`, kind: "milestone" };
  }, { req: (l, c) => (!c.free && l.money < priceOf(Number(c.q)) * GOLD ? `ต้องมี ${priceOf(Number(c.q))} เหรียญทอง` : undefined) }),
  // ผ่อนได้ แต่ต้องวางมัดจำครึ่งหนึ่ง ที่เหลือเป็นหนี้พร้อมดอกเบี้ย
  C((_l, c) => `วางมัดจำครึ่งหนึ่ง ที่เหลือผ่อนกับร้าน (${Math.ceil(priceOf(Number(c.q)) / 2)} เหรียญทอง · หนี้อีก ${Math.ceil(priceOf(Number(c.q)) / 2) + 20})`, (l, c) => {
    addMoney(l, -Math.ceil(priceOf(Number(c.q)) / 2) * GOLD);
    giveWand(l, String(c.wood), String(c.core), Number(c.q));
    l.debt += (Math.ceil(priceOf(Number(c.q)) / 2) + 20) * GOLD;
    return { text: `เจ้าของร้านจดชื่อคุณลงสมุดหนี้ แล้วยื่น${wandName(String(c.wood), String(c.core))}ให้ "ที่เหลือจ่ายเมื่อมี ดอกเบี้ยยี่สิบเหรียญ"`, kind: "good" };
  }, { show: (_l, c) => !c.free, req: (l, c) => (l.money < Math.ceil(priceOf(Number(c.q)) / 2) * GOLD ? `ต้องมีมัดจำ ${Math.ceil(priceOf(Number(c.q)) / 2)} เหรียญทอง` : undefined) }),
  C("ขอลองเลือกเล่มอื่นด้วยตัวเอง", (l, c) => {
    const other = pick(l, WOODS.filter((w) => w.id !== c.wood));
    addStat(l, "health", -2);
    return { text: `คุณหยิบ${wandName(other.id, String(c.core))}ขึ้นมา มันพ่นประกายใส่มือคุณจนผิวไหม้ คทาที่เลือกคุณยังรออยู่ในกล่อง เผื่อคุณกลับมา` };
  }),
  C("เดินออกไปก่อน ยังไม่พร้อม", N("คทาที่อุ่นอยู่ในมือเย็นลงเมื่อคุณวางมันคืน มันจะรอคุณ")),
];

/** หาคทาที่ดีกว่า: คทาเล่มใหม่ต้องยอมรับคุณเหมือนกัน */
const seekOdds = (l: Life, c: Ctx) => 0.3 + fl(l).potential * 0.05 + fitOf(l, W(c)) * 0.25;
const seekChoices: Choice[] = [
  P((_l, c) => `ลองจับ${label(c)} (คุณภาพ ${c.q} · ${priceOf(Number(c.q))} เหรียญทอง)`, seekOdds, (l, c) => {
    addMoney(l, -priceOf(Number(c.q)) * GOLD);
    giveWand(l, String(c.wood), String(c.core), Number(c.q));
    return { text: `${wandName(String(c.wood), String(c.core))}อุ่นขึ้นในมือ มันยอมรับคุณ คทาเล่มเก่าถูกห่อผ้าเก็บไว้อย่างดี`, kind: "milestone" };
  }, () => ({ text: "คทาเล่มนั้นสั่นแล้วกระเด็นออกจากมือคุณ มันยังไม่ยอมรับคุณ เจ้าของร้านบอกให้ลองใหม่เมื่อคุณเติบโตกว่านี้", kind: "bad" }), { req: (l, c) => (l.money < priceOf(Number(c.q)) * GOLD ? `ต้องมี ${priceOf(Number(c.q))} เหรียญทอง` : undefined) }),
  C("ให้เจ้าของร้านอ่านว่าคุณเปลี่ยนไปแค่ไหน", (l) => { const w = bestWood(l); return { text: `เจ้าของร้านจับมือคุณนาน แล้วบอกว่าตอนนี้${w.trait}ของคุณเด่นที่สุด คทาที่เข้ากับคุณจึงเป็นไม้${w.name.replace("ไม้", "")}` }; }),
  C("เก็บคทาเล่มเดิมไว้", N("คุณลูบคทาเล่มเดิมแล้วเดินออกจากร้าน มันอุ่นขึ้นเล็กน้อยเหมือนขอบคุณ")),
];

const WAND_EVENTS: GameEvent[] = [
  SCENE("ft.wand.first", "คทาเลือกคุณ", chooseText, firstChoices),
  SCENE("ft.wand.seek", "หาคทาที่ดีกว่า", (_l, c) => `เจ้าของร้านหยิบกล่องที่เก่ากว่าทุกกล่องลงมา ${label(c)} คุณภาพ ${c.q} มันยังไม่เคยยอมใครมาหลายสิบปี`, seekChoices),
];

/** บริบทของคทาที่จะเลือกคุณ */
export function wandCtx(l: Life, free = false): Ctx {
  const w = bestWood(l), c = bestCore(l);
  const have = fl(l).wand?.quality ?? 0;
  const q = free ? Math.min(2, qualityFor(l, w)) : Math.min(qualityCap(l), Math.max(qualityFor(l, w), have + 1));
  return { wood: w.id, core: c.id, q, free, miss1: Math.floor(nextFloat(l) * 7), miss2: Math.floor(nextFloat(l) * 7) + 1 };
}

/** ไม้ช่วยทางที่ตรงกับนิสัยที่มันชอบ · แกนช่วยเวทธาตุของมัน (magic.ts ใช้ coreFits) */
export const coreFits = (l: Life, e: Element) => !!coreOf(fl(l).wand?.core)?.elements.includes(e);
function woodOdds(l: Life, c: Choice, _ctx: Ctx, p: number) {
  if (l.worldId !== "fantasy" || !l.ft || !c.lean) return p;
  const w = woodOf(fl(l).wand?.wood);
  return w && (c.lean[w.axis] ?? 0) * w.sign > 0 ? p + WOOD_EDGE : p;
}

let loaded = false;
export function loadWands() {
  if (loaded) return;
  loaded = true;
  registerEvents(WAND_EVENTS);
  oddsHooks.push(woodOdds);
  // ร้านคทาเดิมกลายเป็นที่ที่คทาเลือกคุณ
  const shop = ACTIVITIES.find((a) => a.id === "ft_wand");
  if (shop) Object.assign(shop, {
    name: "ไปร้านคทา", desc: "คทาเป็นฝ่ายเลือกคุณ ตามนิสัย ธาตุ และดาวเวท",
    available: (l: Life) => (fl(l).wand?.quality ?? 0) < qualityCap(l),
    run: (l: Life) => { runEvent(l, fl(l).wand ? "ft.wand.seek" : "ft.wand.first", wandCtx(l)); return { text: "" }; },
  });
  // นักเรียนได้คทาแรกจากโรงเรียน
  yearHooks.push((l) => {
    if (!on(l) || !l.alive || fl(l).wand || !fl(l).school || l.age < 11 || l.flags.ftSchoolWand) return;
    l.flags.ftSchoolWand = true;
    runEvent(l, "ft.wand.first", wandCtx(l, true));
  });
}
