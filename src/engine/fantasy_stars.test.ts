import { describe, expect, it } from "vitest";
import { loadFantasyWorld } from "../content/fantasy";
import { inheritLife } from "../content/fantasy/life";
import { BODY_RANKS, MAGIC_RANKS, MAX_RANK, bodyCap, combat, magicCap, starCap } from "../content/fantasy/power";
import { STAR_EVENTS, addStars, applyStarStart, dual, giveNpcStars, migrateStars, rollStars, seen, underdogWin } from "../content/fantasy/stars";
import { fl, worldOfLife } from "../content/fantasy/state";
import { epithetOf } from "../content/fantasy/styles";
import { getEvent, visibleChoices } from "./events";
import { ageUp, createLife, resolveChoice, runEvent } from "./game";
import { buildHeir } from "./soul";
import type { Life } from "./types";
import { createPerson } from "./util";

loadFantasyWorld();

const life = (seed: number, age = 20): Life => {
  const l = createLife({ seed, worldId: "fantasy" });
  l.age = age; l.queue = []; l.flags.ftStarsSeen = true;
  return l;
};

describe("ดาวพรสวรรค์", () => {
  it("ทอยเป็นพีระมิด: ไร้ดาวเยอะ สิบดาวหายากมาก เผ่าเอียงดาวได้", () => {
    const l = createLife({ seed: 5, worldId: "fantasy" });
    const n = 20000, count = Array(11).fill(0);
    let orc = 0, human = 0;
    for (let i = 0; i < n; i++) { const h = rollStars(l, "human"), o = rollStars(l, "orc"); count[h.b]++; human += h.b; orc += o.b; }
    expect(count[0] / n).toBeGreaterThan(0.24);
    expect(count[0] / n).toBeLessThan(0.36);
    expect(count.slice(7).reduce((a, b) => a + b, 0) / n).toBeLessThan(0.06);
    expect(count[10] / n).toBeLessThan(0.005);
    expect(orc / n).toBeGreaterThan(human / n + 0.5);
  });
  it("ทุกคนเกิดมามีดาวสองสาย 0–10 และยังไม่รู้จนอายุหกขวบ", () => {
    for (let s = 1; s <= 80; s++) {
      const f = fl(createLife({ seed: s * 13, worldId: "fantasy" }));
      expect(f.bstars).toBeGreaterThanOrEqual(0);
      expect(f.bstars).toBeLessThanOrEqual(10);
      expect(f.potential).toBeLessThanOrEqual(10);
    }
    const l = createLife({ seed: 9, worldId: "fantasy" });
    expect(seen(l)).toBe(false);
    for (let i = 0; i < 7 && l.alive; i++) { ageUp(l); while (l.queue.length) resolveChoice(l, visibleChoices(l, l.queue[0])[0].index); }
    expect(seen(l)).toBe(true);
  });
  it("ดาวกำหนดเพดาน · ขั้นตำนานต้องแปดและสิบดาว · ของช่วยดันได้ถึงปรมาจารย์เท่านั้น", () => {
    expect(BODY_RANKS.length).toBe(MAX_RANK + 1);
    expect(MAGIC_RANKS.length).toBe(MAX_RANK + 1);
    expect([0, 2, 4, 6, 7, 8, 9, 10].map((s) => starCap(s, "body"))).toEqual([1, 2, 3, 4, 4, 5, 5, 6]);
    expect(starCap(0, "magic")).toBe(0);
    const l = life(3);
    fl(l).potential = 0; fl(l).wand = { name: "คทา", quality: 1, material: "ไม้" };
    expect(magicCap(l)).toBe(2);
    fl(l).potential = 6; fl(l).relic = "embersoul";
    expect(magicCap(l)).toBe(4);
    fl(l).bstars = 0; fl(l).weapon = { name: "ดาบ", quality: 5 };
    expect(bodyCap(l)).toBe(3);
    fl(l).bstars = 10;
    expect(bodyCap(l)).toBe(6);
  });
  it("สิบดาวเริ่มต้นนำหน้าคนอื่น · ไร้ดาวเริ่มจากศูนย์", () => {
    const a = life(4, 0), b = life(5, 0);
    for (const x of [a, b]) { const f = fl(x); f.body = 0; f.bodyRank = 0; f.magic = 0; f.magicRank = 0; }
    fl(a).bstars = 10; fl(a).potential = 9; fl(b).bstars = 0; fl(b).potential = 0;
    applyStarStart(a); applyStarStart(b);
    expect(fl(a).bodyRank).toBe(2);
    expect(fl(a).magicRank).toBe(1);
    expect(fl(a).body).toBeGreaterThan(fl(b).body);
    expect(fl(b).bodyRank).toBe(0);
  });
  it("อ่านดาวสิบดาวเข้าพงศาวดาร และคนรุ่นหลังได้ยินเรื่องนี้", () => {
    const l = life(6, 6);
    l.flags.ftStarsSeen = false; fl(l).bstars = 10;
    runEvent(l, "ft.st.awaken");
    resolveChoice(l, 0);
    expect(seen(l)).toBe(true);
    expect(worldOfLife(l).legends.some((g) => g.deed.includes("สิบดาว"))).toBe(true);
    const next = life(7, 10);
    next.fw = l.fw;
    expect(getEvent("ft.st.legend_tale")!.when!(next)).toBe(true);
  });
  it("เซฟเก่า: ดาวเวทคูณสอง ได้ดาวกาย และถือว่าอ่านแล้ว", () => {
    const l = life(8, 30);
    delete fl(l).bstars; fl(l).potential = 3; delete l.flags.ftStarsSeen;
    migrateStars(l);
    expect(fl(l).potential).toBe(6);
    expect(fl(l).bstars).toBeDefined();
    expect(seen(l)).toBe(true);
  });
  it("คนสำคัญมีดาว · ลูกได้ดาวจากพ่อแม่ · ทายาทรับดาวของลูกคนนั้น", () => {
    const l = life(10, 40);
    fl(l).bstars = 10; fl(l).potential = 10;
    const sp = createPerson(l, "spouse", { age: 40 }); sp.stars = { b: 10, m: 10 };
    const kid = createPerson(l, "child", { age: 18 });
    const friend = createPerson(l, "friend", { age: 40 });
    giveNpcStars(l);
    expect(kid.stars!.b).toBeGreaterThanOrEqual(8);
    expect(friend.stars).toBeUndefined();
    const next = buildHeir(l, kid.id);
    inheritLife(l, next, kid.id);
    expect(fl(next).bstars).toBe(kid.stars!.b);
    expect(seen(next)).toBe(true);
  });
  it("สามัญชนล้มอัจฉริยะได้ตำนาน · ห่างไม่ถึงห้าดาวไม่นับ", () => {
    const l = life(11);
    fl(l).bstars = 1; fl(l).potential = 0;
    expect(underdogWin(l, { b: 5, m: 0 })).toBe("");
    expect(underdogWin(l, { b: 9, m: 0 })).not.toBe("");
    expect(l.flags.ftUnderdog).toBe(1);
    expect(fl(l).deeds).toContain("สามัญชนผู้ล้มอัจฉริยะ");
  });
  it("ดาบเวท: ดาวสูงทั้งสองสายสู้ได้แรงกว่า · ปรมาจารย์ทั้งคู่ได้ฉายาดาวคู่", () => {
    const a = life(12), b = life(12);
    for (const x of [a, b]) { const f = fl(x); f.bodyRank = 4; f.magicRank = 4; f.body = 0; f.magic = 0; f.wand = { name: "คทา", quality: 1, material: "ไม้" }; }
    fl(a).bstars = 6; fl(a).potential = 6; fl(b).bstars = 6; fl(b).potential = 5;
    expect(dual(a)).toBe(true);
    expect(dual(b)).toBe(false);
    expect(combat(a)).toBeGreaterThan(combat(b) + 15);
    expect(epithetOf(a)).toBe("ดาวคู่");
  });
  it("เพิ่มดาวไม่เกินสิบ", () => {
    const l = life(13);
    fl(l).bstars = 9; addStars(l, "body", 3);
    expect(fl(l).bstars).toBe(10);
  });
  it("ทุกฉากของดาวเขียนข้อความได้และมีทางเลือก", () => {
    const l = life(14, 20);
    fl(l).bstars = 10; fl(l).potential = 10; l.flags.ftBloomTrack = "body"; l.flags.ftPatron = 12;
    (worldOfLife(l).data as { prodigies?: unknown[] }).prodigies = [{ name: "คนเก่า", year: 1, lifeId: "x", track: "body" }];
    for (const e of STAR_EVENTS) {
      const ctx = e.prepare?.(l) ?? {};
      const t = e.text(l, ctx);
      expect(t, e.id).toBeTruthy();
      expect(t, e.id).not.toMatch(/undefined|NaN/);
      expect((e.choices ?? []).length, e.id).toBeGreaterThan(0);
    }
  });
});
