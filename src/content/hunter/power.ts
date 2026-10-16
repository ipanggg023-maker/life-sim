import { chance, nextFloat, pick, weightedPick } from "../../engine/rng";
import type { HunterClass, Life, StatKey, WorldId } from "../../engine/types";
import { addFame, addMoney, addStat, clamp, log, money as fmtMoney } from "../../engine/util";
import { worldOf } from "../worlds";
import { titleBonus } from "../titles";
import { skillInfo, type SkillInfo } from "../skills";
import { sponsorBonus } from "../sponsors";

/** เพื่อนร่วมทีมที่ยังมีชีวิต (นับสูงสุด 3 คน) */
export const partySize = (life: Life) => Math.min(3, life.people.filter((p) => p.relation === "ally" && p.alive).length);

// ───────────────────────── แรงก์ ─────────────────────────

export const RANKS = ["F", "E", "D", "C", "B", "A", "S", "SS", "SSS"] as const;
export const rankName = (r: number) => RANKS[clamp(r, 0, RANKS.length - 1)];
export const MAX_RANK = RANKS.length - 1;
/** ชื่อแรงก์ตามโลก (ยุทธภพ = ขั้นยุทธ์) */
export const rankLabel = (life: Pick<Life, "worldId">, r: number) => worldOf(life.worldId).ranks[clamp(r, 0, MAX_RANK)];

// ───────────────────────── สายอาชีพ ─────────────────────────

export interface ClassInfo {
  id: HunterClass;
  name: string;
  emoji: string;
  key: StatKey;
  desc: string;
  /** สกิลที่ปลดล็อกตามเลเวล */
  skills: [number, string][];
  cp: number;
  survival: number;
  world?: WorldId;
}

