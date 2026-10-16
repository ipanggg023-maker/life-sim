import type { Wealth, WorldId } from "../engine/types";
import { FEMALE_NAMES, LAST_NAMES, MALE_NAMES, NICKNAMES_F, NICKNAMES_M } from "./hunter/names";
import { MURIM_FEMALE, MURIM_LAST, MURIM_MALE, MURIM_NICK_F, MURIM_NICK_M } from "./murim/names";
import { COURT_FEMALE, COURT_LAST, COURT_MALE, COURT_NICK_F, COURT_NICK_M } from "./court/names";

export interface WorldInfo {
  id: WorldId;
  name: string;
  emoji: string;
  birthplace: string;
  startYear: number;
  yearLabel: string;
  /** เงินในเกมใช้สเกลเดียวกันทุกโลก ต่างกันแค่การแสดงผล */
  currency: (n: number) => string;
  names: { male: string[]; female: string[]; nickM: string[]; nickF: string[]; last: string[] };
  parentJobs: Record<Wealth, string[]>;
  wealthLabel: Record<Wealth, string>;
  deathYoung: string[];
  deathOld: string[];
  /** อายุที่ตื่นพลัง/คัดศิษย์ */
  awakenAge: [number, number];
  /** ช่วงอายุของคนตื่นเร็ว (อัจฉริยะ) และตื่นช้า */
  awakenEarly: [number, number];
  awakenLate: [number, number];
  labels: {
    rank: string;
    power: string;
    guild: string;
    raid: string;
    raidUnit: (rank: string) => string;
    train: string;
    trainText: string;
  };
  /** อาชีพที่ออกภารกิจได้ */
  questJobs: string[];
  ranks: readonly string[];
  /** โลกยุคปัจจุบัน: มีประเทศที่เกิด (ไทย/เกาหลี/ญี่ปุ่น) และระบบโรงเรียน */
  modern?: boolean;
}

const baht = (n: number) => `${n < 0 ? "-" : ""}฿${Math.abs(n).toLocaleString("th-TH")}`;
const goldCoins = (n: number) => {
  const g = Math.abs(n) / 10_000;
  return `${n < 0 ? "-" : ""}${g < 10 ? g.toFixed(1) : Math.round(g).toLocaleString("th-TH")} เหรียญทอง`;
};
const taels = (n: number) => {
  const t = Math.abs(n) / 1000;
  return `${n < 0 ? "-" : ""}${t < 10 ? t.toFixed(1) : Math.round(t).toLocaleString("th-TH")} ตำลึง`;
};

