// ยุทธภพเต็มรูปแบบ (MURIM_PLAN §7 · §8.3–8.5 · §6): ทำเนียบมังกรหนุ่ม · ตำนานรุ่นก่อน · ชุมนุมผู้กล้า · เยือนสำนัก · หน้าที่พันธมิตร
// ล่าลัทธิมาร · ประกวดโฉม · ขโมยคัมภีร์ (สำนักตามล่า) · สอบขุนนางสามระดับ · อาคาร/กิจการ/ขวัญของสำนักตัวเอง
import type { Ctx, GameEvent, Outcome } from "../../../engine/events";
import { kill, yearHooks } from "../../../engine/game";
import { chance, pick, randInt } from "../../../engine/rng";
import type { Life } from "../../../engine/types";
import { addFame, addMoney, addStat, clamp, log } from "../../../engine/util";
import { combatPower, fightOdds, gainExp, survivalOdds } from "../../hunter/power";
import { EPITHETS, mySect, npcName, saveSect, shiftAlign, type MySect } from "../m17core";
import { ARTS, knows, learn } from "../martial/arts";
import { calYear } from "../life/world";
import { TAEL } from "../story/kit";
import { factionById, factions, shiftRep } from "./factions";

const murim = (l: Life) => l.worldId === "murim";
const pow = (l: Life) => l.power?.rank ?? 0;
const ok = (text: string, next?: string): Outcome => ({ text, kind: "good", next });
const no = (text: string): Outcome => ({ text, kind: "bad" });
const meh = (text: string, next?: string): Outcome => ({ text, next });
const big = (text: string): Outcome => ({ text, kind: "milestone" });
const read = <T,>(l: Life, k: string, d: T): T => { try { return l.flags[k] ? (JSON.parse(String(l.flags[k])) as T) : d; } catch { return d; } };
const write = (l: Life, k: string, v: unknown) => { l.flags[k] = JSON.stringify(v); };

// ───────────────────────── ทำเนียบมังกรหนุ่ม (อายุไม่เกิน 30) ─────────────────────────
export interface Young { n: string; e: string; a: number; cp: number }
const YOUNG_KEY = "mwYoung";
export function youngList(l: Life): Young[] {
  let list = read<Young[]>(l, YOUNG_KEY, []);
  if (!list.length) {
    list = Array.from({ length: 10 }, (_, i) => ({ n: npcName(l), e: pick(l, EPITHETS), a: randInt(l, 18, 29), cp: 72 - i * 3 + randInt(l, -2, 2) }));
    write(l, YOUNG_KEY, list);
  }
  return list;
}
/** อันดับของผู้เล่นในทำเนียบมังกรหนุ่ม (0 = ไม่ติด) */
export function myYoungPlace(l: Life): number {
  if (!l.power || l.age > 30) return 0;
  const cp = combatPower(l);
  const list = youngList(l);
  const place = list.filter((y) => y.cp > cp).length + 1;
  return place <= 10 ? place : 0;
}

// ───────────────────────── ตำนานรุ่นก่อน (ส่งต่อข้ามรุ่นใน mw.legends) ─────────────────────────
export interface Legend { n: string; e?: string; deed: string; year: number }
export const legendsOf = (l: Life): Legend[] => (l.mw?.legends ?? []) as Legend[];