export const CLASSES: ClassInfo[] = [
  {
    id: "sword", name: "นักดาบ", emoji: "⚔️", key: "health", desc: "บุกหน้า ดาเมจสูง", cp: 2, survival: 0,
    skills: [[1, "ฟันเสริมมานา"], [10, "ก้าวพริบตา"], [25, "ดาบพันใบ"], [45, "เจตจำนงดาบ"]],
  },
  {
    id: "mage", name: "นักเวท", emoji: "🔮", key: "smarts", desc: "เวทระยะไกล ทำลายล้างเป็นวงกว้าง", cp: 3, survival: -0.05,
    skills: [[1, "ลูกไฟ"], [10, "โล่มานา"], [25, "อุกกาบาตเพลิง"], [45, "พายุธาตุทั้งห้า"]],
  },
  {
    id: "healer", name: "ฮีลเลอร์", emoji: "✨", key: "smarts", desc: "รักษาตัวเองและทีม รอดง่าย สู้ไม่เก่ง", cp: -2, survival: 0.12,
    skills: [[1, "แสงเยียวยา"], [10, "พรคุ้มครอง"], [25, "ฟื้นคืนชีพฉุกเฉิน"], [45, "สวรรค์โปรด"]],
  },
  {
    id: "assassin", name: "นักลอบสังหาร", emoji: "🗡️", key: "luck", desc: "ซ่อนตัว จู่โจมจุดตาย", cp: 2, survival: 0.03,
    skills: [[1, "ซ่อนเร้น"], [10, "แทงจุดตาย"], [25, "ร่างเงา"], [45, "ราชันแห่งเงา"]],
  },
  {
    id: "tank", name: "แทงก์", emoji: "🛡️", key: "health", desc: "รับดาเมจแทนทีม ตายยาก", cp: 0, survival: 0.15,
    skills: [[1, "ยั่วยุ"], [10, "กำแพงเหล็ก"], [25, "ร่างไม่ล้ม"], [45, "ป้อมปราการมีชีวิต"]],
  },
  {
    id: "summoner", name: "ผู้อัญเชิญ", emoji: "👁️", key: "smarts", desc: "สายหายาก เรียกมอนสเตอร์มาสู้แทน", cp: 6, survival: 0.05,
    skills: [[1, "อัญเชิญหมาป่าเงา"], [10, "สัญญาวิญญาณ"], [25, "กองทัพอมตะ"], [45, "ประตูนรก"]],
  },
  // ── วิชาในยุทธภพ ──
  {
    id: "m_sword", name: "วิชากระบี่", emoji: "🗡️", key: "health", desc: "เพลงกระบี่รวดเร็วดุจสายลม", cp: 3, survival: 0, world: "murim",
    skills: [[1, "กระบี่ลมพัดใบไผ่"], [10, "กระบี่พันเงา"], [25, "ปราณกระบี่ทะลวงฟ้า"], [45, "กระบี่ไร้กระบี่"]],
  },
  {
    id: "m_palm", name: "วิชาฝ่ามือ", emoji: "✋", key: "smarts", desc: "ลมปราณหนักแน่น ฝ่ามือเดียวทลายหิน", cp: 2, survival: 0.05, world: "murim",
    skills: [[1, "ฝ่ามือพยัคฆ์คำราม"], [10, "ฝ่ามือสิบแปดมังกร"], [25, "ฝ่ามือหมื่นพุทธะ"], [45, "ฝ่ามือสวรรค์ถล่ม"]],
  },
  {
    id: "m_spear", name: "วิชาทวน", emoji: "🔱", key: "health", desc: "ทวนยาวทะลวงทัพ ห้าวหาญไม่ถอย", cp: 2, survival: 0.08, world: "murim",
    skills: [[1, "ทวนพายุหมุน"], [10, "ทวนมังกรทะยาน"], [25, "ทวนเจ็ดดาว"], [45, "ทวนเทพสงคราม"]],
  },
  {
    id: "m_hidden", name: "อาวุธลับ", emoji: "🎯", key: "luck", desc: "เข็มบินและมีดซัด สังหารก่อนศัตรูรู้ตัว", cp: 2, survival: 0.03, world: "murim",
    skills: [[1, "เข็มเงาเหมยฮวา"], [10, "พันมีดซัด"], [25, "ฝนพิรุณพิฆาต"], [45, "เงามรณะไร้รูป"]],
  },
  {
    id: "m_medic", name: "แพทย์ยุทธ์", emoji: "🌿", key: "smarts", desc: "ฝังเข็ม ปรุงยา รักษาได้ทั้งตัวเองและผู้อื่น", cp: -2, survival: 0.14, world: "murim",
    skills: [[1, "เข็มทองฟื้นชีพ"], [10, "ยาเม็ดเก้าหยาง"], [25, "สิบสองจุดชีพจร"], [45, "หัตถ์หมอเทวดา"]],
  },
  {
    id: "m_demon", name: "วิชามาร", emoji: "🩸", key: "luck", desc: "สายหายาก รุนแรงที่สุด แต่ทุกสำนักฝ่ายธรรมะจะตามล่า", cp: 7, survival: -0.04, world: "murim",
    skills: [[1, "ฝ่ามือโลหิตมาร"], [10, "ดูดพลังมาร"], [25, "ร่างอสูรฟ้า"], [45, "จักรพรรดิมารสวรรค์"]],
  },
  // ── สายเวทในราชสำนัก ──
  {
    id: "c_fire", name: "เวทธาตุไฟ", emoji: "🔥", key: "smarts", desc: "ทำลายล้างสูง เผาทุกอย่างที่ขวางหน้า", cp: 3, survival: -0.03, world: "court",
    skills: [[1, "ลูกไฟ"], [10, "กำแพงเพลิง"], [25, "ฝนอุกกาบาต"], [45, "เพลิงกัลป์"]],
  },
  {
    id: "c_ice", name: "เวทน้ำแข็ง", emoji: "❄️", key: "smarts", desc: "ควบคุมสนามรบ แช่แข็งศัตรู", cp: 2, survival: 0.05, world: "court",
    skills: [[1, "หอกน้ำแข็ง"], [10, "โล่หิมะ"], [25, "พายุหิมะนิรันดร์"], [45, "ราชินีน้ำแข็ง"]],
  },
  {
    id: "c_holy", name: "พลังศักดิ์สิทธิ์", emoji: "🕊️", key: "happiness", desc: "รักษาและปัดเป่าปีศาจ — สายของนักบุญ", cp: -1, survival: 0.15, world: "court",
    skills: [[1, "แสงเยียวยา"], [10, "ม่านศักดิ์สิทธิ์"], [25, "ปาฏิหาริย์"], [45, "นักบุญแห่งยุค"]],
  },
  {
    id: "c_aura", name: "ดาบออร่า", emoji: "⚔️", key: "health", desc: "ปลุกออร่าบนคมดาบ สายอัศวินผู้ยิ่งใหญ่", cp: 3, survival: 0.03, world: "court",
    skills: [[1, "ออร่าจาง"], [10, "ดาบออร่า"], [25, "ออร่าทะลวงฟ้า"], [45, "ปรมาจารย์ดาบ"]],
  },
  {
    id: "c_spirit", name: "ผู้ทำสัญญาภูต", emoji: "🧚", key: "luck", desc: "ทำสัญญากับภูตธาตุ หายากและคาดเดาไม่ได้", cp: 4, survival: 0.05, world: "court",
    skills: [[1, "ภูตลมน้อย"], [10, "ภูตไฟ"], [25, "ราชาภูต"], [45, "สัญญาแห่งโลกภูต"]],
  },
  {
    id: "c_dark", name: "เวทมืด", emoji: "🌑", key: "luck", desc: "สายต้องห้าม รุนแรงที่สุด แต่วิหารตามล่า", cp: 7, survival: -0.04, world: "court",
    skills: [[1, "เงาสาป"], [10, "กลืนวิญญาณ"], [25, "ประตูนรก"], [45, "จอมราชันย์ปีศาจ"]],
  },
  // ── ตำแหน่งในหอคอย ──
  {
    id: "t_vanguard", name: "หัวหอก", emoji: "⚔️", key: "health", desc: "บุกเปิดทางให้ทีม ปะทะทุกอย่างตรงหน้า", cp: 3, survival: 0, world: "tower",
    skills: [[1, "ทะลวงแนวหน้า"], [10, "ก้าวสายฟ้า"], [25, "หมัดพันชั้น"], [45, "ผู้ทะลวงยอดหอคอย"]],
  },
  {
    id: "t_lancer", name: "มือขว้างหอก", emoji: "🔱", key: "luck", desc: "ขว้างหอกพลังงานจากระยะไกล ชี้ขาดการต่อสู้ในนัดเดียว", cp: 4, survival: -0.03, world: "tower",
    skills: [[1, "หอกพลังงาน"], [10, "หอกนำวิถี"], [25, "ฝนหอก"], [45, "หอกทะลุมิติ"]],
  },
  {
    id: "t_lantern", name: "ผู้ถือโคม", emoji: "🏮", key: "smarts", desc: "โคมสอดแนมมองเห็นทั้งสนาม ทีมที่มีผู้ถือโคมตายยาก", cp: -1, survival: 0.12, world: "tower",
    skills: [[1, "โคมสอดแนม"], [10, "โคมคุ้มกัน"], [25, "เครือข่ายโคม"], [45, "ประภาคารแห่งหอคอย"]],
  },
  {
    id: "t_wave", name: "ผู้ควบคุมพลังงาน", emoji: "🌊", key: "smarts", desc: "บิดพลังงานในอากาศให้เป็นอาวุธหรือกำแพง", cp: 3, survival: 0.04, world: "tower",
    skills: [[1, "คลื่นพลังงาน"], [10, "เกราะพลังงาน"], [25, "ทะเลพลังงาน"], [45, "ผู้ปกครองพลังงาน"]],
  },
  {
    id: "t_scout", name: "หน่วยสอดแนม", emoji: "👣", key: "luck", desc: "หาเส้นทางลับและกับดักก่อนใคร ผ่านบททดสอบด้วยทางที่ไม่มีใครคิด", cp: 1, survival: 0.07, world: "tower",
    skills: [[1, "เดินไร้เสียง"], [10, "ตาเหยี่ยว"], [25, "เงาหลบหนี"], [45, "ผู้เห็นทุกเส้นทาง"]],
  },
  {
    id: "t_outsider", name: "ผู้บุกรุก", emoji: "🌀", key: "luck", desc: "สายหายาก — เข้าหอคอยโดยไม่ได้รับเชิญ กฎของหอคอยใช้กับคุณไม่ได้ทั้งหมด", cp: 7, survival: -0.03, world: "tower",
    skills: [[1, "ประตูต้องห้าม"], [10, "ฝ่ากฎหอคอย"], [25, "พลังจากภายนอก"], [45, "ผู้ทำลายหอคอย"]],
  },
];

