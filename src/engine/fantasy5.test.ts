import { describe, expect, it } from "vitest";
import { loadFantasyWorld } from "../content/fantasy";
import { closeLife, RACES, setRace } from "../content/fantasy/life";
import { MYSTERIES, mysteryState } from "../content/fantasy/mysteries";
import { combat } from "../content/fantasy/power";
import { addStanding, fl, standingOf, worldOfLife } from "../content/fantasy/state";
import { activitiesFor, activityLocked, doActivity } from "./activities";
import { allEvents, getEvent, labelOf, visibleChoices } from "./events";
import { ageUp, createLife, lifespanHooks, resolveChoice, runEvent } from "./game";
import { nextFloat } from "./rng";
import type { Life, Soul } from "./types";
import { validateLife } from "./validate";

loadFantasyWorld();

const life = (seed: number, race: keyof typeof RACES = "human", age = 25): Life => {
  const l = createLife({ seed, worldId: "fantasy" });
  setRace(l, race);
  l.age = age; l.queue = []; l.money = 500_000; l.stats.health = 90; l.stats.smarts = 70; l.stats.looks = 70; l.stats.luck = 70;
  return l;
};
const labels = (l: Life) => visibleChoices(l, l.queue[0]).map((x) => labelOf(x.c, l, l.queue[0].ctx));
const force = (l: Life, start: string, ok = true) => {
  const q = l.queue[0];
  const o = visibleChoices(l, q).find((x) => labelOf(x.c, l, q.ctx).includes(start));
  expect(o, `ไม่มี "${start}" ใน ${q.eventId}: ${labels(l).join(" / ")}`).toBeTruthy();
  const out = o!.c.run(l, q.ctx, ok);
  l.queue.shift();
  return out;
};

describe("เผ่าใหม่", () => {
  it("มีหกเผ่า และเกิดเป็นเผ่าใหม่ได้จริง", () => {
    expect(Object.keys(RACES).length).toBe(6);
    const seen = new Set<string>();
    for (let s = 1; s <= 300; s++) seen.add(fl(createLife({ seed: s, worldId: "fantasy" })).race);
    expect(seen.size).toBe(6);
  });
  it("ออร์กตีหนักกว่าแต่ถูกระแวงตั้งแต่เกิด จนสร้างชื่อเองได้", () => {
    const h = life(1), o = life(1, "orc");
    expect(combat(o)).toBe(combat(h) + 3);
    expect(standingOf(o)).toBe(-15);
    addStanding(o, 20);
    expect(standingOf(o)).toBe(5);
  });
  it("ฝึกกายของออร์กและฝึกเวทของเอลฟ์ได้มากกว่า", () => {
    const run = (r: keyof typeof RACES, id: string, key: "body" | "magic") => { let sum = 0; for (let s = 0; s < 40; s++) { const l = life(100 + s, r); fl(l).wand = { name: "ค", quality: 1, material: "ไม้" }; const b = fl(l)[key]; doActivity(l, id); sum += fl(l)[key] - b; } return sum; };
    expect(run("orc", "ft_train", "body")).toBeGreaterThan(run("human", "ft_train", "body"));
    expect(run("elf", "ft_study", "magic")).toBeGreaterThan(run("human", "ft_study", "magic"));
  });
  it("อักษรรูนของคนแคระแรงเป็นสองเท่า", () => {
    const h = life(2), d = life(2, "dwarf");
    const a = combat(h), b = combat(d);
    fl(h).rune = 2; fl(d).rune = 2;
    expect(combat(h) - a).toBe(6);
    expect(combat(d) - b).toBe(12);
  });
  it("ฮาล์ฟลิงอายุยืนกว่า ออร์กกับชนเผ่าสัตว์สั้นกว่า", () => {
    const y = (r: keyof typeof RACES) => lifespanHooks.reduce((s, h) => s + h(life(3, r)), 0);
    expect(y("halfling")).toBeGreaterThan(0);
    expect(y("orc")).toBeLessThan(0);
    expect(y("beastfolk")).toBeLessThan(0);
  });
  it("ทุกเผ่าใหม่มีเรื่องของตัวเอง และไม่โผล่ให้เผ่าอื่น", () => {
    for (const [r, id] of [["orc", "ft.r.orc_pit"], ["beastfolk", "ft.r.beast_moon"], ["halfling", "ft.r.half_feast"]] as const) {
      expect(getEvent(id)!.when!(life(4, r))).toBe(true);
      expect(getEvent(id)!.when!(life(4, "human"))).toBe(false);
    }
  });
  it("เปลี่ยนเผ่าตอนเกิดแล้วค่าพลังกลับมาครบ ไม่สะสม", () => {
    const l = life(5);
    const before = { ...l.stats };
    setRace(l, "orc"); setRace(l, "halfling"); setRace(l, "human");
    expect(l.stats).toEqual(before);
  });
});

