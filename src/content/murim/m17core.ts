import { woundFrom } from "../../engine/body";
// M17 — ระบบประจำยุทธภพ: ทำเนียบยอดฝีมือ · มาตรธรรมะ/มาร · สมุดบุญคุณ/ความแค้น · ก่อตั้งสำนัก
// เก็บทุกอย่างใน life.flags (JSON string / ตัวเลข) เพื่อไม่แตะ engine/types.ts
import type { Outcome } from "../../engine/events";
import { kill, yearHooks } from "../../engine/game";
import { chance, pick, randInt } from "../../engine/rng";
import type { Life } from "../../engine/types";
import { addFame, addMoney, addStat, clamp, displayName, log, money, uid } from "../../engine/util";
import { combatPower, fightOdds, gainExp, guildById, survivalOdds } from "../hunter/power";
import { TITLES } from "../titles";
import { MURIM_FEMALE, MURIM_LAST, MURIM_MALE } from "./names";

export const isMurim = (l: Life) => l.worldId === "murim";
export const rankOf = (l: Life) => l.power?.rank ?? -1;

function readJson<T>(l: Life, key: string, fallback: T): T {
  const raw = l.flags[key];
  if (typeof raw !== "string") return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}
const writeJson = (l: Life, key: string, v: unknown) => {
  l.flags[key] = JSON.stringify(v);
};

/** ชื่อคนในยุทธภพแบบไม่ต้องสร้าง Person (แซ่นำหน้า) */
export function npcName(l: Life, g?: "m" | "f") {
  const gender = g ?? (chance(l, 0.6) ? "m" : "f");
  return `${pick(l, MURIM_LAST)}${pick(l, gender === "m" ? MURIM_MALE : MURIM_FEMALE)}`;
}

// ───────────────────────── ทำเนียบยอดฝีมือ ─────────────────────────

export interface Master {
  id: string;
  /** ชื่อ */
  n: string;
  /** ฉายา */
  e: string;
  /** อายุ */
  a: number;
  /** พลังฝีมือ (เทียบกับพลังต่อสู้ของผู้เล่น) */
  cp: number;
  me?: boolean;
  /** เพศ (ทำเนียบมีทั้งชายและหญิง) */
  g?: "m" | "f";
}

/** ทำเนียบยอดฝีมือใต้หล้า 20 อันดับ — สิบอันดับแรกคือ "สิบยอดฝีมือใต้หล้า" ส่วนอันดับ 11–20 คือคนที่ฝีมือดีพอจะไต่ขึ้นไป */
export const RANK_SIZE = 20;
export const TOP_TEN = 10;

export const EPITHETS = [
  "กระบี่ไร้เงา", "ฝ่ามือพันพุทธ", "ทวนเพลิงทะลวงฟ้า", "มารโลหิตเก้าเศียร", "ขลุ่ยหยกสังหาร",
  "ยาจกเมาสุราแห่งแดนใต้", "พยัคฆ์หิมะทิศเหนือ", "นางพญาบุปผาพิษ", "เทพดาบหักครึ่ง", "หมัดสะท้านขุนเขา",
  "เงาจันทร์ไร้เสียง", "พระอรหันต์หน้ายักษ์", "นักพรตผมขาวเขาหัวซาน", "ราชาเข็มเงินแห่งตระกูลถัง", "อสูรพัดเหล็ก",
  "กระบี่สายลมพลิ้ว", "เทพธิดาแขนพันใบมีด", "บัณฑิตพู่กันเหล็ก", "จ้าวแห่งทะเลทรายเหลือง", "หญิงชราสวมงอบไผ่",
  "เจ้าสำนักไร้นาม", "ปีศาจหัวเราะ", "ขุนพลทวนเงินพเนจร", "ฝ่ามือน้ำแข็งพันปี", "คนแบกโลงศพ",
  "นักเล่นหมากรุกตาบอด", "กระบี่เมาแห่งทะเลสาบไท่หู", "แม่ชีพันกร", "มือสังหารชาเย็น", "พ่อครัวมีดคว่ำฟ้า",
];

