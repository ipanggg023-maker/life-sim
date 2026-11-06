// ข้อมูลของโลกแฟนตาซี: ส่วนที่อยู่กับตัวละคร (FLife) และส่วนที่อยู่ต่อหลังตัวละครตาย (FWorld)
import { pick, randInt } from "../../engine/rng";
import type { Life, Person } from "../../engine/types";
import { clamp } from "../../engine/util";
import { newWorldState, type WorldState } from "../../engine/worldState";
import { notableName } from "./names";

export type RaceId = "human" | "elf" | "dwarf" | "orc" | "beastfolk" | "halfling" | "dragon" | "demon";
export type Realm = "demon" | "dragon" | "divine";
export interface Gate { realm: Realm; kingdom: string; until: number }
export interface God { name: string; domain: string; year: number; kin?: string }
export type Element = "fire" | "water" | "earth" | "wind" | "light" | "dark";

export interface Wand { name: string; quality: number; material: string }

export interface FLife {
  race: RaceId;
  kingdom: string;
  /** ดาวเวทแต่กำเนิด 0–10 · 0 ยังใช้คทาได้ */
  potential: number;
  /** ดาวกายแต่กำเนิด 0–10 (stars.ts) · เซฟเก่าไม่มี */
  bstars?: number;
  /** นิสัยจากทางเลือก -100..100 (persona.ts) */
  persona?: { m: number; h: number; c: number; f: number };
  /** เมล็ดชะตาที่ปลูกไว้ (echoes.ts) */
  seeds?: { id: string; age: number; note: string; who?: string; done?: number; back?: string }[];
  /** สิ่งที่คุณเปลี่ยนแผ่นดิน (worldmark.ts) */
  marks?: { text: string; k: string; age: number }[];
  /** ปณิธานที่ถืออยู่ และครั้งล่าสุดที่ผิดปณิธาน (powerplus.ts) */
  vow?: { id: string; age: number };
  vowBroke?: { id: string; age: number };
  /** ท่าประจำตัว · ขั้น 2 = ขั้นตำนาน */
  signature?: { name: string; tier: number };
  /** ผลงานพร้อมอายุตอนได้ (lifestory.ts) · เซฟเก่ามีแค่ deeds */
  deedLog?: { text: string; age: number }[];
  /** นิสัยทุกสิบปี */
  personaLog?: { age: number; words: string[] }[];
  /** ปณิธานที่เคยตั้งและผล */
  vowLog?: { age: number; text: string }[];
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
  /** การตามล่าอาวุธตำนานที่กำลังทำ (hunts.ts) · ch = บทที่ 0-3 · wait = รอให้คนที่ถืออยู่ตายไปเอง */
  hunt?: { id: string; ch: number; next: number; rival?: string; wait?: boolean; fails?: number };
  /** อาวุธที่เลิกตามล่าแล้วในชีวิตนี้ */
  huntsClosed?: string[];
  /** อาวุธที่ขโมยมา เจ้าของเดิมจะตามทวง */
  huntStolen?: { id: string; from: string; at: number };
  /** เบาะแสที่หลับของมังกรโบราณ · สิ่งที่ทำกับมังกรโบราณไปแล้วในชีวิตนี้ (ancients.ts) */
  ancientLeads?: Record<string, number>;
  /** เด็กที่ถูกทิ้ง: พ่อแม่และพี่น้องแท้ๆ ที่ยังไม่รู้จัก (birth.ts) · อายุของพวกเขาเก็บตามวันที่คุณเกิด */
  lostKin?: Person[];
  ancientDone?: string[];
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
  /** ปีล่าสุดที่ส่งคาราวาน และจำนวนปีติดกัน · ตลาดอิ่มตัวเมื่อส่งทุกปี */
  tradeLast?: number;
  tradeStreak?: number;
  /** ของใหญ่ที่ซื้อไว้ (economy.ts) · ค่าคือจำนวนปีที่ค้างค่าดูแล */
  estates?: Partial<Record<import("./economy").EstateId, number>>;
  /** บัญชีปีล่าสุด และทรัพย์สุทธิเมื่อปลายปีก่อน */
  ledger?: import("./economy").Ledger;
  lastWorth?: number;
  /** อันดับในสังเวียนของแผ่นดินที่ขึ้นสู้ (arena.ts) · 1 = แชมป์ */
  arena?: { kingdom: string; rank: number };
  /** พลังชุดที่สอง (power2.ts): ความมืดในตัว 0–100 · ท่าที่เรียนจากอาจารย์ · ท่าที่ตั้งชื่อเอง · ยาที่พกอยู่ · ฝีมือช่างและตำรา */
  corruption?: number;
  /** ปีที่ฝึกต่อเนื่อง · ทุก 15 ปีดันเพดานขั้นขึ้นหนึ่ง จนถึงปรมาจารย์ */
  trainYears?: number;
  learned?: string[];
  myTech?: string;
  potions?: { heal?: number; strength?: number; life?: number };
  craft?: Partial<Record<"smith" | "alchemy" | "healing" | "lore", number>>;
  // ── อันตราย (danger.ts) ──
  /** แผลถาวรที่เปลี่ยนชีวิต */
  injuries?: ("eye" | "leg" | "hand" | "lung")[];
  /** แผลสดที่ยังไม่หาย: อายุที่ได้แผล · ไม่รักษาอาจกลายเป็นแผลถาวร */
  wound?: number;
  /** พิษ คำสาป หรือโรคที่ทรุดลงทีละปี */
  ailment?: { kind: "poison" | "curse" | "plague"; stage: number };
  /** สัตว์อสูรที่เคยเจอ · ชื่อ → จำนวนครั้ง (bestiary.ts) */
  bestiary?: Record<string, number>;
  /** สัตว์ร้ายคู่อาฆาตที่กลับมาหาคุณเรื่อยๆ */
  nemesis?: { name: string; power: number; met: number; last: number; dead?: boolean };
  /** แพ้หนักแล้วยังกลัวอยู่ จนกว่าจะชนะได้อีกครั้ง */
  fear?: boolean;
  /** ลูกค้าที่จำคุณได้ · ชื่อ → งานที่ทำสำเร็จ */
  clients?: Record<string, number>;
  /** ปฏิญาณไม่จับอาวุธ */
  peaceVow?: boolean;
  // ── ใต้ดินและกฎหมาย (underworld.ts) ──
  /** กิลด์โจร: ขั้น 1–5 แต้มผลงาน และความร้อน (ยามจับตามอง 0–100) */
  ug?: { rank: number; merit: number; heat: number };
  /** คนที่ตายด้วยมือคุณนอกสงคราม */
  kills?: number;
  /** แผนแหกคุกที่เตรียมไว้ 0–3 */
  escape?: number;
  // ── การงาน 2 (careers2.ts) ──
  /** กิจการของตัวเอง ขั้น 1–5 · ส่งต่อให้ทายาทได้ */
  biz?: { kind: string; name: string; level: number; since: number; rival?: string; bad?: number };
  /** สมาคมของสายงาน: ขั้น 1–4 · ค่าบำรุงที่ค้าง */
  tguild?: { fam: string; rank: number; since: number; owed: number; saved?: boolean };
  /** ผลงานที่มีชื่อ */
  works?: { name: string; fam: string; fame: number; age: number }[];
  /** ผู้อุปถัมภ์ */
  patron?: { name: string; kind: "noble" | "mage" | "hero"; favor: number; since: number };
  /** การจากงานครั้งล่าสุดของแต่ละสายงาน: ถูกไล่ออก หรือลาออกดีๆ พร้อมคำรับรอง */
  leftMark?: Record<string, { how: "fired" | "reference"; age: number }>;
  // ── เงิน 2 (money2.ts) ──
  /** เงินที่ลงทุนไว้ รอผลตามปี */
  invests?: { kind: string; gold: number; due: number; pid?: string }[];
  /** เงินที่ให้คนอื่นกู้ */
  loans?: { name: string; gold: number; due: number; pid?: string }[];
  /** ที่ดินและคนที่อยู่บนนั้น: จำนวนไร่ หมู่บ้าน เหมือง · ใจของผู้เช่า 0–100 · เก็บค่าเช่าแบบไหน */
  land?: { farm: number; village: number; mine: number; mood: number; squeeze?: boolean };
  /** ใช้ชีวิตแบบไหน */
  lifestyle?: "frugal" | "comfortable" | "lavish";
  /** ความอยากเล่นพนันสะสม · 5 ขึ้นไปติดพนัน */
  gambling?: number;
  /** ทำบุญไว้ที่ไหนบ้าง */
  charity?: string[];
  /** มีห้องนิรภัยกันขโมย */
  vault?: boolean;
  // ── สังคม (society2.ts) ──
  /** ทางในราชสำนัก: ขั้น 1–4 · ความโปรดปราน 0–100 */
  court?: { rank: number; favor: number };
  /** เทพที่อุทิศตนให้ · ปีที่ผิดหน้าที่ต่อเทพครั้งล่าสุด */
  god?: string;
  godLost?: number;
  /** สมาคมลับ: ขั้น 1–3 · ภารกิจที่ทำ */
  shadow?: { rank: number; missions: number; out?: boolean };
  /** กบฏ: ภารกิจที่ทำ */
  rebel?: { missions: number; kingdom: string };
  /** เป้าหมายชีวิตที่เลือกไว้ และที่ทำสำเร็จแล้ว (ease.ts) */
  goals?: string[];
  goalsDone?: string[];
  // ── สัตว์ (creatures.ts) ──
  /** สัตว์ขี่: ม้า กริฟฟิน หมาป่ายักษ์ งูทะเล · สายเลือดรุ่นที่เท่าไร */
  steed?: { kind: string; name: string; bond: number; born: number; line: string; gen: number; lastCare: number };
  /** สัตว์หายากที่ฝึกได้ */
  beasts?: { kind: string; name: string; bond: number }[];
  /** ภูตประจำบ้าน */
  houseSpirit?: { fed: number };
  /** ลูกครึ่ง: อีกเผ่าหนึ่งในสายเลือด (birth.ts) */
  half?: RaceId;
  /** เส้นเรื่องที่ยังไม่จบ: คนในเรื่องจะกลับมาเมื่อถึงกำหนด (storygen.ts) */
  storylines?: import("./storygen").Storyline[];
  beatGreat?: boolean;
  /** แผ่นดินที่ครองอยู่ */
  throne?: string;
  realmVisits?: Partial<Record<Realm, number>>;
  /** พันธสัญญาปีศาจ · ครั้งละสิบปีของอายุขัย */
  pacts?: number;
  demonHorn?: boolean;
  /** บททดสอบแห่งสวรรค์ 0–2 */
  divine?: number;
  /** อายุขัยที่ได้เพิ่มจากภพอื่น */
  lifeBonus?: number;
  /** แผ่นดินที่เป็นคู่ครองของผู้ครอง */
  consort?: string;
  /** ความผูกพันกับมังกรแต่ละตัว · dragonBond คือความชอบมังกรโดยกำเนิด */
  dBonds?: Record<string, number>;
  dLearned?: string[];
  egg?: { element: Element; warmth: number; from: string; lastCare: number };
  whelp?: { name: string; element: Element; age: number; bond: number; power: number; lastCare: number; from: string; /** นิสัยของมังกร (creatures.ts) */ trait?: string };
  /** มังกรที่ขี่อยู่ · "whelp" = ตัวที่เลี้ยงเอง */
  mount?: string;
  dragonFoe?: string;
  dragonblood?: boolean;
  /** ถ้วยรางวัลจากสัตว์ในตำนาน (world2.ts) */
  trophies?: string[];
  /** ศาสตร์แห่งเวทที่เลือก (mschools.ts) */
  mschool?: string;
  /** มหากาพย์ที่กำลังตาม: บทที่อยู่ · 99 = จบแล้ว (sagas.ts) */
  sagas?: Record<string, number>;
  /** สัตว์เลี้ยง (hobbies.ts) */
  pet?: { kind: "cat" | "owl" | "wolf" | "fox" | "slime" | "golem"; name: string; bond: number; born: number };
  /** ชั้นที่ผ่านแล้วของแต่ละดันเจี้ยน */
  dungeons?: Record<string, number>;
  /** เมืองที่อยู่ในแผ่นดินนั้น (cities.ts) */
  city?: string;
  /** สายอาวุธ (styles.ts) */
  style?: string;
  /** อาวุธและเกราะ · ช่างตีเองหรือซื้อมา · คุณภาพ 1–5 */
  weapon?: Gear;
  armor?: Gear;
  /** ปริศนาที่ตัวละครนี้รู้จัก · ความคืบหน้าอยู่ในโลก */
  mKnown?: string[];
}

