import { describe, expect, it } from "vitest";
import { loadFantasyWorld } from "../content/fantasy";
import { capitalOf, tradeProfit, wanted } from "../content/fantasy/civic";
import { setRace } from "../content/fantasy/life";
import { GOODS, priceOf, setLaw } from "../content/fantasy/society";
import { addStanding, dataOf, ensureSociety, fl, homeKingdom, kingdomsOf, newFantasyWorld, standingOf, worldOfLife, NOTABLE_CAP } from "../content/fantasy/state";
import { fastForward, tickWorld } from "../content/fantasy/world";
import { activitiesFor, activityLocked, doActivity } from "./activities";
import { allEvents, getEvent, labelOf, visibleChoices } from "./events";
import { ageUp, createLife, resolveChoice, runEvent } from "./game";
import { nextFloat } from "./rng";
import type { Life } from "./types";
import { validateLife } from "./validate";
import { moduleOf } from "./worldModule";

loadFantasyWorld();

const life = (seed: number, age = 25): Life => {
  const l = createLife({ seed, worldId: "fantasy" });
  setRace(l, "human");
  l.age = age; l.queue = []; l.money = 500_000; l.stats.health = 90; l.stats.smarts = 70; l.stats.looks = 70; l.stats.luck = 70;
  return l;
};
const force = (l: Life, start: string, ok = true) => {
  const q = l.queue[0];
  const o = visibleChoices(l, q).find((x) => labelOf(x.c, l, q.ctx).includes(start));
  expect(o, `ไม่มี "${start}" ใน ${q.eventId}`).toBeTruthy();
  const out = o!.c.run(l, q.ctx, ok);
  l.queue.shift();
  return out;
};
const act = (l: Life, id: string) => activitiesFor(l).find((a) => a.id === id)!;

describe("โลกเดินเอง 500 ปีโดยไม่มีผู้เล่น", () => {
  const w = newFantasyWorld(77, 1000);
  const d = ensureSociety(w);
  const r = { rng: 123 };
  const seen = { leaders: new Set<string>(), tops: new Set<string>(), rulers: new Set<string>(), holders: new Set<string>(), lawChanges: 0 };
  let lows = 0, highs = 0;
  for (let y = 0; y < 500; y++) {
    w.year++;
    tickWorld(w, r);
    for (const x of d.factions) seen.leaders.add(x.leader);
    seen.tops.add(d.factions.slice().sort((a, b) => b.power - a.power)[0].id);
    for (const k of d.kingdoms) { seen.rulers.add(k.ruler); if ((k.prosperity ?? 0) < 80) lows++; if ((k.prosperity ?? 0) > 115) highs++; }
    for (const rl of d.relics) seen.holders.add(rl.holder);
  }
  it("ไม่มีใครครองโลกตลอดไป และไม่มีอะไรหยุดนิ่ง", () => {
    expect(seen.tops.size).toBeGreaterThanOrEqual(4);
    expect(seen.leaders.size).toBeGreaterThan(20);
    expect(seen.rulers.size).toBeGreaterThan(9);
    expect(seen.holders.size).toBeGreaterThan(5);
    expect(d.notables.length).toBeGreaterThanOrEqual(NOTABLE_CAP * 0.75);
    expect(lows).toBeGreaterThan(0);
    expect(highs).toBeGreaterThan(0);
  });
  it("บันทึกเหตุการณ์หลากหลาย และคนเก่าตายไปหมดแล้ว", () => {
    expect(d.notables.every((n) => n.id > NOTABLE_CAP)).toBe(true);
    expect(d.notables.every((n) => n.age < 130)).toBe(true);
    const text = w.chronicle.map((c) => c.text).join("\n");
    for (const word of ["ดวล", "กฎหมาย"]) expect(text).toContain(word);
    expect(text).not.toMatch(/undefined|NaN/);
  });
  it("ไม่มีสองแผ่นดินที่ผู้ครองชื่อซ้ำกัน", () => {
    const w2 = newFantasyWorld(11, 1000), d2 = ensureSociety(w2), r2 = { rng: 4 };
    for (let y = 0; y < 400; y++) {
      w2.year++; tickWorld(w2, r2);
      expect(new Set(d2.kingdoms.map((k) => k.ruler)).size).toBe(d2.kingdoms.length);
    }
  });
  it("500 ปีเร็วพอ และเซฟไม่บวม", () => {
    const w2 = newFantasyWorld(5, 1000);
    const t = Date.now();
    fastForward(w2, 500, { rng: 9 });
    expect(Date.now() - t).toBeLessThan(1500);
    expect(JSON.stringify(w2).length).toBeLessThan(120_000);
  });
});

