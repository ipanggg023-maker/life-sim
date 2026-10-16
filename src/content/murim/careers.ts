import { ACTIVITIES } from "../../engine/activities";
import { chance, randInt } from "../../engine/rng";
import { addFame, addMoney, addStat, checkChance, createPerson, hasTalent, people, shortName } from "../../engine/util";
import { CAREERS } from "../hunter/careers";
import { RETAINER, guildById } from "../hunter/power";

// ───────────────────────── อาชีพในยุทธภพ ─────────────────────────

const stipend = (mult: number) => (life: Parameters<NonNullable<(typeof CAREERS)[number]["salary"]>>[0]) => {
  const p = life.power;
  if (!p) return 0;
  return RETAINER[p.rank] * mult * (guildById(p.guild)?.pay ?? 1) * (1 + 0.25 * ((life.job?.level ?? 1) - 1));
};

CAREERS.push(
  {
    id: "disciple",
    name: "ศิษย์สำนัก",
    emoji: "🏯",
    minAge: 12,
    world: "murim",
    titles: ["ศิษย์นอก", "ศิษย์ใน", "ศิษย์สายตรง", "ผู้อาวุโส", "เจ้าสำนัก"],
    baseSalary: 0,
    key: "health",
    dc: 0,
    needsPower: true,
    salary: stipend(0.5),
  },
  {
    id: "wanderer",
    name: "จอมยุทธ์พเนจร",
    emoji: "🍶",
    minAge: 16,
    world: "murim",
    titles: ["จอมยุทธ์ไร้นาม", "จอมยุทธ์ท้องถิ่น", "จอมยุทธ์มีฉายา", "ยอดฝีมือพเนจร", "ตำนานแห่งยุทธภพ"],
    baseSalary: 0,
    key: "luck",
    dc: 0,
    needsPower: true,
    salary: stipend(0.3),
  },
  {
    id: "m_assassin",
    name: "นักฆ่ารับจ้าง",
    emoji: "🌑",
    minAge: 16,
    world: "murim",
    titles: ["มือสังหารฝึกหัด", "มือสังหาร", "เงามรณะ", "หัวหน้าหอสังหาร", "เจ้าแห่งหอเงา"],
    baseSalary: 0,
    key: "luck",
    dc: 55,
    needsPower: true,
    salary: stipend(1.2),
  },
  { id: "farmer", name: "ชาวนา", emoji: "🌾", minAge: 12, world: "murim", titles: ["ลูกมือทำนา", "ชาวนา", "ชาวนามีที่ดิน", "เจ้าของนา", "ผู้ใหญ่บ้าน"], baseSalary: 70_000, key: "health", dc: 10 },
  { id: "escort", name: "ผู้คุ้มกันขบวนสินค้า", emoji: "🐎", minAge: 16, world: "murim", titles: ["คนคุมเกวียน", "ผู้คุ้มกัน", "หัวหน้าขบวน", "ผู้จัดการสำนักคุ้มภัย", "เจ้าสำนักคุ้มภัย"], baseSalary: 180_000, key: "health", dc: 45 },
  { id: "innkeeper", name: "เจ้าของโรงเตี๊ยม", emoji: "🏮", minAge: 18, world: "murim", titles: ["เด็กเสิร์ฟ", "พ่อครัว", "ผู้จัดการร้าน", "เถ้าแก่", "เจ้าของโรงเตี๊ยมดัง"], baseSalary: 140_000, key: "luck", dc: 30, salary: (l, b) => b * (0.6 + l.stats.luck / 80) },
  { id: "herbalist", name: "หมอยาสมุนไพร", emoji: "🌿", minAge: 16, world: "murim", titles: ["ลูกมือร้านยา", "หมอยา", "หมอมีชื่อ", "หมอหลวงท้องถิ่น", "หมอเทวดา"], baseSalary: 200_000, key: "smarts", dc: 55 },
  { id: "storyteller", name: "นักเล่านิทานในโรงน้ำชา", emoji: "📜", minAge: 16, world: "murim", titles: ["นักเล่าฝึกหัด", "นักเล่าประจำร้าน", "นักเล่าดัง", "ปรมาจารย์นิทาน", "ผู้บันทึกตำนานยุทธภพ"], baseSalary: 90_000, key: "looks", dc: 40, salary: (l, b) => b * (1 + Math.max(0, l.fame) / 20) },
  { id: "official", name: "ขุนนาง", emoji: "📯", minAge: 18, world: "murim", titles: ["เสมียนอำเภอ", "นายอำเภอ", "เจ้าเมือง", "ข้าหลวงมณฑล", "เสนาบดี"], baseSalary: 350_000, key: "smarts", dc: 60, mundaneOnly: true },
);

// ───────────────────────── กิจกรรมในยุทธภพ ─────────────────────────

