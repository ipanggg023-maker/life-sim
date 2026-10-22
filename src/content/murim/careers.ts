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
  { id: "official", name: "ขุนนาง", emoji: "📯", minAge: 18, world: "murim", titles: ["เสมียนอำเภอ", "นายอำเภอ", "เจ้าเมือง", "ข้าหลวงมณฑล", "เสนาบดี"], baseSalary: 350_000, key: "smarts", dc: 60, mundaneOnly: true, needs: (l) => (l.flags.xiucai ? undefined : "ต้องสอบขุนนางระดับอำเภอผ่านก่อน (เป็นบัณฑิต)") },
);


// ───────────────────────── อาชีพเพิ่มเติม (MURIM_PLAN §6) ─────────────────────────
// ทุกอาชีพมีบันได 5 ขั้น · บางอาชีพมีเงื่อนไขจริงของโลก: สอบขุนนาง · ถือพรหมจรรย์ · ฝ่ายมาร · ยุคสงคราม
const war = (l: { mw?: { era: string } }) => l.mw?.era === "war" || l.mw?.era === "chaos";
CAREERS.push(
  { id: "fisher", name: "ชาวประมง", emoji: "🎣", minAge: 12, world: "murim", titles: ["ลูกเรือหาปลา", "ชาวประมง", "เจ้าของเรือ", "นายท่าเรือประมง", "เจ้าแห่งท่าเรือ"], baseSalary: 65_000, key: "health", dc: 10 },
  { id: "hunter_m", name: "นายพราน", emoji: "🏹", minAge: 14, world: "murim", titles: ["เด็กตามพราน", "นายพราน", "พรานเจนป่า", "พรานล่าเสือ", "ราชาแห่งพงไพร"], baseSalary: 80_000, key: "health", dc: 30 },
  { id: "porter", name: "กุลีแบกหาม", emoji: "🧺", minAge: 12, world: "murim", titles: ["กุลีรายวัน", "กุลีประจำท่า", "หัวหน้ากุลี", "นายหน้าแรงงาน", "เจ้าพ่อท่าเรือ"], baseSalary: 55_000, key: "health", dc: 5 },
  { id: "gambler", name: "นักพนันอาชีพ", emoji: "🎲", minAge: 18, world: "murim", titles: ["นักพนันตามบ่อน", "เซียนลูกเต๋า", "นักพนันมีชื่อ", "เจ้ามือ", "เจ้าของบ่อน"], baseSalary: 90_000, key: "luck", dc: 50, salary: (l, b) => b * (0.3 + l.stats.luck / 50) },
  { id: "smith", name: "ช่างตีเหล็ก", emoji: "⚒️", minAge: 14, world: "murim", titles: ["ลูกมือโรงตีเหล็ก", "ช่างตีเหล็ก", "ช่างตีอาวุธ", "ปรมาจารย์ช่างกระบี่", "ช่างกระบี่ในตำนาน"], baseSalary: 110_000, key: "health", dc: 40, needs: (l) => (l.flags.smithSkill || l.stats.health >= 55 ? undefined : "ต้องเคยฝึกงานโรงตีเหล็ก หรือร่างกายแข็งแรงพอ") },
  { id: "tailor", name: "ช่างตัดเสื้อ", emoji: "🧵", minAge: 14, world: "murim", titles: ["ลูกมือร้านผ้า", "ช่างตัดเสื้อ", "ช่างฝีมือดี", "ช่างตัดชุดขุนนาง", "ช่างหลวง"], baseSalary: 85_000, key: "smarts", dc: 30 },
  { id: "carpenter", name: "ช่างไม้", emoji: "🪚", minAge: 14, world: "murim", titles: ["ลูกมือช่างไม้", "ช่างไม้", "ช่างสร้างบ้าน", "นายช่างวัด", "นายช่างวังหลวง"], baseSalary: 90_000, key: "health", dc: 25 },
  { id: "merchant", name: "พ่อค้า", emoji: "🧳", minAge: 16, world: "murim", titles: ["พ่อค้าเร่", "พ่อค้าแผงลอย", "พ่อค้ามีร้าน", "นายกองคาราวาน", "ประธานสมาคมพ่อค้า"], baseSalary: 130_000, key: "smarts", dc: 40, salary: (l, b) => b * (l.mw?.era === "peace" || l.mw?.era === "recovery" ? 1.3 : l.mw?.era === "chaos" || l.mw?.era === "war" ? 0.6 : 1) },
  { id: "constable", name: "มือปราบ", emoji: "🪪", minAge: 18, world: "murim", titles: ["มือปราบฝึกหัด", "มือปราบ", "มือปราบอาวุโส", "หัวหน้ามือปราบ", "หัวหน้ามือปราบประจำมณฑล"], baseSalary: 150_000, key: "health", dc: 45, needs: (l) => (l.flags.wanted ? "คุณถูกประกาศจับอยู่" : Number(l.flags.heat ?? 0) >= 30 ? "ทางการยังจับตามองคุณอยู่" : undefined) },
  { id: "soldier", name: "ทหาร", emoji: "🛡️", minAge: 16, world: "murim", titles: ["พลทหาร", "นายสิบ", "นายร้อย", "นายพัน", "แม่ทัพ"], baseSalary: 100_000, key: "health", dc: 20, salary: (l, b) => b * (war(l) ? 1.6 : 1) },
  { id: "teacher", name: "ครูสอนหนังสือ", emoji: "🖌️", minAge: 18, world: "murim", titles: ["ครูหมู่บ้าน", "ครูประจำตำบล", "ครูมีชื่อ", "อาจารย์สำนักศึกษา", "ปราชญ์แห่งแผ่นดิน"], baseSalary: 95_000, key: "smarts", dc: 55 },
  { id: "monk", name: "พระวัดวัชระ / นักพรต", emoji: "📿", minAge: 12, world: "murim", titles: ["เณร", "ภิกษุ", "ภิกษุอาวุโส", "เจ้าอาวาส", "พระมหาเถระ"], baseSalary: 20_000, key: "smarts", dc: 30, needs: (l) => (l.people.some((p) => p.alive && (p.relation === "spouse" || p.relation === "partner")) ? "ต้องถือพรหมจรรย์ — มีคู่ครองอยู่" : undefined) },
  { id: "beggar_sect", name: "พรรคกระยาจก", emoji: "🥣", minAge: 10, world: "murim", titles: ["ศิษย์ถุงเดียว", "ศิษย์สามถุง", "ศิษย์ห้าถุง", "ผู้อาวุโสเจ็ดถุง", "ผู้อาวุโสเก้าถุง"], baseSalary: 15_000, key: "luck", dc: 20 },
  { id: "bandit", name: "โจรภูเขา", emoji: "🏴", minAge: 16, world: "murim", titles: ["ลูกน้องโจร", "โจรภูเขา", "หัวหน้าหมู่โจร", "รองหัวหน้าค่าย", "ราชาโจร"], baseSalary: 160_000, key: "health", dc: 30 },
  { id: "pirate", name: "โจรสลัดแม่น้ำ", emoji: "⛵", minAge: 16, world: "murim", titles: ["ลูกเรือโจร", "โจรสลัด", "นายท้ายเรือโจร", "กัปตันโจรสลัด", "เจ้าแห่งแม่น้ำ"], baseSalary: 170_000, key: "health", dc: 35, needs: (l) => (l.flags.region === "jiangnan" || l.flags.region === "south" ? undefined : "ต้องอยู่เจียงหนานหรือป่าทางใต้ (มีแม่น้ำใหญ่)") },
  { id: "thief", name: "หัวขโมย", emoji: "🦝", minAge: 12, world: "murim", titles: ["เด็กล้วงกระเป๋า", "หัวขโมย", "จอมโจรย่องเบา", "จอมโจรไร้เงา", "ราชาโจรแห่งเมืองหลวง"], baseSalary: 90_000, key: "luck", dc: 35 },
  { id: "poisoner", name: "นักปรุงพิษ", emoji: "🧪", minAge: 18, world: "murim", titles: ["ลูกมือปรุงยา", "นักปรุงพิษ", "ผู้เชี่ยวชาญพิษ", "ปรมาจารย์พิษ", "ราชาพิษ"], baseSalary: 180_000, key: "smarts", dc: 60, needs: (l) => (l.flags.medicKnow || l.flags.tangInLaw || l.flags.region === "sichuan" ? undefined : "ต้องรู้เรื่องสมุนไพร หรือเกี่ยวข้องกับตระกูลถัง") },
  { id: "cultist", name: "สาวกลัทธิมาร", emoji: "🩸", minAge: 14, world: "murim", titles: ["สาวกใหม่", "สาวกชั้นใน", "ผู้พิทักษ์ธรรมมาร", "ราชันมาร", "เสาหลักลัทธิ"], baseSalary: 120_000, key: "happiness", dc: 20, needs: (l) => (Number(l.flags.m17Align ?? 0) <= -15 || l.flags.region === "west" ? undefined : "ลัทธิไม่ไว้ใจคนที่ยังยึดธรรมะ") },
);

