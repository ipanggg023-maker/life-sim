import { ACTIVITIES } from "../../engine/activities";
import { randInt } from "../../engine/rng";
import type { Life } from "../../engine/types";
import { addStat } from "../../engine/util";
import { CAREERS } from "../hunter/careers";
import { RETAINER, guildById } from "../hunter/power";

// อาชีพตามเส้นทางของระบบชีวิต — ต้องมีระบบก่อน (needsPower)
// หมออัจฉริยะใช้อาชีพ "แพทย์" ทั่วไป (ต้องจบแพทย์)

const pay = (mult: number) => (life: Life) => {
  const p = life.power;
  if (!p) return 0;
  return RETAINER[p.rank] * mult * (guildById(p.guild)?.pay ?? 1) * (1 + 0.25 * ((life.job?.level ?? 1) - 1)) * (1 + Math.max(0, life.fame) / 50);
};

CAREERS.push(
  {
    id: "o_mma",
    name: "นักสู้ MMA",
    emoji: "👊",
    minAge: 16,
    world: "ordinary",
    titles: ["นักสู้ใต้ดิน", "นักสู้อาชีพ", "แชมป์ประเทศ", "แชมป์เอเชีย", "แชมป์โลกไร้พ่าย"],
    baseSalary: 0,
    key: "health",
    dc: 0,
    needsPower: true,
    salary: pay(0.35),
  },
  {
    id: "o_trainee",
    name: "ไอดอล/นักแสดงในสังกัด",
    emoji: "🎤",
    minAge: 13,
    world: "ordinary",
    titles: ["เด็กฝึก", "ศิลปินหน้าใหม่", "ศิลปินดาวรุ่ง", "ท็อปสตาร์", "ไอคอนระดับโลก"],
    baseSalary: 0,
    key: "looks",
    dc: 0,
    needsPower: true,
    salary: pay(0.4),
  },
  {
    id: "o_progamer",
    name: "โปรเกมเมอร์ VR",
    emoji: "🎮",
    minAge: 14,
    world: "ordinary",
    titles: ["ผู้เล่นมือสมัครเล่น", "โปรเพลเยอร์", "ตัวหลักของทีม", "แชมป์โลก", "ตำนานแห่งโลกเสมือน"],
    baseSalary: 0,
    key: "luck",
    dc: 0,
    needsPower: true,
    salary: pay(0.35),
  },
  {
    id: "o_chef_job",
    name: "เชฟ",
    emoji: "🍳",
    minAge: 16,
    world: "ordinary",
    titles: ["ลูกมือในครัว", "เชฟประจำสเตชั่น", "ซูเชฟ", "หัวหน้าเชฟ", "เชฟสามดาว"],
    baseSalary: 0,
    key: "happiness",
    dc: 0,
    needsPower: true,
    salary: pay(0.3),
  },
  {
    id: "o_heir",
    name: "ผู้บริหารเครือบริษัท",
    emoji: "💼",
    minAge: 18,
    world: "ordinary",
    titles: ["ทายาทที่ไม่มีใครเห็นค่า", "ผู้จัดการ", "กรรมการบริหาร", "รองประธาน", "ประธานเครือ"],
    baseSalary: 0,
    key: "smarts",
    dc: 0,
    needsPower: true,
    salary: pay(0.8),
  },
);

ACTIVITIES.push({
  id: "o_status",
  world: "ordinary",
  emoji: "🪟",
  name: "เปิดหน้าต่างสถานะ",
  desc: "ระบบแนะนำทางพัฒนาตัวเอง (ผู้มีระบบเท่านั้น)",
  minAge: 7,
  available: (l) => !!l.power,
  run: (l) => {
    const keys = ["health", "smarts", "looks", "luck"] as const;
    const low = [...keys].sort((a, b) => l.stats[a] - l.stats[b])[0];
    addStat(l, low, randInt(l, 2, 4));
    return { text: "[ระบบ] วิเคราะห์จุดอ่อนของผู้ใช้เสร็จสิ้น — แผนพัฒนาปีนี้ถูกส่งเข้าหัวคุณโดยอัตโนมัติ", kind: "system" };
  },
});
