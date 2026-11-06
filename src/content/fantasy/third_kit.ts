// เครื่องมือเขียนทางเลือกที่สาม (third.ts)
import type { Choice } from "../../engine/events";
import type { StatKey } from "../../engine/types";
import { B, C, G, K, N, type Fx } from "./kit";

export type Extra = Choice | Choice[];
const mood = (fx: Fx) => {
  const v = (fx.hp ?? 0) + (fx.joy ?? 0) + (fx.iq ?? 0) + (fx.luck ?? 0) + (fx.fame ?? 0) + (fx.gold ?? 0) + (fx.look ?? 0) + (fx.body ?? 0) / 2 + (fx.magic ?? 0) / 2;
  return v > 2 ? G : v < -2 ? B : N;
};
/** ทางใหม่ที่ผลชัดเจน */
export const T = (label: string, text: string, fx: Fx = {}): Choice => C(label, mood(fx)(text, fx));
/** ทางใหม่ที่ต้องลุ้นด้วยค่าพลัง */
export const R = (label: string, stat: StatKey, dc: number, ok: [string, Fx], fail: [string, Fx]): Choice => K(label, stat, dc, mood(ok[1])(ok[0], ok[1]), mood(fail[1])(fail[0], fail[1]));
/** ทางที่แตกจากทางเดิมข้อ i: ผลของทางเดิมยังเกิดครบ (สถานะที่เรื่องต้องใช้ไม่หาย) แล้วเพิ่มสิ่งที่ต่างออกไป */
export interface Variant { variantOf: number; vText: string; vFx: Fx; label: string }
export const V = (i: number, label: string, text: string, fx: Fx = {}): Choice => ({ label, run: () => ({ text: "" }), variantOf: i, vText: text, vFx: fx }) as unknown as Choice;
