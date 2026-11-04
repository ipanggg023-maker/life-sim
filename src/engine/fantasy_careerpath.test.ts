import { describe, expect, it } from "vitest";
import { loadFantasyWorld } from "../content/fantasy";
import { canRise, mastered, retireAge, stepsFor } from "../content/fantasy/careerpath";
import { setRace } from "../content/fantasy/life";
import { fl } from "../content/fantasy/state";
import { careerById } from "../content/core/careers";
import { getEvent, labelOf, visibleChoices } from "./events";
import { ageUp, applyJob, createLife, resolveChoice, runEvent } from "./game";
import type { Life } from "./types";

loadFantasyWorld();
const life = (seed = 3, job = "ft_merchant", level = 1): Life => {
  const l = createLife({ seed, worldId: "fantasy" });
  l.age = 30; l.queue = []; l.money = 500_000; l.stats.health = 90; l.stats.smarts = 70; l.flags.ftStarsSeen = true;
  l.job = { careerId: job, level, performance: 85, years: 0 };
  return l;
};
const choose = (l: Life, re: RegExp) => {
  const q = l.queue[0], ev = getEvent(q.eventId)!;
  const o = visibleChoices(l, q).find((x) => re.test(labelOf(ev.choices![x.index], l, q.ctx)));
  if (!o) throw new Error(`no choice ${re}`);
  resolveChoice(l, o.index);
};

describe("เส้นทางอาชีพ", () => {
  it("ขึ้นขั้นสามต้องทำงานมาสามปีและมีฝีมือพอ", () => {
    const l = life(3, "ft_merchant", 2);
    const c = careerById("ft_merchant")!;
    expect(canRise(l)).toBe(false);
    l.job!.years = 3;
    expect(canRise(l)).toBe(true);
    l.stats.smarts = 30;
    expect(stepsFor(l, c, 3).find((s) => !s.ok && s.label.includes("สติปัญญา"))).toBeTruthy();
  });
  it("อาชีพนักสู้วัดด้วยขั้นสายกาย ไม่ใช่ค่าสถานะ", () => {
    const l = life(4, "ft_knight", 2); l.job!.years = 5;
    fl(l).bodyRank = 0;
    expect(canRise(l)).toBe(false);
    fl(l).bodyRank = 1;
    expect(canRise(l)).toBe(true);
  });
  it("ขั้นสูงสุดได้จากการสอบเป็นนายใหญ่เท่านั้น", () => {
    const l = life(5, "ft_merchant", 4); l.job!.years = 9; l.stats.smarts = 80;
    expect(canRise(l)).toBe(false); // ยังไม่ได้สอบ
    let seen = false;
    for (let y = 0; y < 6 && !mastered(l, "ft_merchant"); y++) {
      l.job!.performance = 90; l.queue = [];
      ageUp(l);
      if (l.queue.some((q) => q.eventId === "ft.cp.trial")) {
        seen = true;
        while (l.queue[0]?.eventId !== "ft.cp.trial") l.queue.shift();
        choose(l, /สร้างผลงานชิ้นเอก/);
      }
      l.queue = [];
    }
    expect(seen).toBe(true);
    expect(mastered(l, "ft_merchant")).toBe(true);
    expect(l.job!.level).toBe(5);
  });
  it("การชิงตำแหน่งในที่ทำงานพาไปได้ไม่เกินขั้นสี่", () => {
    const l = life(6, "ft_merchant", 4); l.job!.years = 10;
    expect(getEvent("ft.wk.promo")!.when!(l)).toBe(false);
  });
  it("เผ่าอายุยืนเกษียณช้ากว่ามนุษย์ และเลือกทำต่อได้", () => {
    const h = life(7); setRace(h, "human");
    const e = life(8); setRace(e, "elf");
    expect(retireAge(e)).toBeGreaterThan(retireAge(h));
    runEvent(h, "ft.cp.retire");
    const before = retireAge(h);
    choose(h, /ทำต่ออีกห้าปี/);
    expect(retireAge(h)).toBe(before + 5);
  });
  it("เกษียณแล้วได้บำนาญตามขั้น", () => {
    const l = life(9, "ft_merchant", 5); setRace(l, "human");
    l.flags.ftMaster_ft_merchant = true;
    l.age = retireAge(l);
    l.queue = []; ageUp(l);
    expect(l.job).toBeUndefined();
    expect(Number(l.flags.pension)).toBeGreaterThan(0);
  });
  it("กลับมาทำงานเดิมไม่ต้องเริ่มจากศูนย์", () => {
    const l = life(10); l.job = undefined; l.flags.ftBest_ft_merchant = 4;
    for (let i = 0; i < 20 && !l.job; i++) { l.doneThisYear = []; applyJob(l, "ft_merchant"); }
    expect((l.job as Life["job"])?.level).toBe(3);
  });
});