/** ฉายาของผู้เล่นตามวิชาและฝ่าย (ได้ตอนติดทำเนียบครั้งแรก) */
const MY_EPITHET: Record<string, [string, string]> = {
  m_sword: ["กระบี่พิทักษ์ธรรม", "กระบี่ล้างโลหิต"],
  m_palm: ["ฝ่ามือเมตตา", "ฝ่ามือทลายวิญญาณ"],
  m_spear: ["ทวนพิทักษ์แผ่นดิน", "ทวนสังหารพันศพ"],
  m_hidden: ["เงาคุ้มภัย", "เงาไร้หัวใจ"],
  m_medic: ["หมอเทวดา", "หมอผีพิษร้อยชนิด"],
  m_demon: ["มารกลับใจ", "จอมมารโลหิต"],
};

export const masters = (l: Life): Master[] => readJson<Master[]>(l, "m17Rank", []);
const saveMasters = (l: Life, list: Master[]) => writeJson(l, "m17Rank", list.slice(0, RANK_SIZE));

/** อันดับของผู้เล่น (1–10) · 0 = ไม่ติดทำเนียบ */
export const myPlace = (l: Life) => masters(l).findIndex((m) => m.me) + 1;
export const wasRanked = (l: Life) => Number(l.flags.m17Best ?? 0) > 0;

function newMaster(l: Life, cp: number, age?: number): Master {
  const used = masters(l).map((m) => m.e);
  const free = EPITHETS.filter((e) => !used.includes(e));
  const g = chance(l, 0.4) ? "f" : "m";
  return { id: uid(l), n: npcName(l, g), e: pick(l, free.length ? free : EPITHETS), a: age ?? randInt(l, 28, 60), cp, g };
}

export function initRanking(l: Life) {
  if (l.flags.m17Rank) return;
  const list: Master[] = [];
  for (let i = 0; i < RANK_SIZE; i++) {
    const m = newMaster(l, 0);
    list.push(m);
    writeJson(l, "m17Rank", list); // ให้ฉายาไม่ซ้ำ
  }
  // ทำเนียบสิบยอดฝีมือใต้หล้า = ระดับจุดสูงสุดถึงหลอมรวม (หายากจริง — MURIM_PLAN §4)
  list.forEach((m, i) => (m.cp = (i < TOP_TEN ? 108 - i * 4 : 66 - (i - TOP_TEN) * 2) + randInt(l, -3, 3)));
  saveMasters(l, list);
}

export const masterLabel = (m: Master) => `【${m.e}】${m.n}`;
export const masterAt = (l: Life, place: number) => masters(l)[place - 1];

/** โอกาสชนะยอดฝีมือคนนี้ — ผ่าน fightOdds เพื่อให้สกิลเสริมทำงาน */
export const masterOdds = (l: Life, m: Master, mod = 0) => fightOdds(l, 0, -(m.cp - 10) / 40 + mod);
export const masterSurvival = (l: Life, m: Master, mod = 0) => clamp(survivalOdds(l, 0, -(m.cp - 10) / 40 + mod), 0.35, 0.99);

/** เป้าหมายที่ท้าได้: คนที่อยู่เหนือเราหนึ่งอันดับ (ยังไม่ติด = อันดับ 10) */
export function challengeTarget(l: Life): Master | undefined {
  const list = masters(l);
  const me = list.findIndex((m) => m.me);
  if (me === 0) return;
  return me < 0 ? list[list.length - 1] : list[me - 1];
}

function myEntry(l: Life): Master {
  const cls = l.power?.hunterClass ?? "m_sword";
  const pair = MY_EPITHET[cls] ?? MY_EPITHET.m_sword;
  if (!l.flags.m17Epithet) l.flags.m17Epithet = alignment(l) >= 0 ? pair[0] : pair[1];
  return { id: "me", n: displayName(l), e: String(l.flags.m17Epithet), a: l.age, cp: combatPower(l), me: true };
}

function markBest(l: Life) {
  const p = myPlace(l);
  if (p && (!wasRanked(l) || p < Number(l.flags.m17Best))) l.flags.m17Best = p;
  if (p === 1) l.flags.m17Top = true;
}

