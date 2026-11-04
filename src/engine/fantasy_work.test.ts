import { describe, expect, it } from "vitest";
import { loadFantasyWorld } from "../content/fantasy";
import { plant } from "../content/fantasy/conseq";
import { personaOf } from "../content/fantasy/persona";
import { WORK_ECHOES, WORK_EVENTS, bossOf, matesOf, workFactors } from "../content/fantasy/worklife";
import { getEvent, visibleChoices } from "./events";
import { fl } from "../content/fantasy/state";
import { rumorsOf } from "../content/fantasy/rumors";
import { ageUp, createLife, resolveChoice, runEvent } from "./game";
import { remember } from "./npc";
import type { Life } from "./types";

loadFantasyWorld();
const life = (seed: number, job = "ft_knight", age = 25): Life => {
  const l = createLife({ seed, worldId: "fantasy" });
  l.age = age; l.queue = []; l.money = 500_000; l.stats.health = 90; l.flags.ftStarsSeen = true;
  l.job = { careerId: job, level: 2, performance: 50, years: 3 };
  return l;
};
const drain = (l: Life) => { let g = 0; while (l.queue.length && l.alive && g++ < 30) resolveChoice(l, visibleChoices(l, l.queue[0])[0].index); };

describe("ที่ทำงาน", () => {
  it("มีงานแล้วได้เจ้านายหนึ่งคนกับเพื่อนร่วมงานสองคน · เปลี่ยนงานแล้วคนเก่ากลายเป็นอดีตเพื่อนร่วมงาน", () => {
    const l = life(3);
    ageUp(l); drain(l);
    expect(bossOf(l)).toBeTruthy();
    expect(matesOf(l).length).toBe(2);
    const old = bossOf(l)!;
    l.job = { careerId: "ft_merchant", level: 1, performance: 50, years: 0 };
    ageUp(l); drain(l);
    expect(old.tags).toContain("work_ex");
    expect(bossOf(l)!.id).not.toBe(old.id);
  });
  it("นิสัยที่เหมาะกับงานช่วยผลงาน นิสัยที่ขัดทำให้ผลงานตก", () => {
    const k = life(4, "ft_knight"); ageUp(k); drain(k);
    personaOf(k).c = 80; personaOf(k).h = 70;
    expect(workFactors(k).find((x) => x.label.includes("เหมาะ"))?.value).toBeGreaterThan(0);
    const t = life(5, "ft_thief"); ageUp(t); drain(t);
    personaOf(t).h = 80;
    expect(workFactors(t).find((x) => x.label.includes("ขัด"))?.value).toBeLessThan(0);
  });
  it("เจ้านายที่แค้นคุณทำให้ผลงานตก", () => {
    const l = life(6); ageUp(l); drain(l);
    remember(l, bossOf(l)!, "x", "x", 3, { grudge: 80, trust: -40, respect: -30 });
    expect(workFactors(l).find((x) => x.label.includes("เจ้านาย"))!.value).toBeLessThan(0);
  });
  it("เรื่องในที่ทำงานทุกเรื่องเขียนข้อความได้", () => {
    const l = life(7); ageUp(l); drain(l);
    plant(l, "tax_hide");
    for (const e of [...WORK_EVENTS, ...WORK_ECHOES]) {
      expect(getEvent(e.id), e.id).toBeTruthy();
      const ok = !e.when || e.when(l);
      const t = e.text(l, ok && e.prepare ? e.prepare(l) : { pid: bossOf(l)!.id });
      expect(t, e.id).not.toMatch(/undefined|NaN/);
    }
  });
  it("เรื่องเก่าที่ฉาวตามมาถึงที่ทำงานได้", () => {
    const l = life(8); ageUp(l); drain(l);
    fl(l).seeds = []; for (const r of rumorsOf(l)) r.heat = 0;
    expect(getEvent("ft.wk.scandal")!.when!(l)).toBe(false);
    plant(l, "tax_hide");
    expect(getEvent("ft.wk.scandal")!.when!(l)).toBe(true);
  });
  it("ชิงตำแหน่ง: ชนะแล้วเลื่อนขั้น · แพ้แล้วคู่แข่งจำได้", () => {
    let won = 0, lost = 0;
    for (let s = 0; s < 30; s++) {
      const l = life(100 + s); ageUp(l); drain(l);
      // ขั้นสามของอัศวินต้องมีสายกายขั้นหนึ่ง (เส้นทางอาชีพ)
      l.job!.performance = 75; fl(l).bodyRank = Math.max(1, fl(l).bodyRank); const before = l.job!.level;
      runEvent(l, "ft.wk.promo");
      resolveChoice(l, 0); drain(l);
      if (l.job!.level > before) won++; else lost++;
    }
    expect(won).toBeGreaterThan(5);
    expect(lost).toBeGreaterThan(2);
  });
  it("มีเรื่องในที่ทำงานมาให้เลือกเป็นระยะ และไม่ถูกไล่ออกบ่อยเกินไป", () => {
    let events = 0, fired = 0;
    for (let s = 0; s < 10; s++) {
      const l = life(200 + s, "ft_merchant", 22);
      for (let y = 0; y < 15 && l.alive; y++) {
        ageUp(l);
        let g = 0;
        while (l.queue.length && l.alive && g++ < 30) resolveChoice(l, visibleChoices(l, l.queue[0])[0].index);
        if (!l.job) { fired++; break; }
      }
      // เรื่องในที่ทำงานเกิดทั้งแบบเรื่องหลักและแบบช่วงเล็กๆ ที่นิสัยตัดสินเอง
      events += Object.entries(l.seen).filter(([k]) => k.startsWith("ft.wk.")).reduce((s, [, n]) => s + n, 0);
    }
    expect(events).toBeGreaterThan(30);
    expect(fired).toBeLessThan(5);
  }, 60000);
});
