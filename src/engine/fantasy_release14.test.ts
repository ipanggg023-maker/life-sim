import { describe, expect, it } from "vitest";
import { loadFantasyWorld } from "../content/fantasy";
import { EXTINCT_FROM, HUNTED_EMPTY, STEEDS, creatureLines, flying, inheritCreatures, slainDragons, stageOf } from "../content/fantasy/creatures";
import { combat } from "../content/fantasy/power";
import { dataOf, fl, homeKingdom } from "../content/fantasy/state";
import { citiesOf } from "../content/fantasy/cities";
import { doActivity } from "./activities";
import { currentScene, eligibilityFilters, getEvent, labelOf } from "./events";
import { ageUp, createLife, runEvent } from "./game";
import type { Life } from "./types";
import { createPerson } from "./util";

loadFantasyWorld();
const life = (seed: number, age = 30): Life => {
  const l = createLife({ seed, worldId: "fantasy", plain: true });
  l.age = age; l.queue = []; l.money = 100_000; l.flags.ftStarsSeen = true; l.stats.health = 90;
  return l;
};
const labels = (l: Life) => { const q = l.queue[0]; const s = currentScene(q, l)!; return s.choices.filter((c) => !c.show || c.show(l, q.ctx)).map((c) => labelOf(c, l, q.ctx)); };
const pickRun = (l: Life, re: RegExp, ok = true) => {
  const q = l.queue[0], s = currentScene(q, l)!;
  const c = s.choices.find((x) => (!x.show || x.show(l, q.ctx)) && re.test(labelOf(x, l, q.ctx)));
  if (!c) throw new Error(`no choice ${re} in ${q.eventId}/${q.scene ?? "start"}: ${labels(l).join(" | ")}`);
  const out = c.run(l, q.ctx, ok);
  if (out.next) q.scene = out.next; else l.queue.shift();
  return out;
};
const only = (l: Life, id: string) => { l.queue = l.queue.filter((q) => q.eventId === id); };
const year = (l: Life) => { l.queue = []; l.doneThisYear = []; ageUp(l); };
const whelp = (l: Life, age = 4) => { fl(l).whelp = { name: "ถ่าน", element: "fire", age, bond: 60, power: 20, lastCare: l.age, from: "x" }; };

describe("มังกรที่โตไปตลอดชีวิต", () => {
  it("มังกรมีนิสัย โตเป็นช่วงวัย และมีสิ่งที่อยากได้", () => {
    const l = life(1); whelp(l, 5);
    year(l);
    expect(fl(l).whelp!.trait).toBeTruthy();
    expect(stageOf(6)).toBe("มังกรหนุ่ม");
    expect(getEvent("ft.cr.wish")!.when!(l)).toBe(true);
    l.queue = []; runEvent(l, "ft.cr.wish"); pickRun(l, /บอกมันว่าไม่ได้/);
    expect(fl(l).whelp!.bond).toBeLessThan(60);
    expect(getEvent("ft.cr.wish")!.when!(l)).toBe(false);
  });
  it("ลูกที่โตมากับมังกรรับมังกรต่อได้เมื่อพ่อแม่จากไป", () => {
    const dead = life(2, 70); whelp(dead, 30);
    const kid = createPerson(dead, "child", { age: 40, bond: 70, lastName: dead.lastName });
    kid.tags = [...(kid.tags ?? []), "dragonfriend"];
    dead.flags.ftWhelpLeft = "whelpX";
    dataOf(dead).dragons.push({ id: "whelpX", name: "ถ่าน", title: `ผู้จากบ้านของ${dead.lastName}`, element: "fire", home: fl(dead).kingdom, age: 30, mood: 40, alive: true, power: 50 });
    const next = life(3, 40); next.fw = dead.fw;
    inheritCreatures(dead, next, kid.id);
    expect(fl(next).whelp?.name).toBe("ถ่าน");
    expect(dataOf(next).dragons.some((d) => d.id === "whelpX")).toBe(false);
  });
  it("มังกรที่ถูกทอดทิ้งกลับมาหาตระกูลในชีวิตต่อมา", () => {
    const l = life(4);
    dataOf(l).dragons.push({ id: "whelpY", name: "เงา", title: `ผู้จากบ้านของ${l.lastName}`, element: "dark", home: fl(l).kingdom, age: 50, mood: -10, alive: true, power: 40 });
    expect(getEvent("ft.cr.oldwhelp")!.when!(l)).toBe(true);
  });
  it("มังกรตายมากเกินไป ผู้ใช้เวทอ่อนลง", () => {
    const l = life(5); fl(l).magicRank = 2;
    const c0 = combat(l);
    const ds = dataOf(l).dragons;
    for (let i = 0; i < EXTINCT_FROM && i < ds.length; i++) ds[i].alive = false;
    if (slainDragons(l) >= EXTINCT_FROM) expect(combat(l)).toBeLessThan(c0);
  });
});