export const classById = (id: HunterClass) => CLASSES.find((c) => c.id === id)!;

/** ขั้นของสกิล (0–3) = ตำแหน่งในสายอาชีพ · สกิลจากวาสนาที่ไม่อยู่ในสายไหนนับเป็นขั้นสูงสุด */
export function skillTier(name: string): number {
  for (const c of CLASSES) {
    const i = c.skills.findIndex(([, s]) => s === name);
    if (i >= 0) return i;
  }
  return 3;
}

export const skillsOf = (life: Life): SkillInfo[] => (life.power?.skills ?? []).map((s) => skillInfo(life, s, skillTier(s)));
const sumSkills = (life: Life, k: "cp" | "survival") => skillsOf(life).reduce((s, x) => s + x[k], 0);
/** โบนัสชั่วคราวระหว่างใช้สกิลในฉาก (ดู content/shared/skillUse.ts) */
const skillBoost = (life: Life) => Number(life.flags.skillBoost ?? 0);

// ───────────────────────── กิลด์ ─────────────────────────

export interface Guild {
  id: string;
  name: string;
  minRank: number;
  pay: number; // ตัวคูณรายได้
  cp: number;
  safety: number;
  desc: string;
  world?: WorldId;
  /** ฝ่ายมาร: ได้วิชามารง่าย แต่ฝ่ายธรรมะตามล่า */
  demonic?: boolean;
}

