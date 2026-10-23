// ราชโองการที่มีผลจริงและต่อเนื่อง (คำขอของผู้เล่น: ราชโองการควรมีมากกว่านี้)
// · ออกแล้วมีผลทุกปีจนกว่าจะยกเลิก (หรือหมดอายุ) · ขัดกันออกพร้อมกันไม่ได้ · มีพร้อมกันได้ไม่เกินหก
// · ฮ่องเต้ NPC ก็ออกราชโองการตามนิสัย — และราชโองการไปถึงชีวิตคนธรรมดา: ขึ้นทะเบียนผู้มีวิชา เกณฑ์ทหาร สอบจอหงวนบู๊ บุกบ่อน ปฏิรูปที่ดิน
// · โลกตอบสนอง: สำนักลุกฮือ อ๋องขัดคำสั่ง ตระกูลใหญ่ยื่นฎีกา ขันทีวางแผน ราษฎรสรรเสริญ
import type { Ctx, GameEvent } from "../../../engine/events";
import { yearHooks } from "../../../engine/game";
import { chance, pick, randInt } from "../../../engine/rng";
import type { Life } from "../../../engine/types";
import { clamp, log, people } from "../../../engine/util";
import { calYear } from "../life/world";
import { B, BIG, C, E, G, K, N, NEXT, P, PAY, ab, type Res } from "../story/kit";
import { courtOf, type Temper } from "./court";
import { factions, shiftRep } from "./factions";
import { castOf, palaceOf } from "./palace";
import { kingsOf } from "./regionKings";

export type EdictCat = "eco" | "soc" | "jh" | "state";
export const CAT_NAME: Record<EdictCat, string> = { eco: "เศรษฐกิจ", soc: "สังคมและราษฎร", jh: "ยุทธภพ", state: "แผ่นดินและราชสำนัก" };
export interface EdictDef {
  id: string;
  name: string;
  cat: EdictCat;
  /** ข้อความประกาศ */
  text: string;
  pros: string;
  cons: string;
  conflicts?: string[];
  /** อายุราชโองการ (ปี) ถ้าไม่ใส่ = จนกว่าจะยกเลิก */
  years?: number;
  /** ผลทันทีตอนออก */
  once?: (l: Life) => void;
  /** ผลทุกปีขณะมีผล */
  year: (l: Life) => void;
  /** ฮ่องเต้นิสัยไหนชอบออก */
  likes: Temper[];
}

const legit = (l: Life, d: number) => { if (l.mw) l.mw.legitimacy = clamp(l.mw.legitimacy + d, 0, 100); };
const unrest = (l: Life, d: number) => { if (l.mw) l.mw.unrest = clamp(l.mw.unrest + d, 0, 100); };
const food = (l: Life, d: number) => { if (l.mw) l.mw.food = clamp(l.mw.food + d, 0, 100); };
const cult = (l: Life, d: number) => { if (l.mw) l.mw.cult = clamp(l.mw.cult + d, 0, 100); };
const treasury = (l: Life, d: number) => { const p = palaceOf(l); p.treasury = clamp(p.treasury + d, 0, 100); };
const sects = (l: Life, f: (x: ReturnType<typeof factions>[number]) => void) => { for (const x of factions(l)) f(x); };