export interface Gear { name: string; quality: number; enchant?: boolean; /** ศัตรูที่ล้มด้วยอาวุธนี้ (power2.ts) */ kills?: number; /** ได้ชื่อจากเรื่องที่ผ่านมาแล้ว */ named?: boolean }
export interface Kingdom { /** ล่าสัตว์มากเกินไปแล้วสัตว์หายจากแถบนี้ (creatures.ts) */ hunted?: number; /** ช่วงรุ่งหรือร่วงของเศรษฐกิจ (money2.ts) */ boom?: { kind: "harvest" | "goldrush" | "embargo" | "bust"; left: number }; id: string; name: string; ruler: string; rulerAge: number; power: number; stability: number; war?: string; plague?: number; prosperity?: number; famine?: number; laws?: LawId[]; /** เป็นเมืองขึ้นของ */ overlord?: string; playerRuled?: boolean; /** ชื่อผู้เล่นที่เป็นคู่ครองและจะสืบบัลลังก์ */ consortHeir?: string; dynasty?: string; elective?: boolean; nextElection?: number; founded?: number }
export interface Dragon { id: string; name: string; title: string; element: Element; home: string; age: number; mood: number; alive: boolean; power: number; slainBy?: string; /** นามสกุลของครอบครัวที่เคยเลี้ยงมัน */ kin?: string }
export interface Mystery { step: number; notes: string[]; solvedBy?: string }
export interface Egg { mother: string; element: Element; laid: number }
export interface Relic { id: string; name: string; power: string; holder: string; at: string; bonus: number; trial: "combat" | "wit" | "heart"; history?: string[] }
export type LawId = "banMagic" | "heavyTax" | "freeTrade" | "harshCourts";
export type Good = "grain" | "iron" | "herbs";
export type Role = "hero" | "mage" | "merchant" | "rogue" | "priest" | "general";
export interface Notable { id: number; name: string; role: Role; age: number; power: number; kingdom: string; faction?: string; fame: number; /** เพดานฝีมือของคนนี้ · ส่วนใหญ่ธรรมดา บางคนเป็นตำนาน */ peak?: number }
export interface Faction { id: string; /** แบบของงานและผลประโยชน์ · ไม่ใส่ = ใช้ id */ kind?: string; name: string; creed: string; power: number; leader: string; feud?: string; playerLed?: boolean }
/** ชื่อเสียงของตระกูลข้ามชีวิต (family2.ts) */
export interface FamilyRecord { fame: number; crest?: string; motto?: string; secret?: "sibling" | "crime" | "stolen" | "curse"; revealed?: boolean; lives: number }
export interface AncientState { state: "asleep" | "awake" | "raging" | "slain" | "friend"; /** นามสกุลของตระกูลที่ทำให้เป็นแบบนี้ */ by?: string; year?: number }
export interface FData { /** มังกรโบราณทั้งห้า (ancients.ts) · โลกจำผลข้ามชีวิต */ ancients?: Record<string, AncientState>; /** หลุมศพของชีวิตก่อนๆ ในโลกนี้ · ผู้ที่กลับมาเป็นอมตะ · ความสำเร็จแรกของโลก (souls2.ts) */ graves?: { name: string; lastName: string; kingdom: string; deed?: string; age: number; year: number }[]; undead?: { name: string; kind: "lich" | "ghost"; kingdom: string; met?: boolean }; firsts?: Record<string, string>; /** สิ่งมหัศจรรย์ที่ซ่อนอยู่ · ชื่อคนที่ค้นพบ (legends2.ts) */ wonders?: Record<string, string>; /** ภัยพิบัติของโลกที่กินเวลาหลายชีวิต */ crisis?: { kind: string; stage: number; since: number; done?: string }; /** ความจริงของโลกที่ค้นพบแล้ว */ lore?: string[]; families?: Record<string, FamilyRecord>; kingdoms: Kingdom[]; dragons: Dragon[]; eggs: Egg[]; gates: Gate[]; gods: God[]; mysteries: Record<string, Mystery>; relics: Relic[]; notables: Notable[]; factions: Faction[]; nextId: number; /** เซฟเก่าก่อนมีหลายมังกร */ dragon?: Omit<Dragon, "id" | "element" | "power"> }

