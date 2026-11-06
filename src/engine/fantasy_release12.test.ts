import { describe, expect, it } from "vitest";
import { loadFantasyWorld } from "../content/fantasy";
import { HABIT, LANDS, LOAN_RATE, THEFT_AT, VENTURES, boomOf, landCount, moneyLines, taxRate } from "../content/fantasy/money2";
import { ftLiving } from "../content/fantasy/economy";
import { priceOf } from "../content/fantasy/society";
import { fl, homeKingdom, kingdomsOf } from "../content/fantasy/state";
import { doActivity } from "./activities";
import { currentScene, getEvent, labelOf } from "./events";
import { ageUp, createLife, runEvent } from "./game";
import type { Life } from "./types";
import { createPerson } from "./util";

loadFantasyWorld();
const life = (seed: number, age = 30): Life => {
  const l = createLife({ seed, worldId: "fantasy", plain: true });
  l.age = age; l.queue = []; l.money = 100_000; l.flags.ftStarsSeen = true; l.stats.health = 90;
  for (const k of kingdomsOf(l)) k.boom = undefined;
  return l;
};
const labels = (l: Life) => { const q = l.queue[0]; const s = currentScene(q, l)!; return s.choices.filter((c) => !c.show || c.show(l, q.ctx)).map((c) => labelOf(c, l, q.ctx)); };
const pickRun = (l: Life, re: RegExp, ok = true) => {
  const q = l.queue[0], s = currentScene(q, l)!;
  const c = s.choices.find((x) => (!x.show || x.show(l, q.ctx)) && re.test(labelOf(x, l, q.ctx)));
  if (!c) throw new Error(`no choice ${re} in ${q.eventId}: ${labels(l).join(" | ")}`);
  const out = c.run(l, q.ctx, ok);
  if (out.next) q.scene = out.next; else l.queue.shift();
  return out;
};
const only = (l: Life, id: string) => { l.queue = l.queue.filter((q) => q.eventId === id); };
const year = (l: Life) => { l.queue = []; l.doneThisYear = []; ageUp(l); };

describe("ลงทุนและปล่อยกู้", () => {
  it("เงินที่ลงทุนได้ผลเมื่อครบกำหนด ไม่ว่าจะได้ เสมอตัว หรือเสีย", () => {
    let won = 0, lost = 0;
    for (let s = 1; s <= 30; s++) {
      const l = life(s); l.money = 6000;
      doActivity(l, "ft_invest"); only(l, "ft.m2.invest"); pickRun(l, /เรือสินค้า/);
      const due = fl(l).invests![0].due;
      expect(due).toBeGreaterThan(l.age);
      const m0 = l.money;
      while (l.age < due) year(l);
      expect(fl(l).invests ?? []).toHaveLength(0);
      const net = l.log.slice(-40).find((e) => e.text.includes(VENTURES.voyage.name))?.text ?? "";
      if (/กำไร/.test(net)) won++; else if (/ล้มเหลว/.test(net)) lost++;
      void m0;
    }
    expect(won).toBeGreaterThan(3);
    expect(lost).toBeGreaterThan(3);
  });
  it("ปล่อยกู้แล้วได้คืนพร้อมดอก หรือคนกู้มาขอเลื่อน หรือหนีไป", () => {
    let paid = 0, other = 0;
    for (let s = 1; s <= 20; s++) {
      const l = life(s); l.money = 6000;
      doActivity(l, "ft_lend"); only(l, "ft.m2.lend"); pickRun(l, /ชาวนา/);
      for (let i = 0; i < 4; i++) year(l);
      if (l.log.some((e) => e.text.includes("พร้อมดอกเบี้ย"))) paid++; else other++;
    }
    expect(paid).toBeGreaterThan(4);
    expect(other).toBeGreaterThan(2);
    expect(LOAN_RATE).toBeGreaterThan(0);
  });
  it("คนกู้ที่มาขอเลื่อน ยกหนี้ให้ได้ และเพื่อนจำได้", () => {
    const l = life(3); const p = createPerson(l, "friend", { age: 30, bond: 50 }); const before = p.bond;
    fl(l).loans = [{ name: "เพื่อน", gold: 30, due: l.age, pid: p.id }];
    runEvent(l, "ft.m2.loan_due", { n: "เพื่อน", g: 30 }); pickRun(l, /ยกหนี้/);
    expect(fl(l).loans).toHaveLength(0);
    expect(p.bond).toBeGreaterThan(before);
  });
});

