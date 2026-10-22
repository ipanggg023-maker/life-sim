// กฎหมาย อาชญากรรม การเดินทาง และธรรมเนียมครอบครัว (MURIM_PLAN §7)
// อาชญากรรม: ขโมย ปล้นคนเดินทาง วางยา ลอบสังหาร ใส่ร้าย → ความร้อนแรง (heat) → ประกาศจับ นักล่าค่าหัว จับกุม ศาล คุก เนรเทศ
// การเดินทาง: ย้ายถิ่นไปภูมิภาคอื่น (เรื่องของภูมิภาคเปลี่ยนตาม) · ธรรมเนียม: ไว้ทุกข์สามปีเมื่อพ่อแม่ตาย · ตัดพ่อตัดลูก
import type { Ctx, GameEvent, Outcome } from "../../../engine/events";
import { kill, kinDeathHooks, yearHooks } from "../../../engine/game";
import { feel, relOf } from "../../../engine/npc";
import { chance, pick, randInt } from "../../../engine/rng";
import type { Life } from "../../../engine/types";
import { addFame, addMoney, addStat, clamp, log, money, shortName } from "../../../engine/util";
import { shiftAlign } from "../m17core";
import { DUEL_END, startDuel } from "./duel";
import { REGIONS, regionOf } from "./region";
import { TAEL } from "../story/kit";
import { DARK_JOBS } from "../careers";

const murim = (l: Life) => l.worldId === "murim";
const pow = (l: Life) => l.power?.rank ?? 0;
export const heatOf = (l: Life) => Number(l.flags.heat ?? 0);
export const jailed = (l: Life) => Number(l.flags.jailUntil ?? -1) > l.age;
export const mourning = (l: Life) => Number(l.flags.mourningUntil ?? -1) > l.age;

/** ทำผิด: เพิ่มความร้อนแรง (ทางการรู้มากขึ้น) — ถึง 50 = ถูกประกาศจับ */
export function addHeat(l: Life, n: number): string {
  const before = heatOf(l);
  l.flags.heat = clamp(before + n, 0, 100);
  if (heatOf(l) >= 50 && !l.flags.wanted) { l.flags.wanted = true; return " — ใบหน้าคุณถูกวาดลงใบประกาศจับแล้ว"; }
  return "";
}

const ok = (text: string, next?: string): Outcome => ({ text, kind: "good", next });
const no = (text: string): Outcome => ({ text, kind: "bad" });
const meh = (text: string, next?: string): Outcome => ({ text, next });
/** โอกาสทำผิดสำเร็จ: ฝีมือ + ปัญญา/โชค − ความร้อนแรงที่มีอยู่ */
const crimeOdds = (l: Life, base: number, stat: "smarts" | "luck" | "health" | "looks") => clamp(base + pow(l) * 0.06 + (l.stats[stat] - 50) / 200 - heatOf(l) / 400, 0.05, 0.95);