/** อาชีพสายมืด: ทางการรู้มากขึ้นทุกปีที่ทำ */
export const DARK_JOBS = new Set(["bandit", "pirate", "thief", "poisoner", "cultist", "m_assassin"]);

// ───────────────────────── อาชีพสายราชสำนักและงานทั่วไปเพิ่มเติม (MURIM_PLAN §6 · §8.7) ─────────────────────────
CAREERS.push(
  { id: "woodcutter", name: "คนตัดฟืน", emoji: "🪓", minAge: 12, world: "murim", titles: ["เด็กเก็บฟืน", "คนตัดฟืน", "คนตัดไม้ประจำป่า", "นายหน้าไม้", "เจ้าของป่าไม้"], baseSalary: 50_000, key: "health", dc: 5 },
  { id: "waiter", name: "เด็กเสิร์ฟโรงน้ำชา", emoji: "🍵", minAge: 12, world: "murim", titles: ["เด็กล้างถ้วย", "เด็กเสิร์ฟ", "หัวหน้าเด็กเสิร์ฟ", "ผู้จัดการโรงน้ำชา", "หุ้นส่วนโรงน้ำชา"], baseSalary: 55_000, key: "looks", dc: 10 },
  { id: "imperial_guard", name: "องครักษ์หลวง", emoji: "🛡️", minAge: 18, world: "murim", titles: ["ทหารรักษาประตูวัง", "องครักษ์", "หัวหน้าเวรองครักษ์", "รองผู้บัญชาการองครักษ์", "ผู้บัญชาการองครักษ์หลวง"], baseSalary: 260_000, key: "health", dc: 55, needs: (l) => ((l.power?.rank ?? 0) < 3 ? "ต้องมีฝีมือขั้นชั้นหนึ่งขึ้นไป" : l.flags.wanted || l.flags.courtBlacklist ? "ประวัติไม่สะอาดพอจะเข้าวัง" : undefined) },
  { id: "jinyiwei", name: "องครักษ์เสื้อแพร", emoji: "🕵️", minAge: 20, world: "murim", titles: ["สายลับฝึกหัด", "องครักษ์เสื้อแพร", "หัวหน้ากองสืบ", "รองผู้บัญชาการเสื้อแพร", "ผู้บัญชาการเสื้อแพร"], baseSalary: 320_000, key: "smarts", dc: 65, needs: (l) => ((l.power?.rank ?? 0) < 3 ? "ต้องมีฝีมือขั้นชั้นหนึ่งขึ้นไป" : l.stats.smarts < 55 ? "ต้องฉลาดพอจะสืบคดีการเมือง" : l.flags.wanted ? "ถูกประกาศจับอยู่" : undefined) },
  { id: "palace_physician", name: "หมอหลวง", emoji: "⚕️", minAge: 25, world: "murim", titles: ["ผู้ช่วยหมอหลวง", "หมอหลวง", "หมอหลวงอาวุโส", "หัวหน้าสำนักหมอหลวง", "หมอประจำพระองค์"], baseSalary: 380_000, key: "smarts", dc: 70, needs: (l) => (l.flags.medicKnow || (l.job?.careerId === "herbalist" && l.job.level >= 3) ? undefined : "ต้องเป็นหมอที่มีชื่อเสียงมาก่อน (หมอยาขั้น 3 ขึ้นไป หรือรู้วิชาแพทย์)") },
);
