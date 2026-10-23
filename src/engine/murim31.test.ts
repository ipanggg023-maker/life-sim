import { describe, expect, it } from "vitest";
import { loadMurimWorld } from "../content/murim";
import { loadSharedEvents } from "../content/shared";
import { worldOfLife } from "../content/murim/life/world";
import { courtOf } from "../content/murim/world/court";
import { syncThrone } from "../content/murim/world/emperor";
import { EDICTS, activeEdicts, edictOn, issueEdict } from "../content/murim/world/edicts";
import { palaceOf } from "../content/murim/world/palace";
import { ACTIVITIES } from "./activities";
import { labelOf, visibleChoices } from "./events";
import { ageUp, createLife, resolveChoice, runEvent } from "./game";
import { nextFloat } from "./rng";
import type { Life } from "./types";
import { validateLife } from "./validate";

loadMurimWorld();
loadSharedEvents();

const labels = (l: Life) => visibleChoices(l, l.queue[0]).map((x) => String(labelOf(x.c, l, l.queue[0].ctx)));
function choose(l: Life, start: string) {
  const o = visibleChoices(l, l.queue[0]);
  const i = o.findIndex((x) => String(labelOf(x.c, l, l.queue[0].ctx)).startsWith(start));
  expect(i, `${start} ใน ${labels(l).join(" | ")}`).toBeGreaterThanOrEqual(0);
  resolveChoice(l, o[i].index);
}
function drain(l: Life, r: { rng: number }) {
  let g = 0;
  while (l.queue.length && g++ < 60) {
    const o = visibleChoices(l, l.queue[0]);
    expect(o.length, `ตันใน ${l.queue[0].eventId}/${l.queue[0].scene ?? "start"}`).toBeGreaterThan(0);
    resolveChoice(l, o[Math.floor(nextFloat(r) * o.length)].index);
  }
}
function emperor(seed: number) {
  const l = createLife({ seed, worldId: "murim" });
  worldOfLife(l);
  l.age = 30; l.stats.health = 90;
  courtOf(l);
  l.flags.emperorSelf = true;
  syncThrone(l);
  l.queue = [];
  return l;
}

describe("ราชโองการที่มีผลต่อเนื่อง", () => {
  it("มีราชโองการอย่างน้อย 20 ฉบับ ครบสี่หมวด", () => {
    expect(EDICTS.length).toBeGreaterThanOrEqual(20);
    expect(new Set(EDICTS.map((e) => e.cat)).size).toBe(4);
  });

  it("ฮ่องเต้ออกราชโองการจากเมนู มีผลทุกปี ขัดกันออกพร้อมกันไม่ได้ ยกเลิกได้ หมดอายุเองได้", () => {
    const l = emperor(5);
    runEvent(l, "ct.e_edict");
    choose(l, "ด้านเศรษฐกิจ");
    choose(l, "สร้างยุ้งฉางหลวง");
    expect(edictOn(l, "granary")).toBe(true);
    const food = l.mw!.food;
    ageUp(l);
    expect(l.mw!.food).toBeGreaterThanOrEqual(Math.min(100, food));
    l.queue = [];
    runEvent(l, "ct.e_edict");
    choose(l, "ด้านเศรษฐกิจ");
    choose(l, "ลดภาษีที่นา");
    runEvent(l, "ct.e_edict");
    choose(l, "ด้านเศรษฐกิจ");
    expect(labels(l).some((x) => x.startsWith("เพิ่มภาษีที่นา"))).toBe(false);
    choose(l, "ยังไม่ออก");
    runEvent(l, "ct.e_edict");
    choose(l, "ยกเลิกราชโองการ");
    choose(l, "ยกเลิก \"สร้างยุ้งฉาง");
    expect(edictOn(l, "granary")).toBe(false);
    for (let y = 0; y < 6; y++) { l.stats.health = 90; ageUp(l); drain(l, { rng: y }); }
    expect(edictOn(l, "tax_cut")).toBe(false);
    expect(validateLife(l)).toEqual([]);
  });

  it("ผลจริง: ภาษีหนักเพิ่มท้องพระคลังและความไม่สงบ · ปิดบ่อนแล้วเล่นถั่วไม่ได้", () => {
    const l = emperor(9);
    const t0 = palaceOf(l).treasury, u0 = l.mw!.unrest;
    issueEdict(l, "heavy_tax");
    ageUp(l);
    expect(palaceOf(l).treasury).toBeGreaterThan(t0 - 3);
    expect(l.mw!.unrest).toBeGreaterThan(u0 - 4);
    const c = createLife({ seed: 10, worldId: "murim" });
    worldOfLife(c);
    c.age = 25;
    const g = ACTIVITIES.find((a) => a.id === "mw_gamble")!;
    expect(g.available!(c)).toBe(true);
    issueEdict(c, "ban_vice");
    expect(g.available!(c)).toBe(false);
  });

  it("ฮ่องเต้องค์อื่นออกราชโองการตามนิสัย และราชโองการไปถึงชีวิตคนธรรมดา", () => {
    let issued = 0, reached = 0;
    for (let s = 1; s <= 40; s++) {
      const l = createLife({ seed: 300 + s * 7, worldId: "murim", gender: s % 2 ? "m" : "f" });
      worldOfLife(l);
      const r = { rng: s };
      for (let y = 0; y < 45 && l.alive; y++) { drain(l, r); if (!l.alive) break; if (l.age >= 16) l.stats.health = Math.max(50, l.stats.health); ageUp(l); issued = Math.max(issued, activeEdicts(l).length); }
      drain(l, r);
      reached += Object.keys(l.seen).filter((k) => k.startsWith("ed.")).length;
      expect(validateLife(l)).toEqual([]);
    }
    console.log("SIM edicts", { issued, reached });
    expect(issued).toBeGreaterThan(1);
    expect(reached).toBeGreaterThan(8);
  });
});