// ───── อาชญากรรม (ปุ่มในแท็บทำ → เปิดฉาก) ─────
export const CRIME_EVENTS: GameEvent[] = [
  {
    id: "cr.steal",
    minAge: 8,
    maxAge: 90,
    manual: true,
    maxTimes: 0,
    title: "มือไว",
    text: () => "ตลาดเช้าคนแน่น ถุงเงินห้อยอยู่ที่เอวพ่อค้าผ้าไหมอ้วนๆ คนหนึ่ง — อีกฝั่งถนน ยามสองคนกำลังกินซาลาเปา",
    choices: [
      { label: "ล้วงถุงเงินพ่อค้า", skill: ["stealth"], odds: (l) => crimeOdds(l, 0.55, "luck"), run: (l, _c, s) => { if (s) { const t = randInt(l, 3, 12); addMoney(l, t * TAEL); return ok(`ถุงเงินหนักมือ — ${t} ตำลึง${shiftAlign(l, -2)}${addHeat(l, 4)}`); } return caught(l, "ล้วงกระเป๋า", 12); } },
      { label: "ขโมยของจากแผงแล้ววิ่ง", skill: ["stealth"], odds: (l) => crimeOdds(l, 0.6, "health"), run: (l, _c, s) => { if (s) { addMoney(l, 2 * TAEL); return ok(`คุณวิ่งหายเข้าตรอกพร้อมผ้าไหมหนึ่งพับ${shiftAlign(l, -1)}${addHeat(l, 3)}`); } return caught(l, "ขโมยของ", 8); } },
      { label: "เปลี่ยนใจ", run: () => meh("คุณเดินผ่านพ่อค้าไปเฉยๆ — มือยังสั่นอยู่") },
    ],
  },
  {
    id: "cr.rob",
    minAge: 16,
    maxAge: 80,
    manual: true,
    maxTimes: 0,
    title: "ดักปล้น",
    text: () => "คุณซุ่มอยู่ในพงหญ้าข้างทางเขา — ขบวนเกวียนพ่อค้าสามเล่มกำลังขึ้นมา มีผู้คุ้มกันสองคน",
    choices: [
      { label: "ปล้นด้วยกำลัง", tone: "danger", run: (l) => { startDuel(l, { foe: "ผู้คุ้มกันขบวนสินค้า", rank: Math.max(1, pow(l)), lethal: false, on: "crimeRob" }); return meh("คุณกระโดดออกจากพงหญ้า ผ้าปิดหน้าแน่น"); } },
      { label: "ขู่ให้กลัวโดยไม่ลงมือ", odds: (l) => crimeOdds(l, 0.35, "looks") + l.fame / 300, run: (l, _c, s) => { if (s) { addMoney(l, 15 * TAEL); return ok(`พ่อค้าโยนถุงเงินให้แล้วรีบขับเกวียนหนี${shiftAlign(l, -3)}${addHeat(l, 8)}`); } return caught(l, "ปล้นคนเดินทาง", 25); } },
      { label: "ปล่อยไป", run: () => meh("ขบวนผ่านไป — คุณนั่งนิ่งในพงหญ้าจนมืด") },
    ],
  },
  {
    id: "cr.poison",
    minAge: 16,
    maxAge: 90,
    manual: true,
    maxTimes: 0,
    title: "ยาในถ้วยชา",
    prepare: (l): Ctx => { const p = pickFoe(l); return p ? { pid: p.id } : {}; },
    text: (l, c) => { const p = l.people.find((x) => x.id === c.pid); return p ? `${shortName(p)}จะมางานเลี้ยงคืนนี้ — คุณมีห่อผงสีขาวอยู่ในแขนเสื้อ ไม่มีกลิ่น ไม่มีรส` : "คุณมีห่อผงสีขาวในแขนเสื้อ แต่ไม่มีใครที่คุณอยากให้หายไปจริงๆ"; },
    choices: [
      { label: "ใส่ยาในถ้วยของเขา", skill: ["stealth"], tone: "danger", show: (_l, c) => !!c.pid, odds: (l) => crimeOdds(l, 0.5, "smarts") + (l.flags.medicKnow ? 0.1 : 0), run: (l, c, s) => {
        const p = l.people.find((x) => x.id === c.pid)!;
        if (s) { p.alive = false; l.flags.mwKills = Number(l.flags.mwKills ?? 0) + 1; l.flags.mwKillAge = l.age; return { text: `${shortName(p)}ล้มลงกลางงานเลี้ยง หมอบอกว่าหัวใจวาย — ไม่มีใครสงสัยคุณ${shiftAlign(l, -10)}${addHeat(l, 10)}`, kind: "bad" }; }
        feel(p, { grudge: 60, fear: 20 });
        return caught(l, "วางยาพิษ", 40);
      } },
      { label: "ทิ้งยาลงแม่น้ำ", run: (l) => meh(`ผงสีขาวละลายหายไปในน้ำ — คุณรู้สึกเบาขึ้นอย่างประหลาด${shiftAlign(l, 2)}`) },
    ],
  },
  {
    id: "cr.assassinate",
    minAge: 18,
    maxAge: 80,
    manual: true,
    maxTimes: 0,
    title: "งานในเงามืด",
    text: (l) => `ชายสวมหน้ากากวางห่อทองบนโต๊ะ "ขุนนางคนหนึ่งในเมือง${regionOf(l).name} — ค่าจ้าง ${money(l, 80 * TAEL)}"`,
    choices: [
      { label: "รับงาน", tone: "danger", run: (l) => { startDuel(l, { foe: "องครักษ์ประจำตัวขุนนาง", rank: Math.max(2, pow(l) + 1), lethal: true, on: "crimeHit" }); return meh("คืนเดือนมืด คุณปีนข้ามกำแพงจวน"); } },
      { label: "ปฏิเสธ", run: (l) => meh(`เขาเก็บทองแล้วจากไป — "เสียดาย" เสียงนั้นติดหูคุณไปหลายคืน${shiftAlign(l, 1)}`) },
    ],
  },
  {
    id: "cr.frame",
    minAge: 18,
    maxAge: 90,
    manual: true,
    maxTimes: 0,
    title: "ใส่ร้าย",
    prepare: (l): Ctx => { const p = pickFoe(l); return p ? { pid: p.id } : {}; },
    text: (l, c) => { const p = l.people.find((x) => x.id === c.pid); return p ? `คุณมีโอกาสซ่อนหยกที่ขโมยมาไว้ในบ้านของ${shortName(p)} แล้วแจ้งยาม` : "ไม่มีศัตรูให้ใส่ร้าย — คุณนั่งคิดแผนเล่นๆ อยู่คนเดียว"; },
    choices: [
      { label: "ลงมือ", show: (_l, c) => !!c.pid, odds: (l) => crimeOdds(l, 0.45, "smarts"), run: (l, c, s) => {
        const p = l.people.find((x) => x.id === c.pid)!;
        if (s) { p.tags = [...(p.tags ?? []), "jailed_by_you"]; feel(p, { grudge: 40 }); return { text: `${shortName(p)}ถูกจับเข้าคุกสามปี — เขาไม่รู้ว่าใครทำ${shiftAlign(l, -8)}${addHeat(l, 5)}`, kind: "bad" }; }
        feel(p, { grudge: 70 });
        return caught(l, "ใส่ร้ายผู้บริสุทธิ์", 30);
      } },
      { label: "ล้มเลิก", run: () => meh("แผนนั้นอยู่แค่ในหัว — และควรจะอยู่แค่นั้น") },
    ],
  },
  // ───── ผลที่ตามมา (เกิดเอง) ─────
  {
    id: "cr.hunters",
    minAge: 14,
    maxAge: 100,
    maxTimes: 0,
    weight: (l) => (murim(l) && l.flags.wanted && !jailed(l) ? 6 + heatOf(l) / 10 : 0),
    title: "นักล่าค่าหัว",
    text: (l) => `นักล่าค่าหัวสามคนเดินเข้าโรงเตี๊ยมที่คุณนั่งอยู่ คนนำถือใบประกาศจับที่มีหน้าคุณ — ค่าหัว ${money(l, Math.round(heatOf(l)) * TAEL)}`,
    choices: [
      { label: "สู้", tone: "danger", run: (l) => { startDuel(l, { foe: "หัวหน้านักล่าค่าหัว", rank: Math.max(1, pow(l)), lethal: true, on: "crimeHunters" }); return meh("โต๊ะคว่ำ ชามแตก คนในร้านวิ่งหนีออกประตูหลัง"); } },
      { label: "หนีทางหน้าต่าง", skill: ["escape"], odds: (l) => crimeOdds(l, 0.5, "health"), run: (l, _c, s) => (s ? meh(`คุณกระโดดข้ามหลังคาสามหลังหายไปในความมืด${addHeat(l, 2)}`) : arrest(l)) },
      { label: "ยอมมอบตัว", run: (l) => arrest(l, true) },
    ],
  },
  {
    id: "cr.trial",
    minAge: 10,
    maxAge: 100,
    manual: true,
    maxTimes: 0,
    title: "ศาลนายอำเภอ",
    text: (l) => `คุณคุกเข่าหน้าโต๊ะนายอำเภอ ข้อหาที่ถูกอ่าน: ${String(l.flags.lastCrime ?? "ก่ออาชญากรรม")} — ประตูศาลเปิดให้ชาวบ้านมุงดู`,
    choices: [
      { label: "สารภาพ ขอความเมตตา", run: (l) => sentence(l, 0.7) },
      { label: (l) => `ติดสินบนนายอำเภอ (${money(l, sentenceBribe(l))})`, req: (l) => (l.money < sentenceBribe(l) ? "เงินไม่พอ" : undefined), odds: (l) => clamp(0.55 + (l.stats.looks - 50) / 200 - heatOf(l) / 300, 0.1, 0.9), run: (l, _c, s) => { addMoney(l, -sentenceBribe(l)); if (s) { l.flags.heat = Math.max(0, heatOf(l) - 40); delete l.flags.wanted; return ok("นายอำเภอกระแอม \"หลักฐานไม่พอ\" — คุณเดินออกจากศาลได้"); } return sentence(l, 1.3, " นายอำเภอรับเงินแล้วยังตัดสินหนักกว่าเดิม"); } },
      { label: "แก้ต่างให้ตัวเอง", skill: ["social"], check: { stat: "smarts", dc: 65 }, run: (l, _c, s) => { if (s) { l.flags.heat = Math.max(0, heatOf(l) - 30); delete l.flags.wanted; return ok("คุณชี้ช่องโหว่ในคำให้การของพยานทีละข้อ — ชาวบ้านโห่ร้องเมื่อนายอำเภอยกฟ้อง"); } return sentence(l, 1.1); } },
    ],
  },
  {
    id: "cr.prison",
    minAge: 10,
    maxAge: 100,
    maxTimes: 0,
    weight: (l) => (murim(l) && jailed(l) ? 20 : 0),
    title: "ในคุก",
    text: (l) => `คุกหินชื้นแฉะ อาหารวันละมื้อ เหลืออีก ${Number(l.flags.jailUntil) - l.age} ปี — นักโทษห้องข้างๆ เคาะผนังเป็นจังหวะทุกคืน`,
    choices: [
      { label: "ฝึกลมปราณในความมืด", run: (l) => { l.flags.mwBasics = Number(l.flags.mwBasics ?? 0) + 1; addStat(l, "happiness", -2); return meh("ไม่มีอะไรให้ทำนอกจากหายใจ — ลมปราณของคุณนิ่งกว่าตอนอยู่ข้างนอก"); } },
      { label: "คุยกับนักโทษห้องข้างๆ", run: (l) => { addStat(l, "smarts", 1); return meh("เขาเคยเป็นจอมโจรที่ปล้นคลังหลวง — เล่าเรื่องให้คุณฟังทุกคืนจนพ้นโทษ"); } },
      { label: "แหกคุก", skill: ["escape"], tone: "danger", odds: (l) => crimeOdds(l, 0.25, "health"), run: (l, _c, s) => { if (s) { delete l.flags.jailUntil; addHeat(l, 30); return ok("คุณขุดผนังด้วยช้อนมาสองปี คืนนี้มันทะลุ — คุณหายไปในหมอก"); } addStat(l, "health", -10); l.flags.jailUntil = Number(l.flags.jailUntil) + 3; return no("ยามจับได้ — โบยห้าสิบทีและเพิ่มโทษอีกสามปี"); } },
    ],
  },
];

