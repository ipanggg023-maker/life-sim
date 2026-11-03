// ข้อมูลของโลกแฟนตาซี: ส่วนที่อยู่กับตัวละคร (FLife) และส่วนที่อยู่ต่อหลังตัวละครตาย (FWorld)
import { pick, randInt } from "../../engine/rng";
import type { Life } from "../../engine/types";
import { clamp } from "../../engine/util";
import { newWorldState, type WorldState } from "../../engine/worldState";

export type RaceId = "human" | "elf" | "dwarf";
export type Element = "fire" | "water" | "earth" | "wind" | "light" | "dark";

export interface Wand { name: string; quality: number; material: string }

export interface FLife {
  race: RaceId;
  kingdom: string;
  /** พลังเวทแต่กำเนิด 0–5 · 0 ยังใช้คทาได้ */
  potential: number;
  body: number;
  magic: number;
  bodyRank: number;
  magicRank: number;
  wand?: Wand;
  school?: string;
  schoolSince?: number;
  graduated?: boolean;
  /** ขั้นกิลด์ 0 = ไม่ได้สมัคร */
  guild: number;
  contracts: number;
  relic?: string;
  clues: Record<string, number>;
  dragonBond: number;
  deeds: string[];
  /** ย้อนชะตาฟรีใช้ไปแล้วในชีวิตนี้ */
  mercyUsed?: boolean;
  scars: string[];
  threads: number;
  element?: Element;
  spells?: string[];
  manaUsed?: number;
  /** ศาสตร์เวท ขั้น 0–3 */
  chant?: number;
  circle?: number;
  rune?: number;
  classScore?: number;
  cups?: number;
  rivalId?: string;
  rivalPower?: number;
  /** เพดานของคู่ปรับคนนี้ · บางคนเป็นตำนาน บางคนไม่ */
  rivalPeak?: number;
  /** ความคืบหน้าความลับของโรงเรียน 0–3 */
  secret?: number;
  faction?: string;
  fRank: number;
  fMerit?: number;
  /** ฝ่ายที่ผู้เล่นเคยหักหลัง */
  foe?: string;
  /** ชื่อเสียงรายอาณาจักร -100..100 */
  standing?: Record<string, number>;
  crimes?: number;
  trades?: number;
  beatGreat?: boolean;
}

export interface Kingdom { id: string; name: string; ruler: string; rulerAge: number; power: number; stability: number; war?: string; plague?: number; prosperity?: number; famine?: number; laws?: LawId[] }
export interface Dragon { name: string; title: string; home: string; age: number; mood: number; alive: boolean; slainBy?: string }
export interface Relic { id: string; name: string; power: string; holder: string; at: string; bonus: number; trial: "combat" | "wit" | "heart" }
export type LawId = "banMagic" | "heavyTax" | "freeTrade" | "harshCourts";
export type Good = "grain" | "iron" | "herbs";
export type Role = "hero" | "mage" | "merchant" | "rogue" | "priest" | "general";
export interface Notable { id: number; name: string; role: Role; age: number; power: number; kingdom: string; faction?: string; fame: number }
export interface Faction { id: string; name: string; creed: string; power: number; leader: string; feud?: string; playerLed?: boolean }
export interface FData { kingdoms: Kingdom[]; dragon: Dragon; relics: Relic[]; notables: Notable[]; factions: Faction[]; nextId: number }

