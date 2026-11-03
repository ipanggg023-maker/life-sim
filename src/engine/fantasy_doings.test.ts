import { describe, expect, it } from "vitest";
import { loadFantasyWorld } from "../content/fantasy";
import { MOMENTS, MOMENT_EVENTS } from "../content/fantasy/moments";
import { TIERS, masteryTier } from "../content/fantasy/doings";
import { personaOf } from "../content/fantasy/persona";
import { activityNotes, ACTIVITIES, doActivity } from "./activities";
import { getEvent } from "./events";
import { ageUp, createLife } from "./game";
import type { Life } from "./types";

loadFantasyWorld();
const life = (seed: number, age = 25): Life => {
  const l = createLife({ seed, worldId: "fantasy" });
  l.age = age; l.queue = []; l.money = 1_000_000; l.stats.health = 90; l.flags.ftStarsSeen = true;
  l.ft!.wand = { name: "คทา", quality: 2, material: "ไม้" };
  return l;
};
const fresh = (l: Life) => { l.doneThisYear = []; l.queue = []; };

describe("แท็บทำ", () => {
  it("ผลของกิจกรรมเปลี่ยนตามดาวและนิสัย", () => {
    const l = life(3);
    l.ft!.bstars = 10;
    const texts = new Set<string>();
    for (let i = 0; i < 40; i++) { fresh(l); const o = doActivity(l, "ft_train"); texts.add(o?.text ?? ""); }
    expect([...texts].some((t) => t.includes("หักเป็นท่อน"))).toBe(true);
    expect(texts.size).toBeGreaterThan(3);
  });
  it("ทำซ้ำจนชำนาญได้รางวัลและป้ายขั้น", () => {
    const l = life(4);
    l.flags.act_ft_rest = TIERS[0] - 1;
    fresh(l); doActivity(l, "ft_rest");
    expect(masteryTier(l, "ft_rest")).toBe(1);
    expect(l.log.some((x) => x.text.includes("เริ่มคล่อง"))).toBe(true);
    const rest = ACTIVITIES.find((a) => a.id === "ft_rest")!;
    expect(activityNotes.map((f) => f(l, rest)).join("")).toContain("ทำมาแล้ว");
  });
  it("ทำผิดกฎหมายบ่อยๆ จนติดเป็นนิสัยเจ้าเล่ห์", () => {
    const l = life(5);
    for (let i = 0; i < 20; i++) { fresh(l); doActivity(l, "ft_crime"); }
    expect(personaOf(l).h).toBeLessThan(0);
  });
  it("ทิ้งการฝึกนานเกินสี่ปี ฝีมือที่สะสมไว้หายไปบ้าง", () => {
    const l = life(6, 30);
    l.ft!.bodyRank = 2; l.ft!.body = 300; l.flags.ftBodyAt = 25;
    ageUp(l);
    expect(l.ft!.body).toBeLessThan(300);
    expect(l.ft!.bodyRank).toBe(2);
  });
  it("เรื่องต่อเนื่องทุกเรื่องลงทะเบียนแล้วและเขียนข้อความได้", () => {
    const l = life(7, 30);
    l.ft!.pet = { kind: "cat", name: "หมอก", bond: 50, born: 20 };
    for (const e of MOMENT_EVENTS) {
      expect(getEvent(e.id), e.id).toBeTruthy();
      const t = e.text(l, e.prepare && (!e.when || e.when(l)) ? e.prepare(l) : {});
      expect(t, e.id).not.toMatch(/undefined|NaN/);
    }
    expect(Object.keys(MOMENTS).length).toBeGreaterThanOrEqual(15);
  });
  it("บางครั้งกิจกรรมพาเรื่องต่อเนื่องมาให้เลือก และไม่เกินปีละครั้ง", () => {
    const l = life(8, 25);
    let got = 0;
    for (let y = 0; y < 60; y++) {
      fresh(l);
      doActivity(l, "ft_tavern"); doActivity(l, "ft_rest");
      const n = l.queue.filter((q) => q.eventId.startsWith("ft.mo.")).length;
      expect(n).toBeLessThanOrEqual(1);
      got += n;
      for (const k of Object.keys(l.seen)) if (k.startsWith("ft.mo.")) l.seen[k] = 0;
    }
    expect(got).toBeGreaterThan(3);
  });
});
