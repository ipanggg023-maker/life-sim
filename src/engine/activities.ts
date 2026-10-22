import { chance, randInt } from "./rng";
import type { Outcome } from "./events";
import type { Life, WorldId } from "./types";
import { isRealistic, worldMatches } from "../content/worlds";
import { addFame, addMoney, addStat, checkChance, createPerson, money, hasTalent, log, people, shortName } from "./util";

export interface Activity {
  id: string;
  emoji: string;
  name: string;
  desc: string;
  minAge: number;
  /** ไม่ใส่ = ทุกโลกยุคปัจจุบัน · "all" = ทุกโลก */
  world?: WorldId | "all";
  cost?: number;
  /** หมวดในแท็บ "ทำ" (ไม่ใส่ = ไม่แบ่งหมวด) */
  group?: string;
  /** % สำเร็จที่แสดงให้ผู้เล่นเห็น */
  odds?: (life: Life) => number;
  available?: (life: Life) => boolean;
  run: (life: Life) => Outcome;
}

export const ACTIVITIES: Activity[] = [
  {
    id: "gym",
    emoji: "🏋️",
    name: "ออกกำลังกาย",
    desc: "สุขภาพ +",
    minAge: 8,
    run: (l) => { addStat(l, "health", randInt(l, 2, 6)); addStat(l, "happiness", 1); return { text: "คุณวิ่งรอบสวนลุมทุกเช้า รู้สึกตัวเบาขึ้น", kind: "good" }; },
  },
  {
    id: "read",
    emoji: "📖",
    name: "อ่านหนังสือ",
    desc: "สติปัญญา +",
    minAge: 6,
    run: (l) => { addStat(l, "smarts", randInt(l, 1, 4)); return { text: "คุณอ่านหนังสือจบไปหลายเล่ม", kind: "good" }; },
  },
  {
    id: "temple",
    emoji: "🛕",
    name: "ทำบุญที่วัด",
    desc: "ความสุข + และอาจมีโชค",
    minAge: 5,
    run: (l) => {
      addStat(l, "happiness", randInt(l, 3, 6));
      if (chance(l, 0.25)) { addStat(l, "luck", 1); return { text: "หลวงพ่อมองหน้าคุณนาน แล้วผูกสายสิญจน์ให้ \"ชาติก่อนสร้างกรรมไว้หนัก ชาตินี้ทำดีเข้าไว้\"", kind: "good" }; }
      return { text: "คุณทำบุญใส่บาตร ใจสงบดี", kind: "good" };
    },
  },
  {
    id: "doctor",
    emoji: "🏥",
    name: "ไปหาหมอ",
    desc: "สุขภาพ ++",
    minAge: 0,
    cost: 3000,
    run: (l) => {
      if (l.age >= 18) addMoney(l, -3000);
      addStat(l, "health", randInt(l, 5, 12));
      return { text: "หมอจ่ายยาและแนะนำให้นอนให้พอ", kind: "good" };
    },
  },
  {
    id: "social",
    emoji: "📱",
    name: "โพสต์โซเชียล",
    desc: "ลุ้นดัง",
    minAge: 13,
    odds: (l) => checkChance(l, "looks", 75),
    run: (l) => {
      if (chance(l, checkChance(l, "looks", 75))) { addFame(l, randInt(l, 3, 8)); return { text: "โพสต์ของคุณมีคนแชร์หลายหมื่นครั้ง!", kind: "good" }; }
      return { text: "ได้สามไลก์ หนึ่งในนั้นคือแม่" };
    },
  },
  {
    id: "lottery",
    emoji: "🎟️",
    name: "ซื้อลอตเตอรี่",
    desc: "ใบละ ฿80",
    minAge: 20,
    cost: 80,
    run: (l) => {
      addMoney(l, -80);
      const luckBonus = (l.stats.luck - 50) / 50000;
      if (chance(l, 0.0008 + luckBonus)) {
        addMoney(l, 6_000_000); addStat(l, "happiness", 30);
        return { text: "🎉 ถูกรางวัลที่ 1! ฿6,000,000!!!", kind: "milestone" };
      }
      if (chance(l, 0.08)) { addMoney(l, 4000); return { text: "ถูกเลขท้ายสามตัว ได้ ฿4,000", kind: "good" }; }
      return { text: "กินแห้วตามระเบียบ" };
    },
  },
  {
    id: "trip",
    emoji: "🏖️",
    name: "ไปเที่ยวทะเล",
    desc: "ความสุข ++",
    minAge: 18,
    cost: 15_000,
    run: (l) => { addMoney(l, -15_000); addStat(l, "happiness", randInt(l, 8, 15)); return { text: "คุณนั่งดูพระอาทิตย์ตกที่หัวหินแล้วลืมเรื่องงานไปหมด", kind: "good" }; },
  },
  {
    id: "nightout",
    emoji: "🍻",
    name: "ไปปาร์ตี้",
    desc: "ความสุข + เสี่ยงเมาค้าง",
    minAge: 20,
    cost: 3000,
    run: (l) => {
      addMoney(l, -3000); addStat(l, "happiness", randInt(l, 4, 9));
      if (chance(l, 0.25)) { addStat(l, "health", -4); return { text: "สนุกมาก แต่ตื่นมาจำอะไรไม่ได้เลย หัวจะระเบิด", kind: "bad" }; }
      if (chance(l, 0.2)) { const p = createPerson(l, "friend", { age: l.age + randInt(l, -3, 3), bond: 45 }); return { text: `คุณได้เพื่อนใหม่ชื่อ${shortName(p)}จากปาร์ตี้`, kind: "good" }; }
      return { text: "คืนนี้สนุกสุดๆ", kind: "good" };
    },
  },
  {
    id: "dating",
    emoji: "💘",
    name: "เล่นแอปหาคู่",
    desc: "หาแฟน",
    minAge: 18,
    available: (l) => !people(l, "partner").length && !people(l, "spouse").length,
    odds: (l) => checkChance(l, "looks", 50, hasTalent(l, "charm") ? 0.2 : 0),
    run: (l) => {
      if (chance(l, checkChance(l, "looks", 50, hasTalent(l, "charm") ? 0.2 : 0))) {
        const p = createPerson(l, "partner", { gender: l.gender === "m" ? "f" : "m", age: l.age + randInt(l, -4, 4), bond: 60 });
        return { text: `💕 คุณแมตช์กับ${shortName(p)} ไปเดตแล้วคลิกกันทันที!`, kind: "good" };
      }
      addStat(l, "happiness", -3);
      return { text: "ปัดขวาไปร้อยคน แมตช์ศูนย์", kind: "bad" };
    },
  },
  {
    id: "surgery",
    emoji: "💉",
    name: "ศัลยกรรม",
    desc: "รูปลักษณ์ ++ (มีความเสี่ยง)",
    minAge: 18,
    cost: 120_000,
    odds: (l) => checkChance(l, "luck", 35),
    run: (l) => {
      addMoney(l, -120_000);
      if (chance(l, checkChance(l, "luck", 35))) { addStat(l, "looks", randInt(l, 10, 20)); return { text: "ผลลัพธ์ออกมาสวยเป๊ะ! คนทักว่าไปเกาหลีมาเหรอ", kind: "good" }; }
      addStat(l, "looks", -10); addStat(l, "health", -8);
      return { text: "หมอทำพลาด หน้าบวมเบี้ยวไปหลายเดือน", kind: "bad" };
    },
  },
];

