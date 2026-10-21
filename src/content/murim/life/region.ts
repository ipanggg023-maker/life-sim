// ภูมิภาคที่เกิด (MURIM_PLAN §2–3) — แต่ละที่ต่างกันทั้งภูมิประเทศ สำนัก อันตราย และโอกาส
import type { Life } from "../../../engine/types";

export interface Region {
  id: string;
  name: string;
  desc: string;
  /** สำนักที่ลงมาคัดศิษย์บ่อยในภูมิภาคนี้ */
  sects: string[];
}

export const REGIONS: Region[] = [
  { id: "north", name: "ที่ราบภาคเหนือ", desc: "หนาวจัด ลมทรายแรง ชายแดนติดทุ่งหญ้า ผู้คนแข็งแกร่งและพูดตรง ทหารหลวงตั้งค่ายเต็มไปหมด", sects: ["alliance", "vajra"] },
  { id: "jiangnan", name: "เจียงหนาน", desc: "เมืองน้ำที่ร่ำรวยที่สุดในแผ่นดิน เรือสินค้าเต็มคลอง โรงน้ำชาและหอนางโลมไม่เคยปิด", sects: ["cloud", "alliance"] },
  { id: "sichuan", name: "เสฉวน", desc: "ภูเขาสูงเสียดฟ้า หมอกไม่เคยจาง ตระกูลถังเรือนพิษครอบครองทั้งมณฑล", sects: ["tang", "cloud"] },
  { id: "west", name: "ชายแดนตะวันตก", desc: "ทะเลทรายกับภูเขาหิมะ กองคาราวานจากแดนไกลผ่านทุกฤดู ลัทธิมารสวรรค์ซ่อนตัวอยู่ในเทือกเขา", sects: ["cult", "vajra"] },
  { id: "south", name: "ป่าทางใต้", desc: "ร้อนชื้น งูพิษ ไข้ป่า และชนเผ่าที่ไม่ขึ้นกับราชสำนัก ยาสมุนไพรหายากขึ้นทุกที่", sects: ["tang", "beggar"] },
  { id: "capital", name: "เมืองหลวง", desc: "ศูนย์กลางของราชสำนัก ขุนนาง ขันที และสายลับ ทุกถนนมีเรื่องการเมือง", sects: ["alliance", "beggar"] },
];

/** ภูมิภาคที่เกิด — คงที่ตลอดชีวิต (คำนวณจาก id ของชีวิต) จนกว่าจะย้ายถิ่น */
export function regionOf(l: Life): Region {
  if (!l.flags.region) {
    let h = 7;
    for (const ch of l.id) h = (h * 33 + ch.charCodeAt(0)) >>> 0;
    l.flags.region = REGIONS[h % REGIONS.length].id;
  }
  return REGIONS.find((r) => r.id === l.flags.region) ?? REGIONS[0];
}

const PLACE: Record<string, string> = {
  north: "หมู่บ้านกลางทุ่งหญ้าแห่งที่ราบภาคเหนือ",
  jiangnan: "เมืองน้ำริมคลองแห่งเจียงหนาน",
  sichuan: "หมู่บ้านบนเขาสูงแห่งเสฉวน",
  west: "เมืองด่านริมทะเลทรายแห่งชายแดนตะวันตก",
  south: "หมู่บ้านกลางป่าทางใต้",
  capital: "ตรอกเล็กๆ ในเมืองหลวง",
};

/** ที่เกิดสำหรับข้อความเปิดชีวิต (ยุทธภพใช้ภูมิภาคจริง) */
export function birthplaceOf(l: Life, fallback: string): string {
  return l.worldId === "murim" ? PLACE[regionOf(l).id] ?? fallback : fallback;
}