export const GUILDS: Guild[] = [
  { id: "rice", name: "กิลด์ข้าวมันไก่ประตูน้ำ", minRank: 0, pay: 1.1, cp: 1, safety: 0.03, desc: "กิลด์เล็กๆ ของลุงเจ้าของร้าน อบอุ่นแต่จน" },
  { id: "moon", name: "กิลด์เงาจันทร์", minRank: 2, pay: 1.8, cp: 2, safety: -0.05, desc: "จ่ายดีมาก แต่ข่าวลือเรื่องงานใต้ดินไม่เคยหายไป" },
  { id: "tiger", name: "กิลด์พยัคฆ์ขาว", minRank: 3, pay: 1.5, cp: 3, safety: 0.06, desc: "กิลด์ใหญ่อันดับ 3 ของประเทศ ระบบดี" },
  { id: "naga", name: "กิลด์นาคราช", minRank: 4, pay: 2.2, cp: 5, safety: 0.08, desc: "กิลด์อันดับ 2 เชี่ยวชาญ Gate ใต้น้ำ" },
  { id: "lion", name: "กิลด์ราชสีห์ทองคำ", minRank: 5, pay: 3, cp: 7, safety: 0.1, desc: "กิลด์อันดับ 1 ของประเทศ มีแรงก์ S สามคน" },
  // ── สำนักในยุทธภพ (สมมติขึ้นทั้งหมด) ──
  { id: "beggar", name: "พรรคกระยาจก", minRank: 0, pay: 0.8, cp: 2, safety: 0.05, world: "murim", desc: "รับทุกคน ข่าวสารไวที่สุดในใต้หล้า แต่จนกรอบ" },
  { id: "cloud", name: "สำนักกระบี่เมฆา", minRank: 1, pay: 1.3, cp: 3, safety: 0.05, world: "murim", desc: "สำนักฝ่ายธรรมะบนยอดเขา เข้มงวดเรื่องกฎ" },
  { id: "tang", name: "ตระกูลถังเรือนพิษ", minRank: 2, pay: 1.8, cp: 3, safety: 0.02, world: "murim", desc: "เชี่ยวชาญพิษและอาวุธลับ คนนอกเข้ายาก" },
  { id: "vajra", name: "วัดวัชระ", minRank: 3, pay: 1.2, cp: 5, safety: 0.12, world: "murim", desc: "สำนักพุทธที่เก่าแก่ที่สุด ศิษย์ตายยาก" },
  { id: "cult", name: "ลัทธิมารสวรรค์", minRank: 2, pay: 2.5, cp: 6, safety: -0.06, world: "murim", demonic: true, desc: "ฝ่ายอธรรม จ่ายหนัก ฆ่าไม่เลือก ทั้งใต้หล้าเกลียดชัง" },
  // ── สังกัดในราชสำนัก ──
  { id: "c_knights", name: "อัศวินแห่งจักรวรรดิ", minRank: 0, pay: 1.1, cp: 2, safety: 0.06, world: "court", desc: "ทหารรักษาดินแดน ภักดีต่อบัลลังก์ เกียรติยศสูงแต่เงินน้อย" },
  { id: "c_tower", name: "หอคอยเวทเงิน", minRank: 1, pay: 1.6, cp: 3, safety: 0.04, world: "court", desc: "ที่รวมจอมเวทผู้ปราดเปรื่อง หมกมุ่นกับงานวิจัย" },
  { id: "c_temple", name: "วิหารศักดิ์สิทธิ์", minRank: 1, pay: 1.2, cp: 2, safety: 0.12, world: "court", desc: "ศูนย์กลางศรัทธา มีอิทธิพลไม่แพ้ราชวงศ์" },
  { id: "c_north", name: "กองอัศวินดยุกแห่งทิศเหนือ", minRank: 3, pay: 2, cp: 5, safety: 0.05, world: "court", desc: "ปกป้องชายแดนจากฝูงมอนสเตอร์ ดยุกเย็นชาที่สุดในจักรวรรดิ" },
  { id: "c_shadow", name: "สมาคมจอมเวทมืด", minRank: 2, pay: 2.4, cp: 6, safety: -0.05, world: "court", demonic: true, desc: "เวทต้องห้าม ถ้าวิหารรู้ จะถูกเผาทั้งเป็น" },
  { id: "c_guard", name: "หน่วยองครักษ์จักรพรรดิ", minRank: 5, pay: 3, cp: 8, safety: 0.1, world: "court", desc: "ยอดฝีมือที่ใกล้ชิดบัลลังก์ที่สุด" },
  // ── ทีมในหอคอย ──
  { id: "t_rookie", name: "ทีมผู้ท้าชิงหน้าใหม่", minRank: 0, pay: 1, cp: 2, safety: 0.05, world: "tower", desc: "ทีมรวมคนแปลกหน้าที่เพิ่งเข้าหอคอย ไม่มีใครเก่ง แต่ทุกคนจริงใจ" },
  { id: "t_hawk", name: "กิลด์เหยี่ยวเงิน", minRank: 2, pay: 1.6, cp: 3, safety: 0.05, world: "tower", desc: "กิลด์ที่ปีนเร็วที่สุดในรุ่น มีสปอนเซอร์จากโลกภายนอกหนุนหลัง" },
  { id: "t_pk", name: "กลุ่มล่าผู้ท้าชิง", minRank: 2, pay: 2.4, cp: 6, safety: -0.06, world: "tower", demonic: true, desc: "ฆ่าผู้ท้าชิงคนอื่นเพื่อชิงคะแนน — หอคอยไม่ห้าม แต่ทุกคนเกลียด" },
  { id: "t_family", name: "ตระกูลผู้ปกครองชั้นบน", minRank: 4, pay: 2.2, cp: 6, safety: 0.1, world: "tower", desc: "ตระกูลเก่าแก่ที่อยู่ในหอคอยมาหลายร้อยปี รับคนนอกยากมาก" },
  { id: "t_summit", name: "สมาพันธ์ผู้มุ่งยอดหอคอย", minRank: 5, pay: 3, cp: 8, safety: 0.1, world: "tower", desc: "รวมผู้ท้าชิงที่เก่งที่สุดจากทุกประเทศ มีเป้าหมายเดียวคือชั้น 100" },
  { id: "alliance", name: "พันธมิตรยุทธจักร", minRank: 5, pay: 3, cp: 8, safety: 0.1, world: "murim", desc: "รวมยอดฝีมือฝ่ายธรรมะ เป็นเหมือนรัฐบาลของยุทธภพ" },
];

