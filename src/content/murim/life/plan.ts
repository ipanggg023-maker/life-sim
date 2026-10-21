// Phase 1 — แผนหลักของปี: ปีนี้คุณใช้เวลาส่วนใหญ่ไปกับอะไร (MURIM_PLAN §18.2)
// เลือกครั้งเดียวแล้วใช้ซ้ำทุกปีจนกว่าจะเปลี่ยน · ผลออกตอนสิ้นปี (กด +1 ปี) · ไม่เลือก = ใช้ชีวิตตามปกติ
import { chance, pick, randInt } from "../../../engine/rng";
import type { Life } from "../../../engine/types";
import { addFame, addMoney, addStat, clamp, createPerson, log, money, shortName } from "../../../engine/util";
import { gainExp } from "../../hunter/power";
import { familyOf, priceIndex } from "./world";

export interface YearPlan {
  id: string;
  emoji: string;
  name: string;
  /** สรุปผลดี/ผลเสียสั้นๆ ให้เห็นก่อนเลือก */
  pros: string;
  cons: string;
  minAge: number;
  maxAge?: number;
  available?: (l: Life) => boolean;
  /** ผลตอนสิ้นปี — คืนข้อความบันทึก */
  apply: (l: Life) => string;
}

const kidPlans: YearPlan[] = [
  {
    id: "play", emoji: "🪁", name: "วิ่งเล่นกับเพื่อน", minAge: 3, maxAge: 11,
    pros: "ความสุข + สุขภาพ + ได้เพื่อน", cons: "ไม่ได้ความรู้",
    apply: (l) => {
      addStat(l, "happiness", randInt(l, 3, 6)); addStat(l, "health", randInt(l, 1, 3));
      if (chance(l, 0.25)) { const p = createPerson(l, "friend", { age: l.age + randInt(l, -1, 1), bond: 50 }); return `ทั้งปีคุณวิ่งเล่นริมลำธาร ได้เพื่อนใหม่ชื่อ${shortName(p)}`; }
      return "ทั้งปีคุณวิ่งเล่นจนตัวดำ ขาเป็นแผลถลอกเต็มไปหมด";
    },
  },
  {
    id: "chores", emoji: "🧺", name: "ช่วยงานบ้าน", minAge: 4, maxAge: 11,
    pros: "พ่อแม่รักมากขึ้น ร่างกายแข็งแรง", cons: "เหนื่อย ความสุขลดนิดหน่อย",
    apply: (l) => {
      for (const p of familyOf(l)) if (p.relation === "father" || p.relation === "mother") p.bond = clamp(p.bond + randInt(l, 4, 8), 0, 100);
      addStat(l, "health", randInt(l, 1, 3)); addStat(l, "happiness", -1);
      return pick(l, ["คุณหาบน้ำ ผ่าฟืน เลี้ยงไก่ทุกวัน มือด้านขึ้นเรื่อยๆ", "คุณช่วยแม่ขายของที่ตลาดทุกเช้า จำราคาของได้ทุกอย่าง"]);
    },
  },
  {
    id: "letters", emoji: "🖌️", name: "เรียนหนังสือกับซินแส", minAge: 5, maxAge: 11,
    pros: "สติปัญญา ++", cons: "ครอบครัวเสียค่าเล่าเรียน",
    apply: (l) => {
      addStat(l, "smarts", randInt(l, 2, 4));
      return pick(l, ["ซินแสตีมือคุณด้วยไม้เรียวทุกครั้งที่เขียนผิด แต่คุณอ่านออกเขียนได้มากขึ้นทุกวัน", "คุณท่องตำราสามอักษรได้จนจบเล่ม"]);
    },
  },
  {
    id: "kid_train", emoji: "🥋", name: "ฝึกท่าพื้นฐาน", minAge: 6, maxAge: 11,
    pros: "สุขภาพ ++ ร่างกายพร้อมฝึกวิชา", cons: "เจ็บตัวบ่อย",
    apply: (l) => {
      addStat(l, "health", randInt(l, 2, 5));
      l.flags.mwBasics = Number(l.flags.mwBasics ?? 0) + 1;
      if (l.power) gainExp(l, 40);
      if (chance(l, 0.15)) { addStat(l, "health", -3); return "คุณตั้งท่าม้าทุกเช้าจนขาสั่น วันหนึ่งพลาดล้มข้อเท้าแพลง"; }
      return "คุณตั้งท่าม้าทุกเช้าก่อนไก่ขัน ขาเริ่มแข็งแรงเหมือนเสาบ้าน";
    },
  },
];

