// M20 — ฐานของคุณ: ลักษณะเฉพาะของโลกวันสิ้นโลก
// ตั้งฐานหลังวันสิ้นโลก · ทรัพยากร อาหาร/น้ำ/ยา/วัสดุ · ประชากร (ชาวฐานคนสำคัญ + จำนวนหัว)
// อาคารมีเลเวล · นโยบาย (ปันส่วน/รับผู้ลี้ภัย/บทลงโทษ) · วิกฤตประจำปีตามขนาดฐาน · โลกฟื้นแล้วฐานกลายเป็นเมือง
// เก็บทั้งหมดใน life.flags.base (JSON) — ไม่แตะ types.ts
import type { Outcome } from "../../engine/events";
import { yearHooks } from "../../engine/game";
import { chance, pick, randInt, weightedPick } from "../../engine/rng";
import type { Gender, Life } from "../../engine/types";
import { addFame, addMoney, addStat, clamp, countryIn, log, randomName } from "../../engine/util";

export type Res = "food" | "water" | "med" | "mat";
export type BuildingId = "wall" | "farm" | "well" | "clinic" | "shop" | "tower" | "school";
export type SiteId = "subway" | "mall" | "school" | "condo" | "hospital" | "temple";
export type Role = "doctor" | "mechanic" | "soldier" | "teacher" | "farmer" | "merchant" | "priest" | "kid";

export interface Resident {
  id: number;
  n: string;
  g: Gender;
  role: Role;
  /** ความภักดีต่อคุณ 0–100 */
  loy: number;
  /** ความสัมพันธ์พิเศษ: lover = คนรัก (ย้ายไปแท็บคน) · rival = คู่แข่งชิงอำนาจ */
  tag?: "lover" | "rival";
}

export interface Base {
  site: SiteId;
  name: string;
  food: number;
  water: number;
  med: number;
  mat: number;
  pop: number;
  morale: number;
  b: Record<BuildingId, number>;
  res: Resident[];
  /** ปันส่วน 0=อิ่ม 1=ปกติ 2=เข้มงวด */
  ration: number;
  /** ผู้ลี้ภัย 0=เปิดรับ 1=คัดกรอง 2=ปิดประตู */
  door: number;
  /** บทลงโทษ 0=ให้อภัย 1=ใช้แรงงาน 2=เนรเทศ */
  law: number;
  /** ฐานพันธมิตร */
  allies: number;
  /** ความแค้นของแก๊งปล้น/ลัทธิ 0–100 */
  feud: number;
  /** คุณเป็นผู้นำอยู่ไหม (ถูกรัฐประหารได้) */
  lead: boolean;
  founded: number;
  town?: boolean;
  /** สถิติ */
  wins: number;
  crises: number;
  peak: number;
  nextId: number;
}

export const RES_INFO: Record<Res, { emoji: string; name: string }> = {
  food: { emoji: "🥫", name: "อาหาร" },
  water: { emoji: "💧", name: "น้ำ" },
  med: { emoji: "💊", name: "ยา" },
  mat: { emoji: "🧱", name: "วัสดุ" },
};

export const ROLE_INFO: Record<Role, { emoji: string; name: string; desc: string }> = {
  doctor: { emoji: "🩺", name: "หมอ", desc: "ยา +2/ปี" },
  mechanic: { emoji: "🔧", name: "ช่าง", desc: "วัสดุ +3/ปี" },
  soldier: { emoji: "🪖", name: "อดีตทหาร", desc: "ป้องกัน +8" },
  teacher: { emoji: "📚", name: "ครู", desc: "ขวัญกำลังใจ +2/ปี" },
  farmer: { emoji: "🌾", name: "ชาวนา", desc: "อาหาร +5/ปี" },
  merchant: { emoji: "💰", name: "พ่อค้า", desc: "แลกของได้ราคาดีขึ้น" },
  priest: { emoji: "🕯️", name: "ผู้นำศรัทธา", desc: "กันลัทธิ · ขวัญ +1" },
  kid: { emoji: "🧒", name: "เด็กกำพร้า", desc: "โตขึ้นจะเป็นอะไรก็ได้" },
};

export interface BuildingInfo {
  id: BuildingId;
  emoji: string;
  name: string;
  desc: string;
  /** ค่าวัสดุต่อเลเวล */
  cost: number;
  max: number;
  effect: (lv: number) => string;
}