// ───────────────────────── อาคารและกิจการของสำนักตัวเอง ─────────────────────────
export const SECT_BUILDINGS: { id: string; name: string; cost: number; desc: string }[] = [
  { id: "hall", name: "หอฝึกยุทธ์", cost: 300, desc: "ศิษย์เพิ่มเร็วขึ้น · ป้องกันสำนักดีขึ้น" },
  { id: "library", name: "หอคัมภีร์", cost: 400, desc: "ฝีมือคุณเพิ่มทุกปี · ชื่อเสียงสำนักขึ้นช้าๆ" },
  { id: "pharmacy", name: "โรงยา", cost: 250, desc: "ขวัญศิษย์ดีขึ้น · สุขภาพคุณฟื้นทุกปี" },
  { id: "armory", name: "คลังอาวุธ", cost: 300, desc: "ป้องกันการบุกได้ดีขึ้นมาก" },
  { id: "watch", name: "หอสอดแนม", cost: 200, desc: "กันสายลับและศิษย์ทรยศ" },
];
export const SECT_BUSINESS: { id: string; name: string; cost: number; income: number; desc: string }[] = [
  { id: "escort", name: "สำนักคุ้มภัยของสำนัก", cost: 200, income: 40, desc: "รายได้ดี บางปีเสียคน" },
  { id: "inn", name: "โรงเตี๊ยมเชิงเขา", cost: 150, income: 25, desc: "รายได้สม่ำเสมอ ได้ข่าวสาร" },
  { id: "clinic", name: "ร้านยาของสำนัก", cost: 120, income: 20, desc: "ช่วยชาวบ้าน ชื่อเสียงสำนักขึ้น" },
];
export const hasBuilding = (s: MySect | undefined, id: string) => !!s?.b?.includes(id);
export const sectMorale = (s: MySect | undefined) => s?.m ?? 60;
/** กำลังป้องกันสำนัก (ใช้ในศึกป้องกันสำนัก) */
export const sectDefense = (l: Life) => { const s = mySect(l); return (hasBuilding(s, "hall") ? 0.08 : 0) + (hasBuilding(s, "armory") ? 0.15 : 0) + (sectMorale(s) - 50) / 400; };

export function buildSect(l: Life, id: string): Outcome | undefined {
  const s = mySect(l);
  const b = SECT_BUILDINGS.find((x) => x.id === id);
  if (!s || !b || hasBuilding(s, id) || l.money < b.cost * TAEL) return;
  addMoney(l, -b.cost * TAEL);
  s.b = [...(s.b ?? []), id];
  s.m = clamp(sectMorale(s) + 5, 0, 100);
  saveSect(l, s);
  const text = `🏗️ ${b.name}ของ「${s.n}」สร้างเสร็จ — ${b.desc}`;
  log(l, text, "good");
  return { text, kind: "good" };
}
export function openSectBusiness(l: Life, id: string): Outcome | undefined {
  const s = mySect(l);
  const b = SECT_BUSINESS.find((x) => x.id === id);
  if (!s || !b || s.biz?.includes(id) || l.money < b.cost * TAEL) return;
  addMoney(l, -b.cost * TAEL);
  s.biz = [...(s.biz ?? []), id];
  saveSect(l, s);
  const text = `💼 「${s.n}」เปิด${b.name} — ${b.desc}`;
  log(l, text, "good");
  return { text, kind: "good" };
}