export const LAWS: Record<LawId, { name: string; desc: string }> = {
  banMagic: { name: "ห้ามเวทในที่สาธารณะ", desc: "ผู้ตรวจการตามล่าคนร่ายเวท" },
  heavyTax: { name: "ภาษีสงคราม", desc: "ค่าครองชีพสูง และคนเก็บภาษีมาเคาะประตู" },
  freeTrade: { name: "การค้าเสรี", desc: "กำไรกองคาราวานสูงขึ้น เมืองรุ่งเรือง" },
  harshCourts: { name: "ศาลเหล็ก", desc: "ค่าปรับสองเท่า และโทษจำคุกนานขึ้น" },
};
export const ROLES: Record<Role, string> = { hero: "นักรบ", mage: "จอมเวท", merchant: "พ่อค้าใหญ่", rogue: "จอมโจร", priest: "นักบวช", general: "แม่ทัพ" };
export const NOTABLE_CAP = 120;
const FIRST = ["อัลดริค", "เบรนนา", "คาเซีย", "ดาริอัส", "เอลวิน", "ฟิออน", "กาเลน", "ฮาเดรียน", "อิโซลด์", "จอริน", "คาลิสตา", "ลูเซียน", "มาร์ซิน", "นีเรีย", "โอเวน", "เพอร์ซิวาล", "ควินน์", "โรเวนา", "เซรีน", "ธาเดียส", "อูร์ซูลา", "วาเลเรีย", "เวสลีย์", "ยอริค"];
const EPITHET = ["ผู้ไร้พ่าย", "มือเหล็ก", "ตาเดียว", "แห่งหอคอยขาว", "เงาพเนจร", "ผู้ร่ำรวย", "ดาบสองคม", "ลิ้นเงิน", "แห่งทะเลเหนือ", "หัวใจน้ำแข็ง", "ผู้ไถ่บาป", "เพลิงแดง", "ไร้ปรานี", "ผู้ไม่หลับใหล", "แห่งป่าหมอก",
  "แห่งเนินเถ้า", "ผู้ถือโคม", "กระดูกเหล็ก", "เสียงฟ้าร้อง", "แห่งหุบเขาลม", "ผู้ล่าหมาป่า", "มือทอง", "ผู้เงียบงัน", "แห่งเกาะหมอก", "หน้ากากเงิน", "ผู้ข้ามทะเลทราย", "ตาเหยี่ยว", "ใจสิงห์", "แห่งเมืองจม", "ผู้แบกระฆัง", "ดาบหัก", "ผู้นับดาว", "แห่งทุ่งกุหลาบ", "ผู้ไม่เคยยิ้ม", "เขี้ยวเงิน", "แห่งประตูเหนือ", "ผู้หัวเราะ", "มือซ้าย", "แห่งหอระฆัง", "ผู้กลับจากความตาย"];
const ROLE_FACTION: Partial<Record<Role, string>> = { hero: "silver", mage: "conclave", merchant: "league", rogue: "night", priest: "dawn" };
const FACTIONS: Faction[] = [
  { id: "silver", name: "ภาคีโล่เงิน", creed: "อัศวินผู้พิทักษ์", power: 55, leader: "" },
  { id: "conclave", name: "สภาเจ็ดหอ", creed: "จอมเวทผู้เก็บความรู้", power: 55, leader: "" },
  { id: "league", name: "สมาคมทองคำ", creed: "พ่อค้าผู้ซื้อได้ทุกอย่าง", power: 50, leader: "" },
  { id: "night", name: "ราชสำนักรัตติกาล", creed: "โจรผู้รู้ความลับทุกเมือง", power: 40, leader: "" },
  { id: "dawn", name: "ศาสนจักรอรุณ", creed: "นักบวชผู้รักษาและพิพากษา", power: 55, leader: "" },
  { id: "ember", name: "ลัทธิเถ้าถ่าน", creed: "ผู้บูชามังกร", power: 30, leader: "" },
];
const KINGDOM_LAWS: Record<string, LawId[]> = { aldria: ["harshCourts"], varn: ["banMagic", "heavyTax"], thalos: ["freeTrade"] };

export function newNotable(r: Pick<Life, "rng">, d: Pick<FData, "kingdoms" | "nextId" | "notables">, age = randInt(r, 18, 30)): Notable {
  const role = pick(r, Object.keys(ROLES) as Role[]);
  const faction = randInt(r, 1, 12) === 1 ? "ember" : ROLE_FACTION[role];
  const roll = () => `${pick(r, FIRST)} ${pick(r, EPITHET)}`;
  let name = roll();
  for (let i = 0; i < 6 && d.notables.some((n) => n.name === name); i++) name = roll();
  return { id: d.nextId++, name, role, age, power: clamp(randInt(r, 10, 40) + (age - 20), 5, 90), kingdom: pick(r, d.kingdoms).id, faction, fame: 0 };
}