export const EDICTS: EdictDef[] = [
  // ───── เศรษฐกิจ ─────
  { id: "salt_iron", name: "ผูกขาดเกลือและเหล็ก", cat: "eco", text: "เกลือและเหล็กทั้งแผ่นดินเป็นของหลวง ผู้ลักลอบค้ามีโทษประหาร", pros: "ท้องพระคลังโตทุกปี", cons: "ราษฎรบ่น เกลือเถื่อนชุก", year: (l) => { treasury(l, 3); unrest(l, 1); }, likes: ["puppet", "tyrant"] },
  { id: "coin", name: "ปฏิรูปเงินตรา", cat: "eco", text: "หลอมเหรียญเก่าทั้งหมดเป็นเหรียญใหม่ตราราชวงศ์", pros: "ท้องพระคลังได้ก้อนใหญ่ทันที", cons: "ปีแรกราคาข้าวปั่นป่วน", years: 1, once: (l) => { treasury(l, 12); unrest(l, 6); }, year: () => {}, likes: ["wise"] },
  { id: "granary", name: "สร้างยุ้งฉางหลวงทุกอำเภอ", cat: "eco", text: "ทุกอำเภอต้องมียุ้งฉางเก็บข้าวสามปี เปิดแจกยามแล้ง", pros: "กันทุพภิกขภัย อาหารมั่นคงขึ้นทุกปี", cons: "ท้องพระคลังจ่ายทุกปี", year: (l) => { treasury(l, -2); food(l, 3); }, likes: ["wise"] },
  { id: "open_trade", name: "เปิดเส้นทางการค้าชายแดน", cat: "eco", text: "คาราวานต่างแดนเข้าออกได้เสรี เก็บภาษีที่ด่าน", pros: "ท้องพระคลังโต การค้าคึกคัก", cons: "ลัทธิแปลกๆ และสายลับเข้ามากับคาราวาน", conflicts: ["close_border"], year: (l) => { treasury(l, 3); cult(l, 1); }, likes: ["wise", "puppet"] },
  { id: "close_border", name: "ปิดด่านชายแดน", cat: "eco", text: "ห้ามคาราวานและคนต่างแดนเข้าแผ่นดิน", pros: "ชายแดนปลอดภัย ลัทธิมารเข้ายาก", cons: "การค้าซบเซา ท้องพระคลังลด", conflicts: ["open_trade"], year: (l) => { treasury(l, -1); cult(l, -1); }, likes: ["paranoid"] },
  { id: "heavy_tax", name: "เพิ่มภาษีที่นา", cat: "eco", text: "ภาษีที่นาเพิ่มสามส่วนเพื่อการใหญ่ของราชสำนัก", pros: "ท้องพระคลังโตมาก", cons: "ราษฎรเดือดร้อนหนัก ความชอบธรรมลด", conflicts: ["tax_cut"], year: (l) => { treasury(l, 5); unrest(l, 4); legit(l, -2); food(l, -2); }, likes: ["tyrant"] },
  { id: "tax_cut", name: "ลดภาษีที่นาครึ่งหนึ่ง", cat: "eco", text: "ภาษีที่นาลดลงครึ่งหนึ่ง ให้ราษฎรได้ลืมตาอ้าปาก", pros: "ราษฎรรัก ความชอบธรรมขึ้น", cons: "ท้องพระคลังผอมลงทุกปี", conflicts: ["heavy_tax"], years: 5, year: (l) => { treasury(l, -4); unrest(l, -3); legit(l, 2); }, likes: ["wise"] },
  // ───── สังคม ─────
  { id: "land_reform", name: "ปฏิรูปที่ดิน", cat: "soc", text: "ที่นาเกินร้อยหมู่ของตระกูลใหญ่ต้องแบ่งให้ชาวนาไร้ที่ดิน", pros: "ราษฎรมีที่ทำกิน ความไม่สงบลด", cons: "ตระกูลใหญ่และอ๋องแค้น", years: 6, year: (l) => { legit(l, 2); unrest(l, -2); if (l.mw?.era !== "war") for (const k of kingsOf(l)) k.loyalty = clamp(k.loyalty - 2, 0, 100); shiftRep(l, "families", -1); }, likes: ["wise"] },
  { id: "census", name: "สำรวจสำมะโนครัว", cat: "soc", text: "ทุกครัวเรือนต้องขึ้นทะเบียนคน ที่ดิน และสัตว์เลี้ยง", pros: "เก็บภาษีได้ครบ ท้องพระคลังโต", cons: "ราษฎรระแวง หนีทะเบียน", years: 3, year: (l) => { treasury(l, 2); unrest(l, 1); }, likes: ["paranoid", "wise"] },
  { id: "ban_vice", name: "ปิดบ่อนและหอนางโลม", cat: "soc", text: "บ่อนพนันและหอนางโลมทั่วแผ่นดินต้องปิด ผู้ฝ่าฝืนโบยร้อยที", pros: "บ้านเมืองเป็นระเบียบ", cons: "โจรกับขุนนางโกงกินได้ช่องรีดไถใหม่", year: (l) => { legit(l, 1); unrest(l, 1); }, likes: ["paranoid", "wise"] },
  { id: "resettle", name: "อพยพราษฎรไปบุกเบิกที่รกร้าง", cat: "soc", text: "ราษฎรเมืองแออัดต้องย้ายไปบุกเบิกนาริมชายแดน แลกกับยกเว้นภาษีห้าปี", pros: "นาใหม่ อาหารเพิ่ม", cons: "ครอบครัวพลัดถิ่น ความไม่สงบช่วงแรก", years: 5, year: (l) => { food(l, 2); unrest(l, 1); }, likes: ["tyrant", "wise"] },
  { id: "amnesty", name: "นิรโทษกรรมทั่วแผ่นดิน", cat: "soc", text: "นักโทษคดีเล็กทั่วแผ่นดินได้รับอิสรภาพ", pros: "ราษฎรยินดี ความไม่สงบลด", cons: "โจรเก่ากลับมาเดินถนน", years: 1, once: (l) => { unrest(l, -3); legit(l, 2); if (!l.flags.emperorSelf && Number(l.flags.jailUntil ?? -1) > l.age) { l.flags.jailUntil = l.age; log(l, "🔓 ประตูคุกเปิด — นิรโทษกรรมทั่วแผ่นดิน คุณได้รับอิสรภาพ", "good"); } }, year: () => {}, likes: ["wise", "puppet"] },
  // ───── ยุทธภพ ─────
  { id: "register_martial", name: "ขึ้นทะเบียนผู้มีวิชายุทธ์", cat: "jh", text: "ผู้มีวิชายุทธ์ทุกคนต้องขึ้นทะเบียนกับทางการ ผู้ไม่ขึ้นทะเบียนถือเป็นโจร", pros: "ราชสำนักรู้ว่าใครอยู่ที่ไหน ลัทธิมารซ่อนยาก", cons: "ยุทธภพไม่พอใจทั้งแผ่นดิน", year: (l) => { cult(l, -1); unrest(l, 1); sects(l, (x) => { x.rep = clamp(x.rep - 1, -100, 100); }); }, likes: ["paranoid"] },
  { id: "ban_sects", name: "ห้ามสำนักยุทธ์รับศิษย์", cat: "jh", text: "สำนักยุทธ์ห้ามรับศิษย์ใหม่ ผู้พกอาวุธในเมืองมีโทษถึงตาย", pros: "ยุทธภพอ่อนแอลง ไม่มีใครท้าทายบัลลังก์ได้", cons: "สำนักใหญ่แค้น อาจลุกฮือ", conflicts: ["summon_sects"], year: (l) => { unrest(l, 2); sects(l, (x) => { if (x.side === "orthodox") x.power = clamp(x.power - 2, 5, 100); x.rep = clamp(x.rep - 2, -100, 100); }); }, likes: ["tyrant", "paranoid"] },
  { id: "crush_cult", name: "กวาดล้างลัทธิมารสวรรค์", cat: "jh", text: "ทัพหลวงร่วมกับสำนักฝ่ายธรรมะกวาดล้างลัทธิมารทุกหุบเขา", pros: "ลัทธิมารอ่อนลงทุกปี", cons: "ท้องพระคลังจ่าย ลัทธิแก้แค้น", year: (l) => { cult(l, -5); treasury(l, -2); unrest(l, 1); const c = factions(l).find((x) => x.id === "cult"); if (c) c.power = clamp(c.power - 4, 5, 100); }, likes: ["tyrant", "wise"] },
  { id: "summon_sects", name: "เชิญเจ้าสำนักเข้ารับราชการ", cat: "jh", text: "เจ้าสำนักและยอดฝีมือทั่วแผ่นดินได้รับเชิญเป็นขุนนางที่ปรึกษาราชสำนัก", pros: "ยุทธภพภักดีต่อบัลลังก์", cons: "ขุนนางสายบุ๋นไม่พอใจ", conflicts: ["ban_sects"], year: (l) => { legit(l, 1); sects(l, (x) => { if (x.side !== "demonic") x.rep = clamp(x.rep + 2, -100, 100); }); }, likes: ["wise"] },
  { id: "wuju", name: "เปิดสอบจอหงวนบู๊", cat: "jh", text: "เปิดสอบยิงธนู ขี่ม้า และกลศึกทุกสามปี ผู้ชนะได้เป็นนายทหารหลวง", pros: "ได้นายทหารเก่งที่ภักดีต่อบัลลังก์ แม่ทัพเก่าอิทธิพลลด", cons: "ท้องพระคลังจ่ายเล็กน้อย", year: (l) => { treasury(l, -1); for (const n of castOf(l)) if (n.role === "general") n.inf = clamp(n.inf - 2, 5, 100); }, likes: ["wise", "tyrant"] },
  // ───── แผ่นดินและราชสำนัก ─────
  { id: "exam_reform", name: "ปฏิรูปการสอบขุนนาง", cat: "state", text: "ข้อสอบเปลี่ยนจากท่องตำราเป็นแก้ปัญหาบ้านเมือง ปิดชื่อผู้สอบ", pros: "ขุนนางเก่งขึ้น ความชอบธรรมขึ้น", cons: "ตระกูลขุนนางเก่าเสียประโยชน์", years: 6, year: (l) => { legit(l, 2); const m = castOf(l).filter((n) => n.role === "minister").sort((a, b) => b.inf - a.inf)[0]; if (m) m.you.grudge = clamp(m.you.grudge + 2, 0, 100); }, likes: ["wise"] },
  { id: "curb_eunuchs", name: "ลดอำนาจขันที", cat: "state", text: "ขันทีห้ามยุ่งราชการ ห้ามรับฎีกา ห้ามคุมทหาร", pros: "ขันทีอ่อนลงทุกปี", cons: "ขันทีแค้น อาจวางแผน", year: (l) => { for (const n of castOf(l)) if (n.role === "eunuch") { n.inf = clamp(n.inf - 5, 5, 100); n.you.grudge = clamp(n.you.grudge + 3, 0, 100); } }, likes: ["wise", "paranoid"] },
  { id: "great_wall", name: "ก่อกำแพงเมืองชายแดน", cat: "state", text: "เกณฑ์แรงงานก่อกำแพงยาวหมื่นลี้กันชนเผ่าทุ่งหญ้า", pros: "ชนเผ่าทุ่งหญ้าบุกไม่ได้", cons: "แรงงานล้มตาย ท้องพระคลังจ่ายหนัก", years: 8, year: (l) => { treasury(l, -4); unrest(l, 2); }, likes: ["tyrant", "paranoid"] },
  { id: "purge_corrupt", name: "กวาดล้างขุนนางโกงกิน", cat: "state", text: "ขุนนางตรวจการออกตรวจบัญชีทุกกรม ทรัพย์ที่โกงยึดเข้าหลวง", pros: "ท้องพระคลังโต ความชอบธรรมขึ้น", cons: "ขุนนางหวาดกลัว บางคนถูกใส่ร้าย", years: 3, year: (l) => { treasury(l, 3); legit(l, 2); const m = castOf(l).filter((n) => n.role === "minister" && n.amb >= 70)[0]; if (m && chance(l, 0.25)) m.out = true; }, likes: ["wise", "paranoid"] },
  { id: "draft", name: "เกณฑ์ทหาร", cat: "state", text: "ชายอายุสิบหกถึงสี่สิบห้า และผู้มีวิชายุทธ์ ต้องเข้ากองทัพชายแดน — ผู้หลบหนีถือเป็นกบฏ", pros: "กองทัพใหญ่ขึ้น อ๋องกล้าน้อยลง", cons: "ครอบครัวพลัดพราก ความไม่สงบขึ้น", years: 3, year: (l) => { unrest(l, 3); if (l.mw?.era !== "war") for (const k of kingsOf(l)) k.power = clamp(k.power - 1, 5, 100); }, likes: ["tyrant"] },
];
export const edictDef = (id: string) => EDICTS.find((e) => e.id === id);

