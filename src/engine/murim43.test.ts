import { describe, expect, it } from "vitest";
import { loadMurimWorld } from "../content/murim";
import { loadSharedEvents } from "../content/shared";
import { worldOfLife } from "../content/murim/life/world";
import { activitiesFor, activityLocked, doActivity } from "./activities";
import { getEvent, visibleChoices } from "./events";
import { ageUp, createLife, resolveChoice, runEvent } from "./game";
import type { Life } from "./types";
import { createPerson } from "./util";

loadMurimWorld();
loadSharedEvents();

const rich = (seed: number, tael: number, age = 50): Life => {
  const l = createLife({ seed, worldId: "murim" });
  worldOfLife(l);
  l.age = age; l.money = tael * 1000; l.queue = [];
  return l;
};
const ids = (l: Life) => activitiesFor(l).filter((a) => a.group === "ทรัพย์สิน" && !activityLocked(l, a)).map((a) => a.id);

describe("ใช้เงินช่วงปลายชีวิต", () => {
  it("คนจนไม่เห็นรายการ คนรวยเห็นครบ", () => {
    expect(ids(rich(1, 50)).length).toBe(0);
    expect(ids(rich(2, 10000)).length).toBeGreaterThanOrEqual(8);
  });

  it("ซื้อโรงเตี๊ยมแล้วเงินลด มีรายได้ทุกปี และซื้อซ้ำไม่ได้", () => {
    const l = rich(3, 3000);
    doActivity(l, "mw_buy_inn");
    expect(l.money).toBe(1000 * 1000);
    expect(ids(l)).not.toContain("mw_buy_inn");
    l.stats.health = 95;
    const before = l.money;
    l.people = [];
    ageUp(l);
    expect(l.money).toBeGreaterThan(before - 60_000);
    expect(getEvent("es.inn_brawl")!.when!(l)).toBe(true);
  });

  it("โรงทานทำซ้ำได้ห้าปีครั้ง · จ้างอาจารย์แล้วลูกเก่งขึ้นจริง", () => {
    const l = rich(4, 10000);
    doActivity(l, "mw_soup");
    expect(ids(l)).not.toContain("mw_soup");
    l.age += 5; l.doneThisYear = [];
    expect(ids(l)).toContain("mw_soup");
    const k = createPerson(l, "child", { age: 12, gender: "m", bond: 50 });
    const r0 = k.martial?.rank ?? 0;
    doActivity(l, "mw_master_child");
    expect(k.martial!.rank).toBe(r0 + 2);
  });

  it("คาราวานถูกปล้นแล้วเสียกิจการจริง · ทุกเรื่องมีทางเลือกที่กดได้แม้ไม่มีเงิน", () => {
    const l = rich(5, 7000);
    doActivity(l, "mw_buy_caravan");
    l.age += 1;
    l.money = 0;
    expect(getEvent("es.caravan_raid")!.when!(l)).toBe(true);
    runEvent(l, "es.caravan_raid");
    const o = visibleChoices(l, l.queue[0]);
    expect(o.length).toBeGreaterThan(0);
    resolveChoice(l, o[o.length - 1].index);
    expect(l.flags.estate_caravan).toBeUndefined();
  });
});