export const BUILDINGS: BuildingInfo[] = [
  { id: "wall", emoji: "🧱", name: "กำแพง", desc: "กันการบุกตอนกลางคืน", cost: 10, max: 5, effect: (lv) => `ป้องกัน +${lv * 14}` },
  { id: "farm", emoji: "🌱", name: "ฟาร์ม", desc: "ปลูกผักในกระถาง ไปจนถึงไร่บนดาดฟ้า", cost: 8, max: 5, effect: (lv) => `อาหาร +${lv * 12}/ปี` },
  { id: "well", emoji: "🚰", name: "เครื่องกรองน้ำ", desc: "กรองน้ำฝนเถ้าให้ดื่มได้", cost: 8, max: 5, effect: (lv) => `น้ำ +${lv * 14}/ปี` },
  { id: "clinic", emoji: "🏥", name: "ห้องพยาบาล", desc: "รักษาคนป่วย ลดคนตายจากโรคระบาด", cost: 12, max: 5, effect: (lv) => `ยา +${lv * 3}/ปี · ฟื้นสุขภาพ +${lv}` },
  { id: "shop", emoji: "🛠️", name: "เวิร์กช็อป", desc: "ซ่อมของ แปรรูปซากเป็นวัสดุ", cost: 10, max: 5, effect: (lv) => `วัสดุ +${lv * 5}/ปี` },
  { id: "tower", emoji: "🗼", name: "หอสังเกตการณ์", desc: "เห็นศัตรูก่อนมันเห็นเรา", cost: 8, max: 5, effect: (lv) => `ป้องกัน +${lv * 6} · เตือนภัยล่วงหน้า` },
  { id: "school", emoji: "📖", name: "ห้องเรียน", desc: "ให้เด็กๆ ยังมีอนาคต", cost: 10, max: 5, effect: (lv) => `ขวัญกำลังใจ +${lv * 3}/ปี` },
];
export const buildingById = (id: BuildingId) => BUILDINGS.find((b) => b.id === id)!;

export interface SiteInfo {
  id: SiteId;
  emoji: string;
  name: string;
  desc: string;
  def: number;
  /** ตัวคูณผลผลิตฟาร์ม */
  farm: number;
  start: Partial<Record<Res, number>> & { pop?: number; morale?: number };
  free?: Partial<Record<BuildingId, number>>;
}

export const SITES: SiteInfo[] = [
  { id: "subway", emoji: "🚇", name: "สถานีรถไฟใต้ดิน", desc: "ทางเข้าน้อย กันง่าย — แต่ปลูกอะไรแทบไม่ได้", def: 18, farm: 0.6, start: { water: 25, pop: 14 } },
  { id: "mall", emoji: "🏬", name: "ห้างสรรพสินค้า", desc: "ของกินของใช้ล้นโกดัง แต่ผนังกระจกรอบตึก", def: -8, farm: 0.9, start: { food: 45, mat: 25, pop: 12 } },
  { id: "school", emoji: "🏫", name: "โรงเรียนประจำอำเภอ", desc: "สนามฟุตบอลกลายเป็นไร่ เด็กๆ เยอะ", def: 4, farm: 1.4, start: { pop: 16, morale: 60 }, free: { school: 1 } },
  { id: "condo", emoji: "🏢", name: "คอนโดสามสิบชั้น", desc: "ชั้นบนมองเห็นได้ทั้งเมือง แต่บันไดคือทางเดียว", def: 8, farm: 0.8, start: { mat: 15, pop: 12 }, free: { tower: 1 } },
  { id: "hospital", emoji: "🏨", name: "โรงพยาบาลร้าง", desc: "ยาเหลือในคลังเพียบ — และเชื้อโรคด้วย", def: 0, farm: 0.7, start: { med: 25, pop: 10 }, free: { clinic: 1 } },
  { id: "temple", emoji: "🛕", name: "วัดเก่าริมแม่น้ำ", desc: "ใกล้น้ำ คนศรัทธาสูง ลัทธิเข้ายาก", def: 2, farm: 1.2, start: { water: 30, pop: 10, morale: 65 } },
];
export const siteById = (id: SiteId) => SITES.find((s) => s.id === id)!;

