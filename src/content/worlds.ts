import type { Wealth, WorldId } from "../engine/types";
import { MURIM_FEMALE, MURIM_LAST, MURIM_MALE, MURIM_NICK_F, MURIM_NICK_M } from "./murim/names";

export interface WorldInfo {
  id: WorldId;
  name: string;
  emoji: string;
  birthplace: string;
  startYear: number;
  yearLabel: string;
  /** เงินในเกมใช้สเกลเดียวกันทุกโลก ต่างกันแค่การแสดงผล */
  currency: (n: number) => string;
  names: { male: string[]; female: string[]; nickM: string[]; nickF: string[]; last: string[] };
  parentJobs: Record<Wealth, string[]>;
  wealthLabel: Record<Wealth, string>;
  deathYoung: string[];
  deathOld: string[];
  /** อายุที่ตื่นพลัง/คัดศิษย์ */
  awakenAge: [number, number];
  /** ช่วงอายุของคนตื่นเร็ว (อัจฉริยะ) และตื่นช้า */
  awakenEarly: [number, number];
  awakenLate: [number, number];
  labels: {
    rank: string;
    power: string;
    guild: string;
    raid: string;
    raidUnit: (rank: string) => string;
    train: string;
    trainText: string;
  };
  /** อาชีพที่ออกภารกิจได้ */
  questJobs: string[];
  ranks: readonly string[];
  /** คำโปรยหนึ่งบรรทัด ใช้ในหน้าเลือกโลก */
  tagline?: string;
  /** สาเหตุการตายตามธรรมชาติช่วงที่โลกพัง (วันสิ้นโลก) */
  deathRuins?: string[];
  /** โลกยุคปัจจุบัน: มีประเทศที่เกิด (ไทย/เกาหลี/ญี่ปุ่น) และระบบโรงเรียน */
  modern?: boolean;
}

const taels = (n: number) => {
  const t = Math.abs(n) / 1000;
  return `${n < 0 ? "-" : ""}${t < 10 ? t.toFixed(1) : Math.round(t).toLocaleString("th-TH")} ตำลึง`;
};

export const WORLDS: Record<WorldId, WorldInfo> = {
  murim: {
    id: "murim",
    name: "ยุทธภพ",
    tagline: "สำนัก กระบี่ ลมปราณ และความแค้นที่ต้องชำระ",
    emoji: "⛰️",
    birthplace: "หมู่บ้านเชิงเขาในแคว้นเหอหนาน",
    startYear: 1120,
    yearLabel: "ศักราช",
    currency: taels,
    names: { male: MURIM_MALE, female: MURIM_FEMALE, nickM: MURIM_NICK_M, nickF: MURIM_NICK_F, last: MURIM_LAST },
    parentJobs: {
      poor: ["ชาวนา", "คนตัดฟืน", "ชาวประมง", "คนลากเกวียน"],
      middle: ["พ่อค้าผ้าไหม", "เจ้าของโรงเตี๊ยม", "หมอยาสมุนไพร", "ช่างตีเหล็ก"],
      rich: ["คหบดีใหญ่", "ผู้คุ้มกันขบวนสินค้า", "ขุนนางท้องถิ่น", "เจ้าของสำนักคุ้มภัย"],
      elite: ["ประมุขตระกูลยุทธ์", "เจ้าเมือง", "ผู้อาวุโสสำนักใหญ่", "เชื้อพระวงศ์"],
    },
    wealthLabel: { poor: "ครอบครัวชาวนายากจน", middle: "ครอบครัวพ่อค้า", rich: "ตระกูลคหบดี", elite: "ตระกูลยุทธ์ผู้ยิ่งใหญ่" },
    deathYoung: ["ไข้ป่า", "จมน้ำในแม่น้ำเหลือง", "ถูกโจรภูเขาปล้นฆ่า", "ม้าตื่นเหยียบ"],
    deathOld: ["ชราภาพ", "หลับไปอย่างสงบใต้ต้นท้อ", "ไข้หวัดลงปอด", "หัวใจวายในฤดูหนาว"],
    awakenAge: [12, 14],
    awakenEarly: [5, 10],
    awakenLate: [16, 50],
    labels: {
      rank: "ขั้นยุทธ์",
      power: "ลมปราณ",
      guild: "สำนัก",
      raid: "ภารกิจยุทธภพ",
      raidUnit: (r) => `ภารกิจระดับ${r}`,
      train: "ฝึกลมปราณ",
      trainText: "ลานฝึกของสำนัก",
    },
    questJobs: ["disciple", "wanderer", "m_assassin"],
    ranks: ["ผู้ฝึกหัด", "ชั้นสาม", "ชั้นสอง", "ชั้นหนึ่ง", "จุดสูงสุด", "เหนือจุดสูงสุด", "หลอมรวม", "ลึกล้ำ", "เหนือความเป็นความตาย"],
  },
};

/** เซฟเก่าอาจอ้างโลกที่ลบไปแล้ว: ถือเป็นยุทธภพ */
export const worldOf = (id: string | undefined) => WORLDS[id as WorldId] ?? WORLDS.murim;

/** โลกที่เปิดให้เกิดใหม่ได้ตอนนี้ — ทำทีละโลกให้ครบก่อน (MURIM_PLAN §18.10) · เซฟเก่าของโลกที่ปิดยังเล่นต่อจนจบชีวิตได้ */
export const OPEN_WORLDS: WorldId[] = ["murim"];
export const isOpenWorld = (id: WorldId) => OPEN_WORLDS.includes(id);

/** โลกแบบสมจริง: ไม่มีหน้าต่างระบบ ไม่ย้อนเวลา ไม่ข้ามโลก ไม่มีร้านวิญญาณ ไม่มีคอมเมนต์ผู้อ่าน */
const REALISTIC: WorldId[] = ["murim"];
export const isRealistic = (id: WorldId | undefined) => REALISTIC.includes(id ?? "murim");

/**
 * ของที่ผูกกับโลก (อาชีพ/กิจกรรม/event) ใช้ได้ในโลกนี้ไหม
 * ไม่ระบุ หรือ "modern" = ใช้ได้ทุกโลกยุคปัจจุบัน
 */
export function worldMatches(tag: WorldId | "modern" | undefined, world: WorldId | undefined): boolean {
  const w = world ?? "murim";
  if (!tag || tag === "modern") return !!worldOf(w).modern;
  return tag === w;
}