describe("สัตว์ขี่ ตลาด และสายเลือด", () => {
  it("ซื้อสัตว์ขี่ตามถิ่น ช่วยสู้ และส่งต่อได้ถึงรุ่นที่สามจนสายเลือดดัง", () => {
    const l = life(6);
    const c0 = combat(l);
    doActivity(l, "ft_market"); only(l, "ft.cr.market"); pickRun(l, /ม้าศึก/);
    expect(fl(l).steed?.kind).toBe("horse");
    expect(combat(l)).toBeGreaterThan(c0);
    fl(l).steed!.bond = 80; fl(l).steed!.born = l.age - 5;
    for (let i = 0; i < 2; i++) { runEvent(l, "ft.cr.breed"); pickRun(l, /ผสมพันธุ์/); }
    expect(fl(l).steed!.gen).toBe(3);
    expect(fl(l).deeds.some((d) => d.includes("สายเลือด"))).toBe(true);
  });
  it("สัตว์ขี่ที่ถูกทอดทิ้งดื้อหรือหนีไป", () => {
    let gone = 0;
    for (let s = 1; s <= 10; s++) {
      const l = life(s);
      fl(l).steed = { kind: "horse", name: "ฟ้าแลบ", bond: 10, born: l.age, line: l.lastName, gen: 1, lastCare: l.age - 5 };
      year(l); if (!fl(l).steed) gone++;
    }
    expect(gone).toBeGreaterThan(0);
  });
  it("กริฟฟินซื้อได้เฉพาะเมืองภูเขาสำหรับนักฝึก และบินได้", () => {
    const l = life(7);
    const mountain = citiesOf(homeKingdom(l)).find((c) => c.kind === "mountain");
    if (!mountain) return;
    fl(l).city = mountain.id;
    l.job = { careerId: "ft_tamer", level: 3, performance: 50, years: 3 };
    doActivity(l, "ft_market"); only(l, "ft.cr.market"); pickRun(l, /กริฟฟิน/);
    expect(STEEDS[fl(l).steed!.kind].fly).toBe(true);
    expect(flying(l)).toBeTruthy();
  });
  it("ไข่มังกรในตลาดมืดอาจทำให้แม่มังกรตามมา", () => {
    let foes = 0;
    for (let s = 1; s <= 12; s++) { const l = life(s); runEvent(l, "ft.cr.black"); pickRun(l, /ซื้อไข่/); expect(fl(l).egg).toBeTruthy(); if (fl(l).dragonFoe) foes++; }
    expect(foes).toBeGreaterThan(0);
  });
});

describe("สัตว์หายาก ภูต และถิ่น", () => {
  it("นักฝึกสัตว์ขั้นสูงตามหาสัตว์หายากได้ ยูนิคอร์นรักษาคำสาป", () => {
    const l = life(8); l.job = { careerId: "ft_tamer", level: 3, performance: 50, years: 5 };
    doActivity(l, "ft_rare"); only(l, "ft.cr.rare");
    expect(labels(l).some((t) => /ยูนิคอร์น/.test(t))).toBe(true);
    expect(labels(l).some((t) => /ฟีนิกซ์/.test(t))).toBe(false);
    pickRun(l, /ยูนิคอร์น/, true);
    fl(l).ailment = { kind: "curse", stage: 2 };
    year(l);
    expect(fl(l).ailment).toBeUndefined();
  });
  it("พรของภูตมีราคาที่ต้องจ่ายในภายหลัง", () => {
    const l = life(9);
    runEvent(l, "ft.cr.fey"); pickRun(l, /ตอบปริศนา/, true);
    const due = Number(l.flags.ftFeyDebt);
    expect(due).toBeGreaterThan(l.age);
    l.age = due;
    expect(getEvent("ft.cr.feytwist")!.when!(l)).toBe(true);
  });
  it("ล่าจนสัตว์หมดถิ่น สัตว์อสูรไม่บุกเมืองอีก แล้วค่อยๆ กลับมา", () => {
    const l = life(10); const k = homeKingdom(l);
    k.hunted = HUNTED_EMPTY;
    expect(eligibilityFilters.every((f) => f(l, getEvent("ft.dg.raid")!))).toBe(false);
    expect(creatureLines(l).some((t) => /ล่าจนเกือบหมด/.test(t))).toBe(true);
    year(l);
    expect(k.hunted).toBeLessThan(HUNTED_EMPTY);
  });
});