export const RATION = ["อิ่มท้อง", "ปกติ", "เข้มงวด"];
export const DOOR = ["เปิดรับทุกคน", "คัดกรอง", "ปิดประตู"];
export const LAW = ["ให้อภัย", "ใช้แรงงานชดใช้", "เนรเทศ"];

// ───────────────────────── อ่าน/เขียนสถานะ ─────────────────────────

const ruins = (l: Life) => !!l.flags.doomed && !l.flags.rebuilt;

export function getBase(l: Life): Base | undefined {
  const raw = l.flags.base;
  if (typeof raw !== "string") return;
  try {
    return JSON.parse(raw) as Base;
  } catch {
    return;
  }
}

export function setBase(l: Life, b: Base) {
  b.food = Math.max(0, Math.round(b.food));
  b.water = Math.max(0, Math.round(b.water));
  b.med = Math.max(0, Math.round(b.med));
  b.mat = Math.max(0, Math.round(b.mat));
  b.pop = Math.max(2, Math.round(b.pop));
  b.morale = clamp(Math.round(b.morale), 0, 100);
  b.feud = clamp(Math.round(b.feud), 0, 100);
  b.peak = Math.max(b.peak, b.pop);
  l.flags.base = JSON.stringify(b);
}

/** แก้สถานะฐานแล้วบันทึก */
export function withBase<T>(l: Life, fn: (b: Base) => T): T | undefined {
  const b = getBase(l);
  if (!b) return;
  const out = fn(b);
  setBase(l, b);
  return out;
}

export const hasBase = (l: Life) => typeof l.flags.base === "string";
/** มีฐานและโลกยังพังอยู่ */
export const inBase = (l: Life) => ruins(l) && hasBase(l) && !!l.power;
/** มีฐานและคุณเป็นผู้นำ */
export const leads = (l: Life) => inBase(l) && !!getBase(l)?.lead;
/** ฐานกลายเป็นเมืองหลังโลกฟื้น */
export const isTown = (l: Life) => !!getBase(l)?.town;

export const levelSum = (b: Base) => Object.values(b.b).reduce((s, x) => s + x, 0);
export const baseSize = (b: Base) => b.pop + levelSum(b) * 3;
export const TIERS = ["ค่ายผู้รอดชีวิต", "ชุมชน", "ป้อมปราการ", "นครรัฐ"];
export const tierOf = (b: Base) => (baseSize(b) < 28 ? 0 : baseSize(b) < 60 ? 1 : baseSize(b) < 110 ? 2 : 3);
export const tierName = (b: Base) => (b.town ? "เมือง" : TIERS[tierOf(b)]);

export const roleCount = (b: Base, r: Role) => b.res.filter((x) => x.role === r).length;

export function defense(b: Base) {
  return Math.round(b.b.wall * 14 + b.b.tower * 6 + b.pop * 0.4 + roleCount(b, "soldier") * 8 + siteById(b.site).def);
}

/** โบนัสโอกาสสู้ป้องกันฐาน (ใส่เป็น mod ของ fightOdds/survivalOdds) */
export function defMod(l: Life) {
  const b = getBase(l);
  if (!b) return 0;
  return clamp(defense(b) / 160 - (b.morale < 25 ? 0.08 : 0), -0.1, 0.3);
}

/** ฐานช่วยฉากภารกิจหลักแค่ไหน (แข็งแรง = รอดง่าย รางวัลดี) */
export function mainMod(l: Life) {
  const b = getBase(l);
  if (!b || !ruins(l)) return 0;
  return clamp(defMod(l) * 0.5 + tierOf(b) * 0.02 + (b.morale - 50) / 1000, -0.05, 0.2);
}

/** แรงก์ของศัตรูที่มาบุกฐาน — ฐานใหญ่ดึงศัตรูใหญ่ */
export function threatRank(l: Life) {
  const b = getBase(l);
  const r = l.power?.rank ?? 0;
  const scen = Number(l.flags.mainScenario ?? 1);
  return clamp(Math.min(r + (b ? Math.max(0, tierOf(b) - 1) : 0), Math.floor(scen / 2) + 1 + (b ? tierOf(b) : 0)), 0, 8);
}