describe("ที่ดิน ภาษี และเศรษฐกิจ", () => {
  it("ซื้อที่ดินแล้วได้ค่าเช่า รีดเต็มที่ได้มากกว่าแต่ผู้เช่าเกลียด จนลุกฮือได้", () => {
    const l = life(4); l.money = 1_000_000;
    doActivity(l, "ft_land"); only(l, "ft.m2.land"); pickRun(l, /ซื้อไร่/);
    expect(landCount(l)).toBe(1);
    expect(LANDS.farm.price).toBeGreaterThan(0);
    runEvent(l, "ft.m2.land"); pickRun(l, /รีดเต็มที่/);
    expect(fl(l).land!.squeeze).toBe(true);
    for (let i = 0; i < 10; i++) year(l);
    expect(fl(l).land === undefined || fl(l).land!.mood < 60).toBe(true);
    if (fl(l).land) { fl(l).land!.mood = 10; expect(getEvent("ft.m2.revolt")!.when!(l)).toBe(true); }
  });
  it("แต่ละแผ่นดินเก็บภาษีไม่เท่ากัน ปีสงครามแพงขึ้น และย้ายหนีภาษีได้", () => {
    const l = life(5); l.money = 500 * 100;
    const ks = kingdomsOf(l), rates = new Set(ks.map((k) => taxRate(k)));
    expect(rates.size).toBeGreaterThan(1);
    const k = homeKingdom(l), r0 = taxRate(k); k.war = "x"; expect(taxRate(k)).toBeGreaterThan(r0); k.war = undefined;
    expect(getEvent("ft.m2.tax")!.when!(l)).toBe(true);
    const home = fl(l).kingdom;
    runEvent(l, "ft.m2.tax"); pickRun(l, /ย้ายไป/);
    expect(fl(l).kingdom).not.toBe(home);
  });
  it("ช่วงเศรษฐกิจเปลี่ยนราคาและค่าครองชีพ แล้วหมดไปเอง", () => {
    const l = life(6); const k = homeKingdom(l);
    const p0 = priceOf(k, "grain");
    k.boom = { kind: "harvest", left: 2 };
    expect(priceOf(k, "grain")).toBeLessThan(p0);
    expect(boomOf(l)).toBe("harvest");
    k.boom = { kind: "goldrush", left: 1 };
    const c = ftLiving(l, 0, 0); k.boom = undefined; expect(c).toBeGreaterThan(ftLiving(l, 0, 0));
    k.boom = { kind: "bust", left: 1 }; year(l);
    expect(k.boom).toBeUndefined();
  });
  it("ใช้ชีวิตหรูหราแพงกว่าประหยัด", () => {
    const l = life(7);
    fl(l).lifestyle = "lavish"; const hi = ftLiving(l, 0, 0);
    fl(l).lifestyle = "frugal"; const lo = ftLiving(l, 0, 0);
    expect(hi).toBeGreaterThan(lo * 2);
    expect(moneyLines(l)[0]).toMatch(/ประหยัด/);
  });
});

describe("พนัน ความจน ขโมย และทำบุญ", () => {
  it("เล่นลูกเต๋าบ่อยแล้วติดพนัน และนักบวชช่วยได้", () => {
    const l = life(8);
    fl(l).gambling = HABIT;
    expect(getEvent("ft.m2.urge")!.when!(l)).toBe(true);
    runEvent(l, "ft.m2.urge"); pickRun(l, /นักบวช/);
    expect(fl(l).gambling).toBe(0);
  });
  it("คนจนเห็นทางของคนจน และคนมีเงินไม่เห็น", () => {
    const l = life(9); l.money = 0; l.job = undefined;
    const ids = () => ACT_IDS(l);
    expect(ids()).toContain("ft_beg");
    expect(getEvent("ft.m2.kindness")!.when!(l)).toBe(true);
    l.money = 100_000;
    expect(ids()).not.toContain("ft_beg");
  });
  it("คนรวยที่ไม่มีคนเฝ้าโดนขโมย ห้องนิรภัยกันได้", () => {
    let robbed = 0, safe = 0;
    for (let s = 1; s <= 40; s++) {
      const a = life(s); a.money = THEFT_AT * 3 * 100; year(a); if (a.log.some((e) => e.text.includes("ขโมยงัดบ้าน"))) robbed++;
      const b = life(s); b.money = THEFT_AT * 3 * 100; fl(b).vault = true; year(b); if (b.log.some((e) => e.text.includes("ขโมยงัดบ้าน"))) safe++;
    }
    expect(robbed).toBeGreaterThan(0);
    expect(safe).toBe(0);
  });
  it("สร้างบ้านเด็กกำพร้าแล้ววันหนึ่งเด็กคนนั้นกลับมาช่วย", () => {
    const l = life(10, 40); l.money = 1_000_000;
    doActivity(l, "ft_charity"); only(l, "ft.m2.charity"); pickRun(l, /บ้านเด็กกำพร้า/);
    expect(fl(l).deeds.some((d) => d.includes("บ้านเด็กกำพร้า"))).toBe(true);
    l.stats.health = 30;
    expect(getEvent("ft.m2.orphan")!.when!(l)).toBe(true);
  });
  it("ส่งคาราวานสำเร็จแล้วไปต่ออีกเมืองได้ และพาไปได้สามเมือง", () => {
    const l = life(11);
    runEvent(l, "ft.m2.route", { leg: 0, gain: 20 }); pickRun(l, /ไปต่อ/, true);
    expect(l.queue[0]?.eventId).toBe("ft.m2.route");
    pickRun(l, /ไปต่อ/, true); pickRun(l, /ไปต่อ/, true);
    expect(fl(l).deeds.some((d) => d.includes("สามเมือง"))).toBe(true);
  });
});

import { activitiesFor } from "./activities";
const ACT_IDS = (l: Life) => activitiesFor(l).map((a) => a.id);