// ───────── สถานะราชโองการ ─────────
export function activeEdicts(l: Life) {
  if (!l.mw?.court) return [];
  const c = courtOf(l);
  c.edicts ??= [];
  // ราชโองการแบบเก่า (ช่องเดียว) ย้ายเข้าระบบใหม่
  if (c.edict && !c.edicts.some((e) => e.id === c.edict)) c.edicts.push({ id: c.edict, since: calYear(l), until: calYear(l) + 3 });
  return c.edicts.filter((e) => edictDef(e.id));
}
export const edictOn = (l: Life, id: string) => activeEdicts(l).some((e) => e.id === id);
const blocked = (l: Life, d: EdictDef) => activeEdicts(l).some((e) => e.id === d.id || d.conflicts?.includes(e.id) || edictDef(e.id)?.conflicts?.includes(d.id));
export const MAX_EDICTS = 6;

export function issueEdict(l: Life, id: string, until?: number): string {
  const d = edictDef(id)!;
  const c = courtOf(l);
  activeEdicts(l);
  c.edicts!.push({ id, since: calYear(l), until: until ?? (d.years ? calYear(l) + d.years : undefined) });
  if (["ban_sects", "heavy_tax", "draft", "amnesty"].includes(id)) c.edict = id as typeof c.edict;
  d.once?.(l);
  l.flags.edictNew = id;
  return `📯 ราชโองการ: ${d.text}`;
}
export function repealEdict(l: Life, id: string) {
  const c = courtOf(l);
  c.edicts = (c.edicts ?? []).filter((e) => e.id !== id);
  if (c.edict === id) c.edict = undefined;
}

// ───────── ทุกปี: ผลของราชโองการ · หมดอายุ · ฮ่องเต้ NPC ออกราชโองการ ─────────
yearHooks.push((l) => {
  if (l.worldId !== "murim" || !l.alive || !l.mw || l.mw.era === "war") return;
  const c = courtOf(l);
  const yr = calYear(l);
  for (const e of activeEdicts(l)) {
    if (e.until !== undefined && e.until <= yr) {
      repealEdict(l, e.id);
      log(l, `📜 ราชโองการ "${edictDef(e.id)!.name}" ครบกำหนดแล้ว`, "normal");
      continue;
    }
    edictDef(e.id)!.year(l);
  }
  if (l.flags.emperorSelf) return;
  // ฮ่องเต้องค์อื่นออกราชโองการตามนิสัย
  if (activeEdicts(l).length < 4 && chance(l, 0.2)) {
    const pool = EDICTS.filter((d) => d.likes.includes(c.emperor.temper) && !blocked(l, d));
    if (pool.length) {
      const d = pick(l, pool);
      log(l, issueEdict(l, d.id, yr + (d.years ?? randInt(l, 3, 8))), ["heavy_tax", "ban_sects", "draft", "register_martial", "great_wall", "census"].includes(d.id) ? "bad" : "good");
    }
  }
});

// ───────── เมนูออกราชโองการของฮ่องเต้ (ผู้เล่น) ─────────
const issue = (d: EdictDef) => C(
  `${d.name}${d.years ? ` (${d.years} ปี)` : ""}`,
  ((l: Life, c: Ctx) => { const text = issueEdict(l, d.id); return BIG(`${text} — ทั้งแผ่นดินรับรู้ภายในเดือนเดียว`, {})(l, c); }) as Res,
  { show: (l) => !blocked(l, d) && activeEdicts(l).length < MAX_EDICTS, pros: d.pros, cons: d.cons },
);
const catScene = (cat: EdictCat) => ({
  // ขุนนางกราบทูลผลดีผลเสียของแต่ละฉบับ (ตัวเลือกแสดงแค่ชื่อ ตามแบบของเกม)
  text: (l: Life) => `ราชโองการด้าน${CAT_NAME[cat]} — ตอนนี้มีผลอยู่ ${activeEdicts(l).length}/${MAX_EDICTS} ฉบับ${activeEdicts(l).length >= MAX_EDICTS ? " (เต็มแล้ว ต้องยกเลิกบางฉบับก่อน)" : ""}\nขุนนางกราบทูล:\n${EDICTS.filter((d) => d.cat === cat).map((d) => `• ${d.name}: ${d.pros} — แต่${d.cons}${edictOn(l, d.id) ? " (มีผลอยู่แล้ว)" : blocked(l, d) ? " (ขัดกับฉบับที่มีผลอยู่)" : ""}`).join("\n")}`,
  choices: [...EDICTS.filter((d) => d.cat === cat).map(issue), C("ยังไม่ออกตอนนี้", N("คุณวางพู่กันลง — ราชเลขาธิการม้วนกระดาษเก็บ"))],
});
const repealAt = (i: number) => C(
  (l: Life) => { const e = activeEdicts(l)[i]; return e ? `ยกเลิก "${edictDef(e.id)!.name}" (ตั้งแต่ปี ${e.since})` : "—"; },
  ((l: Life, c: Ctx) => { const e = activeEdicts(l)[i]; const name = e ? edictDef(e.id)!.name : ""; if (e) repealEdict(l, e.id); return N(`ราชโองการ "${name}" ถูกยกเลิก — ป้ายประกาศถูกปลดลงทั่วแผ่นดิน`, {})(l, c); }) as Res,
  { show: (l) => !!activeEdicts(l)[i] },
);
const catPick = (cat: EdictCat) => C(`ด้าน${CAT_NAME[cat]}`, NEXT(cat, "ราชเลขาธิการคลี่กระดาษเหลืองรอพระราชโองการ"));

