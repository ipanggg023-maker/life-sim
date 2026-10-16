import { ACTIVITIES } from "../../engine/activities";
import { chance, randInt } from "../../engine/rng";
import type { Life } from "../../engine/types";
import { addFame, addMoney, addStat, checkChance, createPerson, people, shortName } from "../../engine/util";
import { CAREERS } from "../hunter/careers";
import { RETAINER, guildById } from "../hunter/power";

const stipend = (mult: number) => (life: Life) => {
  const p = life.power;
  if (!p) return 0;
  return RETAINER[p.rank] * mult * (guildById(p.guild)?.pay ?? 1) * (1 + 0.25 * ((life.job?.level ?? 1) - 1));
};

/** ขุนนางมีรายได้จากที่ดินอยู่แล้ว — สามัญชนต้องทำงาน */
const nobleBonus = (l: Life) => ({ poor: 1, middle: 1.2, rich: 1.5, elite: 2 })[l.wealth];

CAREERS.push(
  {
    id: "knight",
    name: "อัศวิน",
    emoji: "🛡️",
    minAge: 16,
    world: "court",
    titles: ["อัศวินฝึกหัด", "อัศวิน", "หัวหน้าหน่วยอัศวิน", "รองผู้บัญชาการ", "ผู้บัญชาการอัศวิน"],
    baseSalary: 0,
    key: "health",
    dc: 0,
    needsPower: true,
    salary: stipend(0.6),
  },
  {
    id: "court_mage",
    name: "จอมเวทราชสำนัก",
    emoji: "🔮",
    minAge: 16,
    world: "court",
    titles: ["ผู้ช่วยจอมเวท", "จอมเวท", "จอมเวทอาวุโส", "ผู้อาวุโสแห่งหอคอย", "จอมเวทหลวง"],
    baseSalary: 0,
    key: "smarts",
    dc: 40,
    needsPower: true,
    salary: stipend(0.7),
  },
  {
    id: "adventurer",
    name: "นักผจญภัย",
    emoji: "🗺️",
    minAge: 15,
    world: "court",
    titles: ["นักผจญภัยระดับทองแดง", "ระดับเงิน", "ระดับทอง", "ระดับแพลทินัม", "ระดับมิธริล"],
    baseSalary: 0,
    key: "luck",
    dc: 0,
    needsPower: true,
    salary: stipend(0.3),
  },
  { id: "maid", name: "คนรับใช้ในคฤหาสน์", emoji: "🧹", minAge: 13, world: "court", titles: ["เด็กรับใช้", "คนรับใช้", "หัวหน้าคนรับใช้", "พ่อบ้าน/แม่บ้านใหญ่", "หัวหน้าข้าราชบริพาร"], baseSalary: 80_000, key: "health", dc: 20 },
  { id: "tutor", name: "ครูพี่เลี้ยง", emoji: "📖", minAge: 18, world: "court", titles: ["ครูพี่เลี้ยงฝึกหัด", "ครูพี่เลี้ยง", "ครูประจำตระกูล", "ครูในวัง", "ราชครู"], baseSalary: 200_000, key: "smarts", dc: 55 },
  { id: "scholar", name: "นักวิชาการหอสมุดหลวง", emoji: "📚", minAge: 18, world: "court", titles: ["ผู้ช่วยบรรณารักษ์", "นักวิชาการ", "นักวิชาการอาวุโส", "ผู้อำนวยการหอสมุด", "ปราชญ์หลวง"], baseSalary: 240_000, key: "smarts", dc: 60 },
  { id: "priest", name: "นักบวช", emoji: "⛪", minAge: 16, world: "court", titles: ["ผู้ช่วยนักบวช", "นักบวช", "บาทหลวง", "บิชอป", "พระสันตะปาปา"], baseSalary: 150_000, key: "happiness", dc: 40 },
  { id: "c_clerk", name: "ข้าราชการกระทรวงการคลัง", emoji: "📜", minAge: 18, world: "court", titles: ["เสมียน", "เจ้าหน้าที่", "หัวหน้าแผนก", "รัฐมนตรีช่วย", "รัฐมนตรีการคลัง"], baseSalary: 300_000, key: "smarts", dc: 55, salary: (l, b) => b * nobleBonus(l) },
  { id: "patisserie", name: "เจ้าของร้านขนม (สูตรจากโลกเก่า)", emoji: "🍰", minAge: 16, world: "court", titles: ["แผงขนมในตลาด", "ร้านขนมเล็กๆ", "ร้านขนมดังในนครหลวง", "ผู้ส่งขนมเข้าวัง", "ราชินีแห่งขนมหวาน"], baseSalary: 160_000, key: "luck", dc: 35, salary: (l, b) => b * (0.6 + l.stats.luck / 70 + Math.max(0, l.fame) / 40) },
  { id: "designer", name: "ช่างออกแบบชุดราตรี", emoji: "👗", minAge: 16, world: "court", titles: ["ช่างเย็บผ้า", "ช่างตัดชุด", "ดีไซเนอร์ประจำร้าน", "ดีไซเนอร์ของตระกูลใหญ่", "ผู้กำหนดเทรนด์แห่งจักรวรรดิ"], baseSalary: 150_000, key: "looks", dc: 45, salary: (l, b) => b * (1 + Math.max(0, l.fame) / 25) },
);