// ───────────────────────── ทุกปี ─────────────────────────
yearHooks.push((l) => {
  if (!murim(l) || !l.alive) return;
  // ทำเนียบมังกรหนุ่ม: แก่ขึ้น คนเกิน 30 ออก คนใหม่ขึ้นมา
  const yl = youngList(l).map((y) => ({ ...y, a: y.a + 1, cp: y.cp + randInt(l, 0, 3) })).filter((y) => y.a <= 30);
  while (yl.length < 10) yl.push({ n: npcName(l), e: pick(l, EPITHETS), a: randInt(l, 17, 22), cp: 58 + randInt(l, -4, 6) });
  yl.sort((a, b) => b.cp - a.cp);
  write(l, YOUNG_KEY, yl.slice(0, 10));
  const yp = myYoungPlace(l);
  if (yp && !l.flags.youngListed) { l.flags.youngListed = true; addFame(l, 6); log(l, `🐉 ชื่อของคุณขึ้นทำเนียบมังกรหนุ่มอันดับ ${yp} — คนรุ่นเดียวกันทั่วแผ่นดินเริ่มจับตามอง`, "milestone"); }
  if (yp === 1) l.flags.youngTop = true;
  // ชุมนุมผู้กล้า ทุกสิบปีปฏิทิน
  if (calYear(l) % 10 === 0 && l.age >= 14) l.flags.gatheringYear = calYear(l);
  // สำนักของตัวเอง: อาคาร กิจการ ค่าใช้จ่าย ขวัญ
  const s = mySect(l);
  if (s) {
    let income = 0;
    for (const id of s.biz ?? []) { const b = SECT_BUSINESS.find((x) => x.id === id); if (b) income += b.income; }
    if (s.biz?.includes("escort") && chance(l, 0.15)) { s.d = Math.max(0, s.d - 1); log(l, "🐎 ขบวนคุ้มภัยของสำนักถูกดักปล้น — ศิษย์ตายหนึ่งคน", "bad"); }
    if (s.biz?.includes("clinic")) s.r = clamp(s.r + 1, 0, 100);
    const upkeep = Math.round((s.b?.length ?? 0) * 15 + s.d * 0.3);
    addMoney(l, (income - upkeep) * TAEL);
    if (hasBuilding(s, "hall") && s.d < 10 + s.r * 3) s.d += 1;
    if (hasBuilding(s, "library")) { if (l.power) gainExp(l, 300); s.r = clamp(s.r + 1, 0, 100); }
    if (hasBuilding(s, "pharmacy")) addStat(l, "health", 2);
    // ขวัญ: เงินพอ ชื่อเสียงดี อาคารดี = ขวัญดี · ถังแตก = ศิษย์หนี
    const target = 40 + (s.b?.length ?? 0) * 6 + (s.r - 50) / 3 + (l.money < 0 ? -30 : 0) + (hasBuilding(s, "pharmacy") ? 8 : 0);
    s.m = clamp(sectMorale(s) + Math.sign(target - sectMorale(s)) * 3, 0, 100);
    if (sectMorale(s) < 25 && s.d > 0 && chance(l, 0.4)) { const gone = Math.max(1, Math.round(s.d * 0.1)); s.d -= gone; log(l, `😞 ขวัญในสำนักตกต่ำ — ศิษย์ ${gone} คนเก็บของหนีลงเขากลางดึก`, "bad"); }
    saveSect(l, s);
  }
  // ถูกสำนักตามล่าเพราะขโมยคัมภีร์ — ความแค้นจางลงช้ามาก
  if (l.flags.manualHunted && chance(l, 0.05)) { delete l.flags.manualHunted; log(l, "📜 ข่าวว่าสำนักที่ตามล่าคุณเรื่องคัมภีร์ เลิกตามแล้ว — มีเรื่องใหญ่กว่าให้กังวล"); }
});

// ───────────────────────── เหตุการณ์ ─────────────────────────
/** โอกาสชนะคู่ต่อสู้ในชุมนุม (รอบหลังยากขึ้น) */
const roundOdds = (l: Life, round: number) => fightOdds(l, clamp(pow(l) + round - 1, 0, 8), -0.05 * round);
const roundSurv = (l: Life, round: number) => clamp(survivalOdds(l, clamp(pow(l) + round - 1, 0, 8)) + 0.1, 0.6, 0.99);
function roundRun(l: Life, round: number, s: boolean, next: string): Outcome {
  gainExp(l, 200 * round);
  if (s) return ok(["คู่ต่อสู้รอบแรกล้มลงในกระบวนท่าที่เจ็ด — คนดูเริ่มจำชื่อคุณ", "รอบสองยากกว่าที่คิด แต่คุณผ่านไปได้ด้วยท่าที่ไม่เคยใช้ต่อหน้าใคร", ""][round - 1] || "", next);
  if (!chance(l, roundSurv(l, round))) { kill(l, "บาดเจ็บสาหัสบนเวทีชุมนุมผู้กล้า"); return no("คู่ต่อสู้ไม่ยั้งมือ — บนเวทีนั้น ไม่มีใครช่วยทัน"); }
  addStat(l, "health", -8 * round);
  addFame(l, round);
  return no(`คุณแพ้ในรอบที่ ${round} — แต่ยุทธภพได้เห็นฝีมือคุณแล้ว`);
}

