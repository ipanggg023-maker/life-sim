import { describe, expect, it } from "vitest";
import { loadMurimWorld } from "../content/murim";
import { loadSharedEvents } from "../content/shared";
import { examLevel } from "../content/murim/life/activities";
import { mainGoal } from "../content/murim/life/goals";
import { worldOfLife } from "../content/murim/life/world";
import { activitiesFor, activityLocked, doActivity } from "./activities";
import { visibleChoices } from "./events";
import { createLife, resolveChoice } from "./game";
import type { Life } from "./types";

loadMurimWorld();
loadSharedEvents();

const murim = (seed: number) => { const l = createLife({ seed, worldId: "murim" }); worldOfLife(l); return l; };
const examAct = (l: Life) => activitiesFor(l).find((a) => a.id === "mw_exam")!;

describe("สอบขุนนางได้ทุกคน ไม่ต้องมีเป้าหมายขุนนาง", () => {
  it("ระดับสนามสอบตามวุฒิ · มณฑลและหน้าพระที่นั่งจัดทุกสามปี · สอบครบแล้วไม่มีให้สอบอีก", () => {
    const l = murim(1);
    l.age = 14;
    expect(examLevel(l)).toBeUndefined();
    l.age = 16;
    expect(mainGoal(l)?.id).not.toBe("official");
    expect(examLevel(l)).toBe("goal.exam");
    l.flags.xiucai = true;
    l.age = 18;
    const years = Array.from({ length: 6 }, (_, i) => { l.age = 18 + i; return examLevel(l); });
    expect(years.filter((x) => x === "jh.exam_province").length).toBe(2);
    expect(years.filter((x) => x === undefined).length).toBe(4);
    l.flags.juren = true;
    l.age = 21;
    while (!examLevel(l)) l.age++;
    expect(examLevel(l)).toBe("jh.exam_palace");
    l.flags.jinshi = true;
    expect(examLevel(l)).toBeUndefined();
  });

  it("กิจกรรมสอบเปิดฉากสอบจริง ผ่านแล้วได้วุฒิ และสมัครเป็นขุนนางได้", () => {
    let passed = 0;
    for (let s = 1; s <= 40; s++) {
      const l = murim(100 + s);
      l.age = 16; l.stats.smarts = 85;
      expect(activityLocked(l, examAct(l))).toBeUndefined();
      doActivity(l, "mw_exam");
      expect(l.queue[0]?.eventId).toBe("goal.exam");
      const take = visibleChoices(l, l.queue[0]).find((o) => o.c.label === "เข้าสอบ")!;
      resolveChoice(l, take.index);
      if (l.flags.xiucai) passed++;
    }
    expect(passed).toBeGreaterThan(25);
  });
});