ACTIVITIES.push(
  {
    id: "m_train",
    world: "murim",
    emoji: "🥋",
    name: "ฝึกกำลังกายใต้น้ำตก",
    desc: "สุขภาพ +",
    minAge: 8,
    run: (l) => { addStat(l, "health", randInt(l, 2, 6)); return { text: "คุณยืนรับน้ำตกเย็นเฉียบทุกเช้า ร่างกายแกร่งขึ้น", kind: "good" }; },
  },
  {
    id: "m_read",
    world: "murim",
    emoji: "📜",
    name: "อ่านตำราโบราณ",
    desc: "สติปัญญา +",
    minAge: 6,
    run: (l) => { addStat(l, "smarts", randInt(l, 1, 4)); return { text: "คุณท่องตำราซุนจื่อจนจำได้ทั้งเล่ม", kind: "good" }; },
  },
  {
    id: "m_shrine",
    world: "murim",
    emoji: "🏮",
    name: "จุดธูปไหว้บรรพชน",
    desc: "ความสุข + อาจมีโชค",
    minAge: 5,
    run: (l) => {
      addStat(l, "happiness", randInt(l, 3, 6));
      if (chance(l, 0.25)) { addStat(l, "luck", 1); return { text: "ธูปทั้งสามดอกไหม้เท่ากันพอดี — ลางดี", kind: "good" }; }
      return { text: "คุณไหว้บรรพชนด้วยความเคารพ", kind: "good" };
    },
  },
  {
    id: "m_doctor",
    world: "murim",
    emoji: "🌿",
    name: "ไปหาหมอจีน",
    desc: "สุขภาพ ++",
    minAge: 0,
    cost: 2000,
    run: (l) => {
      if (l.age >= 18) addMoney(l, -2000);
      addStat(l, "health", randInt(l, 5, 12));
      return { text: "หมอแมะชีพจรแล้วจ่ายยาต้มขมปี๋ให้สามหม้อ", kind: "good" };
    },
  },
  {
    id: "m_tavern",
    world: "murim",
    emoji: "🍶",
    name: "ดื่มสุราที่โรงเตี๊ยม",
    desc: "ความสุข + ฟังข่าวยุทธภพ",
    minAge: 16,
    cost: 1000,
    run: (l) => {
      addMoney(l, -1000);
      addStat(l, "happiness", randInt(l, 3, 8));
      if (chance(l, 0.2)) { const p = createPerson(l, "friend", { age: l.age + randInt(l, -5, 5), bond: 50 }); return { text: `คุณร่วมโต๊ะกับ${shortName(p)} คุยกันถูกคอจนสาบานเป็นพี่น้อง`, kind: "good" }; }
      if (chance(l, 0.2)) { addStat(l, "health", -4); return { text: "สุราหมักร้อยปีแรงเกินคาด คุณตื่นมาในคอกม้า", kind: "bad" }; }
      return { text: "คุณฟังนักเล่านิทานเล่าเรื่องจอมยุทธ์ไร้เทียมทาน", kind: "good" };
    },
  },
  {
    id: "m_matchmaker",
    world: "murim",
    emoji: "💮",
    name: "ไปหาแม่สื่อ",
    desc: "หาคู่",
    minAge: 16,
    cost: 3000,
    available: (l) => !people(l, "partner").length && !people(l, "spouse").length,
    odds: (l) => checkChance(l, "looks", 45, l.wealth === "rich" || l.wealth === "elite" ? 0.2 : 0),
    run: (l) => {
      addMoney(l, -3000);
      if (chance(l, checkChance(l, "looks", 45, l.wealth === "rich" || l.wealth === "elite" ? 0.2 : 0))) {
        const p = createPerson(l, "partner", { gender: l.gender === "m" ? "f" : "m", age: l.age + randInt(l, -3, 3), bond: 55 });
        return { text: `แม่สื่อพาคุณไปดูตัว${shortName(p)} ทั้งสองบ้านพอใจกันมาก`, kind: "good" };
      }
      return { text: "ฝ่ายนั้นดูดวงแล้วบอกว่าธาตุไม่ถูกกัน", kind: "bad" };
    },
  },
  {
    id: "m_gamble",
    world: "murim",
    emoji: "🎲",
    name: "เล่นถั่วในบ่อนพนัน",
    desc: "เสี่ยงโชค",
    minAge: 16,
    cost: 500,
    run: (l) => {
      addMoney(l, -500);
      if (chance(l, 0.04 + (l.stats.luck - 50) / 1000 + (hasTalent(l, "lucky") ? 0.03 : 0))) { addMoney(l, 50_000); addFame(l, 1); return { text: "คุณแทงถูกติดกันเจ็ดตา ทั้งบ่อนจ้องหน้า ได้เงินมา 50 ตำลึง!", kind: "good" }; }
      return { text: "ถ้วยเปิด… เสียตามระเบียบ" };
    },
  },
);