/** ผู้เล่นชนะ m แล้วขึ้นไปแทนที่ — คนแพ้ถูกดันลงหนึ่งอันดับ */
export function takePlace(l: Life, targetId: string): number {
  const list = masters(l).filter((m) => !m.me);
  const idx = list.findIndex((m) => m.id === targetId);
  if (idx < 0) return myPlace(l);
  list.splice(idx, 0, myEntry(l));
  saveMasters(l, list);
  markBest(l);
  return myPlace(l);
}

/** ตกอันดับ n ขั้น (หลุดทำเนียบถ้าตกเกินอันดับ 10) */
export function dropPlace(l: Life, n = 1): number {
  const list = masters(l);
  const i = list.findIndex((m) => m.me);
  if (i < 0) return 0;
  const [me] = list.splice(i, 1);
  const to = i + n;
  if (to >= RANK_SIZE) {
    // มีคนใหม่ขึ้นมาแทนที่ท้ายตาราง
    const last = list[list.length - 1];
    list.push(newMaster(l, (last?.cp ?? 72) - randInt(l, 0, 6)));
    saveMasters(l, list);
    return 0;
  }
  list.splice(to, 0, me);
  saveMasters(l, list);
  return to + 1;
}

/** ลบยอดฝีมือออกจากทำเนียบ (ตาย/เกษียณ) แล้วมีคนใหม่ขึ้นมา */
export function removeMaster(l: Life, id: string, news?: string) {
  const gone = masters(l).find((m) => m.id === id);
  const list = masters(l).filter((m) => m.id !== id);
  const npcs = list.filter((m) => !m.me);
  const floor = npcs[npcs.length - 1]?.cp ?? 56;
  // ผู้สืบทอดฝีมือใกล้เคียงคนที่จากไป — สิบยอดฝีมือไม่อ่อนลงเรื่อยๆ ตามท้ายตาราง
  list.push(newMaster(l, Math.max(floor, (gone?.cp ?? floor) + randInt(l, -12, 4)), randInt(l, 24, 42)));
  saveMasters(l, list);
  sortNpcs(l);
  if (news) addNews(l, news);
}

/** จัดลำดับ NPC ตามฝีมือ โดยไม่ขยับช่องของผู้เล่น (ผู้เล่นขยับได้ด้วยการประลองเท่านั้น) */
function sortNpcs(l: Life) {
  const list = masters(l);
  const me = list.findIndex((m) => m.me);
  const npcs = list.filter((m) => !m.me).sort((a, b) => b.cp - a.cp);
  if (me >= 0) npcs.splice(me, 0, list[me]);
  saveMasters(l, npcs);
}

const addNews = (l: Life, s: string) => {
  const prev = String(l.flags.m17News ?? "");
  l.flags.m17News = prev ? `${prev}|${s}` : s;
};

function rankingYear(l: Life) {
  initRanking(l);
  // เซฟเก่าที่มีแค่สิบอันดับ: เติมอันดับ 11–20 ที่ฝีมืออ่อนกว่า
  const old = masters(l);
  if (old.length < RANK_SIZE) {
    let cp = old.filter((m) => !m.me).slice(-1)[0]?.cp ?? 74;
    while (old.length < RANK_SIZE) { cp -= randInt(l, 1, 3); old.push(newMaster(l, Math.min(cp, 66 - (old.length - TOP_TEN) * 2))); }
    saveMasters(l, old);
  }
  const list = masters(l);
  const gone: Master[] = [];
  for (const m of list) {
    if (m.me) {
      m.a = l.age;
      if (l.power) m.cp = combatPower(l);
      m.n = displayName(l);
      continue;
    }
    m.a++;
    m.cp += m.a < 45 ? randInt(l, 0, 3) : m.a < 65 ? randInt(l, -1, 2) : randInt(l, -4, 0);
    const die = m.a > 68 ? (m.a - 68) * 0.025 : 0.01;
    if (chance(l, die)) gone.push(m);
    else if (m.a > 62 && chance(l, 0.05)) gone.push({ ...m, e: `${m.e}|retire` });
  }
  saveMasters(l, list);
  for (const g of gone) {
    const retire = g.e.endsWith("|retire");
    const label = masterLabel({ ...g, e: g.e.replace("|retire", "") });
    removeMaster(l, g.id, retire ? `${label} วางกระบี่เกษียณจากยุทธภพ` : `${label} สิ้นลมในวัย ${g.a} ปี`);
  }
  sortNpcs(l);
  // ฝีมือตกจนคนข้างล่างแซงหน้า
  const after = masters(l);
  const i = after.findIndex((m) => m.me);
  if (i >= 0) {
    const below = after[i + 1];
    if (below && below.cp > after[i].cp + 15 && chance(l, 0.5)) {
      const to = dropPlace(l, 1);
      addNews(l, to ? `${masterLabel(below)} แซงหน้าคุณขึ้นไปเป็นอันดับ ${i + 1}` : `คุณหลุดจากทำเนียบ — ${masterLabel(below)} ขึ้นมาแทน`);
    }
  }
  // ติดทำเนียบ = มีคนมาท้าประลองทั้งปี ฝีมือถูกขัดเกลาไม่หยุด
  if (myPlace(l) && l.power) gainExp(l, 200 + (RANK_SIZE - myPlace(l)) * 20);
  const news = String(l.flags.m17News ?? "");
  if (news) l.flags.m17NewsShown = news; // ให้ UI โชว์ข่าวล่าสุด
}