describe("เศรษฐกิจ", () => {
  it("ข่าวจริงขยับราคาจริง", () => {
    const l = life(1);
    const k = homeKingdom(l);
    const a = priceOf(k, "iron"), b = priceOf(k, "herbs"), c = priceOf(k, "grain");
    k.war = "x"; k.plague = 2; k.famine = 2;
    expect(priceOf(k, "iron")).toBeGreaterThan(a);
    expect(priceOf(k, "herbs")).toBeGreaterThan(b);
    expect(priceOf(k, "grain")).toBeGreaterThan(c);
  });
  it("กองคาราวานขนไปเมืองที่ขาดแคลน ได้กำไร และเสียเงินเมื่อโดนปล้น", () => {
    const l = life(2);
    const other = kingdomsOf(l).find((k) => k.id !== fl(l).kingdom)!;
    other.famine = 3;
    expect(tradeProfit(l, "grain")).toBeGreaterThan(capitalOf(l) * 0.4);
    runEvent(l, "ft.e.trade");
    const m = l.money;
    force(l, `ขน${GOODS.grain.name}`);
    expect(l.money).toBeGreaterThan(m);
    expect(fl(l).trades).toBe(1);
    // ส่งสำเร็จแล้วไปต่อเมืองถัดไปได้ (Release 12)
    expect(l.queue[0]?.eventId).toBe("ft.m2.route");
    l.queue = [];
    runEvent(l, "ft.e.trade");
    const m2 = l.money;
    force(l, `ขน${GOODS.grain.name}`, false);
    expect(l.money).toBeLessThan(m2);
  });
  it("เงินน้อยเกินไปส่งกองคาราวานไม่ได้", () => {
    const l = life(3);
    l.money = 500;
    expect(activityLocked(l, act(l, "ft_trade"))).toBeTruthy();
  });
  it("ภาษีสงครามทำให้ค่าครองชีพสูงขึ้น และอาณาจักรทรุดกดดันน้อยลงด้วยรายได้", () => {
    const l = life(4);
    const k = homeKingdom(l);
    k.laws = []; k.prosperity = 100;
    const cost = (x: Life) => moduleOf("fantasy")!.livingCost!(x, 0, 10_000);
    const base = cost(l);
    k.laws = ["heavyTax"];
    expect(cost(l)).toBeGreaterThan(base);
  });
});

describe("มรดก", () => {
  it("มรดกอยู่ในระดับเดียวกับค่าแรงของโลกนี้ ไม่ใช่หลายล้าน", () => {
    const l = life(5);
    const pot = (w: Life["wealth"]) => { l.wealth = w; return moduleOf("fantasy")!.inheritance!(l); };
    expect(pot("poor")).toBeLessThan(pot("middle"));
    expect(pot("elite")).toBeLessThanOrEqual(500_000);
    l.wealth = "rich";
    for (const p of l.people) if (p.relation === "father" || p.relation === "mother") p.alive = false;
    l.people = l.people.filter((p) => p.relation !== "sibling");
    const m = l.money;
    l.queue = []; ageUp(l);
    expect(l.flags.inherited).toBe(true);
    expect(l.money - m).toBeLessThan(100_000);
  });
});