const KINGDOMS: Kingdom[] = [
  { id: "aldria", name: "ราชอาณาจักรอัลเดรีย", ruler: "ราชาเอดริก", rulerAge: 48, power: 60, stability: 65 },
  { id: "varn", name: "จักรวรรดิวาร์น", ruler: "จักรพรรดินีเซราฟีน", rulerAge: 41, power: 70, stability: 55 },
  { id: "thalos", name: "นครรัฐทาลอส", ruler: "สภาเก้าพ่อค้า", rulerAge: 55, power: 45, stability: 70 },
];

const newData = () => ({
  kingdoms: KINGDOMS.map((k) => ({ ...k })),
  dragon: { name: "วาลเกรียส", title: "เพลิงแห่งยอดเขาเงิน", home: "varn", age: 900, mood: 0, alive: true },
  relics: [
    { id: "veilcutter", name: "เวลคัตเตอร์", power: "ดาบที่ตัดม่านเวทมนตร์ทุกชนิด", holder: "lost", at: "aldria", bonus: 18, trial: "combat" },
    { id: "dawnchoice", name: "อรุณาเลือก", power: "ดาบที่เลือกเจ้าของด้วยตัวเอง", holder: "lost", at: "thalos", bonus: 20, trial: "heart" },
    { id: "wyrmsbane", name: "ไวร์มสเบน", power: "ทวนที่ตีขึ้นเพื่อสังหารมังกรโดยเฉพาะ", holder: "lost", at: "varn", bonus: 15, trial: "wit" },
  ],
});

export const newFantasyWorld = (seed: number, year = 1000): WorldState => {
  const w = newWorldState("fantasy", seed, year);
  w.data = newData() as unknown as Record<string, unknown>;
  return w;
};

/** เติมสังคมให้โลกเก่าที่สร้างก่อนมีระบบนี้ */
export function ensureSociety(w: WorldState) {
  const d = w.data as unknown as FData;
  if (d.factions) return d;
  const r = { rng: (w.seed >>> 0) || 1 };
  d.nextId = 1;
  d.notables = [];
  for (const k of d.kingdoms) { k.prosperity = 100; k.laws = [...(KINGDOM_LAWS[k.id] ?? [])]; }
  for (let i = 0; i < NOTABLE_CAP; i++) d.notables.push(newNotable(r, d, randInt(r, 18, 65)));
  d.factions = FACTIONS.map((x) => {
    const top = d.notables.filter((n) => n.faction === x.id).sort((a, b) => b.power - a.power)[0];
    return { ...x, leader: top?.name ?? "" };
  });
  return d;
}

export const worldOfLife = (l: Life): WorldState => (l.fw ??= newFantasyWorld(l.seed, l.birthYear + l.age));
export const dataOf = (l: Life) => ensureSociety(worldOfLife(l));
export const fl = (l: Life): FLife => l.ft!;
export const kingdomsOf = (l: Life) => dataOf(l).kingdoms;
export const homeKingdom = (l: Life) => kingdomsOf(l).find((k) => k.id === fl(l).kingdom) ?? kingdomsOf(l)[0];
export const relicOf = (l: Life, id: string) => dataOf(l).relics.find((r) => r.id === id);
export const myRelic = (l: Life) => (fl(l).relic ? relicOf(l, fl(l).relic!) : undefined);
export const deed = (l: Life, text: string) => { fl(l).deeds.push(text); };
export const standingOf = (l: Life, k = fl(l).kingdom) => fl(l).standing?.[k] ?? 0;
export function addStanding(l: Life, d: number, k = fl(l).kingdom) {
  const f = fl(l);
  f.standing = { ...f.standing, [k]: clamp(standingOf(l, k) + d, -100, 100) };
}
