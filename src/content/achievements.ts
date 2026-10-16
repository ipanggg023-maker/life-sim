import type { Life, Soul } from "../engine/types";
import { hasTalent, people } from "../engine/util";

export interface Achievement {
  id: string;
  name: string;
  desc: string;
  points: number;
  check: (life: Life) => boolean;
}

export const ACHIEVEMENTS: Achievement[] = [
  { id: "elder", name: "อายุยืน", desc: "มีชีวิตถึง 90 ปี", points: 20, check: (l) => l.age >= 90 },
  { id: "young", name: "ดอกไม้ร่วงก่อนบาน", desc: "ตายก่อนอายุ 18", points: 5, check: (l) => l.age < 18 },
  { id: "awakened", name: "ผู้ตื่นพลัง", desc: "ตื่นพลังได้สำเร็จ", points: 5, check: (l) => !!l.power },
  { id: "rank_a", name: "ชนชั้นสูงสุดของประเทศ", desc: "ไปถึงแรงก์ A", points: 15, check: (l) => (l.power?.rank ?? -1) >= 5 },
  { id: "rank_s", name: "อาวุธแห่งชาติ", desc: "ไปถึงแรงก์ S", points: 30, check: (l) => (l.power?.rank ?? -1) >= 6 },
  { id: "rank_sss", name: "เหนือมนุษย์", desc: "ไปถึงแรงก์ SSS", points: 80, check: (l) => (l.power?.rank ?? -1) >= 8 },
  { id: "rich", name: "เศรษฐีร้อยล้าน", desc: "มีทรัพย์สินสุทธิ 100 ล้าน", points: 15, check: (l) => l.money - l.debt >= 100_000_000 },
  { id: "billion", name: "มหาเศรษฐีพันล้าน", desc: "มีทรัพย์สินสุทธิ 1,000 ล้าน", points: 30, check: (l) => l.money - l.debt >= 1_000_000_000 },
  { id: "family", name: "ครอบครัวใหญ่", desc: "มีลูก 3 คนขึ้นไป", points: 10, check: (l) => people(l, "child", false).length >= 3 },
  { id: "hero", name: "วีรบุรุษของชาติ", desc: "ชื่อเสียงถึง 80", points: 20, check: (l) => l.fame >= 80 },
  { id: "doctor", name: "หมอประจำบ้าน", desc: "จบแพทยศาสตร์", points: 8, check: (l) => l.education.degree === "med" },
  { id: "gate_death", name: "ไม่ได้กลับออกมา", desc: "ตายใน Gate", points: 5, check: (l) => /Gate|ดันเจี้ยน/.test(l.causeOfDeath ?? "") },
  { id: "jackpot", name: "ดวงเฮงเกินมนุษย์", desc: "ถูกรางวัลที่ 1", points: 10, check: (l) => !!l.flags.jackpot },
  { id: "regressor", name: "ผู้ย้อนเวลา", desc: "ย้อนเวลาครั้งแรก", points: 10, check: (l) => (l.regressions ?? 0) >= 1 },
  { id: "saved_all", name: "เปลี่ยนชะตา", desc: "ปกป้องครอบครัวให้รอดจากมหันตภัยกรุงเทพฯ", points: 25, check: (l) => !!l.flags.savedFamily },
  { id: "system", name: "ผู้เล่นคนเดียว", desc: "เปิดพรสวรรค์หน้าต่างระบบส่วนตัว", points: 15, check: (l) => hasTalent(l, "system_user") },
  { id: "legacy", name: "ทายาทของตัวเอง", desc: "เกิดใหม่ในตระกูลที่ตัวเองสร้าง", points: 15, check: (l) => !!l.flags.descendant },
];

/** แต้มวิญญาณจากชีวิตหนึ่ง (ยังไม่รวมความสำเร็จ) */
export function lifePoints(life: Life): number {
  const net = life.money - life.debt;
  const wealth = net > 0 ? Math.log10(net) * 1.5 : 0;
  const rank = life.power ? (life.power.rank + 1) * 4 : 0;
  const kids = people(life, "child", false).length * 2;
  const married = life.people.some((p) => p.relation === "spouse") ? 4 : 0;
  return Math.max(1, Math.round(life.age / 4 + Math.max(0, life.fame) / 5 + wealth + rank + kids + married));
}

/** ความสำเร็จใหม่ที่ชีวิตนี้ปลดล็อก (ยังไม่เคยได้มาก่อน) */
export function newAchievements(life: Life, soul: Soul): Achievement[] {
  return ACHIEVEMENTS.filter((a) => !soul.achievements.includes(a.id) && a.check(life));
}
