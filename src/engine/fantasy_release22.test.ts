import { describe, expect, it } from "vitest";
import { loadFantasyWorld } from "../content/fantasy";
import { fl } from "../content/fantasy/state";
import { currentScene, labelOf } from "./events";
import { createLife, runEvent } from "./game";
import type { Life } from "./types";

loadFantasyWorld();
const life = (seed: number, age = 20): Life => {
  const l = createLife({ seed, worldId: "fantasy", plain: true });
  l.age = age; l.queue = []; l.money = 100_000; l.flags.ftStarsSeen = true; l.stats.health = 90;
  return l;
};
const pick = (l: Life, re: RegExp, ok = true) => {
  const q = l.queue[0]; const s = currentScene(q, l)!;
  const c = s.choices.find((x) => re.test(labelOf(x, l, q.ctx)));
  if (!c) throw new Error(`no ${re}: ${s.choices.map((x) => labelOf(x, l, q.ctx)).join(" | ")}`);
  const out = c.run(l, q.ctx, ok);
  if (out.next) q.scene = out.next; else l.queue.shift();
  return out;
};

describe("ทางเลือกที่สามแบบใหม่ยังพาเรื่องเดินต่อ", () => {
  it("ขึ้นกล่าวแทนรุ่นก็ยังจบการศึกษา และข้อความเป็นของทางนี้เอง", () => {
    const l = life(1);
    fl(l).school = "arcanvale"; fl(l).schoolSince = 12;
    runEvent(l, "ft.graduate");
    const out = pick(l, /กล่าวแทนรุ่น/);
    expect(fl(l).graduated).toBe(true);
    expect(out.text).toMatch(/เพื่อนที่ไม่ได้เรียนจบ/);
  });
  it("เรื่องหลักหลายฉากเดินต่อไปฉากถัดไปเมื่อเลือกทางใหม่", () => {
    const l = life(2, 8);
    runEvent(l, "ft.hl.wolf_snow");
    pick(l, /สุนัขของบ้าน/, true);
    expect(l.queue[0]?.scene).toBeTruthy();
  });
  it("ทางใหม่ที่ลุ้นด้วยค่าพลังมีผลพลาดเป็นของตัวเอง", () => {
    const l = life(3);
    runEvent(l, "ft.school_letter");
    l.age = 11;
    const out = pick(l, /เรียนเองจากตำรา/, false);
    expect(out.text).toMatch(/อ่านไม่จบ/);
  });
});
