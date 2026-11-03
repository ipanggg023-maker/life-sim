// โลกที่อยู่ต่อหลังตัวละครตาย: บันทึกแยกจากชีวิตในเซฟ · ตัวละครใหม่เกิดในโลกเดิมและเจอร่องรอยของคนเก่า
import type { WorldId } from "./types";

export interface WorldLegend {
  name: string;
  deed: string;
  year: number;
  /** ชีวิตที่สร้างตำนานนี้ */
  lifeId: string;
  /** ยิ่งเล่าต่อกันนาน ยิ่งเพี้ยน */
  retold: number;
}

export interface WorldState {
  version: 1;
  worldId: WorldId;
  seed: number;
  year: number;
  chronicle: { year: number; text: string }[];
  legends: WorldLegend[];
  /** ข้อมูลเฉพาะของแต่ละโลก เช่น อาณาจักรและมังกร */
  data: Record<string, unknown>;
}

const CHRONICLE_MAX = 400;

export const newWorldState = (worldId: WorldId, seed: number, year: number): WorldState => ({ version: 1, worldId, seed, year, chronicle: [], legends: [], data: {} });

export function recordChronicle(w: WorldState, text: string) {
  w.chronicle.push({ year: w.year, text });
  // เก็บเฉพาะเรื่องล่าสุด ไม่ให้เซฟโตไม่สิ้นสุด · ตำนานเก็บแยก
  if (w.chronicle.length > CHRONICLE_MAX) w.chronicle.splice(0, w.chronicle.length - CHRONICLE_MAX);
}

export function addLegend(w: WorldState, l: Omit<WorldLegend, "year" | "retold">) {
  w.legends.push({ ...l, year: w.year, retold: 0 });
}

/** เดินเวลาโลกไปข้างหน้า (ตัวละครใหม่เกิดหลังคนเก่าหลายสิบปี) */
export function advanceWorld(w: WorldState, years: number, tick?: (w: WorldState) => void) {
  for (let i = 0; i < years; i++) {
    w.year++;
    tick?.(w);
  }
  for (const g of w.legends) g.retold += Math.floor(years / 10);
}