// ───────────────────────── มาตรธรรมะ / มาร ─────────────────────────

export const alignment = (l: Life) => Number(l.flags.m17Align ?? 0);

export function shiftAlign(l: Life, d: number): string {
  if (!d) return "";
  const before = alignment(l);
  const v = clamp(before + d, -100, 100);
  l.flags.m17Align = v;
  if (before > -60 && v <= -60) log(l, "ใต้หล้าเริ่มเรียกขานคุณว่า 'มาร' — ฝ่ายธรรมะทุกสำนักขึ้นบัญชีดำชื่อคุณ", "bad");
  if (before < 60 && v >= 60) log(l, "ชาวบ้านจุดธูปขอพรให้คุณ — ชื่อของคุณกลายเป็นคำว่า 'ธรรมะ' ในปากคน", "good");
  return d > 0 ? ` (ธรรมะ +${d})` : ` (มาร ${d})`;
}

export function alignLabel(v: number) {
  if (v >= 60) return "ธรรมะผู้ยิ่งใหญ่";
  if (v >= 20) return "ฝ่ายธรรมะ";
  if (v > -20) return "เทาๆ กลางๆ";
  if (v > -60) return "ฝ่ายอธรรม";
  return "จอมมาร";
}
export const righteous = (l: Life) => alignment(l) >= 20;
export const wicked = (l: Life) => alignment(l) <= -20;
export const demonicSect = (l: Life) => !!guildById(l.power?.guild)?.demonic;

function alignYear(l: Life) {
  if (l.flags.m17AlignInit === undefined && l.power) {
    l.flags.m17AlignInit = true;
    let base = alignment(l);
    if (l.power.hunterClass === "m_demon") base -= 20;
    if (demonicSect(l)) base -= 15;
    if (l.power.guild === "vajra" || l.power.guild === "cloud") base += 10;
    l.flags.m17Align = clamp(base, -100, 100);
  }
  if (demonicSect(l) && chance(l, 0.5)) l.flags.m17Align = clamp(alignment(l) - 1, -100, 100);
  if (l.power?.guild === "vajra" && chance(l, 0.5)) l.flags.m17Align = clamp(alignment(l) + 1, -100, 100);
}

// ───────────────────────── สมุดบุญคุณ / ความแค้น ─────────────────────────

export interface LedgerEntry {
  id: string;
  /** ชื่อ */
  n: string;
  /** f = เขาติดหนี้บุญคุณเรา · g = เราทำร้ายเขาไว้ */
  k: "f" | "g";
  /** เพราะอะไร */
  w: string;
  /** อายุตอนที่เกิด */
  a: number;
  /** ชำระแล้ว (ผลลัพธ์) */
  d?: string;
}