export const guildById = (id?: string) => GUILDS.find((g) => g.id === id);
export const guildsFor = (life: Pick<Life, "worldId">) => GUILDS.filter((g) => (g.world ?? "hunter") === life.worldId);

// ───────────────────────── ประเภท Gate ─────────────────────────

export const GATE_TYPES = [
  { name: "ป่ามืด", desc: "ต้นไม้สูงเสียดฟ้า แสงลอดลงมาไม่ถึงพื้น", monsters: ["หมาป่าเงา", "ก็อบลินหัวหน้าเผ่า", "ทรีแอนต์เน่า"] },
  { name: "ถ้ำน้ำแข็ง", desc: "ลมหายใจกลายเป็นไอขาวทันทีที่ก้าวเข้าไป", monsters: ["หมีน้ำแข็ง", "เอลฟ์น้ำแข็ง", "ไวเวิร์นหิมะ"] },
  { name: "สุสานโบราณ", desc: "โครงกระดูกเรียงรายอยู่สองข้างทาง บางตัวขยับได้", monsters: ["อัศวินโครงกระดูก", "ลิชผู้หลับใหล", "ราชาศพ"] },
  { name: "ปราสาทใต้ดิน", desc: "ทางเดินหินวกวน ได้ยินเสียงโซ่ลากมาจากที่ไหนสักแห่ง", monsters: ["ออร์กผู้คุม", "แวมไพร์ขุนนาง", "อัศวินนรก"] },
  { name: "หนองน้ำพิษ", desc: "หมอกสีเขียวลอยต่ำ กลิ่นเหมือนไข่เน่าผสมเหล็ก", monsters: ["งูยักษ์สามหัว", "ลิซาร์ดแมนนักรบ", "ราชินีแมงมุม"] },
  { name: "เมืองร้าง", desc: "เมืองที่ถูกทิ้งไว้ครึ่งทาง ป้ายร้านยังเป็นภาษาที่ไม่มีใครรู้จัก", monsters: ["การ์กอยล์", "โกเลมหิน", "ปีศาจหน้ากาก"] },
] as const;

// ───────────────────────── การคำนวณ ─────────────────────────

/** ระยะห่างระดับพลังต่อแรงก์ — 1 แรงก์ ≈ 12 แต้ม */
const RANK_STEP = 12;

export function combatPower(life: Life): number {
  const p = life.power;
  if (!p) return 0;
  const cls = classById(p.hunterClass);
  const g = guildById(p.guild);
  return Math.round(
    p.rank * RANK_STEP + p.level * 0.8 + life.stats[cls.key] * 0.15 + sumSkills(life, "cp") + cls.cp + (g?.cp ?? 0) + p.items.length + partySize(life) * 2 + titleBonus(life, "cp") + sponsorBonus(life, "cp"),
  );
}

