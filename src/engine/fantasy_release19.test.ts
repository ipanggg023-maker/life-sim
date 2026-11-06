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