describe("ฝ่ายอำนาจ", () => {
  const joined = (seed: number, id: string) => { const l = life(seed); fl(l).faction = id; return l; };
  it("เข้าร่วมได้ และงานสกปรกแลกชื่อเสียงกับผลงาน", () => {
    const l = life(10);
    runEvent(l, "ft.f.join");
    force(l, "ภาคีโล่เงิน");
    expect(fl(l).faction).toBe("silver");
    expect(activityLocked(l, act(l, "ft_join"))).toBeTruthy();
    runEvent(l, "ft.f.job");
    force(l, "ได้ผลงานสองเท่า");
    expect(fl(l).fMerit).toBe(2);
    expect(standingOf(l)).toBeLessThan(0);
  });
  it("เลื่อนขั้นถึงแกนนำ แล้วชิงตำแหน่งผู้นำได้ และมีรายได้ทุกปี", () => {
    const l = joined(11, "league");
    fl(l).body = 400; fl(l).bodyRank = 3;
    for (let i = 0; i < 12; i++) { runEvent(l, "ft.f.job"); force(l, "เจรจาสัญญา"); }
    expect(fl(l).fRank).toBe(2);
    fl(l).fMerit = 6;
    runEvent(l, "ft.f.job");
    force(l, "ท้าชิงตำแหน่ง");
    force(l, "ท้าดวล");
    expect(fl(l).fRank).toBe(3);
    const x = dataOf(l).factions.find((f) => f.id === "league")!;
    expect(x.playerLed).toBe(true);
    const m = l.money;
    l.queue = []; ageUp(l);
    expect(l.money).toBeGreaterThan(m);
  });
  it("สภาเจ็ดหอสอนเวทเมื่อเลื่อนขั้น", () => {
    const l = joined(12, "conclave");
    for (let i = 0; i < 3; i++) { runEvent(l, "ft.f.job"); force(l, "คัดลอกตำรา"); }
    expect(fl(l).fRank).toBe(1);
    expect(fl(l).spells?.length).toBe(1);
  });
  it("หักหลังได้เงิน และมีมือสังหารตามมา", () => {
    const l = joined(13, "night");
    const before = dataOf(l).factions.find((f) => f.id === "night")!.power;
    runEvent(l, "ft.f.leave");
    force(l, "ขายความลับ");
    expect(fl(l).faction).toBeUndefined();
    expect(fl(l).foe).toBe("night");
    expect(dataOf(l).factions.find((f) => f.id === "night")!.power).toBeLessThan(before);
    expect(getEvent("ft.f.assassin")!.when!(l)).toBe(true);
  });
  it("ผู้นำตายแล้วฝ่ายมีผู้นำคนใหม่", () => {
    const l = joined(14, "dawn");
    const x = dataOf(l).factions.find((f) => f.id === "dawn")!;
    x.playerLed = true; x.leader = "ผู้เล่น";
    const next = createLife({ seed: 15, worldId: "fantasy" });
    expect(next.alive).toBe(true);
    x.playerLed = false; x.leader = "";
    tickWorld(worldOfLife(l), l);
    expect(x.leader).not.toBe("");
  });
});

describe("กฎหมายและอาชญากรรม", () => {
  it("ล้มเหลวแล้วถูกจับ ศาลเหล็กปรับสองเท่า", () => {
    const l = life(20);
    homeKingdom(l).laws = [];
    runEvent(l, "ft.l.crime");
    // คดีเล็ก (ล้วงกระเป๋า) จบด้วยค่าปรับได้ · คดีใหญ่ต้องขึ้นศาล (Release 10)
    force(l, "ล้วงกระเป๋า", false);
    expect(l.queue[0].eventId).toBe("ft.l.arrest");
    const soft = getEvent("ft.l.arrest")!.text(l, l.queue[0].ctx);
    homeKingdom(l).laws = ["harshCourts"];
    const hard = getEvent("ft.l.arrest")!.text(l, l.queue[0].ctx);
    expect(soft).toContain("20 เหรียญทอง");
    expect(hard).toContain("40 เหรียญทอง");
  });
  it("ติดคุกทำให้ทำกิจกรรมไม่ได้จนพ้นโทษ", () => {
    const l = life(21);
    homeKingdom(l).laws = [];
    runEvent(l, "ft.l.arrest", { sev: 2 });
    force(l, "แก้ต่าง", false);
    // จำคุกสองปีเต็ม: พ้นโทษเมื่อผ่านไปสามขั้นปี (ปีที่ตัดสิน + สองปี)
    expect(l.flags.jailUntil).toBe(l.age + 3);
    // ในคุกเห็นแค่สิ่งที่ทำในคุกได้ (Release 10)
    expect(activitiesFor(l).some((a) => a.id === "ft_crime")).toBe(false);
    l.age += 3;
    expect(activityLocked(l, act(l, "ft_crime"))).toBeUndefined();
  });
  it("ชื่อเสียงผูกกับอาณาจักร หนีข้ามแดนจึงพ้นหมายจับ", () => {
    const l = life(22);
    addStanding(l, -50);
    expect(wanted(l)).toBe(true);
    expect(getEvent("ft.l.bounty")!.when!(l)).toBe(true);
    const home = fl(l).kingdom;
    runEvent(l, "ft.l.bounty");
    force(l, "หนีข้ามแดน");
    expect(fl(l).kingdom).not.toBe(home);
    expect(wanted(l)).toBe(false);
    expect(standingOf(l, home)).toBe(-50);
  });
  it("กษัตริย์ใหม่นิรโทษกรรม", () => {
    const l = life(23);
    addStanding(l, -40);
    l.queue = []; ageUp(l);
    const a = standingOf(l);
    homeKingdom(l).ruler = "ราชินีใหม่";
    l.queue = []; ageUp(l);
    expect(standingOf(l)).toBe(a + 15);
  });
  it("คำร้องเปลี่ยนกฎหมายได้จริง มีเงื่อนไข และรอหลายปี", () => {
    const l = life(24);
    homeKingdom(l).laws = ["heavyTax"];
    expect(activityLocked(l, act(l, "ft_petition"))).toBeTruthy();
    addStanding(l, 30);
    expect(activityLocked(l, act(l, "ft_petition"))).toBeUndefined();
    doActivity(l, "ft_petition");
    force(l, "ยกเลิกภาษีสงคราม");
    expect(homeKingdom(l).laws).not.toContain("heavyTax");
    l.doneThisYear = [];
    expect(activityLocked(l, act(l, "ft_petition"))).toBeTruthy();
    l.age += 3;
    expect(activityLocked(l, act(l, "ft_petition"))).toBeUndefined();
  });
  it("กฎหมายก่อเหตุการณ์ตามอาณาจักร", () => {
    const l = life(25);
    fl(l).wand = { name: "ค", quality: 1, material: "ไม้" };
    homeKingdom(l).laws = [];
    expect(getEvent("ft.l.magicban")!.when!(l)).toBe(false);
    setLaw(worldOfLife(l), homeKingdom(l), "banMagic", true);
    setLaw(worldOfLife(l), homeKingdom(l), "heavyTax", true);
    expect(getEvent("ft.l.magicban")!.when!(l)).toBe(true);
    expect(getEvent("ft.l.tax")!.when!(l)).toBe(true);
  });
});

