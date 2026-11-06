import { describe, expect, it } from "vitest";
import { loadFantasyWorld } from "../content/fantasy";
import { isLongLived } from "../content/fantasy/races";
import { setRace } from "../content/fantasy/life";
import { MYSTERIES } from "../content/fantasy/mysteries";
import { fl } from "../content/fantasy/state";
import { doActivity } from "./activities";
import { getEvent, pickEvents, startAge, visibleChoices } from "./events";
import { ageUp, createLife, resolveChoice } from "./game";
import type { Life } from "./types";

loadFantasyWorld();
const life = (seed: number, age = 30): Life => {
  const l = createLife({ seed, worldId: "fantasy", plain: true });
  l.age = age; l.queue = []; l.flags.ftStarsSeen = true; l.stats.health = 90;
  return l;
};

describe("ปีที่สุ่มจริง", () => {
  it("เรื่องที่เกิดครั้งเดียวเริ่มที่อายุต่างกันในแต่ละชีวิต", () => {
    const e = getEvent("ft.ch.bird")!;
    const ages = new Set<number>();
    for (let s = 1; s <= 40; s++) ages.add(startAge(life(s), e));
    expect(ages.size).toBeGreaterThan(1);
    for (const a of ages) expect(a).toBeLessThanOrEqual(e.maxAge);
  });
  it("ทางของวัยรุ่นมาในปีที่สุ่ม แต่มาแน่นอนก่อนอายุ 19", () => {
    const at: number[] = [];
    for (let s = 1; s <= 30; s++) {
      const l = life(s, 16);
      for (let a = 16; a <= 19 && !l.flags.ftTeenPath; a++) {
        l.age = a;
        if (pickEvents(l, 0).some((e) => e.id === "ft.tn.path")) { at.push(a); break; }
      }
    }
    expect(at.length).toBe(30);
    expect(new Set(at).size).toBeGreaterThan(1);
  });
  it("หลายชีวิตไม่เจอเรื่องหลักเดียวกันที่อายุเดียวกัน", () => {
    const byAge = new Map<string, number>();
    const N = 24;
    for (let s = 1; s <= N; s++) {
      const l = createLife({ seed: s * 211, worldId: "fantasy", plain: true });
      for (let y = 0; y < 40 && l.alive; y++) {
        ageUp(l);
        let g = 0;
        while (l.queue.length && l.alive && g++ < 30) {
          const q = l.queue[0];
          if (!q.scene && q.eventId.startsWith("ft.hl.")) byAge.set(`${l.age}:${q.eventId}`, (byAge.get(`${l.age}:${q.eventId}`) ?? 0) + 1);
          const v = visibleChoices(l, q);
          resolveChoice(l, v.length ? v[g % v.length].index : 0);
        }
        l.queue = [];
      }
    }
    expect(Math.max(0, ...byAge.values())).toBeLessThan(N * 0.4);
  });
});

describe("ข้ามเวลาและปริศนา", () => {
  it("ข้ามหลายปีได้เฉพาะเผ่าอายุยืน", () => {
    const h = life(1); setRace(h, "human");
    const e = life(2); setRace(e, "elf");
    expect(isLongLived(h)).toBe(false);
    expect(isLongLived(e)).toBe(true);
  });
  it("เปิดสมุดปริศนาแล้วเลือกปริศนาได้", () => {
    const l = life(3, 20);
    fl(l).mKnown = [MYSTERIES[0].id];
    doActivity(l, "ft_mystery");
    l.queue = l.queue.filter((q) => q.eventId === "ft.m.choose");
    resolveChoice(l, visibleChoices(l, l.queue[0])[0].index);
    expect(l.queue[0]?.eventId).toBe("ft.m.step");
  });
});