export const LAWS: Record<LawId, { name: string; desc: string }> = {
  banMagic: { name: "ห้ามเวทในที่สาธารณะ", desc: "ผู้ตรวจการตามล่าคนร่ายเวท" },
  heavyTax: { name: "ภาษีสงคราม", desc: "ค่าครองชีพสูง และคนเก็บภาษีมาเคาะประตู" },
  freeTrade: { name: "การค้าเสรี", desc: "กำไรกองคาราวานสูงขึ้น เมืองรุ่งเรือง" },
  harshCourts: { name: "ศาลเหล็ก", desc: "ค่าปรับสองเท่า และโทษจำคุกนานขึ้น" },
};
export const ROLES: Record<Role, string> = { hero: "นักรบ", mage: "จอมเวท", merchant: "พ่อค้าใหญ่", rogue: "จอมโจร", priest: "นักบวช", general: "แม่ทัพ" };
export const NOTABLE_CAP = 120;

const EPITHET = ["ผู้ไร้พ่าย", "มือเหล็ก", "ตาเดียว", "แห่งหอคอยขาว", "เงาพเนจร", "ผู้ร่ำรวย", "ดาบสองคม", "ลิ้นเงิน", "แห่งทะเลเหนือ", "หัวใจน้ำแข็ง", "ผู้ไถ่บาป", "เพลิงแดง", "ไร้ปรานี", "ผู้ไม่หลับใหล", "แห่งป่าหมอก",
  "แห่งเนินเถ้า", "ผู้ถือโคม", "กระดูกเหล็ก", "เสียงฟ้าร้อง", "แห่งหุบเขาลม", "ผู้ล่าหมาป่า", "มือทอง", "ผู้เงียบงัน", "แห่งเกาะหมอก", "หน้ากากเงิน", "ผู้ข้ามทะเลทราย", "ตาเหยี่ยว", "ใจสิงห์", "แห่งเมืองจม", "ผู้แบกระฆัง", "ดาบหัก", "ผู้นับดาว", "แห่งทุ่งกุหลาบ", "ผู้ไม่เคยยิ้ม", "เขี้ยวเงิน", "แห่งประตูเหนือ", "ผู้หัวเราะ", "มือซ้าย", "แห่งหอระฆัง", "ผู้กลับจากความตาย",
  "ผู้ขี่พายุ", "แห่งหอคอยดำ", "มือเพลิง", "ผู้เฝ้าประตู", "แห่งเกาะไกล", "ลิ้นทอง", "ผู้ไม่เคยแพ้", "แห่งป่าเถ้า", "ตาสีเงิน", "ผู้ทำลายโซ่", "แห่งยอดหิมะ", "มือไม่สั่น", "ผู้อ่านดวงดาว", "แห่งท่าเรือเก่า", "เกราะทอง", "ผู้ไร้เงา", "แห่งเหมืองลึก", "ผู้ร้องเพลงศึก", "ขวานคู่", "แห่งทุ่งเลือด"];
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
  const roll = () => `${notableName(r)} ${pick(r, EPITHET)}`;
  let name = roll();
  for (let i = 0; i < 6 && d.notables.some((n) => n.name === name); i++) name = roll();
  const peak = Math.max(randInt(r, 35, 95), randInt(r, 35, 95));
  return { id: d.nextId++, name, role, age, power: clamp(randInt(r, 10, 40) + (age - 20), 5, peak), kingdom: pick(r, d.kingdoms).id, faction, fame: 0, peak };
}

