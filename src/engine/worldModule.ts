// แต่ละโลกลงทะเบียนสิ่งที่ต่างกันไว้ที่นี่ · engine ถามโมดูลแทนการ import เนื้อหาของโลกโดยตรง
import type { Life, Person, Soul, WorldId } from "./types";

export interface WorldTraits {
  /** ร่างกายและบาดแผล */
  body: boolean;
  /** NPC มีชีวิตของตัวเองทุกปี */
  npcLife: boolean;
  /** พรสวรรค์หายากซ่อนไว้ตอนเกิด */
  hiddenTalents: boolean;
  /** จำกิจกรรมปีก่อน (ปุ่มซ้ำปีก่อน) */
  repeatActs: boolean;
  /** ชื่อเต็มเขียนนามสกุลติดหน้าชื่อตัว */
  surnameFirst: boolean;
  /** เรียกญาติแบบท่านพ่อ ท่านแม่ */
  classicKinTerms: boolean;
}

export interface WorldModule {
  id: WorldId;
  traits: WorldTraits;
  /** ผลรวมของพรสวรรค์ตามชนิด */
  gift?: (l: Life, key: string) => number;
  birthplace?: (l: Life, fallback: string) => string;
  /** ค่าครองชีพต่อปี */
  livingCost?: (l: Life, kids: number, income: number) => number;
  /** เหตุผลที่ยังแต่งงานไม่ได้ */
  marriageBlock?: (l: Life) => string | undefined;
  /** ปรับเซฟเก่าตอนโหลด */
  migrate?: (l: Life) => void;
  /** บันทึกของชีวิตนี้ลงวิญญาณตอนจบชีวิต */
  onSoulRecord?: (s: Soul, l: Life) => void;
  /** ตั้งข้อมูลของโลกตอนสร้างตัวละคร */
  onCreate?: (l: Life) => void;
  /** ร่างกายแก่ช้ากว่าปกติกี่ปี */
  bodyYounger?: (l: Life) => number;
  /** คนในครอบครัวแก่ช้ากว่าปกติกี่ปี */
  npcYounger?: (l: Life, p: Person) => number;
  /** พรที่ติดตัวตอนเกิด */
  onNewBirth?: (l: Life, s: Soul) => void;
  /** วิชานี้ยังมีอยู่ในเกมไหม */
  isKnownArt?: (id: string) => boolean;
}

const modules = new Map<WorldId, WorldModule>();

export function registerWorld(m: WorldModule) {
  modules.set(m.id, m);
}

export const moduleOf = (id: string | undefined) => modules.get(id as WorldId);
export const traitsOf = (id: string | undefined): Partial<WorldTraits> => moduleOf(id)?.traits ?? {};
export const worldGift = (l: Life, key: string) => moduleOf(l.worldId)?.gift?.(l, key) ?? 0;

export type { Person };
