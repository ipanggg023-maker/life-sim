import type { Life, Rarity, StatKey } from "../engine/types";
import { MORE_TALENTS, type TalentFx } from "./talentsMore";

// ไม่ import engine/util (util → passives → talents) — บวกค่าสถานะเองแบบจำกัด 0–100
const addStat = (l: Life, k: StatKey, v: number) => { l.stats[k] = Math.max(0, Math.min(100, Math.round(l.stats[k] + v))); };

export interface Talent extends TalentFx {
  id: string;
  name: string;
  rarity: Rarity;
  desc: string;
  /** ทำงานครั้งเดียวตอนพรสวรรค์ถูกเปิดเผย */
  apply?: (life: Life) => void;
  /** สายพลัง: สุ่มได้เฉพาะช่องลับ ??? และออกฤทธิ์ตอนตื่นพลัง */
  power?: boolean;
  /** พรสวรรค์ของยุทธภพ (สุ่มได้เฉพาะในยุทธภพ) */
  world?: "murim";
  /** ผลต่อระบบยุทธภพ (murim/life/gifts.ts) เช่น qi 0.25 = ลมปราณสะสมเร็วขึ้น 25% */
  mx?: Partial<Record<string, number>>;
  /** ไม่สุ่มตอนเกิด (ร่างที่วิวัฒน์แล้วของพรสวรรค์ยุทธภพ) */
  noRoll?: boolean;
}

/**
 * พรสวรรค์ที่ไม่มี apply จะถูกเช็กด้วย hasTalent() ในระบบที่เกี่ยวข้อง
 * สายพลัง: โบนัสแรงก์อยู่ใน content/hunter/power.ts (RANK_BONUS)
 */
export const TALENTS: Talent[] = [
  // ── สายพลัง (ช่องลับเท่านั้น) ──
  { id: "mana_heart", name: "หัวใจมานา", rarity: "rare", power: true, desc: "แรงก์ตอนตื่นพลัง +1 และตื่นพลังแน่นอน" },
  { id: "late_bloomer", name: "ผู้ตื่นช้า", rarity: "rare", power: true, desc: "ตื่นพลังที่แรงก์ F เสมอ แต่แรงก์เพิ่มทุก 10 เลเวล (สูงสุด S)" },
  { id: "dragon_blood", name: "สายเลือดมังกร", rarity: "legendary", power: true, desc: "แรงก์ตอนตื่นพลัง +2 สุขภาพ +15", apply: (l) => addStat(l, "health", 15) },
  {
    id: "cursed_body",
    name: "ร่างกายต้องคำสาป",
    rarity: "legendary",
    power: true,
    desc: "แรงก์ตอนตื่นพลัง +3 แต่หลังอายุ 30 ร่างกายจะทรุดลงอย่างรวดเร็ว (ดาบสองคม)",
  },
  {
    id: "system_user",
    name: "หน้าต่างระบบส่วนตัว",
    rarity: "divine",
    power: true,
    desc: "เริ่มที่แรงก์ F แต่มีภารกิจรายวัน และแรงก์เพิ่มทุก 10 เลเวลจนถึง SSS",
  },
  // ── ธรรมดา ──
  { id: "sturdy", name: "ร่างกายแข็งแรง", rarity: "common", desc: "สุขภาพ +10 และเสื่อมช้ากว่าคนอื่น", apply: (l) => addStat(l, "health", 10) },
  { id: "memory", name: "ความจำดี", rarity: "common", desc: "สติปัญญา +10", apply: (l) => addStat(l, "smarts", 10) },
  { id: "cute", name: "หน้าตาน่ารัก", rarity: "common", desc: "รูปลักษณ์ +10", apply: (l) => addStat(l, "looks", 10) },
  { id: "optimist", name: "มองโลกในแง่ดี", rarity: "common", desc: "ความสุข +10 และเศร้าน้อยลง", apply: (l) => addStat(l, "happiness", 10) },
  { id: "sweettalk", name: "ปากหวาน", rarity: "common", desc: "ความสัมพันธ์เพิ่มขึ้นเร็วกว่าปกติ" },
  { id: "diligent", name: "ขยันโดยสันดาน", rarity: "common", desc: "ผลงานในที่ทำงานและที่เรียนเพิ่มเร็วขึ้น" },
  // ── หายาก ──
  { id: "genius", name: "อัจฉริยะ", rarity: "rare", desc: "สติปัญญา +25", apply: (l) => addStat(l, "smarts", 25) },
  { id: "charm", name: "เสน่ห์ล้นเหลือ", rarity: "rare", desc: "รูปลักษณ์ +20 จีบใครก็ติดง่าย", apply: (l) => addStat(l, "looks", 20) },
  { id: "lucky", name: "ดวงเฮง", rarity: "rare", desc: "โชค +25", apply: (l) => addStat(l, "luck", 25) },
  { id: "athlete", name: "เกิดมาเพื่อกีฬา", rarity: "rare", desc: "สุขภาพ +20", apply: (l) => addStat(l, "health", 20) },
  { id: "merchant", name: "พ่อค้าโดยกำเนิด", rarity: "rare", desc: "รายได้ทุกอาชีพ +25%" },
  // ── ตำนาน ──
  { id: "heaven_child", name: "ลูกรักของสวรรค์", rarity: "legendary", desc: "โชค +45 เรื่องร้ายมักพลิกเป็นดี", apply: (l) => addStat(l, "luck", 45) },
  { id: "protagonist_face", name: "หน้าตาระดับพระเอก/นางเอก", rarity: "legendary", desc: "รูปลักษณ์เกือบเต็ม และไม่ค่อยแก่", apply: (l) => { l.stats.looks = Math.max(l.stats.looks, 92); } },
  {
    id: "tragic_genius",
    name: "อัจฉริยะผู้อาภัพ",
    rarity: "legendary",
    desc: "สติปัญญาเกือบเต็ม แต่ร่างกายอ่อนแอมาก (ดาบสองคม)",
    apply: (l) => { l.stats.smarts = Math.max(l.stats.smarts, 95); addStat(l, "health", -35); },
  },
  // ── ศักดิ์สิทธิ์ ──
  {
    id: "golden_spoon",
    name: "คาบช้อนเพชรมาเกิด",
    rarity: "divine",
    desc: "ครอบครัวรวยที่สุดในประเทศ และทุกคนรักคุณ",
    apply: (l) => { l.wealth = "elite"; addStat(l, "happiness", 20); },
  },
];

