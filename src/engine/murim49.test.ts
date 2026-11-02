import { describe, expect, it } from "vitest";
import { loadMurimWorld } from "../content/murim";
import { loadSharedEvents } from "../content/shared";
import { askOdds, bossOf, canRetire, mateOf, nextStep, retire, workActions } from "../content/murim/life/workplace";
import { worldOfLife } from "../content/murim/life/world";
import { labelOf, visibleChoices } from "./events";
import { ageUp, createLife, resolveChoice } from "./game";
import type { Life } from "./types";

loadMurimWorld();
loadSharedEvents();

const worker = (seed: number, careerId = "constable", years = 2, age = 30): Life => {
  const l = createLife({ seed, worldId: "murim" });
  worldOfLife(l);
  l.age = age; l.queue = []; l.money = 500_000; l.stats.health = 100;
  l.job = { careerId, level: 2, performance: 60, years };
  return l;
};
const tick = (l: Life) => { ageUp(l); l.queue = []; };
const force = (l: Life, start: string, ok = true) => {
  const q = l.queue[0];
  const o = visibleChoices(l, q).find((x) => labelOf(x.c, l, q.ctx).startsWith(start));
  expect(o, `ไม่มี "${start}" ใน ${q.eventId}`).toBeTruthy();
  o!.c.run(l, q.ctx, ok);
  l.queue = [];
};

describe("คนในที่ทำงาน", () => {
  it("งานมีหัวหน้าได้หัวหน้าและเพื่อนร่วมงาน งานคนเดียวไม่มี", () => {
    const l = worker(1);
    tick(l);
    expect(bossOf(l)?.age).toBeGreaterThanOrEqual(18);
    expect(mateOf(l)?.age).toBeGreaterThanOrEqual(18);
    expect(workActions(l).length).toBe(2);
    const solo = worker(2, "farmer");
    tick(solo);
    expect(bossOf(solo)).toBeUndefined();
    expect(workActions(solo)).toEqual([]);
  });

  it("ขอเลื่อนตำแหน่งสำเร็จได้ ขอถี่ไม่ได้ และโอกาสขึ้นตามผลงาน", () => {
    const l = worker(3);
    tick(l);
    if (l.job) l.job.performance = 60;
    const low = askOdds(l);
    l.job!.performance = 95;
    expect(askOdds(l)).toBeGreaterThan(low);
    workActions(l)[0].run(l);
    const lv = l.job!.level;
    force(l, "ขอเลื่อนตำแหน่ง");
    expect(l.job!.level).toBe(lv + 1);
    l.doneThisYear = [];
    l.job!.performance = 90;
    workActions(l)[0].run(l);
    const labels = visibleChoices(l, l.queue[0]).map((x) => labelOf(x.c, l, l.queue[0].ctx));
    expect(labels.some((x) => x.startsWith("ขอเลื่อนตำแหน่ง"))).toBe(false);
  });

  it("พบหัวหน้ากินเวลาและทำได้ปีละครั้ง", () => {
    const l = worker(4);
    tick(l);
    const a = workActions(l)[0];
    a.run(l);
    resolveChoice(l, visibleChoices(l, l.queue[0]).at(-1)!.index);
    expect(workActions(l)[0].locked).toBeTruthy();
    expect(l.doneThisYear).toContain("job:w_boss");
  });

  it("เลื่อยขาเพื่อนร่วมงานสำเร็จแล้วเขาไม่ใช่เพื่อนร่วมงานอีก", () => {
    const l = worker(5);
    tick(l);
    workActions(l)[1].run(l);
    force(l, "เลื่อยขาเก้าอี้");
    expect(mateOf(l)).toBeUndefined();
  });

  it("เปลี่ยนงานแล้วคนไม่สนิทหายไป คนสนิทเป็นเพื่อนต่อ", () => {
    const l = worker(6);
    tick(l);
    const b = bossOf(l)!, m = mateOf(l)!;
    m.bond = 90;
    l.job = undefined;
    tick(l);
    expect(l.people.some((p) => p.id === b.id)).toBe(false);
    expect(l.people.find((p) => p.id === m.id)?.tags ?? []).not.toContain("colleague");
    expect(l.people.some((p) => p.id === m.id)).toBe(true);
  });
});

describe("ตำแหน่งถัดไปและเกษียณ", () => {
  it("บอกตำแหน่งถัดไป เตือนเมื่อเกือบถูกไล่ออก", () => {
    const l = worker(7);
    expect(nextStep(l)).toContain("ต่อไป");
    l.job!.performance = 20;
    expect(nextStep(l)).toContain("ไล่ออก");
    l.job!.performance = 60; l.job!.level = 5;
    expect(nextStep(l)).toContain("สูงสุด");
  });

  it("เกษียณได้เมื่ออายุ 55 ทำงาน 10 ปี ได้เบี้ยเลี้ยงทุกปี โจรไม่มีเบี้ยเลี้ยง", () => {
    expect(canRetire(worker(8, "official", 12, 50))).toBe(false);
    expect(canRetire(worker(8, "official", 5, 60))).toBe(false);
    expect(canRetire(worker(8, "bandit", 20, 60))).toBe(false);
    const l = worker(9, "official", 12, 60);
    expect(canRetire(l)).toBe(true);
    retire(l);
    expect(l.job).toBeUndefined();
    const pay = Number(l.flags.pension);
    expect(pay).toBeGreaterThan(0);
    expect(canRetire(l)).toBe(false);
  });
});
