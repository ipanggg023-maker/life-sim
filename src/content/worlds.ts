import type { Wealth, WorldId } from "../engine/types";
import { FEMALE_NAMES, LAST_NAMES, MALE_NAMES, NICKNAMES_F, NICKNAMES_M } from "./hunter/names";
import { MURIM_FEMALE, MURIM_LAST, MURIM_MALE, MURIM_NICK_F, MURIM_NICK_M } from "./murim/names";

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
}

const baht = (n: number) => `${n < 0 ? "-" : ""}฿${Math.abs(n).toLocaleString("th-TH")}`;
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
};

export const worldOf = (id: WorldId | undefined) => WORLDS[id ?? "hunter"];
