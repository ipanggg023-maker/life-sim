import { describe, expect, it } from "vitest";
import { loadMurimWorld } from "../content/murim";
import { loadSharedEvents } from "../content/shared";
import { worldOfLife } from "../content/murim/life/world";
import { getEvent, labelOf, visibleChoices } from "./events";
import { ageUp, confess, createLife, propose, resolveChoice, runEvent } from "./game";
import type { Life } from "./types";
import { createPerson, people } from "./util";

loadMurimWorld();
loadSharedEvents();

const life = (seed: number, age: number, gender: "m" | "f" = "m"): Life => {
  const l = createLife({ seed, worldId: "murim", gender });
  worldOfLife(l);
  l.age = age; l.queue = [];
  return l;
};

describe("ความรักเป็นเรื่องของผู้ใหญ่", () => {
  it("สารภาพรักและขอแต่งงานไม่ได้ถ้าใครคนหนึ่งอายุไม่ถึง 18", () => {
    const l = life(1, 16);
    const p = createPerson(l, "friend", { age: 16, bond: 100 });
    confess(l, p);
    expect(p.relation).toBe("friend");
    const a = life(2, 30);
    const q = createPerson(a, "partner", { age: 16, bond: 100 });
    propose(a, q);
    expect(q.relation).toBe("partner");
  });

  it("เหตุการณ์รักแรกตอนวัยรุ่นได้เพื่อน ไม่ใช่คนรัก", () => {
    const l = life(3, 14);
    runEvent(l, "t.l.first_love");
    resolveChoice(l, visibleChoices(l, l.queue[0]).find((x) => labelOf(x.c, l, l.queue[0].ctx).startsWith("เขียนกลอน"))!.index);
    expect(people(l, "partner").length).toBe(0);
  });

  it("เหตุการณ์คู่ครองทั้งหมดเริ่มได้ตั้งแต่ 18 เท่านั้น", () => {
    for (const id of ["lv.enemy_meet", "lv.forbidden_found", "lv.foe_child", "lv.love_rival", "lv.arranged", "lv.arranged_heart", "lv.ss_confide", "qn.selection"]) expect(getEvent(id)!.minAge, id).toBeGreaterThanOrEqual(18);
  });

  it("เมียรองและคู่แต่งทางการเมืองอายุไม่ต่ำกว่า 18", () => {
    const l = life(4, 22);
    createPerson(l, "spouse", { age: 22, gender: "f", bond: 70 });
    l.flags.wifeConsented = true;
    l.money = 1_000_000;
    for (let i = 0; i < 20; i++) {
      l.queue = [];
      runEvent(l, "hh.second_wife_consent");
      resolveChoice(l, visibleChoices(l, l.queue[0])[0].index);
    }
    for (const p of people(l, "spouse")) expect(p.age).toBeGreaterThanOrEqual(18);
  });
});

describe("งานแต่งและคู่สมรส", () => {
  it("งานแต่งไม่ทำให้เงินติดลบ", () => {
    for (let s = 1; s <= 30; s++) {
      const l = life(s, 25);
      l.wealth = "elite"; l.money = 1_000;
      const p = createPerson(l, "partner", { age: 25, bond: 100 });
      propose(l, p);
      expect(l.money).toBeGreaterThanOrEqual(0);
    }
  });

  it("ผู้หญิงที่มีสามีอยู่แล้วแต่งซ้อนไม่ได้", () => {
    const l = life(5, 30, "f");
    createPerson(l, "spouse", { age: 30, gender: "m", bond: 80 });
    const p = createPerson(l, "partner", { age: 30, gender: "m", bond: 100 });
    propose(l, p);
    expect(p.relation).toBe("partner");
    expect(getEvent("lv.political")!.when!({ ...l, fame: 80 })).toBe(false);
  });
});

describe("ทางเข้าวังและสถานะ", () => {
  it("พ่อค้ารับสัญญาของหลวงได้ แล้วเข้าวังได้จริง", () => {
    const l = life(6, 30);
    l.job = { careerId: "merchant", level: 3, performance: 60, years: 5 };
    expect(getEvent("rt.supplier")!.when!(l)).toBe(true);
    runEvent(l, "rt.supplier");
    visibleChoices(l, l.queue[0])[0].c.run(l, l.queue[0].ctx, true);
    expect(l.flags.palaceSupplier).toBe(true);
    expect(getEvent("rt.supplier")!.when!(l)).toBe(false);
  });

  it("คนในวังหลังไม่มีเหตุการณ์เสมียน และงานนอกวังหลุดเมื่อขึ้นปี", () => {
    const l = life(7, 20, "f");
    l.flags.qnRank = 0;
    expect(getEvent("rt.clerk")!.when!(l)).toBe(false);
    l.job = { careerId: "merchant", level: 1, performance: 50, years: 0 };
    l.stats.health = 100;
    ageUp(l);
    expect(l.job).toBeUndefined();
  });

  it("คนรู้จักไม่อยู่เกิน 115 ปี", () => {
    const l = life(8, 30);
    const p = createPerson(l, "friend", { age: 114, bond: 50 });
    l.stats.health = 100;
    ageUp(l);
    expect(p.alive).toBe(false);
  });
});