const adultPlans: YearPlan[] = [
  {
    id: "train", emoji: "⚔️", name: "ทุ่มเทฝึกวิชา", minAge: 12,
    pros: "พลังยุทธ์ ++ สุขภาพ +", cons: "รายได้ลด เสี่ยงบาดเจ็บ ห่างครอบครัว",
    apply: (l) => {
      addStat(l, "health", randInt(l, 0, 3));
      if (l.power) gainExp(l, 150 + l.stats.smarts);
      else l.flags.mwBasics = Number(l.flags.mwBasics ?? 0) + 1;
      if (l.job) l.job.performance = clamp(l.job.performance - 6, 0, 100);
      for (const p of familyOf(l)) p.bond = clamp(p.bond - 1, 0, 100);
      if (chance(l, 0.12)) { addStat(l, "health", -randInt(l, 4, 10)); return "คุณฝึกหนักจนกล้ามเนื้อฉีก ต้องพักไปหลายเดือน"; }
      return l.power ? "คุณฝึกตั้งแต่ฟ้ายังไม่สางจนเดือนขึ้น ลมปราณในตันเถียนหนาแน่นขึ้นอย่างรู้สึกได้" : "คุณฝึกร่างกายด้วยตัวเองทุกวัน แม้ยังไม่มีใครสอนวิชาให้";
    },
  },
  {
    id: "work", emoji: "💼", name: "ทำงานหนัก", minAge: 14,
    pros: "เงิน ++ ผลงานดี", cons: "ความสุข − สุขภาพ −",
    apply: (l) => {
      addStat(l, "happiness", -2); addStat(l, "health", -randInt(l, 0, 2));
      if (l.job) {
        l.job.performance = clamp(l.job.performance + randInt(l, 6, 12), 0, 100);
        const bonus = Math.round(Number(l.flags.income ?? 0) * 0.15);
        addMoney(l, bonus);
        return `คุณทำงานจนดึกทุกคืน ผลงานโดดเด่น ได้เงินพิเศษ ${money(l, bonus)}`;
      }
      const pay = Math.round(randInt(l, 12, 24) * 1000 * priceIndex(l));
      addMoney(l, pay);
      return `คุณรับจ้างแบกของ ขนข้าว ทำทุกอย่างที่มีคนจ้าง ได้มา ${money(l, pay)}`;
    },
  },
  {
    id: "family", emoji: "🏠", name: "ดูแลครอบครัว", minAge: 12,
    pros: "ทุกคนในบ้านสนิทขึ้น ความสุข +", cons: "ไม่ได้ฝึก ใช้เงินดูแลบ้าน",
    available: (l) => familyOf(l).length > 0,
    apply: (l) => {
      for (const p of familyOf(l)) p.bond = clamp(p.bond + randInt(l, 5, 10), 0, 100);
      addStat(l, "happiness", randInt(l, 3, 6));
      if (l.age >= 18) addMoney(l, -Math.round(10_000 * priceIndex(l)));
      return pick(l, ["คุณอยู่บ้านทั้งปี ซ่อมหลังคา ทำกับข้าว ฟังคนในบ้านเล่าเรื่องจนดึก", "ปีนี้คุณไม่ไปไหนไกล ทุกเย็นทั้งบ้านกินข้าวพร้อมหน้า"]);
    },
  },
  {
    id: "wander", emoji: "🗺️", name: "ท่องยุทธภพ", minAge: 15,
    pros: "ชื่อเสียง + ได้พบผู้คนและโอกาส", cons: "อันตรายระหว่างทาง ห่างบ้าน",
    apply: (l) => {
      addFame(l, randInt(l, 1, 3));
      for (const p of familyOf(l)) p.bond = clamp(p.bond - 2, 0, 100);
      if (l.power) gainExp(l, 60);
      if (chance(l, 0.2)) { addStat(l, "health", -randInt(l, 5, 12)); return "ระหว่างทางคุณถูกโจรป่าดักปล้น หนีรอดมาได้พร้อมแผลที่หลัง"; }
      if (chance(l, 0.35)) { const p = createPerson(l, "friend", { age: l.age + randInt(l, -6, 6), bond: 45 }); return `คุณเดินทางข้ามสามมณฑล และได้รู้จัก${shortName(p)}ที่โรงเตี๊ยมกลางทาง`; }
      return pick(l, ["คุณเห็นทะเลเป็นครั้งแรกในชีวิต และเห็นว่ายุทธภพกว้างกว่าที่เคยคิด", "คุณนอนในวัดร้าง กินข้าวในโรงเตี๊ยม ฟังเรื่องเล่าของยอดฝีมือมาทั้งปี"]);
    },
  },
  {
    id: "study", emoji: "📜", name: "ร่ำเรียนตำรา", minAge: 12,
    pros: "สติปัญญา ++", cons: "ร่างกายอ่อนลงนิดหน่อย",
    apply: (l) => {
      addStat(l, "smarts", randInt(l, 2, 4)); addStat(l, "health", -1);
      return pick(l, ["คุณขังตัวเองกับตำราทั้งปี อ่านจนตะเกียงหมดน้ำมันไปหลายสิบขวด", "คุณยืมตำราจากหอสมุดของอำเภอมาคัดลอกทีละเล่ม"]);
    },
  },
  {
    id: "rest", emoji: "🍵", name: "พักฟื้นร่างกาย", minAge: 12,
    pros: "สุขภาพ +++ ความสุข +", cons: "ไม่ได้อะไรเพิ่ม รายได้ลดลง",
    apply: (l) => {
      addStat(l, "health", randInt(l, 6, 12)); addStat(l, "happiness", randInt(l, 2, 5));
      if (l.job) l.job.performance = clamp(l.job.performance - 4, 0, 100);
      return "คุณพักผ่อน กินยาบำรุง นั่งจิบชาดูฝนตก ร่างกายค่อยๆ ฟื้นตัว";
    },
  },
];