/** ของจากโลกยุคปัจจุบัน/ระบบเกมที่ไม่มีในโลกแบบสมจริง (ยุทธภพใช้แผนของปี + กิจกรรมของตัวเองแทน) */
const REALISTIC_OFF = /^(club_|kid_|biz_|free_course|free_move|free_splurge)/;
const inWorld = (a: Activity, w: WorldId) => (a.world === "all" || worldMatches(a.world, w)) && !(isRealistic(w) && REALISTIC_OFF.test(a.id));
/** ระหว่างติดคุกทำได้แค่ไม่กี่อย่าง */
const JAIL_OK = /^(gym|read|free_create|.*_rest|mw_body|mw_meditate|mw_manual)$/;

/** อายุที่เริ่มทำอะไรเองได้ */
export const BABY_AGE = 3;

/** ตัวกรองจาก content (เช่น ยุทธภพซ่อนกิจกรรมของโลกอื่น) — คืน false = ไม่แสดง */
export const activityFilters: Array<(life: Life, a: Activity) => boolean> = [];
export const activitiesFor = (life: Life) => ACTIVITIES.filter((a) => inWorld(a, life.worldId) && activityFilters.every((f) => f(life, a)));

export function activityLocked(life: Life, a: Activity): string | undefined {
  if (!inWorld(a, life.worldId) || !activityFilters.every((f) => f(life, a))) return "ไม่มีในโลกนี้";
  // ทารกยังทำอะไรเองไม่ได้ — พ่อแม่ดูแลทุกอย่าง
  if (life.age < BABY_AGE) return "ยังเป็นเด็กเล็ก";
  if (Number(life.flags.jailUntil ?? -1) > life.age && !JAIL_OK.test(a.id)) return "ติดคุกอยู่";
  if (life.age < a.minAge) return `อายุ ${a.minAge}+`;
  if (a.available && !a.available(life)) return "ตอนนี้ทำไม่ได้";
  if (life.doneThisYear.includes(`act:${a.id}`)) return "ปีนี้ทำแล้ว";
  if (a.cost && life.age >= 18 && life.money < a.cost) return `ต้องมี ${money(life, a.cost)}`;
  return;
}

export function doActivity(life: Life, id: string): Outcome | undefined {
  const a = ACTIVITIES.find((x) => x.id === id);
  if (!a || activityLocked(life, a)) return;
  life.doneThisYear.push(`act:${a.id}`);
  life.flags[`act_${a.id}`] = Number(life.flags[`act_${a.id}`] ?? 0) + 1; // นับไว้ปลดล็อกสกิลติดตัว
  const out = a.run(life);
  // ปุ่มที่เปิดฉากให้เลือก (runEvent) คืนข้อความว่าง — ผลจะมาตอนเลือก
  if (out.text) log(life, out.text, out.kind ?? "normal");
  return out;
}