export const ledger = (l: Life): LedgerEntry[] => readJson<LedgerEntry[]>(l, "m17Ledger", []);
const saveLedger = (l: Life, list: LedgerEntry[]) => {
  // เก็บที่ยังค้างไว้ทั้งหมด + ประวัติที่ชำระแล้ว 6 รายการล่าสุด
  const open = list.filter((e) => !e.d);
  const done = list.filter((e) => e.d).slice(-6);
  writeJson(l, "m17Ledger", [...done, ...open].slice(-20));
};

function addEntry(l: Life, k: "f" | "g", n: string, w: string): string {
  const list = ledger(l);
  list.push({ id: uid(l), n, k, w, a: l.age });
  saveLedger(l, list);
  return k === "f" ? ` 📗 ${n}ติดหนี้บุญคุณคุณ` : ` 📕 ${n}จะจำเรื่องนี้ไปจนตาย`;
}
export const addFavor = (l: Life, n: string, why: string) => addEntry(l, "f", n, why);
export const addGrudge = (l: Life, n: string, why: string) => addEntry(l, "g", n, why);

export const openEntries = (l: Life, k: "f" | "g", minYears = 0) => ledger(l).filter((e) => e.k === k && !e.d && l.age - e.a >= minYears);
export const hasOpen = (l: Life, k: "f" | "g", minYears = 0) => openEntries(l, k, minYears).length > 0;

/** หยิบรายการที่ค้างไว้นานที่สุด (เรื่องเก่าย่อมกลับมาก่อน) */
export function oldestEntry(l: Life, k: "f" | "g", minYears = 0): LedgerEntry | undefined {
  return openEntries(l, k, minYears)[0];
}
export const entryById = (l: Life, id: unknown) => ledger(l).find((e) => e.id === String(id));

export function settle(l: Life, id: unknown, result: string) {
  const list = ledger(l);
  const e = list.find((x) => x.id === String(id));
  if (!e) return;
  e.d = result;
  saveLedger(l, list);
  if (e.k === "f") l.flags.m17Repaid = Number(l.flags.m17Repaid ?? 0) + 1;
  else l.flags.m17Grudges = Number(l.flags.m17Grudges ?? 0) + 1;
}

// ───────────────────────── สำนักของตัวเอง ─────────────────────────

export interface MySect {
  /** ชื่อสำนัก */
  n: string;
  /** อายุที่ก่อตั้ง */
  y: number;
  /** จำนวนศิษย์ */
  d: number;
  /** ชื่อเสียงสำนัก 0–100 */
  r: number;
  /** สำนักคู่อริ */
  rv: string;
  /** ความแข็งแกร่งของคู่อริ 0–100 */
  rr: number;
  /** ศิษย์เอก */
  h?: string;
  /** อาคาร (หอฝึก หอคัมภีร์ โรงยา คลังอาวุธ หอสอดแนม) */
  b?: string[];
  /** ขวัญกำลังใจของศิษย์ 0–100 */
  m?: number;
  /** กิจการของสำนัก (คุ้มภัย โรงเตี๊ยม ร้านยา) */
  biz?: string[];
}

export const SECT_MIN_RANK = 4;
export const SECT_MIN_AGE = 28;
export const SECT_COST = 2_000_000;

export const mySect = (l: Life): MySect | undefined => readJson<MySect | undefined>(l, "m17Sect", undefined);
export const saveSect = (l: Life, s: MySect) => writeJson(l, "m17Sect", s);

export function canFound(l: Life): string | undefined {
  if (!isMurim(l)) return "เฉพาะยุทธภพ";
  if (mySect(l)) return "คุณมีสำนักของตัวเองแล้ว";
  if (rankOf(l) < SECT_MIN_RANK) return "ต้องมีฝีมือถึงขั้นจุดสูงสุดก่อน — ไม่มีใครฝากตัวกับอาจารย์ที่ฝีมือยังไม่ถึง";
  if (l.age < SECT_MIN_AGE) return `ต้องอายุ ${SECT_MIN_AGE} ปีขึ้นไป — ไม่มีใครฝากตัวกับเจ้าสำนักที่อายุน้อยกว่าลูกศิษย์`;
  if (l.money < SECT_COST) return `ต้องมีเงินสร้างสำนัก ${money(l, SECT_COST)}`;
  return;
}

