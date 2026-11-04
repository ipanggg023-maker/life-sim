import { describe, expect, it } from "vitest";
import { loadFantasyWorld } from "../content/fantasy";
import { capitalOf, tradeSaturation } from "../content/fantasy/civic";
import { CREDITOR_AT, ESTATES, economyYear, ftLiving, nextYearGold, owns, upkeepOf } from "../content/fantasy/economy";
import { GOLD } from "../content/fantasy/kit";
import { fl } from "../content/fantasy/state";
import { careerById } from "../content/core/careers";
import { getEvent, labelOf, visibleChoices } from "./events";
import { createLife, resolveChoice, runEvent, salaryOf } from "./game";
import type { Life } from "./types";

loadFantasyWorld();
const life = (seed = 3, gold = 0): Life => {
  const l = createLife({ seed, worldId: "fantasy" });
  l.age = 30; l.queue = []; l.money = gold * GOLD; l.stats.health = 90; l.flags.ftStarsSeen = true;
  return l;
};
const choose = (l: Life, re: RegExp) => {
  const q = l.queue[0], ev = getEvent(q.eventId)!;
  const o = visibleChoices(l, q).find((x) => re.test(labelOf(ev.choices![x.index], l, q.ctx)));
  if (!o) throw new Error(`no choice ${re}`);
  resolveChoice(l, o.index);
};
const buy = (l: Life, id: keyof typeof ESTATES) => { runEvent(l, "ft.$.shop"); choose(l, new RegExp(`^${ESTATES[id].name}`)); };

describe("เงิน: หาได้ช้าลง ซื้อของใหญ่ได้", () => {
  it("ทุนกองคาราวานมีเพดาน และส่งติดกันทุกปีกำไรบางลง", () => {
    const l = life(3, 5000);
    fl(l).trades = 200;
    expect(capitalOf(l)).toBeLessThanOrEqual(400);
    fl(l).tradeLast = l.age - 1; fl(l).tradeStreak = 3;
    expect(tradeSaturation(l)).toBeCloseTo(0.12);
    fl(l).tradeLast = l.age - 3;
    expect(tradeSaturation(l)).toBe(0);
  });
  it("ซื้อของใหญ่แล้วเงินหาย มีค่าดูแลทุกปี ค้างสองปีต้องขาย", () => {
    const l = life(4, 1800);
    buy(l, "airship");
    expect(owns(l, "airship")).toBe(true);
    expect(l.money).toBe(200 * GOLD);
    expect(upkeepOf(l)).toBeGreaterThanOrEqual(30);
    economyYear(l);
    expect(l.money).toBe(155 * GOLD);
    l.money = 0;
    economyYear(l); expect(owns(l, "airship")).toBe(true);
    l.money = 0;
    economyYear(l); expect(owns(l, "airship")).toBe(false);
    expect(l.money).toBeGreaterThan(0); // ขายได้คืนบางส่วนไปใช้หนี้
  });
  it("ของใหญ่บางอย่างต้องมีเงื่อนไขก่อนซื้อ", () => {
    const l = life(5, 5000);
    expect(ESTATES.tower.req!(l)).toBeTruthy();
    expect(ESTATES.stable.req!(l)).toBeTruthy();
  });
  it("บรรดาศักดิ์เพิ่มค่าจ้างสิบเปอร์เซ็นต์", () => {
    const l = life(6, 3000);
    const c = careerById("ft_knight")!;
    const before = salaryOf(l, c, 2);
    buy(l, "title");
    // ค่าจ้างปัดเป็นหลักพัน: เพิ่มขึ้นราวสิบเปอร์เซ็นต์
    expect(salaryOf(l, c, 2)).toBeGreaterThan(before);
    expect(Math.abs(salaryOf(l, c, 2) - before * 1.1)).toBeLessThanOrEqual(500);
  });
});

describe("หนี้มีราคา", () => {
  it("เงินติดลบกลายเป็นหนี้และมีดอกเบี้ย บัญชีบันทึกทุกปี", () => {
    const l = life(7);
    l.money = -100 * GOLD;
    economyYear(l);
    expect(l.money).toBe(0);
    expect(l.debt).toBe(106 * GOLD);
    expect(fl(l).ledger?.interest).toBe(6);
    expect(fl(l).ledger?.living).toBe(Math.round(ftLiving(l, 0, 0) / GOLD));
    expect(nextYearGold(l)).toBeLessThan(0);
  });
  it("เจ้าหนี้มาทวงเมื่อหนี้ถึงเกณฑ์ · ทำงานใช้หนี้แล้วหนี้ลด", () => {
    let came = 0;
    for (let s = 0; s < 20; s++) {
      const l = life(100 + s); l.debt = CREDITOR_AT * 2 * GOLD;
      economyYear(l);
      if (l.queue.some((q) => q.eventId === "ft.$.creditor")) came++;
    }
    expect(came).toBeGreaterThan(4);
    const l = life(9); l.debt = 100 * GOLD;
    runEvent(l, "ft.$.creditor");
    choose(l, /ทำงานใช้หนี้/);
    expect(l.debt).toBeLessThan(40 * GOLD);
  });
  it("ไล่เจ้าหนี้ตอนหนี้ท่วมหัวพาไปคุกลูกหนี้", () => {
    const l = life(10); l.debt = 300 * GOLD;
    runEvent(l, "ft.$.creditor");
    choose(l, /^ไล่เจ้าหนี้ออกไป/);
    expect(Number(l.flags.jailUntil)).toBeGreaterThan(l.age);
    expect(l.debt).toBeLessThan(300 * GOLD);
  });
});