function pickFoe(l: Life) {
  const foes = l.people.filter((p) => p.alive && p.relation !== "child" && p.relation !== "father" && p.relation !== "mother" && relOf(p).grudge + relOf(p).jealousy >= 30);
  return foes.length ? pick(l, foes) : undefined;
}
const sentenceBribe = (l: Life) => Math.round((10 + heatOf(l)) * TAEL);

/** ถูกจับได้คาหนังคาเขา */
function caught(l: Life, crime: string, heat: number): Outcome {
  l.flags.lastCrime = crime;
  addHeat(l, heat);
  addFame(l, -3);
  if (chance(l, 0.5 + heatOf(l) / 200)) return arrest(l);
  return no(`มีคนตะโกน "ขโมย!" — คุณหนีรอดมาได้ แต่ใบหน้าถูกจำแล้ว (ความผิด: ${crime})`);
}

/** ถูกจับ → ศาล */
function arrest(l: Life, surrendered = false): Outcome {
  if (surrendered) l.flags.heat = Math.max(0, heatOf(l) - 10);
  // แทรกหลังฉากปัจจุบัน (ฉากปัจจุบันจะถูกนำออกจากคิวหลังเลือก)
  l.queue.splice(1, 0, { eventId: "cr.trial", ctx: {} });
  return no(surrendered ? "คุณยื่นมือให้ใส่ตรวน — นักล่าค่าหัวดูผิดหวังที่ไม่ได้สู้" : "โซ่ตรวนรัดข้อมือ คุณถูกลากไปที่ว่าการอำเภอ");
}