const PREFIX = ["เมฆา", "บุปผา", "พยัคฆ์", "มังกร", "จันทรา", "สายลม", "ศิลา", "เพลิง", "วารี", "หิมะ"];
const SUFFIX = ["เหินฟ้า", "ไร้เทียมทาน", "เก้าทิศ", "พันปี", "ทมิฬ", "สวรรค์", "ทองคำ", "หยกขาว"];
const RIVALS = ["สำนักดาบเหล็กเหนือ", "หอพยัคฆ์ทมิฬ", "สำนักกระบี่สองคม", "ตระกูลหลงแห่งเจียงหนาน", "สำนักฝ่ามือเหล็กไหล", "หอสังหารเงาแดง"];

export function sectNameOptions(l: Life): string[] {
  const a = `สำนัก${pick(l, PREFIX)}${pick(l, SUFFIX)}`;
  let b = `สำนัก${pick(l, PREFIX)}${pick(l, SUFFIX)}`;
  if (b === a) b = `หอ${pick(l, PREFIX)}${pick(l, SUFFIX)}`;
  return [a, b, `ตระกูล${l.lastName}แห่งยุทธภพ`];
}

export function foundSect(l: Life, rawName: string): string {
  const name = rawName.trim().slice(0, 30) || `สำนัก${l.lastName}`;
  addMoney(l, -SECT_COST);
  const sect: MySect = { n: name, y: l.age, d: randInt(l, 3, 8) + Math.max(0, Math.floor(l.fame / 10)), r: clamp(30 + Math.floor(l.fame / 3), 10, 80), rv: pick(l, RIVALS), rr: randInt(l, 35, 60) };
  saveSect(l, sect);
  if (l.power) l.power.guild = undefined;
  if (l.job?.careerId === "disciple") l.job = { careerId: "wanderer", level: Math.max(3, l.job.level), performance: 60, years: 0 };
  addFame(l, 10);
  addStat(l, "happiness", 15);
  l.flags.m17Founder = true;
  return `🏯 ป้ายชื่อ「${name}」ถูกแขวนขึ้นเหนือประตูไม้สน — ศิษย์รุ่นแรก ${sect.d} คนคุกเข่าคารวะคุณเป็นอาจารย์ (${sect.rv} ส่งคนมาแอบดูตั้งแต่วันแรก)`;
}

export function sectChange(l: Life, d: { d?: number; r?: number; rr?: number }): string {
  const s = mySect(l);
  if (!s) return "";
  s.d = Math.max(0, s.d + (d.d ?? 0));
  s.r = clamp(s.r + (d.r ?? 0), 0, 100);
  s.rr = clamp(s.rr + (d.rr ?? 0), 0, 100);
  saveSect(l, s);
  const parts: string[] = [];
  if (d.d) parts.push(`ศิษย์ ${d.d > 0 ? "+" : ""}${d.d}`);
  if (d.r) parts.push(`ชื่อเสียงสำนัก ${d.r > 0 ? "+" : ""}${d.r}`);
  return parts.length ? ` (${parts.join(" · ")})` : "";
}

function sectYear(l: Life) {
  const s = mySect(l);
  if (!s || !l.alive) return;
  const income = Math.round((s.d * 15_000 * (0.5 + s.r / 100)) / 1000) * 1000;
  if (income > 0) {
    addMoney(l, income);
    l.flags.income = Number(l.flags.income ?? 0) + income;
  }
  const cap = 10 + s.r * 3;
  const grow = s.d < cap ? randInt(l, -1, 2) + Math.floor(s.r / 34) : -randInt(l, 0, 2);
  s.d = Math.max(0, s.d + grow);
  s.r = clamp(s.r + (l.fame > s.r ? 1 : l.fame < s.r - 30 ? -1 : 0), 0, 100);
  s.rr = clamp(s.rr + randInt(l, -1, 2), 0, 100);
  saveSect(l, s);
  if (s.d >= 100) l.flags.m17BigSect = true;
  // สอนศิษย์ = ทบทวนวิชาตัวเอง
  if (l.power && !l.flags.m17Retired) gainExp(l, 120 + Math.min(s.d, 120) * 2);
}

