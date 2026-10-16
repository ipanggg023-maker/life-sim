import type { Faculty, Life, StatKey } from "../../engine/types";
import { RETAINER, guildById } from "./power";

export interface Career {
  id: string;
  name: string;
  emoji: string;
  minAge: number;
  titles: string[]; // ตำแหน่งตามเลเวล 1..5
  baseSalary: number; // ต่อปี
  degree?: Faculty[]; // ต้องจบคณะใดคณะหนึ่ง
  anyDegree?: boolean;
  highSchool?: boolean;
  minStat?: Partial<Record<StatKey, number>>;
  /** สเตตัสหลักที่ใช้ตอนสมัครงานและเลื่อนตำแหน่ง */
  key: StatKey;
  /** ความยากตอนสมัคร (เทียบกับสเตตัส key) */
  dc: number;
  /** ต้องเป็นผู้ตื่นพลัง */
  needsPower?: boolean;
  /** ต้องเป็นคนธรรมดา (ไม่ตื่นพลัง) */
  mundaneOnly?: boolean;
  salary?: (life: Life, base: number) => number;
}

export const CAREERS: Career[] = [
  {
    id: "store",
    name: "พนักงานร้านสะดวกซื้อ",
    emoji: "🏪",
    minAge: 15,
    titles: ["พนักงานพาร์ตไทม์", "พนักงานประจำ", "ผู้ช่วยผู้จัดการสาขา", "ผู้จัดการสาขา", "ผู้จัดการเขต"],
    baseSalary: 110_000,
    key: "health",
    dc: 30,
  },
  {
    id: "rider",
    name: "ไรเดอร์ส่งอาหาร",
    emoji: "🛵",
    minAge: 18,
    titles: ["ไรเดอร์มือใหม่", "ไรเดอร์ประจำ", "ไรเดอร์ดาวเด่น", "หัวหน้าทีมไรเดอร์", "เจ้าของฟลีท"],
    baseSalary: 170_000,
    key: "health",
    dc: 30,
  },
  {
    id: "seller",
    name: "พ่อค้าแม่ค้าออนไลน์",
    emoji: "📦",
    minAge: 16,
    titles: ["มือใหม่หัดไลฟ์", "แม่ค้าประจำ", "ร้านดังในตลาด", "แบรนด์ของตัวเอง", "เจ้าพ่อ/เจ้าแม่ออนไลน์"],
    baseSalary: 140_000,
    key: "luck",
    dc: 40,
    salary: (life, base) => base * (0.5 + life.stats.luck / 60 + Math.max(0, life.fame) / 50),
  },
  {
    id: "streamer",
    name: "สตรีมเมอร์เกม",
    emoji: "🎮",
    minAge: 16,
    titles: ["สตรีมเมอร์ไร้คนดู", "สตรีมเมอร์หน้าใหม่", "สตรีมเมอร์ดาวรุ่ง", "สตรีมเมอร์ดัง", "ตำนานแห่งวงการ"],
    baseSalary: 40_000,
    key: "looks",
    dc: 55,
    salary: (life, base) => base * (1 + Math.max(0, life.fame) / 6),
  },
  {
    id: "police",
    name: "ตำรวจ",
    emoji: "👮",
    minAge: 18,
    titles: ["สิบตำรวจตรี", "จ่าสิบตำรวจ", "ร้อยตำรวจตรี", "พันตำรวจตรี", "พันตำรวจเอก"],
    baseSalary: 220_000,
    highSchool: true,
    minStat: { health: 55 },
    key: "health",
    dc: 60,
  },
  {
    id: "office",
    name: "พนักงานออฟฟิศ",
    emoji: "💼",
    minAge: 21,
    titles: ["พนักงานใหม่", "พนักงานอาวุโส", "หัวหน้าทีม", "ผู้จัดการฝ่าย", "ผู้อำนวยการ"],
    baseSalary: 300_000,
    anyDegree: true,
    key: "smarts",
    dc: 50,
  },
  {
    id: "engineer",
    name: "วิศวกร",
    emoji: "🛠️",
    minAge: 22,
    titles: ["วิศวกรจูเนียร์", "วิศวกร", "วิศวกรอาวุโส", "หัวหน้าวิศวกร", "ผู้อำนวยการฝ่ายวิศวกรรม"],
    baseSalary: 420_000,
    degree: ["eng"],
    key: "smarts",
    dc: 55,
  },
  {
    id: "teacher",
    name: "ครู",
    emoji: "📚",
    minAge: 22,
    titles: ["ครูอัตราจ้าง", "ครูผู้ช่วย", "ครูชำนาญการ", "ครูชำนาญการพิเศษ", "ผู้อำนวยการโรงเรียน"],
    baseSalary: 250_000,
    degree: ["edu"],
    key: "smarts",
    dc: 50,
  },
  {
    id: "creative",
    name: "ครีเอทีฟเอเจนซี",
    emoji: "🎨",
    minAge: 21,
    titles: ["จูเนียร์ครีเอทีฟ", "ครีเอทีฟ", "ซีเนียร์ครีเอทีฟ", "ครีเอทีฟไดเรกเตอร์", "ผู้ก่อตั้งเอเจนซี"],
    baseSalary: 320_000,
    degree: ["comm", "business"],
    key: "looks",
    dc: 55,
  },
  {
    id: "finance",
    name: "นักวิเคราะห์การเงิน",
    emoji: "📈",
    minAge: 22,
    titles: ["นักวิเคราะห์", "นักวิเคราะห์อาวุโส", "ผู้จัดการกองทุน", "ผู้อำนวยการการลงทุน", "ประธานเจ้าหน้าที่การลงทุน"],
    baseSalary: 400_000,
    degree: ["business", "eng"],
    minStat: { smarts: 60 },
    key: "smarts",
    dc: 65,
  },
  {
    id: "doctor",
    name: "แพทย์",
    emoji: "🩺",
    minAge: 24,
    titles: ["แพทย์ใช้ทุน", "แพทย์ประจำบ้าน", "แพทย์เฉพาะทาง", "หัวหน้าแผนก", "ผู้อำนวยการโรงพยาบาล"],
    baseSalary: 650_000,
    degree: ["med"],
    key: "smarts",
    dc: 50,
  },
];