/** คำตัดสิน: ตามความร้อนแรง — ปรับ · คุก · เนรเทศ · ประหาร */
function sentence(l: Life, mult: number, prefix = ""): Outcome {
  const h = heatOf(l) * mult;
  delete l.flags.wanted;
  l.flags.heat = Math.round(heatOf(l) * 0.3);
  if (h >= 95 && chance(l, 0.5)) { kill(l, `ถูกประหารกลางลานเมืองข้อหา${String(l.flags.lastCrime ?? "อาชญากรรม")}`); return no(`${prefix}คำตัดสินคือประหาร — ฟ้าวันนั้นสีเทา`); }
  if (h >= 70) { exile(l); return no(`${prefix}คำตัดสิน: เนรเทศ — คุณถูกคุมตัวไปอยู่${regionOf(l).name} ห้ามกลับบ้านเกิดตลอดชีวิต`); }
  if (h >= 25) { const y = Math.max(1, Math.round(h / 15)); l.flags.jailUntil = l.age + y; addFame(l, -5); return no(`${prefix}คำตัดสิน: จำคุก ${y} ปี — ประตูเหล็กปิดลงข้างหลังคุณ`); }
  const fine = Math.round((5 + h / 2) * TAEL);
  addMoney(l, -fine);
  return meh(`${prefix}คำตัดสิน: ปรับ ${money(l, fine)} และโบยสิบที`);
}