ACTIVITIES.push(
  {
    id: "c_tea",
    world: "court",
    emoji: "🫖",
    name: "จัดงานน้ำชา",
    desc: "ชื่อเสียงในสังคม",
    minAge: 12,
    cost: 30_000,
    odds: (l) => checkChance(l, "looks", 50),
    run: (l) => {
      addMoney(l, -30_000);
      if (chance(l, checkChance(l, "looks", 50))) { addFame(l, randInt(l, 2, 5)); return { text: "งานน้ำชาของคุณเป็นที่พูดถึงทั่วนครหลวง เหล่าคุณหนูขอเข้าร่วมครั้งหน้า", kind: "good" }; }
      addFame(l, -2);
      return { text: "มีคนทำชาหกใส่ชุดเคานต์เตส บรรยากาศเย็นชาไปทั้งงาน", kind: "bad" };
    },
  },
  {
    id: "c_dance",
    world: "court",
    emoji: "💃",
    name: "ซ้อมเต้นรำ",
    desc: "รูปลักษณ์ +",
    minAge: 8,
    run: (l) => { addStat(l, "looks", randInt(l, 1, 4)); addStat(l, "health", 1); return { text: "ครูสอนเต้นรำชมว่าก้าวเท้าของคุณเบาเหมือนขนนก", kind: "good" }; },
  },
  {
    id: "c_library",
    world: "court",
    emoji: "📚",
    name: "อ่านหนังสือในหอสมุด",
    desc: "สติปัญญา +",
    minAge: 6,
    run: (l) => { addStat(l, "smarts", randInt(l, 1, 4)); return { text: "คุณเจอบันทึกประวัติศาสตร์ที่ไม่มีในนิยายต้นฉบับ", kind: "good" }; },
  },
  {
    id: "c_ride",
    world: "court",
    emoji: "🐎",
    name: "ขี่ม้าล่าสัตว์",
    desc: "สุขภาพ +",
    minAge: 10,
    run: (l) => {
      addStat(l, "health", randInt(l, 2, 5));
      if (chance(l, 0.08)) { addStat(l, "health", -10); return { text: "ม้าตื่นกระต่ายป่า คุณตกม้ากลิ้งลงเนิน", kind: "bad" }; }
      return { text: "ลมป่าปลายฤดูใบไม้ร่วงพัดผ่านหน้า สดชื่นที่สุด", kind: "good" };
    },
  },
  {
    id: "c_chapel",
    world: "court",
    emoji: "⛪",
    name: "สวดมนต์ที่วิหาร",
    desc: "ความสุข + อาจมีโชค",
    minAge: 5,
    run: (l) => {
      addStat(l, "happiness", randInt(l, 3, 6));
      if (chance(l, 0.25)) { addStat(l, "luck", 1); return { text: "แสงจากกระจกสีส่องลงมาที่คุณพอดี นักบวชชราพยักหน้าให้", kind: "good" }; }
      return { text: "เสียงเพลงสวดทำให้ใจคุณสงบ", kind: "good" };
    },
  },
  {
    id: "c_doctor",
    world: "court",
    emoji: "🩺",
    name: "เรียกหมอหลวง",
    desc: "สุขภาพ ++",
    minAge: 0,
    cost: 5000,
    run: (l) => { if (l.age >= 18) addMoney(l, -5000); addStat(l, "health", randInt(l, 5, 12)); return { text: "หมอหลวงจ่ายยาและสั่งห้ามกินขนมหวานหนึ่งสัปดาห์", kind: "good" }; },
  },
  {
    id: "c_dress",
    world: "court",
    emoji: "👗",
    name: "สั่งตัดชุดราตรีใหม่",
    desc: "ความสุข + รูปลักษณ์",
    minAge: 14,
    cost: 50_000,
    run: (l) => { addMoney(l, -50_000); addStat(l, "happiness", randInt(l, 5, 10)); addStat(l, "looks", 2); return { text: "ช่างตัดเสื้อดังที่สุดในนครหลวงยอมรับงานของคุณ", kind: "good" }; },
  },
  {
    id: "c_letter",
    world: "court",
    emoji: "💌",
    name: "ส่งจดหมายผนึกกุหลาบ",
    desc: "หาคู่",
    minAge: 15,
    available: (l) => !people(l, "partner").length && !people(l, "spouse").length,
    odds: (l) => checkChance(l, "looks", 50, (l.fame > 20 ? 0.1 : 0)),
    run: (l) => {
      if (chance(l, checkChance(l, "looks", 50, l.fame > 20 ? 0.1 : 0))) {
        const p = createPerson(l, "partner", { gender: l.gender === "m" ? "f" : "m", age: l.age + randInt(l, -2, 4), bond: 60 });
        return { text: `${shortName(p)}ตอบจดหมายกลับมาพร้อมดอกไม้แห้งหนึ่งช่อ`, kind: "good" };
      }
      return { text: "จดหมายถูกส่งคืนมาโดยไม่ได้เปิดผนึก", kind: "bad" };
    },
  },
);