// ── อาชีพเฉพาะโลก Hunter ──
CAREERS.unshift(
  {
    id: "hunter",
    name: "Hunter",
    emoji: "🗡️",
    minAge: 18,
    titles: ["Hunter อิสระ", "Hunter ประจำทีม", "หัวหน้าทีมจู่โจม", "รองหัวหน้ากิลด์", "หัวหน้ากิลด์"],
    baseSalary: 0,
    key: "health",
    dc: 0,
    needsPower: true,
    // เงินประจำจากสมาคม/กิลด์ตามแรงก์ — รายได้หลักมาจากการบุก Gate
    salary: (life) => {
      const p = life.power;
      if (!p) return 0;
      const pay = RETAINER[p.rank] * (guildById(p.guild)?.pay ?? 1);
      return pay * (1 + 0.2 * ((life.job?.level ?? 1) - 1));
    },
  },
  {
    id: "porter",
    name: "คนแบกของในดันเจี้ยน",
    emoji: "🎒",
    minAge: 18,
    titles: ["คนแบกของมือใหม่", "คนแบกของประจำ", "หัวหน้าคนแบกของ", "ผู้ประสานงานดันเจี้ยน", "ผู้จัดการฝ่ายสนับสนุน"],
    baseSalary: 260_000,
    key: "health",
    dc: 40,
    mundaneOnly: true,
  },
  {
    id: "association",
    name: "เจ้าหน้าที่สมาคม Hunter",
    emoji: "🏛️",
    minAge: 21,
    titles: ["เจ้าหน้าที่ประเมินแรงก์", "เจ้าหน้าที่อาวุโส", "หัวหน้าฝ่ายตรวจสอบ Gate", "ผู้อำนวยการสาขา", "รองประธานสมาคม"],
    baseSalary: 330_000,
    anyDegree: true,
    key: "smarts",
    dc: 55,
  },
  {
    id: "mana_research",
    name: "นักวิจัยคริสตัลมานา",
    emoji: "🧪",
    minAge: 22,
    titles: ["ผู้ช่วยวิจัย", "นักวิจัย", "นักวิจัยอาวุโส", "หัวหน้าห้องแล็บ", "ผู้อำนวยการสถาบันวิจัยมานา"],
    baseSalary: 450_000,
    degree: ["eng", "med"],
    key: "smarts",
    dc: 60,
  },
);

export const careerById = (id: string) => CAREERS.find((c) => c.id === id);

export interface FacultyInfo {
  id: Faculty;
  name: string;
  years: number;
  dc: number; // ความยากในการสอบเข้า (เทียบกับสติปัญญา)
  tuition: number; // ต่อปี
}

export const FACULTIES: FacultyInfo[] = [
  { id: "med", name: "แพทยศาสตร์", years: 6, dc: 85, tuition: 60_000 },
  { id: "eng", name: "วิศวกรรมศาสตร์", years: 4, dc: 65, tuition: 45_000 },
  { id: "business", name: "บริหารธุรกิจ", years: 4, dc: 50, tuition: 40_000 },
  { id: "comm", name: "นิเทศศาสตร์", years: 4, dc: 45, tuition: 40_000 },
  { id: "edu", name: "ครุศาสตร์", years: 4, dc: 40, tuition: 30_000 },
];

export const facultyById = (id: Faculty) => FACULTIES.find((f) => f.id === id)!;