function exile(l: Life) {
  const here = regionOf(l).id;
  const far = REGIONS.filter((r) => r.id !== here && (r.id === "west" || r.id === "south" || r.id === "north"));
  l.flags.region = pick(l, far.length ? far : REGIONS.filter((r) => r.id !== here)).id;
  l.flags.exiled = here;
}

// ───── การเดินทาง / ย้ายถิ่น ─────
export const TRAVEL_EVENTS: GameEvent[] = [
  {
    id: "tv.move",
    minAge: 16,
    maxAge: 90,
    manual: true,
    maxTimes: 0,
    title: "ย้ายถิ่น",
    text: (l) => `คุณอยู่ที่${regionOf(l).name}มานาน — แผนที่ผืนเก่ากางอยู่บนโต๊ะ ทางไกลหลายเดือน ค่าเดินทางและตั้งตัวใหม่ราว ${money(l, 20 * TAEL)}`,
    choices: [
      ...REGIONS.map((r) => ({
        label: `${r.name} — ${r.desc}`,
        show: (l: Life) => r.id !== regionOf(l).id && l.flags.exiled !== r.id,
        req: (l: Life) => (l.money < 20 * TAEL ? "ต้องมีเงิน 20 ตำลึง" : undefined),
        odds: (l: Life) => clamp(0.6 + pow(l) * 0.06 + (l.stats.health - 50) / 200 + (l.mw?.era === "chaos" ? -0.2 : 0), 0.2, 0.97),
        run: (l: Life, _c: Ctx, s: boolean): Outcome => {
          addMoney(l, -20 * TAEL);
          l.flags.region = r.id;
          l.flags.moved = Number(l.flags.moved ?? 0) + 1;
          if (s) { addStat(l, "happiness", 4); return ok(`หลายเดือนบนถนน — คุณมาถึง${r.name} ${r.desc.split(" ")[0]} ชีวิตใหม่เริ่มที่นี่`); }
          addStat(l, "health", -10);
          addMoney(l, -Math.min(l.money, 10 * TAEL));
          return no(`โจรดักกลางทาง ห่อผ้าถูกปล้นครึ่งหนึ่ง — คุณมาถึง${r.name}ในสภาพสะบักสะบอม`);
        },
      })),
      { label: "อยู่ที่เดิม", run: () => meh("คุณพับแผนที่เก็บ — บ้านก็คือบ้าน") },
    ],
  },
];