export const gatePower = (gateRank: number) => gateRank * RANK_STEP + 10;

export function fightOdds(life: Life, gateRank: number, mod = 0) {
  return clamp(0.5 + (combatPower(life) - gatePower(gateRank)) / 40 + mod + skillBoost(life), 0.03, 0.97);
}

export function survivalOdds(life: Life, gateRank: number, mod = 0) {
  const p = life.power;
  const cls = p ? classById(p.hunterClass) : undefined;
  const g = guildById(p?.guild);
  return clamp(fightOdds(life, gateRank, mod) + 0.3 + (cls?.survival ?? 0) + (g?.safety ?? 0) + (life.stats.health - 50) / 300 + partySize(life) * 0.03 + titleBonus(life, "survival") + sponsorBonus(life, "survival") + sumSkills(life, "survival"), 0.05, 0.99);
}

export const expToNext = (level: number) => 60 + level * 40;

/** ผลตอบแทนพื้นฐานของ Gate แต่ละแรงก์ */
export const GATE_PAY = [30_000, 80_000, 200_000, 600_000, 2_000_000, 8_000_000, 40_000_000, 150_000_000, 500_000_000];

/** เงินเดือนประจำจากสมาคม/กิลด์ ตามแรงก์ */
export const RETAINER = [60_000, 120_000, 300_000, 800_000, 2_000_000, 6_000_000, 20_000_000, 60_000_000, 150_000_000];

// ───────────────────────── พรสวรรค์สายพลัง ─────────────────────────

/** โบนัสแรงก์ตอนตื่นพลัง (นับแม้ยังไม่เปิดช่องลับ เพราะพลังมาจากตัวพรสวรรค์เอง) */
const RANK_BONUS: Record<string, number> = { mana_heart: 1, dragon_blood: 2, cursed_body: 3 };
export const POWER_TALENTS = ["mana_heart", "late_bloomer", "dragon_blood", "cursed_body", "system_user"];

export const owns = (life: Life, id: string) => life.talents.some((t) => t.id === id);
const ownsActive = (life: Life, id: string) => life.talents.some((t) => t.id === id && t.revealed);

// ───────────────────────── เส้นทางการตื่นพลัง ─────────────────────────

export type AwakenTrack = "early" | "normal" | "late" | "never";
export const trackOf = (life: Life): AwakenTrack => (life.flags.awakenTrack as AwakenTrack | undefined) ?? "normal";

/**
 * ตั้งตอนเกิด: ตื่นเร็ว 5% · ปกติ 70% · ตื่นช้า 15% · ไม่ตื่น 10%
 * มีพรสวรรค์สายพลังจะไม่ตกช่อง "ไม่ตื่น"
 */
export function rollAwakenTrack(life: Life) {
  const w = worldOf(life.worldId);
  const powerTalent = POWER_TALENTS.some((id) => owns(life, id));
  const track = weightedPick(life, ["early", "normal", "late", "never"] as AwakenTrack[], (t) =>
    ({ early: 5, normal: 70, late: 15, never: powerTalent ? 0 : 10 })[t],
  )!;
  life.flags.awakenTrack = track;
  const [lo, hi] = track === "early" ? w.awakenEarly : track === "late" ? w.awakenLate : w.awakenAge;
  life.flags.awakenAge = lo + Math.floor(nextFloat(life) * (hi - lo + 1));
  // พิธีคัดเลือก/ตรวจพลังของโลกนั้นจัดตามอายุปกติเสมอ
  life.flags.ceremonyAge = w.awakenAge[0] + Math.floor(nextFloat(life) * (w.awakenAge[1] - w.awakenAge[0] + 1));
  // อายุของ "จุดพลิกที่การันตี" ถ้าถึงตอนนั้นแล้วชีวิตยังไม่เคยพลิก
  life.flags.tpAge = 22 + Math.floor(nextFloat(life) * 17);
}

/** ผลพิธีตรวจพลังที่ "ยังไม่ตื่น": ช่องไม่ตื่นจบแค่นั้น ส่วนตื่นช้ายังรอวันของตัวเอง */
export function settleNone(life: Life) {
  if (trackOf(life) === "never") life.flags.awakenDone = true;
  else life.flags.notYet = true;
}