/** ขนาดของการเปลี่ยนทรัพยากร — คืนข้อความสรุป เช่น " (อาหาร +10 · วัสดุ -5)" */
export function addRes(l: Life, d: Partial<Record<Res | "pop" | "morale", number>>): string {
  const b = getBase(l);
  if (!b) return "";
  const parts: string[] = [];
  for (const k of ["food", "water", "med", "mat"] as Res[]) {
    const v = Math.round(d[k] ?? 0);
    if (!v) continue;
    const before = b[k];
    b[k] = Math.max(0, b[k] + v);
    const real = b[k] - before;
    if (real) parts.push(`${RES_INFO[k].name} ${real > 0 ? "+" : ""}${real}`);
  }
  if (d.pop) {
    const before = b.pop;
    b.pop = Math.max(2, b.pop + Math.round(d.pop));
    if (b.pop !== before) parts.push(`ประชากร ${b.pop > before ? "+" : ""}${b.pop - before}`);
  }
  if (d.morale) {
    const before = b.morale;
    b.morale = clamp(b.morale + Math.round(d.morale), 0, 100);
    if (b.morale !== before) parts.push(`ขวัญ ${b.morale > before ? "+" : ""}${b.morale - before}`);
  }
  setBase(l, b);
  return parts.length ? ` (${parts.join(" · ")})` : "";
}

// ───────────────────────── ชาวฐาน ─────────────────────────

function nameFor(l: Life, g: Gender) {
  const n = randomName(l, g);
  return !countryIn(l) || countryIn(l) === "th" ? n.nick : n.first;
}

export function addResident(l: Life, b: Base, role?: Role, g?: Gender): Resident {
  const gender = g ?? (chance(l, 0.5) ? "m" : "f");
  let n = nameFor(l, gender);
  for (let i = 0; i < 4 && b.res.some((x) => x.n === n); i++) n = nameFor(l, gender);
  const r: Resident = {
    id: b.nextId++,
    n,
    g: gender,
    role: role ?? pick(l, ["doctor", "mechanic", "soldier", "teacher", "farmer", "merchant", "priest", "kid"] as Role[]),
    loy: randInt(l, 40, 70),
  };
  b.res.push(r);
  return r;
}

export const residentById = (b: Base, id: number) => b.res.find((r) => r.id === id);
/** สุ่มชาวฐานคนสำคัญ (เลือกบทบาทได้) */
export function someResident(l: Life, roles?: Role[]): Resident | undefined {
  const b = getBase(l);
  if (!b) return;
  const pool = b.res.filter((r) => !roles || roles.includes(r.role));
  return pool.length ? pick(l, pool) : undefined;
}

export function removeResident(l: Life, id: number) {
  withBase(l, (b) => {
    b.res = b.res.filter((r) => r.id !== id);
    b.pop -= 1;
  });
}

export function bumpLoyalty(l: Life, id: number, d: number) {
  withBase(l, (b) => {
    const r = residentById(b, id);
    if (r) r.loy = clamp(r.loy + d, 0, 100);
  });
}

// ───────────────────────── ตั้งฐาน ─────────────────────────

export function foundBase(l: Life, site: SiteId, lead = true): string {
  const s = siteById(site);
  const b: Base = {
    site,
    name: s.name,
    food: 20 + (s.start.food ?? 0),
    water: 20 + (s.start.water ?? 0),
    med: 5 + (s.start.med ?? 0),
    mat: 10 + (s.start.mat ?? 0),
    pop: s.start.pop ?? 12,
    morale: s.start.morale ?? 50,
    b: { wall: 0, farm: 0, well: 0, clinic: 0, shop: 0, tower: 0, school: 0, ...s.free },
    res: [],
    ration: 1,
    door: 1,
    law: 1,
    allies: 0,
    feud: 10,
    lead,
    founded: l.age,
    wins: 0,
    crises: 0,
    peak: 0,
    nextId: 1,
  };
  const stock = Number(l.flags.stockpile ?? 0);
  b.food += stock * 8;
  b.water += stock * 6;
  const roles: Role[] = site === "hospital" ? ["doctor", "soldier", "kid"] : site === "school" ? ["teacher", "kid", "farmer"] : ["mechanic", "soldier", "doctor"];
  for (const r of roles) addResident(l, b, r);
  const prep = applyPrep(l, b);
  setBase(l, b);
  l.flags.baseFounded = l.age;
  return `${s.emoji} ${s.name} กลายเป็นฐานของคุณ — ผู้รอดชีวิต ${b.pop} คน${prep.length ? ` · สิ่งที่เตรียมไว้ก่อนวันสิ้นโลกช่วยได้: ${prep.join(", ")}` : ""}`;
}

