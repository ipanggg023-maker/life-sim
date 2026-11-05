import { describe, expect, it } from "vitest";
import { loadFantasyWorld } from "../content/fantasy";
import { setRace } from "../content/fantasy/life";
import { ELEMENTS, SPELLS, learnSpell, manaLeft, manaMax, spellById, spellOdds, spellPrice, spellsOf } from "../content/fantasy/magic";
import { combat } from "../content/fantasy/power";
import { classStanding, rivalOf } from "../content/fantasy/schoollife";
import { fl } from "../content/fantasy/state";
import { activitiesFor, activityLocked, doActivity } from "./activities";
import { allEvents, getEvent, labelOf, visibleChoices } from "./events";
import { ageUp, createLife, resolveChoice, runEvent } from "./game";
import { nextFloat } from "./rng";
import type { Life } from "./types";
import { validateLife } from "./validate";

loadFantasyWorld();

const life = (seed: number, age = 20): Life => {
  const l = createLife({ seed, worldId: "fantasy" });
  setRace(l, "human");
  l.age = age; l.queue = []; l.money = 500_000; l.stats.health = 90; l.stats.smarts = 70;
  fl(l).wand = { name: "คทา", quality: 1, material: "ไม้" };
  fl(l).element = "fire";
  return l;
};
const force = (l: Life, start: string, ok = true) => {
  const q = l.queue[0];
  const o = visibleChoices(l, q).find((x) => labelOf(x.c, l, q.ctx).startsWith(start));
  expect(o, `ไม่มี "${start}" ใน ${q.eventId}`).toBeTruthy();
  const out = o!.c.run(l, q.ctx, ok);
  l.queue.shift();
  return out;
};
const enroll = (seed: number) => {
  const l = life(seed, 12);
  runEvent(l, "ft.school_apply");
  force(l, "สำนักดาบ");
  return l;
};

describe("เวทมนตร์", () => {
  it("มีหกธาตุ ธาตุละเจ็ดบทครบสี่ขั้น และธาตุของตัวเองถูกกว่า", () => {
    expect(Object.keys(ELEMENTS).length).toBe(6);
    expect(SPELLS.length).toBe(42);
    const l = life(1);
    expect(spellPrice(l, spellById("fire1"))).toBeLessThan(spellPrice(l, spellById("water1")));
  });
  it("ใช้ธาตุถูกทางได้เปรียบ ผิดทางเสียเปรียบ ทำให้ไม่มีเวทเดียวเก่งสุด", () => {
    const l = life(2);
    const s = spellById("water1");
    const base = spellOdds(l, s, 20);
    expect(spellOdds(l, s, 20, "water")).toBeGreaterThan(base);
    expect(spellOdds(l, s, 20, undefined, "water")).toBeLessThan(base);
  });
  it("มานามีจำกัดต่อปี และคืนเมื่อขึ้นปีใหม่", () => {
    const l = life(3);
    learnSpell(l, "fire1"); learnSpell(l, "water1");
    expect(spellsOf(l).length).toBe(2);
    fl(l).manaUsed = manaMax(l);
    expect(manaLeft(l)).toBe(0);
    runEvent(l, "ft.contract", { mon: 0 });
    const labels = visibleChoices(l, l.queue[0]).map((x) => labelOf(x.c, l, l.queue[0].ctx));
    expect(labels.some((x) => x.startsWith("ร่าย"))).toBe(false);
    l.queue = [];
    ageUp(l);
    expect(fl(l).manaUsed).toBe(0);
  });
  it("ร่ายเวทในงานกิลด์ได้ ใช้มานาจริง และไม่มีเวทก็ยังสู้ได้", () => {
    const l = life(4);
    fl(l).guild = 1;
    learnSpell(l, "fire1");
    runEvent(l, "ft.contract", { mon: 1 });
    force(l, "ร่ายลูกไฟ");
    expect(fl(l).manaUsed).toBe(1);
    const n = life(5); fl(n).guild = 1; fl(n).wand = undefined;
    runEvent(n, "ft.contract", { mon: 1 });
    expect(visibleChoices(n, n.queue[0]).length).toBeGreaterThan(1);
  });
  it("ร้านตำราซื้อได้จริงและจำกัดตามระดับเวท", () => {
    const l = life(6);
    runEvent(l, "ft.spellshop");
    const before = l.money;
    resolveChoice(l, visibleChoices(l, l.queue[0])[0].index);
    expect(spellsOf(l).length).toBe(1);
    expect(spellsOf(l)[0].tier).toBe(1);
    expect(l.money).toBeLessThan(before);
  });
  it("อักษรรูนเพิ่มพลังต่อสู้ และศาสตร์เวทมีเพดานพร้อมรอหลายปี", () => {
    const l = life(7);
    fl(l).magicRank = 1;
    const c0 = combat(l);
    fl(l).rune = 3;
    expect(combat(l)).toBe(c0 + 9);
    const a = activitiesFor(l).find((x) => x.id === "ft_art")!;
    expect(activityLocked(l, a)).toBeUndefined();
    doActivity(l, a.id);
    l.queue = []; l.doneThisYear = [];
    expect(activityLocked(l, a)).toBeTruthy();
    l.age += 3;
    expect(activityLocked(l, a)).toBeUndefined();
  });
  it("พิธีวงเวทต้องเรียนก่อน", () => {
    const l = life(8);
    expect(activityLocked(l, activitiesFor(l).find((x) => x.id === "ft_circle")!)).toBeTruthy();
    fl(l).circle = 1;
    expect(activityLocked(l, activitiesFor(l).find((x) => x.id === "ft_circle")!)).toBeUndefined();
  });
});