/** สุ่มผลการตื่นพลัง: -1 = ไม่ตื่น */
export function rollAwakening(life: Life, bonus: number): number {
  const talentBonus = Object.entries(RANK_BONUS).reduce((s, [id, b]) => s + (owns(life, id) ? b : 0), 0);
  const track = trackOf(life);
  // ช่อง "ไม่ตื่น" — แต่ตัวกระตุ้น/วาสนาส่ง bonus มาเพื่อฝ่าชะตาได้
  if (track === "never" && bonus < 2 && !life.flags.forceAwaken) return -1;
  // ผู้ใช้ระบบ / ผู้ตื่นช้า เริ่มจาก F เสมอ (บวกโบนัสจากพรสวรรค์อื่นถ้ามี) — แล้วค่อยโต
  if (owns(life, "system_user") || owns(life, "late_bloomer")) return talentBonus;
  const outcomes = [0, 1, 2, 3, 4, 5, 6, 7, 8];
  // F … SSS — SSS ตั้งแต่ตื่นเป็นของหายากที่สุด
  const base = [22, 19, 14, 10, 6, 3.5, 1.2, 0.35, 0.15];
  const luck = 1 + (life.stats.luck - 50) / 80;
  const r = weightedPick(life, outcomes, (o) => (o >= 2 ? base[o] * Math.max(0.3, luck) : base[o]))!;
  const trackBonus = track === "early" ? 1 : track === "late" ? -1 : 0;
  return clamp(r + bonus + talentBonus + trackBonus, 0, MAX_RANK);
}

/** เสนอสายอาชีพ 2–3 สายตามสเตตัสเด่น */
export function offerClasses(life: Life): HunterClass[] {
  const byWorld: Record<WorldId, { map: Record<StatKey, HunterClass[]>; fallback: HunterClass; rare: HunterClass }> = {
    hunter: {
      map: { health: ["sword", "tank"], smarts: ["mage", "healer"], luck: ["assassin"], looks: ["healer", "assassin"], happiness: ["healer"] },
      fallback: "sword",
      rare: "summoner",
    },
    murim: {
      map: { health: ["m_sword", "m_spear"], smarts: ["m_palm", "m_medic"], luck: ["m_hidden"], looks: ["m_medic", "m_hidden"], happiness: ["m_medic"] },
      fallback: "m_sword",
      rare: "m_demon",
    },
    tower: {
      map: { health: ["t_vanguard"], smarts: ["t_wave", "t_lantern"], luck: ["t_lancer", "t_scout"], looks: ["t_lantern", "t_lancer"], happiness: ["t_lantern"] },
      fallback: "t_vanguard",
      rare: "t_outsider",
    },
    court: {
      map: { health: ["c_aura"], smarts: ["c_fire", "c_ice"], luck: ["c_spirit"], looks: ["c_holy", "c_ice"], happiness: ["c_holy"] },
      fallback: "c_aura",
      rare: "c_dark",
    },
  };
  const w = byWorld[life.worldId ?? "hunter"];
  const keys = (["health", "smarts", "luck", "looks"] as StatKey[]).sort((a, b) => life.stats[b] - life.stats[a]);
  const offer = new Set<HunterClass>();
  offer.add(pick(life, w.map[keys[0]]));
  for (const c of w.map[keys[1]]) if (offer.size < 2 && !offer.has(c)) offer.add(c);
  if (offer.size < 2) offer.add(w.fallback);
  if (life.stats.luck >= 70 || owns(life, "system_user") || chance(life, 0.05)) offer.add(w.rare);
  return [...offer];
}

export function awaken(life: Life, rank: number, cls: HunterClass) {
  const info = classById(cls);
  life.power = {
    rank,
    hunterClass: cls,
    level: 1,
    exp: 0,
    skills: [info.skills[0][1]],
    gates: 0,
    bossKills: 0,
    awakenedAt: life.age,
    items: [],
  };
  life.flags.awakenDone = true;
  delete life.flags.notYet;
  if (life.worldId === "tower" && !life.flags.floor) life.flags.floor = 1; // เริ่มที่ชั้น 1
  addFame(life, rank >= 8 ? 50 : rank >= 5 ? 25 : rank >= 3 ? 8 : 1);
  addStat(life, "happiness", rank >= 3 ? 20 : 8);
  const track = trackOf(life);
  // ตื่นช้ากว่าคนอื่น แต่โตเร็วกว่า
  if (track === "late" || track === "never" || life.age > worldOf(life.worldId).awakenAge[1]) life.flags.lateBloom = true;
  if (track !== "normal" || life.age !== Number(life.flags.awakenAge)) markTurn(life);
  // วัดแรงก์ผิด: ตัวจริงสูงกว่าที่เครื่องวัดบอกมาก
  if (rank < 5 && chance(life, 0.03)) life.flags.trueRank = Math.min(MAX_RANK, rank + 3 + Math.floor(nextFloat(life) * 3));
  if (rank >= 8) life.flags.sssAwakened = true;
}