/** สิ่งที่ทำไว้ก่อนวันสิ้นโลก (event a20.pre.*) กลายเป็นทุนของฐาน */
function applyPrep(l: Life, b: Base): string[] {
  const f = l.flags;
  const out: string[] = [];
  if (f.a20prep_well) { b.b.well = Math.max(b.b.well, 1); out.push("เครื่องกรองน้ำที่ลุงสอนทำ"); }
  if (f.a20prep_farm) { b.b.farm = Math.max(b.b.farm, 1); out.push("เมล็ดพันธุ์จากสวนของยาย"); }
  if (f.a20prep_wall) { b.b.wall = Math.max(b.b.wall, 1); out.push("แบบแปลนหลุมหลบภัย"); }
  if (f.a20prep_mat) { b.mat += 15; out.push("วิชาสร้างที่พักจากค่ายลูกเสือ"); }
  if (f.a20prep_med) { b.med += 10; out.push("วิชาปฐมพยาบาล"); }
  if (f.a20prep_radio) { b.allies += 1; out.push("วิทยุสมัครเล่นที่ติดต่อฐานอื่นได้"); }
  if (f.a20mallKnow && b.site === "mall") { b.food += 25; out.push("คุณรู้ว่าโกดังลับของห้างอยู่ตรงไหน"); }
  if (f.a20subwayKnow && b.site === "subway") { b.mat += 12; b.b.wall += 1; out.push("คุณจำแผนผังอุโมงค์ได้ทุกทางแยก"); }
  if (f.a20doc) { const r = addResident(l, b, "doctor"); r.n = String(f.a20doc); r.loy = 80; out.push(`หมอ${r.n}ที่คุณเคยช่วยงานที่โรงพยาบาล`); }
  if (f.a20kidName) { const r = addResident(l, b, "kid"); r.n = String(f.a20kidName); r.loy = 90; out.push(`${r.n} เด็กข้างบ้านที่คุณเคยติวให้`); }
  if (f.a20soldier) { addResident(l, b, "soldier").loy = 75; out.push("เพื่อนจากการฝึกทหารกองหนุน"); }
  if (f.a20preacher) { const r = addResident(l, b, "priest"); r.n = "ลุงนักเทศน์"; r.loy = 85; out.push("ลุงนักเทศน์ที่คุณเคยให้น้ำ"); }
  if (f.a20dog) { b.morale += 6; out.push(`เจ้า${f.a20dog}เห่าเตือนภัยได้ดีกว่ายามบางคน`); }
  return out;
}

// ───────────────────────── สร้าง/อัปเกรด ─────────────────────────

export const BUILDS_PER_YEAR = 2;
export const buildsLeft = (l: Life) => BUILDS_PER_YEAR - l.doneThisYear.filter((x) => x === "a20build").length;
export const nextCost = (b: Base, id: BuildingId) => buildingById(id).cost * (b.b[id] + 1);

export function canBuild(l: Life, id: BuildingId): string | undefined {
  const b = getBase(l);
  if (!b) return "ยังไม่มีฐาน";
  if (!ruins(l)) return "โลกฟื้นแล้ว";
  if (!b.lead) return "คุณไม่ใช่ผู้นำ";
  const info = buildingById(id);
  if (b.b[id] >= info.max) return "เลเวลสูงสุด";
  if (buildsLeft(l) <= 0) return "ปีนี้ช่างหมดแรงแล้ว";
  if (b.mat < nextCost(b, id)) return "วัสดุไม่พอ";
  return;
}