export const WORLDS: Record<WorldId, WorldInfo> = {
  hunter: {
    id: "hunter",
    name: "โลก Hunter",
    emoji: "🌀",
    birthplace: "กรุงเทพฯ",
    startYear: 2008,
    yearLabel: "ปี",
    currency: baht,
    names: { male: MALE_NAMES, female: FEMALE_NAMES, nickM: NICKNAMES_M, nickF: NICKNAMES_F, last: LAST_NAMES },
    parentJobs: {
      poor: ["รับจ้างทั่วไป", "ขายของตลาดนัด", "ชาวนา", "วินมอเตอร์ไซค์", "แม่บ้าน"],
      middle: ["พนักงานบริษัท", "ข้าราชการ", "ครู", "เจ้าของร้านอาหาร", "พยาบาล"],
      rich: ["ผู้บริหาร", "แพทย์", "เจ้าของโรงงาน", "ทนายความ", "นักธุรกิจ"],
      elite: ["ประธานเครือบริษัท", "ทายาทตระกูลดัง", "นักการเมือง", "เจ้าของห้าง"],
    },
    wealthLabel: { poor: "ครอบครัวยากจน", middle: "ครอบครัวชนชั้นกลาง", rich: "ครอบครัวมีฐานะ", elite: "ตระกูลมหาเศรษฐี" },
    deathYoung: ["อุบัติเหตุรถชน", "จมน้ำ", "ไข้เลือดออก", "โดนไฟดูด"],
    deathOld: ["หัวใจวาย", "เส้นเลือดในสมองแตก", "มะเร็ง", "ปอดบวม", "หลับไปอย่างสงบ", "ไตวาย"],
    awakenAge: [18, 20],
    awakenEarly: [5, 15],
    awakenLate: [21, 55],
    labels: {
      rank: "แรงก์",
      power: "มานา",
      guild: "กิลด์",
      raid: "บุก Gate",
      raidUnit: (r) => `Gate แรงก์ ${r}`,
      train: "ฝึกฝน",
      trainText: "ศูนย์ฝึกของสมาคม",
    },
    questJobs: ["hunter"],
    ranks: ["F", "E", "D", "C", "B", "A", "S", "SS", "SSS"],
    modern: true,
  },
  murim: {
    id: "murim",
    name: "ยุทธภพ",
    emoji: "⛰️",
    birthplace: "หมู่บ้านเชิงเขาในแคว้นเหอหนาน",
    startYear: 1120,
    yearLabel: "ศักราช",
    currency: taels,
    names: { male: MURIM_MALE, female: MURIM_FEMALE, nickM: MURIM_NICK_M, nickF: MURIM_NICK_F, last: MURIM_LAST },
    parentJobs: {
      poor: ["ชาวนา", "คนตัดฟืน", "ชาวประมง", "คนลากเกวียน"],
      middle: ["พ่อค้าผ้าไหม", "เจ้าของโรงเตี๊ยม", "หมอยาสมุนไพร", "ช่างตีเหล็ก"],
      rich: ["คหบดีใหญ่", "ผู้คุ้มกันขบวนสินค้า", "ขุนนางท้องถิ่น", "เจ้าของสำนักคุ้มภัย"],
      elite: ["ประมุขตระกูลยุทธ์", "เจ้าเมือง", "ผู้อาวุโสสำนักใหญ่", "เชื้อพระวงศ์"],
    },
    wealthLabel: { poor: "ครอบครัวชาวนายากจน", middle: "ครอบครัวพ่อค้า", rich: "ตระกูลคหบดี", elite: "ตระกูลยุทธ์ผู้ยิ่งใหญ่" },
    deathYoung: ["ไข้ป่า", "จมน้ำในแม่น้ำเหลือง", "ถูกโจรภูเขาปล้นฆ่า", "ม้าตื่นเหยียบ"],
    deathOld: ["ชราภาพ", "พิษสะสมในร่างกาย", "หลับไปอย่างสงบใต้ต้นท้อ", "ไข้หวัดลงปอด", "ลมปราณแตกซ่าน"],
    awakenAge: [12, 14],
    awakenEarly: [5, 10],
    awakenLate: [16, 50],
    labels: {
      rank: "ขั้นยุทธ์",
      power: "ลมปราณ",
      guild: "สำนัก",
      raid: "ภารกิจยุทธภพ",
      raidUnit: (r) => `ภารกิจระดับ${r}`,
      train: "ฝึกลมปราณ",
      trainText: "ลานฝึกของสำนัก",
    },
    questJobs: ["disciple", "wanderer", "m_assassin"],
    ranks: ["ผู้ฝึกหัด", "ชั้นสาม", "ชั้นสอง", "ชั้นหนึ่ง", "ยอดฝีมือ", "ปรมาจารย์", "ยอดยุทธ์", "เหนือธรรมชาติ", "เซียน"],
  },
  court: {
    id: "court",
    name: "ราชสำนัก",
    emoji: "👑",
    birthplace: "นครหลวงแห่งจักรวรรดิอัสเตรีย",
    startYear: 812,
    yearLabel: "ปีจักรวรรดิ",
    currency: goldCoins,
    names: { male: COURT_MALE, female: COURT_FEMALE, nickM: COURT_NICK_M, nickF: COURT_NICK_F, last: COURT_LAST },
    parentJobs: {
      poor: ["คนทำขนมปัง", "คนเลี้ยงม้า", "ช่างตัดเสื้อ", "คนรับใช้ในคฤหาสน์"],
      middle: ["ขุนนางชั้นบารอน", "พ่อค้าผ้าไหม", "อัศวินชั้นผู้น้อย", "นักวิชาการ"],
      rich: ["ขุนนางชั้นเคานต์", "ขุนนางชั้นมาร์ควิส", "ผู้บัญชาการอัศวิน", "จอมเวทราชสำนัก"],
      elite: ["ประมุขตระกูลดยุก", "สมาชิกราชวงศ์สาขา", "อัครมหาเสนาบดี", "ผู้ดูแลคลังหลวง"],
    },
    wealthLabel: { poor: "ครอบครัวสามัญชน", middle: "ตระกูลบารอน", rich: "ตระกูลเคานต์", elite: "ตระกูลดยุก" },
    deathYoung: ["ไข้หวัดใหญ่ระบาด", "ตกจากหลังม้า", "ถูกโจรปล้นรถม้า", "จมน้ำในทะเลสาบหลังคฤหาสน์"],
    deathOld: ["ชราภาพ", "โรคหัวใจ", "หลับไปอย่างสงบในสวนกุหลาบ", "ไข้หวัดลงปอด"],
    awakenAge: [10, 10],
    awakenEarly: [5, 9],
    awakenLate: [11, 45],
    labels: {
      rank: "วงเวท",
      power: "มานา",
      guild: "สังกัด",
      raid: "ภารกิจราชสำนัก",
      raidUnit: (r) => `ภารกิจระดับ${r}`,
      train: "ฝึกเวทและดาบ",
      trainText: "หอฝึกของสถาบันจักรวรรดิ",
    },
    questJobs: ["knight", "court_mage", "adventurer"],
    ranks: ["ไร้วงเวท", "วงที่ 1", "วงที่ 2", "วงที่ 3", "วงที่ 4", "วงที่ 5", "วงที่ 6", "วงที่ 7", "วงที่ 8"],
  },
  tower: {
    id: "tower",
    name: "หอคอย",
    emoji: "🗼",
    birthplace: "กรุงเทพฯ",
    startYear: 2030,
    yearLabel: "ปี",
    currency: baht,
    names: { male: MALE_NAMES, female: FEMALE_NAMES, nickM: NICKNAMES_M, nickF: NICKNAMES_F, last: LAST_NAMES },
    parentJobs: {
      poor: ["รับจ้างทั่วไป", "ขายของตลาดนัด", "พนักงานส่งของ", "คนงานก่อสร้าง", "แม่บ้าน"],
      middle: ["พนักงานบริษัท", "ข้าราชการ", "ครู", "เจ้าของร้านอาหาร", "พยาบาล"],
      rich: ["ผู้บริหาร", "แพทย์", "นักวิจัยหอคอย", "ทนายความ", "นักธุรกิจ"],
      elite: ["ประธานเครือบริษัท", "ผู้ท้าชิงระดับตำนานที่เกษียณ", "นักการเมือง", "เจ้าของสถานีถ่ายทอดหอคอย"],
    },
    wealthLabel: { poor: "ครอบครัวยากจน", middle: "ครอบครัวชนชั้นกลาง", rich: "ครอบครัวมีฐานะ", elite: "ตระกูลมหาเศรษฐี" },
    deathYoung: ["อุบัติเหตุรถชน", "จมน้ำ", "ไข้เลือดออก", "โดนไฟดูด"],
    deathOld: ["หัวใจวาย", "เส้นเลือดในสมองแตก", "มะเร็ง", "ปอดบวม", "หลับไปอย่างสงบ"],
    awakenAge: [18, 20],
    awakenEarly: [10, 15],
    awakenLate: [21, 50],
    labels: {
      rank: "ระดับ",
      power: "พลังหอคอย",
      guild: "ทีม",
      raid: "บททดสอบหอคอย",
      raidUnit: (r) => `บททดสอบระดับ ${r}`,
      train: "ฝึกในห้องฝึก",
      trainText: "ห้องฝึกชั้นปลอดภัยของหอคอย",
    },
    questJobs: ["climber"],
    ranks: ["F", "E", "D", "C", "B", "A", "S", "SS", "SSS"],
    modern: true,
  },
};

export const worldOf =(id: WorldId | undefined) => WORLDS[id ?? "hunter"];

/**
 * ของที่ผูกกับโลก (อาชีพ/กิจกรรม/event) ใช้ได้ในโลกนี้ไหม
 * ไม่ระบุ หรือ "modern" = ใช้ได้ทุกโลกยุคปัจจุบัน
 */
export function worldMatches(tag: WorldId | "modern" | undefined, world: WorldId | undefined): boolean {
  const w = world ?? "hunter";
  if (!tag || tag === "modern") return !!WORLDS[w].modern;
  return tag === w;
}