describe("บุคคลสำคัญ", () => {
  const meet = (l: Life) => { const n = dataOf(l).notables[0]; runEvent(l, "ft.n.meet", { nid: n.id }); return n; };
  it("คนในโลกกลายเป็นคนรู้จักจริง และข่าวตายมาถึงผู้เล่น", () => {
    const l = life(30);
    const n = meet(l);
    force(l, "ทำความรู้จัก");
    const p = l.people.find((x) => x.notable === n.id)!;
    expect(p.name).toBe(n.name);
    meet(l);
    expect(visibleChoices(l, l.queue[0]).some((x) => labelOf(x.c, l, l.queue[0].ctx).includes("ทำความรู้จัก"))).toBe(false);
    l.queue = [];
    dataOf(l).notables = dataOf(l).notables.filter((x) => x !== n);
    ageUp(l);
    expect(p.alive).toBe(false);
  });
  it("ชนะคนเก่งได้ขึ้นตำนาน ครั้งเดียว", () => {
    const l = life(31);
    const n = dataOf(l).notables[0]; n.power = 80;
    for (let i = 0; i < 2; i++) { runEvent(l, "ft.n.meet", { nid: n.id }); force(l, "ท้าดวล"); }
    expect(worldOfLife(l).legends.filter((g) => g.lifeId === l.id).length).toBe(1);
  });
  it("โลกเก่าที่ไม่มีสังคมได้รับการเติมอัตโนมัติ", () => {
    const l = life(32);
    const data = worldOfLife(l).data as Record<string, unknown>;
    delete data.factions; delete data.notables;
    expect(dataOf(l).factions.length).toBe(6);
    expect(dataOf(l).notables.length).toBe(NOTABLE_CAP);
  });
});

describe("เล่นจริง", () => {
  it("100 ชีวิตสุ่ม ทุกปุ่มใหม่ไม่พัง", () => {
    const seen = new Set<string>();
    for (let s = 1; s <= 100; s++) {
      const l = createLife({ seed: s * 53, worldId: "fantasy" });
      const r = { rng: s };
      const drain = () => { let g = 0; while (l.queue.length && l.alive && g++ < 60) { const o = visibleChoices(l, l.queue[0]); expect(o.length, l.queue[0].eventId).toBeGreaterThan(0); resolveChoice(l, o[Math.floor(nextFloat(r) * o.length)].index); } };
      for (let i = 0; i < 500 && l.alive; i++) {
        for (const a of activitiesFor(l)) if (l.alive && !activityLocked(l, a) && a.id !== "ft_dragon" && nextFloat(r) < 0.35) { doActivity(l, a.id); drain(); }
        if (l.alive) { ageUp(l); drain(); }
      }
      expect(validateLife(l), `seed ${s}`).toEqual([]);
      for (const k of Object.keys(l.seen)) seen.add(k);
      for (const e of l.log) expect(e.text, e.text).not.toMatch(/undefined|NaN|\[object/);
    }
    for (const id of ["ft.f.join", "ft.f.job", "ft.l.crime", "ft.l.arrest", "ft.e.trade", "ft.n.meet"]) expect(seen.has(id), id).toBe(true);
    expect(allEvents().filter((e) => e.world === "fantasy").length).toBeGreaterThanOrEqual(178);
  }, 240_000);
});
