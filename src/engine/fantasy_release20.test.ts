import { describe, expect, it } from "vitest";
import { loadFantasyWorld } from "../content/fantasy";
import { HUNTS } from "../content/fantasy/hunts_data";
import { canStart, giveUp, huntOf, huntRelics, startHunt } from "../content/fantasy/hunts";
import { fl, relicOf } from "../content/fantasy/state";
import { currentScene, labelOf, visibleChoices } from "./events";
import { ageUp, createLife } from "./game";
import type { Life } from "./types";

loadFantasyWorld();
const life = (seed: number, age = 30): Life => {
  const l = createLife({ seed, worldId: "fantasy", plain: true });
  l.age = age; l.queue = []; l.money = 0; l.flags.ftStarsSeen = true; l.stats.health = 90;
  return l;
};
/** ปีถัดไป แล้วเก็บแค่บทของการตามล่า */
const year = (l: Life) => { l.queue = []; l.doneThisYear = []; ageUp(l); l.queue = l.queue.filter((q) => q.eventId.startsWith("ft.hu.")); };
/** เล่นบทที่อยู่หน้าคิวด้วยทางเลือกที่ index (ok = ผ่านหรือไม่) */
const play = (l: Life, index: number, ok = true) => {
  const q = l.queue[0]; const s = currentScene(q, l)!;
  const out = s.choices[index].run(l, q.ctx, ok);
  if (out.next) q.scene = out.next; else l.queue.shift();
  return out;
};
/** วนปีจนบทของการตามล่ามาถึง */
const nextChapter = (l: Life) => { for (let i = 0; i < 6 && !l.queue.length; i++) year(l); return l.queue[0]?.eventId; };

describe("ข้อมูลตำนาน", () => {
  it("อาวุธทั้ง 16 ชิ้นมีเรื่องสี่บท และเจ้าของในอดีตอยู่ในปี 1-999", () => {
    const l = life(1);
    const ids = huntRelics(l).map((r) => r.id);
    expect(ids.length).toBe(16);
    for (const id of ids) {
      const h = HUNTS[id];
      expect(h, id).toBeTruthy();
      expect(h.ch).toHaveLength(4);
      expect(h.holders.length).toBeGreaterThanOrEqual(3);
      for (const [y] of h.holders) { expect(y).toBeGreaterThanOrEqual(1); expect(y).toBeLessThanOrEqual(999); }
    }
  });
});