export function build(l: Life, id: BuildingId): Outcome {
  const why = canBuild(l, id);
  if (why) return { text: why, kind: "bad" };
  const info = buildingById(id);
  const lv = withBase(l, (b) => {
    b.mat -= nextCost(b, id);
    b.b[id]++;
    b.morale += 2;
    return b.b[id];
  })!;
  l.doneThisYear.push("a20build");
  const flavor: Record<BuildingId, string> = {
    wall: "เหล็กจากรถที่จอดทิ้งถูกเชื่อมเป็นแผ่นสูงท่วมหัว",
    farm: "เด็กๆ ช่วยกันขนดินขึ้นมาทีละถัง",
    well: "ท่อพีวีซี ถ่าน และผ้าขาวบาง — น้ำใสไหลออกมาหยดแรก ทุกคนปรบมือ",
    clinic: "ผ้าม่านถูกตัดเป็นผ้าปูเตียง กลิ่นแอลกอฮอล์ลอยไปทั้งชั้น",
    shop: "เสียงค้อนดังทั้งวัน ช่างในฐานยิ้มเป็นครั้งแรก",
    tower: "ยามคนแรกปีนขึ้นไปแล้วตะโกนว่า 'เห็นไกลถึงแม่น้ำเลย!'",
    school: "กระดานดำถูกลากมาจากซาก เด็กๆ เขียนชื่อตัวเองเรียงกัน",
  };
  return { text: `${info.emoji} ${info.name} Lv.${lv} — ${flavor[id]} (${info.effect(lv)})`, kind: "good" };
}

export function setPolicy(l: Life, key: "ration" | "door" | "law", v: number): Outcome {
  const b = getBase(l);
  if (!b?.lead) return { text: "คุณไม่ใช่ผู้นำฐาน", kind: "bad" };
  withBase(l, (x) => {
    x[key] = v;
  });
  const names = { ration: RATION, door: DOOR, law: LAW }[key];
  const label = { ration: "นโยบายปันส่วน", door: "นโยบายผู้ลี้ภัย", law: "บทลงโทษ" }[key];
  return { text: `📜 ${label}: ${names[v]}` };
}

// ───────────────────────── ทุกปี ─────────────────────────

type CrisisKind = "siege" | "plague" | "fire" | "betrayal" | "rival" | "cult" | "coup" | "riot";

function scheduleCrisis(l: Life, b: Base) {
  if (b.morale < 18 && b.lead && chance(l, 0.6)) return setCrisis(l, chance(l, 0.5) ? "coup" : "riot");
  const p = clamp(0.28 + baseSize(b) / 260 + b.feud / 400, 0.25, 0.8);
  if (!chance(l, p)) return;
  const t = tierOf(b);
  const kind = weightedPick(l, ["siege", "plague", "fire", "betrayal", "rival", "cult"] as const, (k) =>
    ({
      siege: 30,
      plague: 14 + (b.site === "hospital" ? 10 : 0) - b.b.clinic * 2,
      fire: 10,
      betrayal: 6 + t * 3,
      rival: t >= 1 ? 8 + t * 6 + b.feud / 10 : 0,
      cult: t >= 1 && roleCount(b, "priest") === 0 && b.site !== "temple" ? 8 + t * 3 : 2,
    })[k],
  )!;
  setCrisis(l, kind);
}

function setCrisis(l: Life, kind: CrisisKind) {
  l.flags.a20crisis = kind;
  l.flags.a20crisisAge = l.age;
}

export const crisisNow = (l: Life, kind: CrisisKind) => inBase(l) && l.flags.a20crisis === kind && Number(l.flags.a20crisisAge) === l.age;

function townYear(l: Life, b: Base) {
  const income = Math.round((b.pop * 6_000 + levelSum(b) * 20_000) / 1000) * 1000;
  addMoney(l, income);
  if (b.lead) addFame(l, chance(l, 0.3) ? 1 : 0);
  b.pop += randInt(l, 1, 4) + Math.floor(b.b.school / 2);
  b.morale = b.morale + Math.sign(70 - b.morale) * 3;
  setBase(l, b);
  if (chance(l, 0.25)) log(l, `🏘️ เมือง${b.name}: ประชากร ${b.pop} คน · ภาษีและการค้าเข้ากองกลาง ${income.toLocaleString("th-TH")} บาท`, "good");
}