// ───── ไว้ทุกข์ · ตัดพ่อตัดลูก ─────
export const FAMILY_RITE_EVENTS: GameEvent[] = [
  {
    id: "fm.mourning",
    minAge: 10,
    maxAge: 100,
    maxTimes: 0,
    weight: (l) => (murim(l) && l.flags.mourningNew ? 50 : 0),
    title: "ไว้ทุกข์",
    text: (l) => `งานศพของ${String(l.flags.mourningNew)}จบลง ธรรมเนียมกำหนดให้ลูกไว้ทุกข์สามปี — ห้ามแต่งงาน ห้ามรับตำแหน่ง ห้ามงานรื่นเริง`,
    choices: [
      { label: "ไว้ทุกข์ครบสามปี สร้างกระท่อมข้างหลุมศพ", run: (l) => { delete l.flags.mourningNew; l.flags.mourningUntil = l.age + 3; addFame(l, 6); shiftAlign(l, 3); return ok("สามปีในกระท่อมไม้ไผ่ข้างหลุม — คนทั้งอำเภอเล่าถึงความกตัญญูของคุณ"); } },
      { label: "ไว้ทุกข์แค่ร้อยวัน ชีวิตต้องเดินต่อ", run: (l) => { delete l.flags.mourningNew; addFame(l, -4); return meh("ญาติผู้ใหญ่บางคนส่ายหน้า — แต่ข้าวในยุ้งไม่รอใคร"); } },
    ],
  },
  {
    id: "fm.disown",
    minAge: 35,
    maxAge: 100,
    manual: true,
    maxTimes: 0,
    title: "ตัดพ่อตัดลูก",
    prepare: (l): Ctx => { const ks = l.people.filter((p) => p.alive && p.relation === "child" && p.age >= 14); const k = ks.sort((a, b) => relOf(a).love - relOf(b).love)[0]; return k ? { pid: k.id } : {}; },
    text: (l, c) => { const k = l.people.find((p) => p.id === c.pid); return k ? `${shortName(k)}ทำให้ตระกูลอับอายเป็นครั้งที่เท่าไรแล้วก็ไม่รู้ — คุณถือพู่กันค้างไว้เหนือผังตระกูล` : "ไม่มีลูกคนไหนให้ตัดขาด"; },
    choices: [
      { label: "ขีดชื่อออกจากผังตระกูล", tone: "danger", show: (_l, c) => !!c.pid, run: (l, c) => { const k = l.people.find((p) => p.id === c.pid)!; k.tags = [...(k.tags ?? []), "disowned"]; k.relation = "rival"; feel(k, { love: -40, grudge: 50 }); addFame(l, -2); return no(`ชื่อ${shortName(k)}ถูกขีดฆ่าด้วยหมึกแดง — เขาไม่ใช่ทายาท ไม่ได้มรดก และไม่ได้กลับบ้านนี้อีก`); } },
      { label: "วางพู่กัน เรียกมาคุยอีกครั้ง", show: (_l, c) => !!c.pid, check: { stat: "looks", dc: 50 }, run: (l, c, s) => { const k = l.people.find((p) => p.id === c.pid)!; if (s) { feel(k, { love: 15, grudge: -15 }); return ok("คุยกันจนเทียนหมดสองเล่ม — ลูกยังไม่ใช่คนที่คุณหวัง แต่เป็นลูกคุณอยู่"); } feel(k, { grudge: 10 }); return meh("คำพูดทุกคำกลายเป็นการทะเลาะ — แต่ชื่อยังอยู่ในผังตระกูล"); } },
      { label: "ไม่ทำอะไร", run: () => meh("ผังตระกูลถูกพับเก็บไว้ที่เดิม") },
    ],
  },
];