// ───────────────────────── ทุกปี ─────────────────────────

yearHooks.push((l) => {
  if (!isMurim(l) || !l.alive) return;
  delete l.flags.m17News;
  rankingYear(l);
  alignYear(l);
  sectYear(l);
});

// ───────────────────────── ฉายา ─────────────────────────

TITLES.push(
  { id: "m17_ranked", name: "หนึ่งในสิบยอดฝีมือ", desc: "พลังต่อสู้ +2", bonus: "cp", value: 2, has: (l) => wasRanked(l) && Number(l.flags.m17Best) <= TOP_TEN },
  { id: "m17_first", name: "อันดับหนึ่งใต้หล้า", desc: "พลังต่อสู้ +4", bonus: "cp", value: 4, has: (l) => !!l.flags.m17Top },
  { id: "m17_saint", name: "ผู้ทรงธรรมแห่งยุทธภพ", desc: "อัตรารอด +4%", bonus: "survival", value: 0.04, has: (l) => isMurim(l) && alignment(l) >= 70 },
  { id: "m17_demon", name: "จอมมารเขย่าใต้หล้า", desc: "พลังต่อสู้ +3", bonus: "cp", value: 3, has: (l) => isMurim(l) && alignment(l) <= -70 },
  { id: "m17_founder", name: "ปรมาจารย์ผู้ก่อตั้ง", desc: "รายได้ +5%", bonus: "money", value: 0.05, has: (l) => !!l.flags.m17BigSect },
  { id: "m17_grateful", name: "ผู้หว่านเมล็ดบุญ", desc: "ความสุขเพิ่มทุกปี", bonus: "happiness", value: 2, has: (l) => Number(l.flags.m17Repaid ?? 0) >= 3 },
);

// ───────────────────────── ตัวช่วยเขียน event ─────────────────────────

export const good = (text: string, next?: string): Outcome => ({ text, kind: "good", next });
export const bad = (text: string, next?: string): Outcome => ({ text, kind: "bad", next });
export const meh = (text: string, next?: string): Outcome => ({ text, next });
export const sys = (text: string, next?: string): Outcome => ({ text, kind: "system", next });
export const big = (text: string): Outcome => ({ text, kind: "milestone" });

/** บาดเจ็บ — ตายถ้าสุขภาพหมด */
export function hurt(l: Life, min: number, max: number, cause: string): string {
  const d = randInt(l, min, max);
  addStat(l, "health", -d);
  if (l.stats.health <= 0) {
    kill(l, cause);
    return " …ร่างกายคุณทนไม่ไหวอีกต่อไป";
  }
  return ` (สุขภาพ -${d})` + woundFrom(l, d, cause);
}

/** ศัตรูทั่วไประดับเดียวกับเรา (ไม่มีวิชาใช้ร่างกายสู้) */
export const foeOdds = (l: Life, d = 0) => (l.power ? fightOdds(l, clamp(rankOf(l) + d, 0, 8)) : clamp(0.25 + (l.stats.health - 50) / 120, 0.05, 0.7));
export const foeSurvival = (l: Life, d = 0) => (l.power ? survivalOdds(l, clamp(rankOf(l) + d, 0, 8)) : clamp(0.6 + (l.stats.health - 50) / 150, 0.3, 0.9));

/** ยาเม็ดช่วยทะลวงขั้น (ให้เฉพาะผู้ที่ขั้นสูงพอจะใช้) — คืนข้อความต่อท้าย */
export function givePill(l: Life, minRank = 5): string {
  if (!l.power || l.power.rank < minRank) return "";
  l.power.items.push("ยาเม็ดเก้าหยาง");
  return " — แถม「ยาเม็ดเก้าหยาง」หนึ่งเม็ด";
}

/** ตายในฉากต่อสู้ถ้าดวงไม่ถึง — คืน true ถ้าตาย */
export function mayDie(l: Life, survival: number, cause: string): boolean {
  if (chance(l, survival)) return false;
  kill(l, cause);
  return true;
}