export const JIANGHU_EVENTS: GameEvent[] = [
  {
    id: "jh.gathering",
    minAge: 14,
    maxAge: 90,
    forced: true,
    maxTimes: 0,
    when: (l) => murim(l) && Number(l.flags.gatheringYear ?? 0) === calYear(l) && l.flags.gatheringSeen !== calYear(l),
    prepare: (l): Ctx => { l.flags.gatheringSeen = calYear(l); return {}; },
    title: "ชุมนุมผู้กล้า",
    text: () => "สิบปีมีครั้ง — พันธมิตรยุทธจักรจัดชุมนุมผู้กล้าที่ลานหน้าภูเขาหัวซาน สำนักใหญ่ทุกสำนักส่งศิษย์เอกมาแข่ง คนดูนับหมื่น พ่อค้าตั้งแผงเต็มเชิงเขา",
    choices: [
      { label: "ลงชื่อแข่ง", skill: ["combat"], show: (l) => !!l.power, odds: (l) => roundOdds(l, 1), survival: (l) => roundSurv(l, 1), run: (l, _c, s) => roundRun(l, 1, s, "r2") },
      { label: "ตั้งแผงขายของในงาน", odds: (l) => clamp(0.4 + (l.stats.smarts - 50) / 150, 0.1, 0.9), run: (l, _c, s) => { const t = s ? randInt(l, 20, 50) : randInt(l, 2, 8); addMoney(l, t * TAEL); return s ? ok(`คนดูนับหมื่นต้องกินต้องดื่ม — คุณขายหมดทุกวัน ได้ ${t} ตำลึง`) : meh(`แผงคุณอยู่มุมอับ ได้แค่ ${t} ตำลึง`); } },
      { label: "ไปดูเฉยๆ", run: (l) => { if (l.power) gainExp(l, 300); addStat(l, "happiness", 4); return meh("คุณดูการประลองทั้งเจ็ดวัน — ท่าที่ได้เห็นจะติดตาไปอีกหลายปี"); } },
      { label: "ไม่ไป", run: () => meh("ข่าวผลการชุมนุมมาถึงหมู่บ้านในอีกหนึ่งเดือน") },
    ],
    scenes: {
      r2: { title: "ชุมนุมผู้กล้า · รอบสอง", text: () => "รอบสองเหลือสิบหกคน — คู่ของคุณคือศิษย์เอกจากสำนักใหญ่ที่ไม่เคยแพ้ใครมาสามปี", choices: [
        { label: "สู้ต่อ", skill: ["combat"], odds: (l) => roundOdds(l, 2), survival: (l) => roundSurv(l, 2), run: (l, _c, s) => roundRun(l, 2, s, "final") },
        { label: "ถอนตัวอย่างมีเกียรติ", run: (l) => { addFame(l, 3); return meh("คุณคารวะคู่ต่อสู้แล้วลงจากเวที — คนดูปรบมือให้ความใจกว้าง"); } },
      ] },
      final: { title: "ชุมนุมผู้กล้า · รอบชิง", text: () => "รอบชิง — ลานทั้งลานเงียบกริบ คู่ต่อสู้คนสุดท้ายยืนรออยู่กลางเวที ผู้ชนะจะเป็นชื่อที่ทั้งแผ่นดินพูดถึงไปอีกสิบปี", choices: [
        { label: "สู้เพื่อชัยชนะ", skill: ["combat"], odds: (l) => roundOdds(l, 3), survival: (l) => roundSurv(l, 3), run: (l, _c, s) => {
          gainExp(l, 800);
          if (s) { addFame(l, 15); l.flags.gatheringChampion = true; shiftRep(l, "alliance", 25); if (l.age <= 30) l.flags.youngTop = true; return big("กระบวนท่าสุดท้ายหยุดห่างคอคู่ต่อสู้เพียงเส้นผม — ลานหน้าหัวซานระเบิดด้วยเสียงโห่ร้อง คุณคือผู้ชนะชุมนุมผู้กล้า"); }
          if (!chance(l, roundSurv(l, 3))) { kill(l, "สิ้นใจในรอบชิงชุมนุมผู้กล้า"); return no("ฝ่ามือสุดท้ายนั้นเร็วเกินกว่าใครจะห้ามทัน…"); }
          addStat(l, "health", -20); addFame(l, 8);
          return no("คุณแพ้ในรอบชิง — อันดับสองของแผ่นดินก็ยังเป็นชื่อที่คนจำได้");
        } },
      ] },
    },
  },
  {
    id: "jh.visit",
    minAge: 14,
    maxAge: 90,
    manual: true,
    maxTimes: 0,
    title: "เยือนสำนักอื่น",
    text: () => "คุณเดินทางไปเยือนสำนักอื่นพร้อมของกำนัล — ประตูภูเขาจะเปิดต้อนรับหรือไม่ ขึ้นกับว่าพวกเขาคิดกับคุณอย่างไร",
    choices: [
      ...["vajra", "cloud", "alliance", "beggar", "tang", "families", "blackway", "cult"].map((id) => ({
        label: (l: Life) => `ไป${factionById(l, id)?.name ?? id}`,
        show: (l: Life) => !!factionById(l, id) && factionById(l, id)!.status !== "fallen" && l.power?.guild !== id,
        odds: (l: Life) => clamp(0.55 + (factionById(l, id)?.rep ?? 0) / 150 + (l.stats.looks - 50) / 250, 0.05, 0.95),
        run: (l: Life, _c: Ctx, s: boolean): Outcome => {
          const f = factionById(l, id)!;
          addMoney(l, -2 * TAEL);
          if (s) { shiftRep(l, id, 8); if (l.power) gainExp(l, 350); return ok(`${f.name}เชิญคุณประลองกระชับมิตรกับศิษย์เอก — แลกเปลี่ยนวิชากันสามวัน คุณได้เห็นทางที่ไม่เคยเห็น`); }
          shiftRep(l, id, -3);
          return no(`ศิษย์เฝ้าประตู${f.name}ไม่ยอมให้เข้า "ประมุขไม่ว่าง" — คุณกลับมาพร้อมของกำนัลที่ไม่มีใครรับ`);
        },
      })),
      { label: "เปลี่ยนใจ", run: () => meh("คุณเก็บของกำนัลไว้ก่อน") },
    ],
  },
  {
    id: "jh.alliance",
    minAge: 16,
    maxAge: 80,
    manual: true,
    maxTimes: 0,
    title: "หน้าที่พันธมิตรยุทธจักร",
    text: () => "ศาลาพันธมิตรยุทธจักรติดประกาศงาน: คุ้มกันผู้อาวุโสเดินทาง · สืบข่าวการเคลื่อนไหวของลัทธิมาร · ไกล่เกลี่ยข้อพิพาทระหว่างสองสำนัก",
    choices: [
      { label: "คุ้มกันผู้อาวุโส", skill: ["combat"], odds: (l) => fightOdds(l, pow(l)), run: (l, _c, s) => { if (s) { shiftRep(l, "alliance", 10); addFame(l, 2); return ok("ผู้อาวุโสถึงที่หมายปลอดภัย — เขาจดชื่อคุณไว้ในสมุดของพันธมิตร"); } addStat(l, "health", -10); shiftRep(l, "alliance", -2); return no("มือสังหารดักกลางทาง — ผู้อาวุโสรอด แต่คุณเจ็บหนัก"); } },
      { label: "สืบข่าวลัทธิมาร", skill: ["stealth"], odds: (l) => clamp(0.4 + (l.stats.smarts - 50) / 150 + pow(l) * 0.04, 0.1, 0.9), run: (l, _c, s) => { if (s) { shiftRep(l, "alliance", 12); shiftRep(l, "cult", -10); l.flags.factionIntel = true; return ok("คุณได้แผนที่ฐานลับของลัทธิมาร — พันธมิตรเตรียมกำลังได้ทัน"); } shiftRep(l, "cult", -15); return no("ลัทธิมารจับได้ว่ามีสายลับ — ชื่อคุณอยู่ในบัญชีของพวกเขาแล้ว"); } },
      { label: "ไกล่เกลี่ยข้อพิพาท", skill: ["social"], check: { stat: "smarts", dc: 60 }, run: (l, _c, s) => { if (s) { shiftRep(l, "alliance", 8); addFame(l, 3); shiftAlign(l, 2); return ok("สองสำนักจับมือกันในศาลา — ไม่มีใครเสียหน้า"); } return no("ทั้งสองฝ่ายหาว่าคุณลำเอียง — ข้อพิพาทแย่ลงกว่าเดิม"); } },
    ],
  },
  {
    id: "jh.cult_hunt",
    minAge: 16,
    maxAge: 80,
    manual: true,
    maxTimes: 0,
    title: "ล่าลัทธิมาร",
    text: () => "ข่าวว่าสาวกลัทธิมารห้าคนซ่อนตัวในวัดร้างนอกเมือง ลักพาตัวเด็กไปทำพิธีเลือด",
    choices: [
      { label: "บุกเข้าไปช่วยเด็ก", skill: ["combat"], tone: "danger", odds: (l) => fightOdds(l, pow(l)), survival: (l) => survivalOdds(l, pow(l)), run: (l, _c, s) => {
        gainExp(l, 400);
        if (s) { shiftRep(l, "cult", -15); shiftRep(l, "alliance", 8); addFame(l, 4); shiftAlign(l, 4); return ok("เด็กสามคนรอดออกมาได้ — สาวกมารที่เหลือหนีกลับเทือกเขาตะวันตก"); }
        if (!chance(l, survivalOdds(l, pow(l)))) { kill(l, "ถูกสาวกลัทธิมารสังหารในวัดร้าง"); return no("พิธีเลือดเสร็จก่อนคุณจะไปถึง — และคุณกลายเป็นเครื่องเซ่นคนต่อไป"); }
        addStat(l, "health", -15); shiftRep(l, "cult", -10);
        return no("คุณหนีออกมาได้พร้อมเด็กคนเดียว — อีกสองคนไม่รอด");
      } },
      { label: "แจ้งพันธมิตรแล้วรอ", run: (l) => { shiftRep(l, "alliance", 3); return meh("พันธมิตรส่งคนมาในสามวัน — วัดร้างว่างเปล่าแล้ว"); } },
    ],
  },
  {
    id: "jh.beauty",
    minAge: 15,
    maxAge: 35,
    manual: true,
    maxTimes: 0,
    title: "ประกวดโฉมงามประจำมณฑล",
    text: (l) => `งานประกวดโฉมงามประจำปีที่ศาลาริมทะเลสาบ — ${l.gender === "f" ? "สาวงามจากทั่วมณฑลแต่งกายเต็มยศ" : "ปีนี้มีการประกวดบัณฑิตรูปงามด้วย"} รางวัลคือผ้าไหมสิบพับและชื่อที่ทั้งมณฑลจะจำ`,
    choices: [
      { label: "ลงประกวด", odds: (l) => clamp(0.15 + (l.stats.looks - 50) / 80, 0.03, 0.9), run: (l, _c, s) => { if (s) { addFame(l, 5); addMoney(l, 10 * TAEL); l.flags.beautyWinner = true; return big("ชื่อคุณถูกประกาศเป็นที่หนึ่ง — แม่สื่อสิบคนมาเคาะประตูในสัปดาห์เดียว"); } addStat(l, "happiness", -2); return meh("ไม่ติดสามอันดับแรก — แต่มีคนมาขอผูกมิตรหลังงาน"); } },
      { label: "ไปเป็นกรรมการ", show: (l) => l.fame >= 30, run: (l) => { addFame(l, 1); return meh("ทุกตระกูลส่งของกำนัลมาให้คุณก่อนตัดสิน — คุณคืนทั้งหมด"); } },
      { label: "ไปเที่ยวงาน", run: (l) => { addStat(l, "happiness", 3); return meh("ศาลาริมน้ำประดับโคมสวยที่สุดในรอบปี"); } },
    ],
  },
  {
    id: "jh.steal_manual",
    minAge: 16,
    maxAge: 70,
    manual: true,
    maxTimes: 0,
    title: "ขโมยคัมภีร์",
    prepare: (l): Ctx => { const pool = ARTS.filter((a) => a.grade === 3 && !knows(l, a.id)); const a = pool.length ? pick(l, pool) : undefined; return a ? { art: a.id, artName: a.name } : {}; },
    text: (_l, c) => (c.art ? `หอคัมภีร์ชั้นในของสำนักหนึ่งเก็บ「${c.artName}」ไว้ — ยามสองคนผลัดเวรตอนเที่ยงคืน` : "คุณรู้วิชาลับที่หาได้หมดแล้ว — ไม่มีอะไรน่าขโมยอีก"),
    choices: [
      { label: "ลอบเข้าไปขโมย", skill: ["stealth"], tone: "danger", show: (_l, c) => !!c.art, odds: (l) => clamp(0.3 + (l.stats.luck - 50) / 200 + pow(l) * 0.05, 0.05, 0.85), run: (l, c, s) => {
        if (s) { learn(l, String(c.art), "คัมภีร์ที่ขโมยมา", true); l.flags.manualHunted = true; shiftAlign(l, -5); return big(`「${c.artName}」อยู่ในมือคุณแล้ว — แต่สำนักนั้นรู้ว่ามีคนขโมย และเริ่มตามหา`); }
        addStat(l, "health", -15); l.flags.manualHunted = true;
        return no("ยามเห็นหน้าคุณ — คุณหนีออกมาได้พร้อมลูกธนูที่ไหล่ และสำนักนั้นจะไม่ลืม");
      } },
      { label: "ล้มเลิก", run: () => meh("คัมภีร์ยังอยู่ที่เดิม — ชีวิตคุณก็เช่นกัน") },
    ],
  },
  {
    id: "jh.manual_hunters",
    minAge: 16,
    maxAge: 90,
    maxTimes: 0,
    weight: (l) => (l.flags.manualHunted ? 7 : 0),
    title: "ผู้ตามล่าคัมภีร์",
    text: () => "ศิษย์สำนักที่คุณขโมยคัมภีร์มาตามหาเจอ — สามคนยืนขวางทาง \"คืนคัมภีร์ หรือคืนชีวิต\"",
    choices: [
      { label: "สู้", skill: ["combat"], tone: "danger", odds: (l) => fightOdds(l, pow(l)), survival: (l) => survivalOdds(l, pow(l)), run: (l, _c, s) => { if (s) { gainExp(l, 300); return ok("พวกเขาถอยกลับ — แต่สำนักจะส่งคนที่เก่งกว่ามา"); } if (!chance(l, survivalOdds(l, pow(l)))) { kill(l, "ถูกศิษย์สำนักที่ถูกขโมยคัมภีร์สังหาร"); return no("ความโลภมีราคา — และวันนี้คุณจ่ายด้วยชีวิต"); } addStat(l, "health", -15); return no("คุณหนีรอดมาได้อย่างหวุดหวิด"); } },
      { label: "คืนคัมภีร์ (ลืมวิชา) แล้วขอโทษ", run: (l) => { delete l.flags.manualHunted; shiftAlign(l, 3); return meh("คุณส่งคัมภีร์คืนพร้อมคุกเข่าขอโทษ — วิชาที่ฝึกไปแล้วยังอยู่ในหัว แต่สำนักยอมจบเรื่อง"); } },
      { label: "หนี", skill: ["escape"], odds: (l) => clamp(0.5 + pow(l) * 0.05, 0.2, 0.9), run: (_l, _c, s) => (s ? meh("คุณหายไปในตลาดคนแน่น — ครั้งนี้") : no("พวกเขาตามทัน — คุณได้แผลยาวที่หลังติดตัวกลับมา")) },
    ],
  },
  // ───── สอบขุนนางระดับมณฑลและราชสำนัก ─────
  {
    id: "jh.exam_province",
    minAge: 17,
    maxAge: 55,
    maxTimes: 0,
    weight: (l) => (l.flags.xiucai && !l.flags.juren && l.stats.smarts >= 55 && (l.job?.careerId === "official" || l.job?.careerId === "teacher" || !l.job) ? 6 : 0),
    title: "สอบระดับมณฑล",
    text: () => "สนามสอบระดับมณฑลเปิดทุกสามปี — บัณฑิตหลายพันคนนั่งในห้องสอบเล็กๆ คนละห้องเป็นเวลาเก้าวัน ผ่านได้แค่ไม่กี่สิบคน",
    choices: [
      { label: "เข้าสอบ", check: { stat: "smarts", dc: 72 }, run: (l, _c, s) => { if (s) { l.flags.juren = true; addFame(l, 6); if (l.job?.careerId === "official" && l.job.level < 3) l.job.level = 3; return big("ชื่อคุณอยู่ในประกาศ — จวี่เหริน! ตระกูลจัดงานเลี้ยงสามวันสามคืน"); } addStat(l, "health", -3); return no("เก้าวันในห้องสอบแคบๆ — ชื่อไม่อยู่ในประกาศ อีกสามปีค่อยลองใหม่"); } },
      { label: "ยังไม่พร้อม", run: (l) => { addStat(l, "smarts", 1); return meh("อ่านต่ออีกสามปี"); } },
    ],
  },
  {
    id: "jh.exam_palace",
    minAge: 20,
    maxAge: 60,
    maxTimes: 0,
    weight: (l) => (l.flags.juren && !l.flags.jinshi && l.stats.smarts >= 65 ? 5 : 0),
    title: "สอบหน้าพระที่นั่ง",
    text: () => "สนามสอบสูงสุดในเมืองหลวง — ฮ่องเต้ทรงตั้งคำถามเอง ผู้ที่ได้ที่หนึ่งจะเป็นจอหงวน ชื่อจารึกบนศิลาหน้าวิทยาลัยหลวงตลอดกาล",
    choices: [
      { label: "เดินทางไปสอบ (15 ตำลึง)", check: { stat: "smarts", dc: 82 }, req: (l) => (l.money < 15 * TAEL ? "ต้องมีค่าเดินทาง 15 ตำลึง" : undefined), run: (l, _c, s) => {
        addMoney(l, -15 * TAEL);
        if (s) { l.flags.jinshi = true; addFame(l, 12); const top = chance(l, 0.15 + (l.stats.smarts - 80) / 100); if (top) l.flags.zhuangyuan = true; if (l.job?.careerId === "official") l.job.level = Math.max(l.job.level, 4); return big(top ? "จอหงวน! ขบวนแห่รอบเมืองหลวงสามรอบ ทั้งแผ่นดินรู้จักชื่อคุณ" : "จิ้นซื่อ — ประตูราชสำนักเปิดกว้างให้คุณแล้ว"); }
        return no("คำถามของฮ่องเต้ลึกเกินกว่าที่คุณเตรียมมา — กลับบ้านพร้อมค่าเดินทางที่หมดไป");
      } },
      { label: "ไม่ไป", run: () => meh("ตำแหน่งที่มีอยู่ก็พอแล้ว") },
    ],
  },
];

