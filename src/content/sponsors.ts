// ผู้สนับสนุน (ดวงดาว): สิ่งมีชีวิตเหนือมิติที่เฝ้าดูผู้ท้าชิง แล้วเลือกหนุนหลังคนที่ถูกใจ
// ใช้ในหอคอย (และโลกวันสิ้นโลกในอนาคต)
// ห้าม import content/hunter/power — power.ts อ่านโบนัสจากไฟล์นี้
import type { Life } from "../engine/types";

export type SponsorBonus = "cp" | "survival" | "exp" | "money";

export interface Sponsor {
  id: string;
  name: string;
  /** นิสัย — ใช้แต่งข้อความ */
  likes: string;
  desc: string;
  bonus: SponsorBonus;
  value: number;
}

export const SPONSORS: Sponsor[] = [
  { id: "war", name: "เทพสงครามผู้เบื่อหน่าย", likes: "การต่อสู้ที่เลือดสาด", desc: "พลังต่อสู้ +4", bonus: "cp", value: 4 },
  { id: "witch", name: "แม่มดดาวเหนือผู้ชอบเรื่องรัก", likes: "ความสัมพันธ์ที่ไม่สมหวัง", desc: "โอกาสรอด +5%", bonus: "survival", value: 0.05 },
  { id: "merchant", name: "พ่อค้าแห่งมิติไร้นาม", likes: "ดีลที่ได้กำไร", desc: "รายได้ +10%", bonus: "money", value: 0.1 },
  { id: "sage", name: "ปราชญ์ผู้เฝ้ามองนิรันดร์", likes: "คำตอบที่ไม่มีใครคิดถึง", desc: "EXP +15%", bonus: "exp", value: 0.15 },
  { id: "demon", name: "ปีศาจผู้หลงใหลโศกนาฏกรรม", likes: "การเสียสละและความสูญเสีย", desc: "พลังต่อสู้ +6", bonus: "cp", value: 6 },
  { id: "queen", name: "ราชินีผู้หลับใหลในทะเลดาว", likes: "ความเมตตาที่โง่เขลา", desc: "โอกาสรอด +7%", bonus: "survival", value: 0.07 },
];

export const sponsorOf = (l: Life) => SPONSORS.find((s) => s.id === l.flags.sponsor);

export function sponsorBonus(l: Life, kind: SponsorBonus): number {
  const s = sponsorOf(l);
  return s && s.bonus === kind ? s.value : 0;
}