describe("ชีวิตในโรงเรียน", () => {
  it("คู่ปรับเติบโตเองทุกปี", () => {
    const l = enroll(10);
    const a = fl(l).rivalPower!;
    expect(rivalOf(l)).toBeTruthy();
    l.age = 13; ageUp(l);
    expect(fl(l).rivalPower!).toBeGreaterThan(a);
  });
  it("คู่ปรับแต่ละคนมีเพดานของตัวเอง ไม่ได้เป็นตำนานทุกคน", () => {
    const peaks = new Set<number>();
    for (let s = 20; s < 40; s++) peaks.add(fl(enroll(s)).rivalPeak!);
    expect(peaks.size).toBeGreaterThan(5);
    const l = enroll(10);
    fl(l).rivalPeak = 30; fl(l).rivalPower = 30;
    l.age = 13; ageUp(l);
    expect(fl(l).rivalPower).toBe(30);
  });
  it("โรงเรียนเวทสอนเวทบทแรก และศิษย์เก่าตามความลับต่อได้", () => {
    const l = life(16, 12);
    runEvent(l, "ft.school_apply");
    force(l, "วิหารเยียวยา");
    expect(spellsOf(l).map((s) => s.id)).toEqual(["fire1"]);
    fl(l).graduated = true;
    expect(getEvent("ft.s.secret")!.when!(l)).toBe(true);
  });
  it("สอบปลายปีขึ้นทุกปีครั้งเดียว และคะแนนเปลี่ยนอันดับ", () => {
    const l = enroll(11);
    l.age = 13;
    const e = getEvent("ft.s.exam")!;
    expect(e.when!(l)).toBe(true);
    e.prepare!(l);
    expect(e.when!(l)).toBe(false);
    fl(l).classScore = 90;
    expect(classStanding(l)).toBe("ที่หนึ่งของรุ่น");
  });
  it("งานประลองไปถึงรอบชิงกับคู่ปรับ ชนะแล้วได้ถ้วย", () => {
    const l = enroll(12);
    runEvent(l, "ft.s.round", { round: 1 });
    force(l, "สู้เต็มที่");
    expect(l.queue[0].ctx.round).toBe(2);
    force(l, "สู้เต็มที่");
    expect(getEvent("ft.s.round")!.text(l, l.queue[0].ctx)).toContain("รอบชิง");
    force(l, "สู้เต็มที่");
    expect(fl(l).cups).toBe(1);
  });
  it("ความลับของโรงเรียนจบในสามตอน ทั้งห้าโรงเรียน", () => {
    for (const id of ["arcanvale", "steelcrest", "lionheart", "mercy", "beastwarden"]) {
      const l = enroll(13);
      fl(l).school = id;
      for (let i = 0; i < 3; i++) { runEvent(l, "ft.s.secret"); force(l, "สืบต่อ"); }
      expect(fl(l).secret).toBe(3);
      expect(fl(l).deeds).toContain("รู้ความลับของโรงเรียน");
      expect(getEvent("ft.s.secret")!.when!(l)).toBe(false);
    }
  });
  it("คนไม่ได้เรียนมีทางของตัวเอง", () => {
    const l = life(14, 16);
    for (const id of ["ft.o.master", "ft.o.library", "ft.o.mercs"]) expect(getEvent(id)!.when!(l)).toBe(true);
    runEvent(l, "ft.o.master");
    force(l, "ขอเดินทาง");
    expect(fl(l).deeds).toContain("ศิษย์ของอาจารย์พเนจร");
    expect(spellsOf(l).length).toBe(1);
    const s = enroll(15);
    expect(getEvent("ft.o.master")!.when!(s)).toBe(false);
  });
});

describe("เล่นจริง", () => {
  it("80 ชีวิตสุ่มไม่พังและเนื้อหาใหม่ได้ใช้จริง", () => {
    const seen = new Set<string>();
    for (let s = 1; s <= 80; s++) {
      const l = createLife({ seed: s * 41, worldId: "fantasy" });
      const r = { rng: s };
      for (let i = 0; i < 400 && l.alive; i++) {
        for (const a of activitiesFor(l)) if (!activityLocked(l, a) && a.id !== "ft_dragon" && nextFloat(r) < 0.35) doActivity(l, a.id);
        let g = 0;
        while (l.queue.length && l.alive && g++ < 50) { const o = visibleChoices(l, l.queue[0]); expect(o.length, l.queue[0].eventId).toBeGreaterThan(0); resolveChoice(l, o[Math.floor(nextFloat(r) * o.length)].index); }
        if (l.alive) ageUp(l);
        g = 0;
        while (l.queue.length && l.alive && g++ < 50) { const o = visibleChoices(l, l.queue[0]); resolveChoice(l, o[Math.floor(nextFloat(r) * o.length)].index); }
      }
      expect(validateLife(l)).toEqual([]);
      for (const k of Object.keys(l.seen)) seen.add(k);
      for (const e of l.log) expect(e.text, e.text).not.toMatch(/undefined|NaN|\[object/);
    }
    for (const id of ["ft.s.exam", "ft.s.cup", "ft.s.secret", "ft.o.master", "ft.spellshop"]) expect(seen.has(id), id).toBe(true);
    expect(allEvents().filter((e) => e.world === "fantasy").length).toBeGreaterThanOrEqual(162);
  }, 180_000);
});