/** ส่งต่อโลก: สำนักที่คุณก่อตั้ง + ตำนานของคุณ ไปยังรุ่นถัดไปในยุคหลัง */
export function legacyToWorld(dead: Life, next: Life, sectAsFaction: boolean) {
  const w = next.mw;
  if (!w) return;
  const s = mySect(dead);
  if (s && sectAsFaction && !(w.fx ?? []).some((f) => f.name === s.n)) {
    factions(next);
    w.fx!.push({ id: `own_${dead.id}`, name: s.n, side: Number(dead.flags.m17Align ?? 0) <= -30 ? "unorthodox" : "orthodox", power: clamp(Math.round(s.d / 2 + s.r / 3), 10, 80), unity: sectMorale(s), rep: 20, leader: s.h ?? npcName(next), leaderAge: randInt(next, 40, 60), status: "steady" });
  }
  const deeds = [
    dead.flags.gatheringChampion && "ผู้ชนะชุมนุมผู้กล้า",
    Number(dead.flags.m17Best ?? 0) > 0 && `เคยเป็นอันดับ ${dead.flags.m17Best} ของทำเนียบ`,
    s && `ผู้ก่อตั้ง「${s.n}」`,
    dead.flags.foundedDynasty && "ผู้ตั้งราชวงศ์",
    dead.flags.heavenlyDemon && "มารสวรรค์",
    dead.flags.ascended && "ผู้บรรลุเซียน",
    dead.flags.zhuangyuan && "จอหงวน",
  ].filter(Boolean) as string[];
  if (deeds.length || dead.fame >= 50) {
    (w.legends ??= []).push({ n: `${dead.lastName}${dead.firstName}`, e: dead.flags.m17Epithet ? String(dead.flags.m17Epithet) : undefined, deed: deeds.join(" · ") || "ชื่อเสียงเลื่องลือ", year: dead.birthYear + dead.age });
    if (w.legends.length > 20) w.legends.splice(0, w.legends.length - 20);
  }
}

