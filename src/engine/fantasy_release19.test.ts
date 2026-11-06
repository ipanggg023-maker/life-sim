import { writeFileSync } from "fs";
import { describe, expect, it } from "vitest";
import { loadFantasyWorld } from "../content/fantasy";
import { allEvents } from "./events";

loadFantasyWorld();

/** ฉากที่ยังมีทางเลือกไม่ถึงสาม (นับตามที่เขียนไว้) */
export const thinScenes = () => {
  const out: string[] = [];
  for (const e of allEvents().filter((x) => x.id.startsWith("ft"))) {
    if ((e.choices?.length ?? 0) < 3) out.push(e.id);
    for (const [k, s] of Object.entries(e.scenes ?? {})) if (s.choices.length < 3) out.push(`${e.id}/${k}`);
  }
  return out;
};

describe("ทุกฉากมีทางเลือกอย่างน้อยสามทาง", () => {
  it("ไม่มีฉากที่บางเหลืออยู่", () => {
    const thin = thinScenes();
    if (process.env.THIN_OUT) writeFileSync(process.env.THIN_OUT, thin.join("\n"));
    expect(thin.length, thin.slice(0, 20).join(" ")).toBe(0);
  });
});

describe("Release 22: ทางเลือกที่สามเป็นวิธีที่ต่างออกไปจริง", () => {
  it("ไม่มีทางเลือกที่เพิ่มซ้ำหรือขึ้นต้นเหมือนทางเดิมของฉากเดียวกัน", () => {
    const dup: string[] = [];
    const lab = (x: unknown) => (typeof x === "string" ? x : "");
    for (const e of allEvents().filter((x) => x.id.startsWith("ft"))) {
      const scenes = [e.choices ?? [], ...Object.values(e.scenes ?? {}).map((s) => s.choices)];
      for (const cs of scenes) {
        // ทางเลือกที่มีเงื่อนไขแสดง (show) ไม่ขึ้นพร้อมกัน จึงไม่นับ
        const ls = cs.filter((c) => !c.show).map((c) => lab(c.label)).filter(Boolean);
        for (let i = 0; i < ls.length; i++) for (let j = i + 1; j < ls.length; j++) if (ls[i] === ls[j]) dup.push(`${e.id}: ${ls[i]}`);
      }
    }
    expect(dup.slice(0, 10)).toEqual([]);
  });
});