const KINGDOMS: Kingdom[] = [
  { id: "aldria", name: "ราชอาณาจักรอัลเดรีย", ruler: "ราชาเอดริก", rulerAge: 48, power: 60, stability: 65 },
  { id: "varn", name: "จักรวรรดิวาร์น", ruler: "จักรพรรดินีเซราฟีน", rulerAge: 41, power: 70, stability: 55 },
  { id: "thalos", name: "นครรัฐทาลอส", ruler: "สภาเก้าพ่อค้า", rulerAge: 55, power: 45, stability: 70, elective: true },
];

const newData = () => ({
  kingdoms: KINGDOMS.map((k) => ({ ...k })),
  dragons: DRAGONS.map((x) => ({ ...x })),
  eggs: [],
  gates: [],
  gods: [],
  mysteries: {},
  relics: RELICS.map((x) => ({ ...x })),
});
const RELICS: Relic[] = [
    { id: "veilcutter", name: "ดาบผ่ามิติรัตติกาล", power: "ดาบที่ตัดม่านเวทมนตร์ทุกชนิด", holder: "lost", at: "aldria", bonus: 18, trial: "combat" },
    { id: "dawnchoice", name: "ดาบสุริยัน", power: "ดาบที่เลือกเจ้าของด้วยตัวเอง", holder: "lost", at: "thalos", bonus: 20, trial: "heart" },
    { id: "wyrmsbane", name: "ทวนพิฆาตมังกร", power: "ทวนที่ตีขึ้นเพื่อสังหารมังกรโดยเฉพาะ", holder: "lost", at: "varn", bonus: 15, trial: "wit" },
  { id: "stormcrown", name: "มงกุฏราชันอัสนี", power: "ใครสวมแล้วพูด สภาทั้งห้องจะเงียบฟัง", holder: "lost", at: "thalos", bonus: 8, trial: "heart" },
  { id: "embersoul", name: "คทาวิญญาณเพลิงนิรันดร์", power: "ทำให้เพดานเวทของผู้ถือสูงขึ้นหนึ่งขั้น", holder: "lost", at: "aldria", bonus: 12, trial: "wit" },
  { id: "grief", name: "ดาบคำสาปแห่งความโศกา", power: "ดาบที่แรงที่สุดในโลก และดูดความสุขของผู้ถือทุกปี", holder: "lost", at: "varn", bonus: 30, trial: "combat" },
  { id: "phoenixring", name: "แหวนวิญญาณฟีนิกซ์", power: "ให้ด้ายชะตาเพิ่มหนึ่งเส้นแก่ผู้ที่สวมครั้งแรก", holder: "lost", at: "thalos", bonus: 5, trial: "heart" },
  { id: "dragonhorn", name: "แตรมังกร", power: "มังกรได้ยินเสียงนี้แล้วผูกพันกับผู้เป่าเร็วขึ้นสองเท่า", holder: "lost", at: "aldria", bonus: 6, trial: "wit" },
];
const DRAGONS: Dragon[] = [
  { id: "valgrias", name: "วาลเกรียส", title: "เพลิงแห่งยอดเขาเงิน", element: "fire", home: "varn", age: 900, mood: 0, alive: true, power: 105 },
  { id: "nerith", name: "เนริธ", title: "ราชินีใต้สมุทร", element: "water", home: "thalos", age: 640, mood: 15, alive: true, power: 95 },
  { id: "korvath", name: "คอร์วาธ", title: "เกล็ดหินแห่งหุบเขาลึก", element: "earth", home: "aldria", age: 1200, mood: 5, alive: true, power: 110 },
  { id: "sylphae", name: "ซิลแฟ", title: "นางพญาพายุ", element: "wind", home: "varn", age: 300, mood: 20, alive: true, power: 80 },
  { id: "umbra", name: "อัมบรา", title: "เงาที่กลืนดวงจันทร์", element: "dark", home: "aldria", age: 1500, mood: -25, alive: true, power: 120 },
];

