// ข้อมูลของโลกแฟนตาซี: ส่วนที่อยู่กับตัวละคร (FLife) และส่วนที่อยู่ต่อหลังตัวละครตาย (FWorld)
import type { Life } from "../../engine/types";
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
}

export interface Kingdom { id: string; name: string; ruler: string; rulerAge: number; power: number; stability: number; war?: string; plague?: number }
export interface Dragon { name: string; title: string; home: string; age: number; mood: number; alive: boolean; slainBy?: string }
export interface Relic { id: string; name: string; power: string; holder: string; at: string; bonus: number; trial: "combat" | "wit" | "heart" }
export interface FData { kingdoms: Kingdom[]; dragon: Dragon; relics: Relic[] }

const KINGDOMS: Kingdom[] = [
  { id: "aldria", name: "ราชอาณาจักรอัลเดรีย", ruler: "ราชาเอดริก", rulerAge: 48, power: 60, stability: 65 },
  { id: "varn", name: "จักรวรรดิวาร์น", ruler: "จักรพรรดินีเซราฟีน", rulerAge: 41, power: 70, stability: 55 },
  { id: "thalos", name: "นครรัฐทาลอส", ruler: "สภาเก้าพ่อค้า", rulerAge: 55, power: 45, stability: 70 },
];

const newData = (): FData => ({
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

export const worldOfLife = (l: Life): WorldState => (l.fw ??= newFantasyWorld(l.seed, l.birthYear + l.age));
export const dataOf = (l: Life) => worldOfLife(l).data as unknown as FData;
export const fl = (l: Life): FLife => l.ft!;
export const kingdomsOf = (l: Life) => dataOf(l).kingdoms;
export const homeKingdom = (l: Life) => kingdomsOf(l).find((k) => k.id === fl(l).kingdom) ?? kingdomsOf(l)[0];
export const relicOf = (l: Life, id: string) => dataOf(l).relics.find((r) => r.id === id);
export const myRelic = (l: Life) => (fl(l).relic ? relicOf(l, fl(l).relic!) : undefined);
export const deed = (l: Life, text: string) => { fl(l).deeds.push(text); };