export const EDICT_MENU: GameEvent = E("ct.e_edict", [16, 100], (l) => {
  const a = activeEdicts(l);
  return `ราชเลขาธิการถวายพู่กันแดง — ราชโองการที่มีผลอยู่: ${a.length ? a.map((e) => edictDef(e.id)!.name).join(" · ") : "ไม่มี"} · ความชอบธรรม ${l.mw?.legitimacy ?? 50} · ความไม่สงบ ${l.mw?.unrest ?? 30} · ท้องพระคลัง ${palaceOf(l).treasury}`;
}, [
  catPick("eco"), catPick("soc"), catPick("jh"), catPick("state"),
  C("ยกเลิกราชโองการ", NEXT("repeal", "ราชเลขาธิการกางทะเบียนราชโองการที่มีผลอยู่"), { show: (l) => activeEdicts(l).length > 0 }),
  C("ไม่ออกราชโองการปีนี้", N("ท้องพระโรงเงียบ — บางครั้งการไม่ทำอะไรก็เป็นราชโองการแบบหนึ่ง")),
], {
  when: (l) => !!l.flags.emperorSelf,
  weight: 0,
  maxTimes: 0,
  title: "ราชโองการ",
  scenes: {
    eco: catScene("eco"), soc: catScene("soc"), jh: catScene("jh"), state: catScene("state"),
    repeal: { text: () => "ราชโองการฉบับไหนจะถูกยกเลิก", choices: [0, 1, 2, 3, 4, 5].map(repealAt).concat([C("ไม่ยกเลิก", N("ทุกฉบับยังมีผลต่อไป"))]) },
  },
});

// ───────── ผลต่อชีวิตคนธรรมดา (ราชโองการของฮ่องเต้องค์อื่น) ─────────
const subj = (id: string) => (l: Life) => !l.flags.emperorSelf && l.mw?.era !== "war" && edictOn(l, id);
const hasGuild = (l: Life) => !!l.power?.guild;
const son = (l: Life) => people(l, "child").find((p) => p.alive && p.gender === "m" && p.age >= 16 && p.age <= 40);