// ───── ทุกปีและเมื่อมีคนตาย ─────
yearHooks.push((l) => {
  if (!murim(l) || !l.alive) return;
  // อาชีพสายมืด: ทางการรู้มากขึ้นทุกปี · หัวขโมย/โจร/พิษ/ลัทธิ
  if (l.job && DARK_JOBS.has(l.job.careerId) && !jailed(l)) addHeat(l, 4 + (l.job.level - 1) * 2);
  else if (heatOf(l) > 0 && !l.flags.wanted) l.flags.heat = Math.max(0, heatOf(l) - 6);
  if (l.flags.wanted && heatOf(l) < 50) delete l.flags.wanted;
  if (jailed(l)) { addStat(l, "happiness", -4); addStat(l, "health", -2); }
  else if (l.flags.jailUntil !== undefined && Number(l.flags.jailUntil) <= l.age) { delete l.flags.jailUntil; log(l, "ประตูคุกเปิด — แสงแดดข้างนอกแสบตาจนต้องหยีตาอยู่นาน", "milestone"); }
});

kinDeathHooks.push((l, p) => {
  if (!murim(l) || (p.relation !== "father" && p.relation !== "mother")) return;
  l.flags.mourningNew = shortName(p);
});

// ───── ผลการต่อสู้ของอาชญากรรม ─────
DUEL_END.crimeRob = (l, r) => {
  if (r === "win") { const t = randInt(l, 20, 45); addMoney(l, t * TAEL); return `ผู้คุ้มกันล้มลง พ่อค้ายกหีบเงินให้ทั้งน้ำตา — ${t} ตำลึง${shiftAlign(l, -4)}${addHeat(l, 15)}`; }
  l.flags.lastCrime = "ปล้นคนเดินทาง";
  addHeat(l, 20);
  return r === "lose" ? "ผู้คุ้มกันกระชากผ้าปิดหน้าคุณออก — เขาเห็นหน้าคุณชัดเต็มตา" : "";
};
DUEL_END.crimeHit = (l, r) => {
  if (r === "win") { l.flags.mwKills = Number(l.flags.mwKills ?? 0) + 1; l.flags.mwKillAge = l.age; addMoney(l, 80 * TAEL); return `ขุนนางไม่ได้ตื่นขึ้นมาอีก — ห่อทองรอคุณอยู่ที่ศาลเจ้าร้างตามนัด${shiftAlign(l, -12)}${addHeat(l, 30)}`; }
  l.flags.lastCrime = "ลอบสังหารขุนนาง";
  addHeat(l, 45);
  return "ยามทั้งจวนตื่น — คุณหนีออกมาได้ แต่ทั่วเมืองรู้แล้วว่ามีคนพยายามฆ่าขุนนาง";
};
DUEL_END.crimeHunters = (l, r) => {
  if (r === "win") { addHeat(l, 5); return "นักล่าค่าหัวถอยไปพร้อมแผล — แต่ค่าหัวคุณเพิ่งขึ้นอีก"; }
  if (r === "lose" && l.alive) { l.queue.push({ eventId: "cr.trial", ctx: {} }); return "คุณถูกมัดขึ้นหลังม้า ส่งตัวให้ทางการ"; }
  return "";
};