/**
 * เลื่อนแรงก์จากวาสนา/ชะตา/เหตุการณ์ — มีเพดานอ่อน: ยิ่งสูงยิ่งยาก ไม่งั้น SSS จะเกลื่อน
 * ไม่ผ่านเพดานก็ยังได้ EXP ก้อนใหญ่แทน
 */
export function luckyRankUp(life: Life, reason: string, steps = 1) {
  const r = life.power?.rank ?? 0;
  const p = r >= 7 ? 0.15 : r >= 6 ? 0.35 : r >= 5 ? 0.6 : 1;
  if (chance(life, p)) {
    rankUp(life, reason, r >= 5 ? 1 : steps);
    return;
  }
  gainExp(life, 800);
  log(life, `${reason} — พลังยังไม่ข้ามขั้น แต่ความเข้าใจลึกซึ้งขึ้นมาก`, "system");
}

/** จุดพลิกของชีวิตเกิดขึ้นแล้ว (ใช้กับการการันตีจุดพลิก) */
export function markTurn(life: Life) {
  life.flags.turnDone = true;
}

export function rankUp(life: Life, reason: string, steps = 1) {
  const p = life.power;
  if (!p || p.rank >= MAX_RANK) return;
  p.rank = Math.min(MAX_RANK, p.rank + steps);
  addFame(life, p.rank >= 6 ? 15 : 5);
  log(life, `${reason} — ${worldOf(life.worldId).labels.rank}เพิ่มขึ้นเป็น 【${rankLabel(life, p.rank)}】`, "system");
}

function levelUp(life: Life) {
  const p = life.power!;
  p.level++;
  const cls = classById(p.hunterClass);
  if (chance(life, 0.6)) addStat(life, cls.key, 1);
  for (const [lv, skill] of cls.skills) {
    if (lv === p.level && !p.skills.includes(skill)) {
      p.skills.push(skill);
      log(life, `สกิลใหม่ปลดล็อก: 「${skill}」`, "system");
    }
  }
  if (ownsActive(life, "system_user") && p.level % 10 === 0) {
    rankUp(life, "[ระบบ] ครบเงื่อนไขการเลื่อนขั้น");
  } else if (ownsActive(life, "late_bloomer") && p.level % 10 === 0 && p.rank < 6) {
    rankUp(life, "พลังที่หลับใหลตื่นขึ้นอีกขั้น");
  } else if (life.worldId !== "murim" && p.level % 15 === 0 && p.rank < 6 && chance(life, 0.12)) {
    // ยุทธภพเลื่อนขั้นผ่านตอนพิเศษ "ทะลวงขั้น" แทน
    rankUp(life, "คุณทะลวงขีดจำกัดของตัวเอง");
  }
}

export function gainExp(life: Life, amount: number) {
  const p = life.power;
  if (!p) return;
  // ตื่นช้าโตเร็ว · ความรู้วิธีฝึกจากชาติก่อน · สัญญากับสิ่งเหนือธรรมชาติ
  const mult = (life.flags.lateBloom ? 1.4 : 1) * (life.flags.knowsMethod ? 1.25 : 1) * (life.flags.pact ? 1.2 : 1) * (1 + titleBonus(life, "exp") + sponsorBonus(life, "exp"));
  p.exp += Math.round(amount * mult);
  const before = p.level;
  while (p.exp >= expToNext(p.level)) {
    p.exp -= expToNext(p.level);
    levelUp(life);
  }
  if (p.level > before) log(life, `เลเวลอัป! Lv.${before} → Lv.${p.level}`, "system");
}

/** แจกรางวัลจาก Gate และคืนข้อความสรุป */
export function gateRewards(life: Life, rawRank: number, mult: number, boss: boolean): string {
  const gateRank = clamp(rawRank, 0, GATE_PAY.length - 1); // บาง event ใช้ "แรงก์ตัวเอง + 1" ซึ่งเกิน SSS ได้
  const p = life.power!;
  const g = guildById(p.guild);
  // กิลด์หักส่วนแบ่ง แต่ได้ภารกิจที่จ่ายดีกว่า
  const money = Math.round((GATE_PAY[gateRank] * mult * (0.6 + nextFloat(life) * 0.8) * (g ? g.pay * 0.8 : 1)) / 1000) * 1000;
  const exp = Math.pow(gateRank + 1, 1.5) * 60 * mult * (boss ? 1.5 : 1);
  addMoney(life, money);
  p.gates++;
  if (boss) p.bossKills++;
  if (life.job?.careerId === "hunter") life.job.performance = clamp(life.job.performance + (boss ? 8 : 4), 0, 100);
  gainExp(life, exp);
  return `ได้ค่าตอบแทน ${fmtMoney(life, money)} และ EXP ${Math.round(exp)}`;
}
