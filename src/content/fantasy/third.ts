// ทุกฉากมีทางเลือกอย่างน้อยสามทาง (Release 19 · design/HUNTS_PLAN.md)
// ทางเลือกที่เพิ่มเขียนแยกไว้ในตารางตามรหัสเรื่อง "id" หรือ "id/ฉาก" แล้วต่อท้ายตอนโหลดโลก
import type { Choice } from "../../engine/events";
import { getEvent } from "../../engine/events";
import { apply } from "./kit";
import { fxKind, type Extra, type Way } from "./third_kit";
import { T1 } from "./third1";
import { T2 } from "./third2";
import { T3 } from "./third3";
import { T4 } from "./third4";
import { T5 } from "./third5";
import { T6 } from "./third6";
import { T7 } from "./third7";
import { T8 } from "./third8";
import { T9 } from "./third9";

const TABLES: Record<string, Extra>[] = [T1, T2, T3, T4, T5, T6, T7, T8, T9];

function attach(base: Choice[], extra: Choice[]): Choice[] {
  return [...base, ...extra.map((x) => {
    const w = x as unknown as Partial<Way>;
    if (w.wayOf !== undefined) {
      const o = base[w.wayOf];
      if (!o) throw new Error(`third: ไม่มีทางเลือกที่ ${w.wayOf}`);
      const way = w as Way;
      // ทางเดิมมีค่าใช้จ่าย: ทางนี้ก็จ่ายเท่ากัน ป้ายต้องบอกด้วย
      const cost = typeof o.label === "string" ? o.label.match(/\(\d+ เหรียญทอง\)/)?.[0] : undefined;
      return {
        label: cost ? `${way.label} ${cost}` : way.label, show: o.show, req: o.req, tone: o.tone,
        ...(way.stat ? { check: { stat: way.stat, dc: way.dc } } : {}),
        run: (l, c, ok) => {
          const win = !way.stat || ok;
          const [text, fx] = win || !way.fail ? way.ok : way.fail;
          const out = o.run(l, c, win);
          if (l.alive) apply(l, fx);
          return { ...out, text, kind: out.kind === "milestone" && win ? "milestone" : fxKind(fx) };
        },
      } as Choice;
    }
    return x;
  })];
}

let done = false;
export function loadThird() {
  if (done) return;
  done = true;
  for (const t of TABLES) for (const [key, ex] of Object.entries(t)) {
    const [id, scene] = key.split("/");
    const e = getEvent(id);
    if (!e) continue; // เรื่องที่ถูกลบหรือเปลี่ยนชื่อ: ข้ามไป ตัวทดสอบจะจับฉากที่ยังบาง
    const extra = Array.isArray(ex) ? ex : [ex];
    if (!scene) e.choices = attach(e.choices ?? [], extra);
    else if (e.scenes?.[scene]) e.scenes = { ...e.scenes, [scene]: { ...e.scenes[scene], choices: attach(e.scenes[scene].choices, extra) } };
  }
}