export const EDICT_EVENTS: GameEvent[] = [
  EDICT_MENU,
  E("ed.register", [16, 90], "ขุนนางท้องถิ่นพร้อมทหารยี่สิบนายมาถึงหน้าบ้าน — ราชโองการให้ผู้มีวิชายุทธ์ทุกคนขึ้นทะเบียน กดลายนิ้วมือ บอกสำนัก วิชา และอาวุธที่ใช้", [
    C("ขึ้นทะเบียนตามสั่ง", N("ชื่อคุณอยู่ในสมุดทะเบียนของทางการแล้ว — ต่อไปนี้ไปที่ไหน ทางการก็รู้", { fame: -1 })),
    K("แสร้งเป็นชาวนาธรรมดา ซ่อนกระบี่ใต้ฟาง", "smarts", 55, G("ขุนนางมองมือที่เต็มไปด้วยด้านของคุณแล้วเดินผ่านไป — ไม่มีชื่อคุณในทะเบียน", { iq: 1 }), B("ทหารเอาหอกเขี่ยกองฟางเจอกระบี่ — คุณถูกปรับ และถูกบันทึกว่า \"ผู้มีวิชาที่ปิดบัง\"", { tael: -5, fame: -2 })),
    PAY("ยัดเงินให้ขุนนางจดว่าเป็นแค่คนขายยา", 3, N("ในทะเบียนคุณคือคนขายยาสมุนไพร — ขุนนางมีเงินซื้อสุราไปอีกเดือน", {})),
  ], { when: (l) => subj("register_martial")(l) && !!l.power, weight: 12, maxTimes: 1, title: "ทะเบียนผู้มีวิชา" }),
  E("ed.draft", [16, 45], (l) => `หมายเกณฑ์ทหารปิดที่ประตูบ้าน — ${l.gender === "m" || l.power ? "ชื่อคุณอยู่ในรายชื่อ" : "ลูกชายของคุณอยู่ในรายชื่อ"} ทัพจะออกเดินทางไปชายแดนในอีกเจ็ดวัน`, [
    P("ไปตามหมายเกณฑ์", ab(0.6, "health"), G("สามปีที่ชายแดน — คุณกลับมาพร้อมแผลเป็น เงินเบี้ยหวัด และเรื่องเล่าที่ไม่อยากเล่า", { tael: 10, exp: 300, hp: -5 }), B("ฤดูหนาวที่ชายแดนกินคนมากกว่าข้าศึก — คุณกลับมาพร้อมไอเรื้อรัง", { hp: -15, tael: 4 }), { tone: "danger", survival: () => 0.97 }),
    K("หนีเข้าเขาจนกว่าทัพจะออก", "smarts", 55, N("คุณกลับมาหลังทัพออกไปสามวัน — ชื่อคุณถูกขีดว่า \"หลบหนี\" แต่ไม่มีใครมาตาม", { joy: -2 }), B("ทหารตามรอยเท้าขึ้นเขา — คุณถูกโบยยี่สิบทีแล้วถูกลากไปอยู่ดี", { hp: -12 })),
    PAY("จ่ายค่าไถ่ตัว", 8, N("นายกองรับเงินแล้วขีดชื่อออก — คนจนในหมู่บ้านไปแทน", { align: -1 })),
  ], { when: (l) => subj("draft")(l) && (l.gender === "m" || !!l.power || !!son(l)), weight: 12, maxTimes: 1, title: "หมายเกณฑ์" }),
  E("ed.wuju", [17, 40], "ป้ายประกาศหน้าที่ว่าการ: เปิดสอบจอหงวนบู๊ — ยิงธนูบนหลังม้า ยกหินพันชั่ง และตอบกลศึก ผู้ได้ที่หนึ่งเป็นนายทหารหลวงทันที", [
    P("ลงสอบ", (l) => clamp(0.2 + (l.power?.rank ?? 0) * 0.1 + (l.stats.health - 50) / 200 + (l.stats.smarts - 50) / 300, 0.05, 0.9), BIG("ลูกธนูสามดอกปักกลางเป้าบนหลังม้าที่วิ่งเต็มฝีเท้า — คุณได้ที่หนึ่ง ได้ชุดเกราะพระราชทานและตำแหน่งนายทหารหลวง", { fame: 8, tael: 40, flag: "wujuChampion" }), N("คุณผ่านรอบแรก แต่ตกรอบกลศึก — ยังได้ชื่อว่าเข้ารอบสอบจอหงวนบู๊", { fame: 2, exp: 150 })),
    C("ไปดูเฉยๆ", N("คนที่ได้ที่หนึ่งปีนี้อายุน้อยกว่าคุณห้าปี", { joy: -1 })),
  ], { when: (l) => subj("wuju")(l) && !l.flags.wujuChampion, weight: 12, maxTimes: 2, title: "สอบจอหงวนบู๊" }),
  E("ed.vice_raid", [16, 80], "คุณกำลังนั่งอยู่ในบ่อนหลังตลาดตอนที่ทหารพังประตูเข้ามา — ราชโองการปิดบ่อนมีผลมาสามเดือนแล้ว ทุกคนในห้องจะถูกโบยร้อยที", [
    K("กระโดดหน้าต่างหนี", "health", 50, G("คุณวิ่งข้ามหลังคาสามหลังจนพ้น — ปีนั้นคุณไม่กล้าเข้าบ่อนอีก", {}), B("คุณตกหลังคาลงมาตรงหน้าทหาร — โบยร้อยทีกลางตลาด", { hp: -15, fame: -2 })),
    PAY("จ่ายค่าปิดปากให้นายกอง", 4, N("นายกองนับเงินแล้วชี้ประตูหลัง — บ่อนนี้เปิดต่อได้เพราะคนอย่างคุณ", { align: -1 })),
  ], { when: (l) => subj("ban_vice")(l), weight: 12, maxTimes: 1, title: "บุกบ่อน" }),
  E("ed.land", [20, 90], (l) => l.wealth === "rich" || l.wealth === "elite" ? "ขุนนางปฏิรูปที่ดินมาวัดเขตนาของตระกูลคุณ — นาเกินร้อยหมู่ต้องแบ่งให้ชาวนาไร้ที่ดินตามราชโองการ" : "ขุนนางปฏิรูปที่ดินอ่านรายชื่อชาวนาที่จะได้รับที่นาจากตระกูลใหญ่ — ชื่อของครอบครัวคุณอยู่ในรายชื่อ", [
    C((l) => (l.wealth === "rich" || l.wealth === "elite" ? "ยอมแบ่งตามกฎหมาย" : "รับที่นา"), ((l: Life, c: Ctx) => (l.wealth === "rich" || l.wealth === "elite" ? N("นาครึ่งหนึ่งของตระกูลกลายเป็นของคนอื่น — แต่ชาวนาที่ได้ไปกราบหน้าบ้านคุณทุกปีใหม่", { tael: -15, align: 3 }) : G("ที่นาสิบหมู่เป็นของครอบครัวคุณเป็นครั้งแรกในรอบสามชั่วคน — พ่อของคุณร้องไห้กลางนา", { tael: 8, joy: 8 }))(l, c)) as Res),
    K((l) => (l.wealth === "rich" || l.wealth === "elite" ? "ติดสินบนให้วัดเขตผิด" : "ขอนาแปลงที่ดีกว่าที่ได้"), "smarts", 55, G("ขุนนางวัดเขตใหม่ตามที่คุณต้องการ — เขาได้ ส่วนต่างคุณก็ได้", { tael: 5, align: -2 }), B("ขุนนางตรวจการจับได้ — ที่นาที่ควรได้ถูกยึดคืนเป็นของหลวง", { tael: -6 })),
  ], { when: subj("land_reform"), weight: 12, maxTimes: 1, title: "ปฏิรูปที่ดินมาถึงหมู่บ้าน" }),
  E("ed.cult_purge", [16, 90], "ทหารหลวงกับศิษย์สำนักฝ่ายธรรมะค้นบ้านทุกหลังหาสาวกลัทธิมาร — เพื่อนบ้านของคุณถูกลากออกมา แม่ของเขาร้องว่าลูกแค่เคยไปฟังเทศน์ครั้งเดียว", [
    K("ขึ้นเป็นพยานว่าเพื่อนบ้านไม่ใช่สาวก", "smarts", 55, G("ทหารปล่อยตัวเขา — แม่ของเขาเอาไก่มาให้คุณทุกตรุษจีน", { align: 3 }), B("คำของคุณไม่มีน้ำหนัก — แถมชื่อคุณถูกจดว่า \"คนปกป้องสาวกลัทธิ\"", { fame: -2, align: 1 })),
    C("อยู่เงียบๆ", N("เพื่อนบ้านไม่ได้กลับมา", { align: -1 })),
    C("ชี้บ้านที่น่าสงสัยให้ทหาร รับรางวัล", B("สามบ้าน สามครอบครัว สิบตำลึง — บางบ้านอาจเป็นสาวกจริง บางบ้านอาจไม่ใช่", { tael: 10, align: -4 })),
  ], { when: subj("crush_cult"), weight: 12, maxTimes: 1, title: "ค้นบ้านหาลัทธิมาร" }),
  E("ed.sect_banned", [14, 90], "ทหารหลวงปิดประตูใหญ่ของสำนักด้วยแผ่นตราประทับ — ราชโองการห้ามสำนักยุทธ์รับศิษย์ และห้ามรวมตัวเกินสิบคน เจ้าสำนักเรียกศิษย์ทุกคนประชุมลับกลางดึก", [
    C("ฝึกต่ออย่างลับๆ ในถ้ำหลังเขา", N("ศิษย์สามสิบคนฝึกใต้แสงคบไฟในถ้ำ — สำนักยังอยู่ แค่หายใจเบาลง", { exp: 150 })),
    P("ไปยื่นฎีกาที่ว่าการหัวเมืองพร้อมเจ้าสำนัก", ab(0.35, "smarts"), G("ขุนนางหัวเมืองยอมผ่อนผันให้สำนักคุณสอนศิษย์เก่าได้ — ไม่ใช่ชัยชนะ แต่ก็ไม่ใช่ความพ่ายแพ้", { fame: 3 }), B("ขุนนางสั่งโบยคนยื่นฎีกา — คุณกลับสำนักด้วยหลังที่เปิดเป็นแผล", { hp: -10 })),
    C("ออกจากสำนัก ใช้ชีวิตแบบคนธรรมดาไปก่อน", N("คุณแขวนกระบี่ไว้ข้างฝา — มันจะรอวันที่ราชโองการเปลี่ยน", { joy: -4 })),
  ], { when: (l) => subj("ban_sects")(l) && hasGuild(l), weight: 12, maxTimes: 1, title: "ตราประทับบนประตูสำนัก" }),
  E("ed.summoned", [25, 90], "ราชทูตถือราชโองการมาถึงสำนัก — เชิญยอดฝีมือผู้มีชื่อเสียงเข้าเมืองหลวงเป็นที่ปรึกษาราชสำนักด้านยุทธภพ มีเบี้ยหวัด มีจวน มีหน้าตา", [
    C("รับราชโองการ เข้าเมืองหลวง", G("คุณได้จวนในเมืองหลวงกับป้ายผ่านประตูวัง — ยุทธภพครึ่งหนึ่งอิจฉา อีกครึ่งหนึ่งเรียกคุณว่าสุนัขของราชสำนัก", { fame: 4, tael: 30, flag: "palaceAccess" })),
    C("ปฏิเสธ — ยุทธภพไม่ใช่ของราชสำนัก", N("ราชทูตกลับไปพร้อมสีหน้าไม่พอใจ — แต่คนในยุทธภพยกจอกให้คุณทุกโรงเตี๊ยม", { fame: 2 })),
  ], { when: (l) => subj("summon_sects")(l) && l.fame >= 35 && !!l.power, weight: 12, maxTimes: 1, title: "ราชทูตเชิญเข้าวัง" }),
  E("ed.corvee", [16, 55], "นายกองเกณฑ์แรงงานมาถึงหมู่บ้าน — ราชโองการก่อกำแพงชายแดนต้องการคนหมู่บ้านละสามสิบคน ไปแล้วกลับมาครึ่งเดียว", [
    P("ไปแบกหินที่กำแพง", ab(0.6, "health"), N("หนึ่งปีบนสันเขาที่หนาวที่สุดในชีวิต — คุณกลับมา คนข้างเตียงคุณไม่ได้กลับมา", { hp: -8, joy: -4, basics: 1 }), B("หินก้อนหนึ่งร่วงทับเท้า — คุณกลับบ้านด้วยไม้เท้า", { hp: -15, wound: ["legR", "broken", 2] }), { tone: "danger", survival: () => 0.95 }),
    PAY("จ้างคนไปแทน", 6, N("ชายยากจนจากหมู่บ้านข้างๆ ไปแทนคุณ — คุณไม่รู้ว่าเขากลับมาหรือเปล่า", { align: -1 })),
  ], { when: subj("great_wall"), weight: 12, maxTimes: 1, title: "เกณฑ์แรงงานก่อกำแพง" }),
  E("ed.salt_price", [16, 80], "ราชโองการผูกขาดเกลือทำให้เกลือหลวงแพงขึ้นสามเท่า — แม่ค้าในตลาดเริ่มขายผักดองที่ไม่เค็ม และคนลักลอบขนเกลือเถื่อนเดินกันขวักไขว่", [
    PAY("ซื้อเกลือหลวงตามราคา", 2, N("เกลือหนึ่งถุงแพงเท่าข้าวหนึ่งกระสอบ — คุณเริ่มเข้าใจว่าทำไมคนถึงยอมเสี่ยงหัว", {})),
    C("ซื้อเกลือเถื่อนครึ่งราคา", N("เกลือเถื่อนเค็มเหมือนกัน — แค่ถ้าถูกจับ คุณก็ผิดเหมือนกัน", { align: -1, tael: 1 })),
  ], { when: subj("salt_iron"), weight: 12, maxTimes: 1, title: "เกลือแพง" }),

  E("ed.heavy_tax", [18, 85], "คนเก็บภาษีหลวงมาพร้อมตาชั่งใหม่ — ราชโองการเพิ่มภาษีที่นาสามส่วน ครอบครัวไหนจ่ายไม่ได้ต้องจ่ายเป็นแรงงานหรือลูกสาว", [
    PAY("จ่ายครบ", 4, N("ยุ้งข้าวว่างเหลือครึ่ง — ปีนี้ทั้งบ้านกินข้าวต้มผสมรำ", { joy: -3 })),
    K("ซ่อนข้าวไว้ในโพรงใต้ศาลเจ้า", "smarts", 55, G("ทหารค้นทั้งหมู่บ้านไม่เจอ — ข้าวในโพรงเลี้ยงสามครอบครัวผ่านหน้าหนาว", { align: 2 }), B("คนในหมู่บ้านเองชี้โพรงให้ทหาร แลกกับลดภาษีของตัวเอง", { tael: -6, joy: -5 })),
    C("หนีเข้าป่าทั้งครอบครัว", N("นาร้างทั้งแปลง — แต่ไม่มีใครต้องถูกขายไปใช้หนี้", { joy: -4, tael: -2 })),
  ], { when: subj("heavy_tax"), weight: 12, maxTimes: 1, title: "ภาษีสามส่วน" }),
  E("ed.tax_cut", [18, 90], "ราชโองการลดภาษีที่นาครึ่งหนึ่งมาถึงอำเภอ — เป็นครั้งแรกในรอบสิบปีที่ยุ้งข้าวของครอบครัวคุณเต็มหลังจ่ายภาษี", [
    C("เก็บข้าวที่เหลือไว้ขาย ซื้อนาเพิ่ม", G("นาเพิ่มอีกห้าหมู่ — ลูกหลานจะจำได้ว่ามีรัชกาลหนึ่งที่ชาวนาได้ลืมตาอ้าปาก", { tael: 6 })),
    C("จัดงานเลี้ยงทั้งหมู่บ้าน", G("ทั้งหมู่บ้านดื่มฉลองสามวัน — มีคนแต่งเพลงสรรเสริญฮ่องเต้ร้องกันในนา", { joy: 6 })),
  ], { when: subj("tax_cut"), weight: 12, maxTimes: 1, title: "ยุ้งข้าวเต็ม" }),
  E("ed.census", [20, 85], (l) => `ขุนนางสำรวจสำมะโนครัวนั่งโต๊ะหน้าบ้าน — นับคน นับนา นับวัว ${son(l) ? `และจดชื่อลูกชายของคุณลงรายชื่อชายฉกรรจ์ที่จะถูกเกณฑ์ในอนาคต` : "และจดทุกอย่างที่ครอบครัวคุณมี"}`, [
    C("บอกตามจริงทุกอย่าง", N("ทะเบียนครบ — ภาษีปีหน้าคิดจากตัวเลขนี้ทุกเม็ด", { tael: -2, align: 1 })),
    K("แจ้งจำนวนคนและนาต่ำกว่าจริง", "smarts", 55, G("ขุนนางจดตามที่คุณบอก — ครอบครัวคุณจ่ายภาษีน้อยลงไปอีกหลายปี", { tael: 4, align: -1 }), B("เพื่อนบ้านเห็นคุณซ่อนวัวไว้หลังเขา — ถูกปรับสองเท่า", { tael: -8 })),
    PAY("ยัดเงินให้ขีดชื่อลูกชายออกจากทะเบียน", 3, N("ในทะเบียนหลวง บ้านนี้ไม่มีลูกชาย — ถ้าวันหนึ่งมีหมายเกณฑ์ ลูกคุณจะปลอดภัย", { align: -1 }), { show: (l) => !!son(l) }),
  ], { when: subj("census"), weight: 12, maxTimes: 1, title: "สำมะโนครัว" }),
  E("ed.granary", [14, 90], "ฝนไม่ตกทั้งปี แต่ปีนี้ต่างจากเดิม — ยุ้งฉางหลวงที่สร้างตามราชโองการเปิดแจกข้าวคนละสามถัง แถวยาวจากที่ว่าการถึงประตูเมือง", [
    C("เข้าแถวรับข้าว", G("ข้าวสามถังเลี้ยงครอบครัวผ่านหน้าแล้งได้ — ปีนี้ไม่มีใครในหมู่บ้านต้องขายลูก", { joy: 4 })),
    C("ยกส่วนของตัวเองให้หญิงม่ายข้างบ้าน", G("หญิงม่ายกราบคุณกลางแถว — ลูกสามคนของนางรอดหน้าแล้ง", { align: 4, joy: 2 })),
    K("ตามดูว่าข้าวหลวงถูกยักยอกไปไหน", "smarts", 60, G("คุณเห็นเกวียนข้าวหลวงเข้าโกดังคหบดีกลางดึก — เรื่องถึงหูขุนนางตรวจการ คหบดีถูกยึดทรัพย์", { fame: 3, align: 2 }), B("คนเฝ้าโกดังจับคุณได้ — ซ้อมแล้วโยนทิ้งไว้ริมคลอง", { hp: -10 })),
  ], { when: (l) => subj("granary")(l) && (l.mw?.food ?? 50) < 60, weight: 12, maxTimes: 1, title: "ยุ้งฉางหลวงเปิด" }),
  E("ed.caravan", [18, 75], "ราชโองการเปิดด่านชายแดน — คาราวานจากแดนตะวันตกขนพรม กำยาน และกระจกเงามาเต็มตลาด พ่อค้าผมแดงคนหนึ่งชวนคุณร่วมหุ้นค้าขาย", [
    P("ร่วมหุ้นสิบตำลึง", ab(0.55, "smarts"), G("พรมแดนตะวันตกขายหมดในสามเดือน — กำไรสองเท่า และคุณได้เพื่อนต่างแดนหนึ่งคน", { tael: 12, meet: { rel: "friend", bond: 40, gender: "m" } }), B("พ่อค้าผมแดงหายไปพร้อมเงินหุ้นในคืนที่คาราวานออกเดินทาง", { tael: -10 }), { req: (l) => (l.money < 10_000 ? "ต้องมีเงิน 10 ตำลึง" : undefined) }),
    C("ซื้อกระจกเงาหนึ่งบานไปฝากแม่", G("แม่ส่องกระจกที่ชัดกว่าบ่อน้ำเป็นครั้งแรกในชีวิต — แล้วหัวเราะกับริ้วรอยของตัวเอง", { tael: -1, joy: 4 })),
    C("เดินดูเฉยๆ", N("โลกกว้างกว่าที่คิด — และส่งกลิ่นกำยานมาถึงตลาดหมู่บ้านคุณ", { iq: 1 })),
  ], { when: subj("open_trade"), weight: 12, maxTimes: 1, title: "คาราวานแดนไกล" }),
  E("ed.inspector", [20, 85], "ขุนนางตรวจการจากเมืองหลวงมาตั้งโต๊ะรับเรื่องร้องเรียนหน้าที่ว่าการ — ตามราชโองการกวาดล้างขุนนางโกงกิน ใครรู้เห็นการทุจริตให้มาแจ้ง นายอำเภอยืนมองอยู่ข้างหลังด้วยสายตาเย็นชา", [
    P("แจ้งเรื่องนายอำเภอโกงภาษี", ab(0.45, "smarts"), G("นายอำเภอถูกถอดหมวกกลางตลาด — ชาวบ้านจุดประทัดทั้งคืน และจำชื่อคุณได้", { fame: 4, align: 3 }), B("ขุนนางตรวจการกลับเมืองหลวงไปแล้ว นายอำเภอยังอยู่ — และรู้ว่าใครเป็นคนแจ้ง", { tael: -6, joy: -4 }), { tone: "danger" }),
    C("อยู่เงียบๆ", N("โต๊ะรับเรื่องว่างตลอดสามวัน — ขุนนางตรวจการเขียนรายงานว่าอำเภอนี้ใสสะอาด", {})),
  ], { when: subj("purge_corrupt"), weight: 12, maxTimes: 1, title: "โต๊ะรับเรื่องร้องเรียน" }),
  E("ed.resettle", [18, 70], "ชื่อครอบครัวคุณอยู่ในรายชื่ออพยพตามราชโองการบุกเบิกที่รกร้าง — ต้องย้ายไปชายแดนตะวันตกภายในสามเดือน แลกกับนาห้าสิบหมู่และยกเว้นภาษีห้าปี", [
    C("ย้ายไปบุกเบิกชายแดน", ((l: Life, c: Ctx) => { l.flags.region = "west"; return G("ปีแรกที่ชายแดนหนาวจนนิ้วแตก — ปีที่สาม นาห้าสิบหมู่ของคุณเขียวทั้งแปลง (ย้ายไปชายแดนตะวันตก)", { tael: 8, hp: -4 })(l, c); }) as Res),
    PAY("จ่ายเงินขอยกเว้น", 5, N("ขุนนางขีดชื่อออก — ครอบครัวยากจนอีกบ้านต้องไปแทน", { align: -1 })),
    K("ยื่นฎีกาว่าพ่อแม่แก่เกินเดินทาง", "looks", 50, G("ขุนนางใจอ่อน ยกเว้นให้ครอบครัวคุณ", {}), B("ฎีกาถูกปัดตก — คุณต้องเลือกระหว่างย้ายหรือจ่าย", { joy: -3 })),
  ], { when: (l) => subj("resettle")(l) && l.flags.region !== "west", weight: 12, maxTimes: 1, title: "รายชื่ออพยพ" }),

  // ───── โลกตอบสนองต่อราชโองการของฮ่องเต้ (ผู้เล่น) ─────
  E("ed.r_sect_rising", [18, 100], "เจ้าสำนักใหญ่สามสำนักออกประกาศร่วม: ราชโองการของคุณคือการฆ่ายุทธภพทั้งแผ่นดิน — ยอดฝีมือหลายร้อยคนรวมตัวที่ภูเขาหัวซาน", [
    P("ส่งทัพหลวงไปสลายการชุมนุม", (l) => clamp(0.3 + (l.mw?.legitimacy ?? 50) / 200 + (l.stats.smarts - 50) / 250, 0.1, 0.85), ((l: Life, c: Ctx) => { sects(l, (x) => { if (x.side === "orthodox") x.power = clamp(x.power - 6, 5, 100); }); legit(l, 2); return BIG("ทัพหลวงล้อมหัวซานสามเดือน — ยอดฝีมือทยอยลงเขาทีละคน ยุทธภพรู้แล้วว่าดาบของบัลลังก์ยาวกว่า", { fame: 3 })(l, c); }) as Res, ((l: Life, c: Ctx) => { unrest(l, 12); legit(l, -8); return B("ทัพหลวงถูกตีแตกในหุบเขา — ยอดฝีมือกลุ่มหนึ่งลอบเข้าเมืองหลวงและฆ่าขุนนางที่เสนอราชโองการนั้น", {})(l, c); }) as Res, { tone: "danger" }),
    C("ยกเลิกราชโองการ ประกาศอภัยโทษ", ((l: Life, c: Ctx) => { repealEdict(l, "ban_sects"); repealEdict(l, "register_martial"); legit(l, -2); sects(l, (x) => { x.rep = clamp(x.rep + 5, -100, 100); }); return N("การชุมนุมสลายไปเอง — ยุทธภพฉลอง ขุนนางกระซิบว่าฮ่องเต้แพ้คนพกดาบ", {})(l, c); }) as Res),
    K("เชิญเจ้าสำนักทั้งสามมาเจรจาในวัง", "looks", 55, ((l: Life, c: Ctx) => { sects(l, (x) => { x.rep = clamp(x.rep + 3, -100, 100); }); return G("สามวันในวัง — ได้ข้อตกลงว่าสำนักใหญ่รับศิษย์ได้ แต่ต้องขึ้นทะเบียน ทุกฝ่ายพอใจครึ่งเดียว", {})(l, c); }) as Res, ((l: Life, c: Ctx) => { unrest(l, 6); return B("เจ้าสำนักทั้งสามไม่มา — ส่งกระบี่หักมาแทนคำตอบ", {})(l, c); }) as Res),
  ], { when: (l) => !!l.flags.emperorSelf && (edictOn(l, "ban_sects") || edictOn(l, "register_martial")) && factions(l).some((x) => x.side === "orthodox" && x.rep < -10), weight: 5, maxTimes: 2, title: "ยุทธภพลุกฮือ" }),
  E("ed.r_clans", [18, 100], "ประมุขตระกูลใหญ่ห้าตระกูลคุกเข่าหน้าท้องพระโรงพร้อมฎีกาเขียนด้วยเลือด — ปฏิรูปที่ดินคือการปล้นบรรพบุรุษของพวกเขา ถ้าไม่ยกเลิก ตระกูลเหล่านี้จะไม่ส่งลูกหลานมารับราชการอีก", [
    C("ยืนยันราชโองการ", ((l: Life, c: Ctx) => { legit(l, 2); for (const n of castOf(l)) if (n.role === "minister") n.you.grudge = clamp(n.you.grudge + 8, 0, 100); return N("ตระกูลใหญ่กลับบ้านมือเปล่า — ชาวนาทั่วแผ่นดินจุดธูปบูชาพระนามคุณ ขุนนางในราชสำนักเริ่มขัดทุกเรื่อง", {})(l, c); }) as Res),
    C("ผ่อนปรน ให้ตระกูลใหญ่เก็บนาได้สองร้อยหมู่", ((l: Life, c: Ctx) => { legit(l, -1); return G("ทุกฝ่ายพอใจครึ่งหนึ่ง — ซึ่งในราชสำนักถือว่าชนะ", {})(l, c); }) as Res),
    C("ยกเลิกปฏิรูปที่ดิน", ((l: Life, c: Ctx) => { repealEdict(l, "land_reform"); unrest(l, 6); return B("ตระกูลใหญ่โค้งขอบพระทัย — ชาวนาที่เพิ่งได้ที่ดินถูกไล่ออกจากนาในฤดูเดียว", { align: -3 })(l, c); }) as Res),
  ], { when: (l) => !!l.flags.emperorSelf && edictOn(l, "land_reform"), weight: 5, maxTimes: 1, title: "ฎีกาเลือดของตระกูลใหญ่" }),
  E("ed.r_eunuch_plot", [18, 100], (l) => `${castOf(l).filter((n) => n.role === "eunuch").sort((a, b) => b.you.grudge - a.you.grudge)[0]?.name ?? "ขันทีหัวหน้า"}ไม่พอใจราชโองการลดอำนาจขันทีมานาน — คืนนี้นางกำนัลคนหนึ่งแอบมาบอกว่าน้ำแกงมื้อเย็นของคุณมีกลิ่นแปลก`, [
    K("ให้ขันทีคนนั้นชิมน้ำแกงก่อนต่อหน้าคุณ", "smarts", 50, ((l: Life, c: Ctx) => { const e = castOf(l).filter((n) => n.role === "eunuch").sort((a, b) => b.you.grudge - a.you.grudge)[0]; if (e) e.alive = false; return BIG("มือของขันทีสั่นจนช้อนตก — เขาคุกเข่าสารภาพก่อนจะชิม แผนวางยาถูกเปิดโปงทั้งเครือข่าย", { fame: 2 })(l, c); }) as Res, B("ขันทีชิมน้ำแกงโดยไม่กะพริบตา — ไม่มีพิษ คุณกลายเป็นฮ่องเต้ที่ระแวงคนรับใช้", { joy: -3 })),
    C("เททิ้ง แล้วยกเลิกราชโองการลดอำนาจขันที", ((l: Life, c: Ctx) => { repealEdict(l, "curb_eunuchs"); return N("ขันทีกลับมายิ้มแย้มอีกครั้ง — คุณรอดคืนนี้ แต่รู้แล้วว่าใครคุมวังนี้จริงๆ", { joy: -4 })(l, c); }) as Res),
  ], { when: (l) => !!l.flags.emperorSelf && edictOn(l, "curb_eunuchs") && castOf(l).some((n) => n.role === "eunuch" && n.you.grudge >= 15), weight: 5, maxTimes: 1, title: "น้ำแกงมื้อเย็น" }),
  E("ed.r_praise", [18, 100], (l) => `ชาวนาชราคนหนึ่งเดินเท้าสามร้อยลี้มาถึงประตูวัง ถือข้าวใหม่หนึ่งถุงมาถวาย — "${edictOn(l, "tax_cut") ? "ปีนี้ลูกหลานข้าได้กินข้าวสวยเป็นครั้งแรก" : edictOn(l, "granary") ? "ปีแล้งที่ผ่านมา ยุ้งฉางหลวงเปิดให้หมู่บ้านข้าไม่อดตาย" : "ลูกชายข้าได้ที่นาเป็นของตัวเองแล้ว"}"`, [
    C("ลงไปรับถุงข้าวด้วยมือตัวเอง", ((l: Life, c: Ctx) => { legit(l, 4); return BIG("ขุนนางทั้งท้องพระโรงตกใจที่เห็นฮ่องเต้เดินลงบันได — ภาพนั้นถูกวาดไว้ในหอจดหมายเหตุ", { fame: 4, joy: 5 })(l, c); }) as Res),
    C("ให้ขันทีรับแทน พระราชทานเงินกลับบ้าน", ((l: Life, c: Ctx) => { legit(l, 1); return G("ชาวนาชรากลับบ้านพร้อมเงินและเรื่องเล่าไปอีกชั่วอายุคน", {})(l, c); }) as Res),
  ], { when: (l) => !!l.flags.emperorSelf && (edictOn(l, "tax_cut") || edictOn(l, "granary") || edictOn(l, "land_reform")), weight: 4, maxTimes: 2, title: "ข้าวใหม่หนึ่งถุง" }),
  E("ed.r_king_refuse", [18, 100], (l) => { const k = l.mw?.era !== "war" ? kingsOf(l).slice().sort((a, b) => a.loyalty - b.loyalty)[0] : undefined; return `${k?.name ?? "อ๋องหัวเมือง"}ส่งสาส์นตอบว่าราชโองการ${edictOn(l, "draft") ? "เกณฑ์ทหาร" : "ปฏิรูปที่ดิน"}จะไม่ถูกใช้ในแคว้นของเขา — "ข้าดูแลราษฎรของข้าเอง"`; }, [
    P("ส่งขุนนางพร้อมทหารไปบังคับใช้", (l) => clamp(0.35 + (l.mw?.legitimacy ?? 50) / 200 + (l.stats.smarts - 50) / 250, 0.1, 0.85), ((l: Life, c: Ctx) => { const k = kingsOf(l).slice().sort((a, b) => a.loyalty - b.loyalty)[0]; if (k) { k.power = clamp(k.power - 8, 5, 100); k.loyalty = clamp(k.loyalty + 5, 0, 100); } legit(l, 3); return G("อ๋องยอมก้มหัว — ราชโองการถูกติดประกาศทุกอำเภอในแคว้นของเขา", {})(l, c); }) as Res, ((l: Life, c: Ctx) => { const k = kingsOf(l).slice().sort((a, b) => a.loyalty - b.loyalty)[0]; if (k) { k.loyalty = clamp(k.loyalty - 15, 0, 100); } unrest(l, 6); return B("ขุนนางของคุณถูกขับออกจากแคว้นด้วยการโกนหัว — อ๋องประกาศไม่รับคำสั่งเมืองหลวงอีก", {})(l, c); }) as Res),
    C("ยกเว้นให้แคว้นนั้น", ((l: Life, c: Ctx) => { legit(l, -3); return N("อ๋องพอใจ — อ๋ององค์อื่นเห็นแล้วว่าราชโองการของคุณต่อรองได้", {})(l, c); }) as Res),
  ], { when: (l) => !!l.flags.emperorSelf && l.mw?.era !== "war" && (edictOn(l, "draft") || edictOn(l, "land_reform")) && kingsOf(l).some((k) => k.loyalty < 35), weight: 4, maxTimes: 2, title: "อ๋องไม่รับราชโองการ" }),
];

/** กิจกรรมบ่อนพนัน/หอนางโลมปิดเมื่อมีราชโองการปิดบ่อน (ใช้ใน activities) */
export const viceBanned = (l: Life) => !l.flags.emperorSelf && edictOn(l, "ban_vice");
export const edictLabel = (l: Life) => activeEdicts(l).map((e) => ({ name: edictDef(e.id)!.name, since: e.since, until: e.until }));