describe("ปริศนา", () => {
  const solveStep = (l: Life, id: string, way: string) => { runEvent(l, "ft.m.step", { m: id }); force(l, way); };
  it("ได้รู้ปริศนาจากเหตุการณ์ แล้วสืบได้", () => {
    const l = life(10);
    expect(activityLocked(l, activitiesFor(l).find((a) => a.id === "ft_mystery")!)).toBeTruthy();
    runEvent(l, "ft.m.hook.sunken");
    force(l, "จดเรื่องนี้");
    expect(activityLocked(l, activitiesFor(l).find((a) => a.id === "ft_mystery")!)).toBeUndefined();
    doActivity(l, "ft_mystery");
    force(l, "นครที่จมหาย");
    expect(l.queue[0].eventId).toBe("ft.m.step");
    l.queue = []; l.doneThisYear = [];
    expect(activityLocked(l, activitiesFor(l).find((a) => a.id === "ft_mystery")!)).toBeTruthy();
    l.age += 2;
    expect(activityLocked(l, activitiesFor(l).find((a) => a.id === "ft_mystery")!)).toBeUndefined();
  });
  it("แต่ละขั้นมีหลายทาง บางทางเปิดตามเผ่า เวท หรืออาวุธที่ถือ", () => {
    const l = life(11);
    fl(l).mKnown = ["sunken"];
    mysteryState(l, "sunken").step = 1;
    runEvent(l, "ft.m.step", { m: "sunken" });
    expect(labels(l).some((x) => x.includes("เวทน้ำ"))).toBe(false);
    l.queue = [];
    fl(l).spells = ["water1"];
    runEvent(l, "ft.m.step", { m: "sunken" });
    expect(labels(l).some((x) => x.includes("เวทน้ำ"))).toBe(true);
  });
  it("ไขจนจบได้รางวัล ตำนาน และเปลี่ยนโลก", () => {
    const l = life(12);
    fl(l).mKnown = ["sunken"];
    const pot = fl(l).potential;
    for (const w of ["ค้นหอจดหมายเหตุ", "ดำน้ำ", "ถอดอักษร", "สลักรูน", "สู้กับผู้พิทักษ์"]) solveStep(l, "sunken", w);
    const s = mysteryState(l, "sunken");
    expect(s.solvedBy).toBeTruthy();
    expect(fl(l).potential).toBe(Math.min(5, pot + 1));
    expect(worldOfLife(l).legends.some((g) => g.deed === "ค้นพบนครออเรเลียนใต้ทะเล")).toBe(true);
    expect(activityLocked(l, activitiesFor(l).find((a) => a.id === "ft_mystery")!)).toBeTruthy();
  });
  it("ล้มเหลวไม่ทำให้ถอยหลัง และบางทางทำให้บาดเจ็บ", () => {
    const l = life(13);
    fl(l).mKnown = ["bell"];
    mysteryState(l, "bell").step = 1;
    const hp = l.stats.health;
    solveStep(l, "bell", "ขุดเอง");
    l.queue = [];
    runEvent(l, "ft.m.step", { m: "bell" });
    force(l, "ทำแผนที่", false);
    expect(mysteryState(l, "bell").step).toBe(2);
    expect(l.stats.health).toBeLessThan(hp);
  });
  it("ความคืบหน้าข้ามชีวิต: คนรุ่นหลังเจอบันทึกแล้วสืบต่อจากขั้นเดิม", () => {
    const a = life(14);
    fl(a).mKnown = ["undying"];
    runEvent(a, "ft.m.step", { m: "undying" }); force(a, "เทียบภาพ");
    runEvent(a, "ft.m.step", { m: "undying" }); force(a, "ซื้อข้อมูล");
    const soul = {} as Soul;
    closeLife(soul, a);
    const b = createLife({ seed: 15, worldId: "fantasy" });
    b.fw = structuredClone(soul.fantasyWorld!); b.age = 20;
    expect(mysteryState(b, "undying").step).toBe(2);
    expect(getEvent("ft.m.hook.undying")!.when!(b)).toBe(false);
    const j = getEvent("ft.m.journal")!;
    expect(j.when!(b)).toBe(true);
    const ctx = j.prepare!(b);
    expect(j.text(b, ctx)).toContain(a.firstName);
    runEvent(b, "ft.m.journal", ctx);
    force(b, "ซื้อไว้");
    expect(fl(b).mKnown).toContain("undying");
  });
  it("ทุกปริศนามีห้าขั้น ทุกขั้นมีอย่างน้อยหนึ่งทางที่ใครก็ลองได้", () => {
    for (const m of MYSTERIES) {
      expect(m.steps.length).toBe(5);
      for (const s of m.steps) expect(s.ways.some((w) => !w.show), `${m.id}: ${s.text}`).toBe(true);
    }
  });
});

describe("เล่นจริง", () => {
  it("120 ชีวิตสุ่มทุกเผ่า ไม่พัง", () => {
    const seen = new Set<string>();
    for (let s = 1; s <= 120; s++) {
      const l = createLife({ seed: s * 73, worldId: "fantasy" });
      setRace(l, (Object.keys(RACES) as (keyof typeof RACES)[])[s % 6]);
      const r = { rng: s };
      const drain = () => { let g = 0; while (l.queue.length && l.alive && g++ < 60) { const o = visibleChoices(l, l.queue[0]); expect(o.length, l.queue[0].eventId).toBeGreaterThan(0); resolveChoice(l, o[Math.floor(nextFloat(r) * o.length)].index); } };
      for (let i = 0; i < 500 && l.alive; i++) {
        for (const a of activitiesFor(l)) if (l.alive && !activityLocked(l, a) && nextFloat(r) < 0.3) { doActivity(l, a.id); drain(); }
        if (l.alive) { ageUp(l); drain(); }
      }
      expect(validateLife(l), `seed ${s}`).toEqual([]);
      for (const k of Object.keys(l.seen)) seen.add(k);
      for (const e of l.log) expect(e.text, e.text).not.toMatch(/undefined|NaN|\[object/);
    }
    for (const id of ["ft.r.orc_pit", "ft.r.beast_moon", "ft.r.half_feast", "ft.m.choose", "ft.m.step"]) expect(seen.has(id), id).toBe(true);
    expect(allEvents().filter((e) => e.world === "fantasy").length).toBeGreaterThanOrEqual(203);
  }, 300_000);
});