describe("ตามล่าอาวุธตำนาน", () => {
  it("เริ่มได้ตั้งแต่อายุ 16 ทีละเล่ม และมีคู่แข่ง", () => {
    expect(canStart(life(2, 12), "crescent")).toMatch(/16/);
    const l = life(3);
    startHunt(l, "crescent");
    expect(huntOf(l)?.id).toBe("crescent");
    expect(huntOf(l)?.rival).toBeTruthy();
    expect(canStart(l, "cleaver")).toMatch(/เล่มอื่น/);
  });
  it("ผ่านสี่บทแล้วได้อาวุธมาครอง และทุกบทมีทางเลือกอย่างน้อยสามทาง", () => {
    const l = life(4);
    startHunt(l, "crescent");
    for (let ch = 0; ch < 4; ch++) {
      expect(nextChapter(l)).toBe("ft.hu.ch");
      expect(visibleChoices(l, l.queue[0]).length).toBeGreaterThanOrEqual(3);
      play(l, 1, true);
    }
    expect(relicOf(l, "crescent")!.holder).toBe("player");
    expect(fl(l).relic).toBe("crescent");
    expect(huntOf(l)).toBeUndefined();
    expect(fl(l).deeds.some((d) => d.includes("ธนูจันทร์เสี้ยว"))).toBe(true);
  });
  it("พลาดบทที่สาม คู่แข่งคว้าไปก่อน แล้วชิงคืนได้ด้วยการดวล", () => {
    const l = life(5);
    startHunt(l, "cleaver");
    for (let ch = 0; ch < 2; ch++) { nextChapter(l); play(l, 0, true); }
    nextChapter(l); relicOf(l, "cleaver")!.holder = "lost";
    const rival = huntOf(l)!.rival!;
    play(l, 0, false);
    expect(relicOf(l, "cleaver")!.holder).toBe(rival);
    expect(nextChapter(l)).toBe("ft.hu.holder");
    play(l, 0, true);
    expect(relicOf(l, "cleaver")!.holder).toBe("player");
  });
  it("ขโมยมาแล้วเจ้าของเดิมจะตามทวง และคืนให้ได้", () => {
    const l = life(6);
    startHunt(l, "twilight");
    for (let ch = 0; ch < 2; ch++) { nextChapter(l); play(l, 2, true); }
    nextChapter(l); play(l, 0, false);
    const owner = relicOf(l, "twilight")!.holder;
    nextChapter(l); play(l, 1, true);
    expect(fl(l).huntStolen?.from).toBe(owner);
    for (let i = 0; i < 20 && !l.queue.length; i++) year(l);
    expect(l.queue[0]?.eventId).toBe("ft.hu.hunted");
    const q = l.queue[0]; const s = currentScene(q, l)!;
    const back = s.choices.findIndex((c) => /คืนให้/.test(labelOf(c, l, q.ctx)));
    play(l, back, true);
    expect(relicOf(l, "twilight")!.holder).not.toBe("player");
    expect(fl(l).huntStolen).toBeUndefined();
  });
  it("รอให้เจ้าของตายไปเอง แล้วบทสุดท้ายกลับมาเมื่ออาวุธหายสาบสูญอีกครั้ง", () => {
    const l = life(7);
    startHunt(l, "bulwark");
    for (let ch = 0; ch < 2; ch++) { nextChapter(l); play(l, 0, true); }
    nextChapter(l); play(l, 0, false);
    nextChapter(l);
    const q = l.queue[0]; const s = currentScene(q, l)!;
    play(l, s.choices.findIndex((c) => /รอให้/.test(labelOf(c, l, q.ctx))), true);
    expect(huntOf(l)?.wait).toBe(true);
    year(l); expect(l.queue.length).toBe(0);
    relicOf(l, "bulwark")!.holder = "lost";
    expect(nextChapter(l)).toBe("ft.hu.ch");
  });
  it("เอ็กซ์คาลิเบอร์ยอมเฉพาะคนที่คู่ควร", () => {
    const l = life(8);
    startHunt(l, "excalibur");
    for (let ch = 0; ch < 3; ch++) { nextChapter(l); play(l, 1, true); }
    nextChapter(l); play(l, 1, true);
    expect(relicOf(l, "excalibur")!.holder).not.toBe("player");
    expect(huntOf(l)?.ch).toBe(3);
  });
  it("บททดสอบสุดท้ายฆ่าคนที่อ่อนแอได้", () => {
    const l = life(9);
    startHunt(l, "grief");
    for (let ch = 0; ch < 3; ch++) { nextChapter(l); play(l, 1, true); }
    nextChapter(l); l.stats.health = 10; fl(l).threads = 0; fl(l).mercyUsed = true; play(l, 0, false);
    expect(l.alive).toBe(false);
  });
  it("พลาดสามครั้งในบทเดียว ร่องรอยหายไปและการตามล่าจบลง", () => {
    const l = life(11);
    startHunt(l, "starforge");
    for (let i = 0; i < 3; i++) { nextChapter(l); play(l, 1, false); }
    expect(huntOf(l)).toBeUndefined();
    expect(canStart(l, "starforge")).toMatch(/เลิกตามล่า/);
  });
  it("เลิกตามล่าแล้วเล่มนั้นปิดไปทั้งชีวิต", () => {
    const l = life(10);
    startHunt(l, "chronos"); giveUp(l);
    expect(huntOf(l)).toBeUndefined();
    expect(canStart(l, "chronos")).toMatch(/เลิกตามล่า/);
    expect(canStart(l, "starforge")).toBeUndefined();
  });
});
