import { ACTIVITIES } from "../../engine/activities";
import { randInt } from "../../engine/rng";
import type { Life, SysStat } from "../../engine/types";
import { addStat } from "../../engine/util";
import { CAREERS } from "../hunter/careers";
import { effSys } from "../gameStats";

// อาชีพเฉพาะทางของโลกธรรมดา — ใครก็สมัครได้ถ้าค่า STR–LUK ถึง (ผู้มีระบบฝึกให้ถึงได้เร็วกว่ามาก)
// อาชีพทั่วไป (พนักงาน หมอ ครู สตรีมเมอร์ …) ใช้ร่วมกับโลกยุคปัจจุบันอื่นอยู่แล้ว

/** เงินเดือนขึ้นตามค่าสถานะหลักที่เกิน 40 */
const bySys = (k: SysStat) => (l: Life, base: number) => base * (1 + Math.max(0, effSys(l, k) - 40) / 30) * (1 + Math.max(0, l.fame) / 80);

CAREERS.push(
  { id: "o_mma", name: "นักสู้ MMA", emoji: "👊", minAge: 18, world: "ordinary", titles: ["นักสู้หน้าใหม่", "นักสู้อาชีพ", "แชมป์ประเทศ", "แชมป์เอเชีย", "แชมป์โลกไร้พ่าย"], baseSalary: 220_000, key: "health", dc: 40, sys: { main: "str", min: { str: 40, agi: 30 } }, salary: bySys("str") },
  { id: "o_athlete", name: "นักกีฬาอาชีพ", emoji: "🏃", minAge: 16, world: "ordinary", titles: ["นักกีฬาสโมสร", "นักกีฬาตัวจริง", "ทีมชาติ", "เจ้าของเหรียญทอง", "ตำนานวงการกีฬา"], baseSalary: 200_000, key: "health", dc: 40, sys: { main: "sta", min: { sta: 42, str: 30 } }, salary: bySys("sta") },
  { id: "o_bodyguard", name: "บอดี้การ์ด", emoji: "🕶️", minAge: 20, world: "ordinary", titles: ["การ์ดฝึกหัด", "บอดี้การ์ด", "หัวหน้าทีมอารักขา", "การ์ดส่วนตัวมหาเศรษฐี", "ผู้อำนวยการบริษัทรักษาความปลอดภัย"], baseSalary: 260_000, key: "health", dc: 35, sys: { main: "str", min: { str: 38, sta: 35 } }, salary: bySys("str") },
  { id: "o_trainee", name: "ไอดอล/นักแสดง", emoji: "🎤", minAge: 13, world: "ordinary", titles: ["เด็กฝึก", "ศิลปินหน้าใหม่", "ศิลปินดาวรุ่ง", "ท็อปสตาร์", "ไอคอนระดับโลก"], baseSalary: 150_000, key: "looks", dc: 45, sys: { main: "cha", min: { cha: 40 } }, salary: bySys("cha") },
  { id: "o_model", name: "นายแบบ/นางแบบ", emoji: "📸", minAge: 16, world: "ordinary", titles: ["นางแบบฟรีแลนซ์", "นางแบบประจำแบรนด์", "หน้าปกนิตยสาร", "แอมบาสเดอร์แบรนด์หรู", "ซูเปอร์โมเดล"], baseSalary: 180_000, key: "looks", dc: 50, sys: { main: "cha", min: { cha: 45, sta: 25 } }, salary: bySys("cha") },
  { id: "o_progamer", name: "โปรเกมเมอร์", emoji: "🎮", minAge: 15, world: "ordinary", titles: ["ผู้เล่นสำรอง", "โปรเพลเยอร์", "ตัวหลักของทีม", "แชมป์โลก", "ตำนานแห่งวงการเกม"], baseSalary: 160_000, key: "luck", dc: 40, sys: { main: "agi", min: { agi: 38, int: 30 } }, salary: bySys("agi") },
  { id: "o_chef_job", name: "เชฟ", emoji: "🍳", minAge: 16, world: "ordinary", titles: ["ลูกมือในครัว", "เชฟประจำสเตชั่น", "ซูเชฟ", "หัวหน้าเชฟ", "เชฟสามดาว"], baseSalary: 170_000, key: "smarts", dc: 40, sys: { main: "int", min: { int: 32, sta: 30 } }, salary: bySys("int") },
  { id: "o_dev", name: "โปรแกรมเมอร์", emoji: "💻", minAge: 18, world: "ordinary", titles: ["จูเนียร์", "นักพัฒนา", "ซีเนียร์", "หัวหน้าทีมเทคนิค", "CTO"], baseSalary: 360_000, key: "smarts", dc: 50, sys: { main: "int", min: { int: 42 } }, salary: bySys("int") },
  { id: "o_heir", name: "ผู้บริหารเครือบริษัท", emoji: "💼", minAge: 22, world: "ordinary", titles: ["ผู้จัดการ", "ผู้อำนวยการฝ่าย", "กรรมการบริหาร", "รองประธาน", "ประธานเครือ"], baseSalary: 900_000, key: "smarts", dc: 60, anyDegree: true, sys: { main: "int", min: { int: 45, cha: 38 } }, salary: bySys("int") },
);

ACTIVITIES.push({
  id: "o_status",
  world: "ordinary",
  emoji: "🪟",
  name: "เปิดหน้าต่างสถานะ",
  desc: "ระบบวิเคราะห์จุดอ่อนให้ (ผู้มีระบบเท่านั้น)",
  minAge: 7,
  available: (l) => !!l.sys,
  run: (l) => {
    const keys = ["health", "smarts", "looks", "luck"] as const;
    const low = [...keys].sort((a, b) => l.stats[a] - l.stats[b])[0];
    addStat(l, low, randInt(l, 2, 4));
    return { text: "[ระบบ] วิเคราะห์จุดอ่อนของผู้ใช้เสร็จสิ้น — แผนพัฒนาปีนี้ถูกส่งเข้าหัวคุณโดยอัตโนมัติ", kind: "system" };
  },
});