export const newFantasyWorld = (seed: number, year = 1000): WorldState => {
  const w = newWorldState("fantasy", seed, year);
  w.data = newData() as unknown as Record<string, unknown>;
  return w;
};

/** เติมสังคมให้โลกเก่าที่สร้างก่อนมีระบบนี้ */
export function ensureSociety(w: WorldState) {
  const d = w.data as unknown as FData;
  d.mysteries ??= {};
  d.gates ??= [];
  d.gods ??= [];
  const thalos = d.kingdoms.find((k) => k.id === "thalos");
  if (thalos && thalos.elective === undefined) thalos.elective = true;
  if (!d.dragons) {
    d.dragons = DRAGONS.map((x) => ({ ...x }));
    if (d.dragon) Object.assign(d.dragons[0], d.dragon);
    delete d.dragon;
    d.eggs = [];
    for (const r of RELICS) if (!d.relics.some((x) => x.id === r.id)) d.relics.push({ ...r });
  }
  // ชื่ออาวุธตำนานเปลี่ยนแล้ว: โลกเก่าใช้ชื่อใหม่ด้วย (ประวัติผู้ถือยังอยู่ครบ)
  for (const x of d.relics) { const r = RELICS.find((y) => y.id === x.id); if (r) x.name = r.name; }
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
/** ผลงานกลายเป็นข่าวลือ (rumors.ts ลงทะเบียน) */
export const deedHooks: ((l: Life, text: string) => void)[] = [];
export const deed = (l: Life, text: string) => { const f = fl(l); f.deeds.push(text); (f.deedLog ??= []).push({ text, age: l.age }); for (const h of deedHooks) h(l, text); };
/** ประวัติผู้ถืออาวุธตำนาน เก็บล่าสุดแปดคน */
export const passRelic = (w: WorldState, r: Relic, who: string) => { r.history = [...(r.history ?? []), `ปี ${w.year} · ${who}`].slice(-8); };
/** อคติที่บางเผ่าเจอตั้งแต่เกิด จนกว่าจะสร้างชื่อเสียงเอง */
const PREJUDICE: Partial<Record<RaceId, number>> = { orc: -15, beastfolk: -5, dragon: -25, demon: -40 };
export const standingOf = (l: Life, k = fl(l).kingdom) => fl(l).standing?.[k] ?? PREJUDICE[fl(l).race] ?? 0;
export function addStanding(l: Life, d: number, k = fl(l).kingdom) {
  const f = fl(l);
  f.standing = { ...f.standing, [k]: clamp(standingOf(l, k) + d, -100, 100) };
}