// ชุดใหม่: ค่าสถานะตอนเปิดเผย (s) รวมเข้ากับ apply
for (const t of MORE_TALENTS) {
  const extra = t.apply;
  TALENTS.push({ ...t, apply: (l) => { for (const [k, v] of Object.entries(t.s ?? {})) addStat(l, k as StatKey, v); extra?.(l); } });
}

export const talentById = (id: string) => TALENTS.find((t) => t.id === id);
/** คำบรรยายแบบเรื่องเล่า (ตัดตัวเลขกลไกท้ายประโยคออก) — ใช้ในโลกสมจริง */
export const talentFlavor = (desc: string) => desc.split(" — ")[0];
/** พรสวรรค์ที่เปิดเผยแล้ว (ใช้คิดโบนัส) */
export const activeTalents = (l: Life): Talent[] => l.talents.filter((x) => x.revealed).map((x) => talentById(x.id)).filter((t): t is Talent => !!t);

export const RARITY_ODDS: Record<Rarity, number> = {
  common: 0.6,
  rare: 0.3,
  legendary: 0.09,
  divine: 0.01,
  /** หนึ่งเดียวในโลก — ยากที่สุดแต่ไม่ใช่ศูนย์ */
  mythic: 0.0002,
};

/** ช่องลับ ??? มีโอกาสได้ของหายากสูงกว่าปกติ */
export const HIDDEN_RARITY_ODDS: Record<Rarity, number> = {
  common: 0.3,
  rare: 0.45,
  legendary: 0.2,
  divine: 0.05,
  mythic: 0.0008,
};

export const RARITY_LABEL: Record<Rarity, string> = {
  common: "ธรรมดา",
  rare: "หายาก",
  legendary: "ตำนาน",
  divine: "ศักดิ์สิทธิ์",
  mythic: "หนึ่งเดียวในโลก",
};