export const YEAR_PLANS: YearPlan[] = [...kidPlans, ...adultPlans];

export const planById = (id: string | undefined) => YEAR_PLANS.find((p) => p.id === id);

export function plansFor(l: Life): YearPlan[] {
  return YEAR_PLANS.filter((p) => l.age >= p.minAge && (p.maxAge === undefined || l.age <= p.maxAge) && (!p.available || p.available(l)));
}

export function currentPlan(l: Life): YearPlan | undefined {
  const p = planById(l.flags.plan as string | undefined);
  return p && plansFor(l).includes(p) ? p : undefined;
}

export function setPlan(l: Life, id: string | undefined) {
  if (id) l.flags.plan = id;
  else delete l.flags.plan;
}

/** ผลของแผนปีที่เพิ่งผ่านไป (yearHook) — ช่วงอายุเปลี่ยนแล้วแผนเดิมใช้ไม่ได้ จะล้างให้อัตโนมัติ */
export function applyPlan(l: Life) {
  if (l.worldId !== "murim" || !l.alive || l.age < 3) return;
  const p = planById(l.flags.plan as string | undefined);
  if (!p) return;
  const prevAge = l.age - 1;
  const fits = prevAge >= p.minAge && (p.maxAge === undefined || prevAge <= p.maxAge);
  if (fits) log(l, `${p.emoji} ${p.apply(l)}`);
  if (!plansFor(l).includes(p)) {
    delete l.flags.plan;
    log(l, "ช่วงวัยของคุณเปลี่ยนไปแล้ว — ถึงเวลาเลือกว่าปีต่อไปจะใช้ชีวิตแบบไหน");
  }
}