function baseYear(l: Life) {
  if (l.worldId !== "apocalypse" || !l.alive) return;
  const b = getBase(l);
  if (!b) return;
  if (l.flags.rebuilt) {
    if (!b.town) {
      b.town = true;
      b.morale = Math.max(b.morale, 60);
      setBase(l, b);
      log(l, `🏘️ หน้าต่างระบบดับลง แต่กำแพงของ${b.name}ยังอยู่ — ฐานของคุณกลายเป็นเมืองแห่งหนึ่งของโลกใหม่ (ประชากร ${b.pop} คน)`, "milestone");
      if (b.lead) addFame(l, 4 + tierOf(b) * 3);
      return;
    }
    return townYear(l, b);
  }
  if (!l.power) return;
  const s = siteById(b.site);
  const notes: string[] = [];
  const before = b.pop;

  // ผลผลิต
  b.food += b.b.farm * 12 * s.farm + b.pop * 0.35 + roleCount(b, "farmer") * 5 + randInt(l, -3, 5);
  b.water += b.b.well * 14 + b.pop * 0.45 + (b.site === "temple" ? 8 : 0) + randInt(l, -3, 4);
  b.med += b.b.clinic * 3 + roleCount(b, "doctor") * 2 + randInt(l, 0, 2);
  b.mat += b.b.shop * 5 + b.pop * 0.25 + roleCount(b, "mechanic") * 3 + (b.law === 1 ? b.pop * 0.08 : 0) + randInt(l, 0, 3);

  // การบริโภค
  b.food -= b.pop * [1.25, 1, 0.75][b.ration];
  b.water -= b.pop * 0.9;
  b.med -= Math.ceil(b.pop / 14);

  // ขวัญกำลังใจ
  let mo = [6, 0, -7][b.ration] + b.b.school * 3 + roleCount(b, "teacher") * 2 + roleCount(b, "priest") + (b.site === "temple" ? 2 : 0) + [1, 0, -2][b.law];
  mo += Math.sign(50 - b.morale) * 2;

  // ขาดแคลน
  if (b.food < 0) {
    const gone = Math.ceil(-b.food / 4);
    b.pop -= gone;
    mo -= 12;
    b.food = 0;
    addStat(l, "health", -randInt(l, 3, 7));
    notes.push(`อาหารหมด — ${gone} คนหนีไปหาที่ใหม่`);
  }
  if (b.water < 0) {
    const gone = Math.ceil(-b.water / 5);
    b.pop -= gone;
    mo -= 10;
    b.water = 0;
    addStat(l, "health", -randInt(l, 2, 6));
    notes.push(`น้ำหมด — คนป่วยจากน้ำสกปรก ${gone} คนไม่รอด`);
  }
  if (b.med < 0) {
    b.med = 0;
    if (chance(l, 0.5)) {
      b.pop -= 1;
      mo -= 4;
      notes.push("ยาหมด — ไข้ธรรมดาก็พรากคนไปได้");
    }
  } else if (b.b.clinic) addStat(l, "health", b.b.clinic);

  // ผู้ลี้ภัย
  const arrivals = [randInt(l, 2, 6), randInt(l, 1, 3), 0][b.door] + (b.morale >= 70 ? 1 : 0);
  if (arrivals) b.pop += arrivals;
  if (b.morale < 30) {
    const left = randInt(l, 1, 4);
    b.pop -= left;
    notes.push(`ขวัญต่ำ — ${left} คนแอบหนีตอนกลางคืน`);
  }
  b.morale += mo;
  if (b.res.length < 7 && arrivals && chance(l, 0.3)) {
    const r = addResident(l, b);
    notes.push(`${ROLE_INFO[r.role].emoji} ${r.n} (${ROLE_INFO[r.role].name}) มาพร้อมผู้ลี้ภัย`);
  }
  // ชาวฐานที่ไม่ภักดีอาจจากไป
  const leaving = b.res.find((r) => r.loy < 12 && r.tag !== "lover");
  if (leaving && chance(l, 0.5)) {
    b.res = b.res.filter((r) => r !== leaving);
    notes.push(`${leaving.n} เก็บของออกจากฐานไปโดยไม่ลา`);
  }
  b.feud = Math.max(0, b.feud - 3);
  setBase(l, b);
  const nb = getBase(l)!;
  const delta = nb.pop - before;
  log(
    l,
    `🏚️ ${nb.name}: ประชากร ${nb.pop}${delta ? ` (${delta > 0 ? "+" : ""}${delta})` : ""} · 🥫${nb.food} 💧${nb.water} 💊${nb.med} 🧱${nb.mat} · ขวัญ ${nb.morale}${notes.length ? " — " + notes.join(" · ") : ""}`,
    notes.length ? "bad" : "normal",
  );
  scheduleCrisis(l, nb);
}

yearHooks.push(baseYear);
