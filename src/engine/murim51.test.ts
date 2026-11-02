import { describe, expect, it } from "vitest";
import { loadMurimWorld } from "../content/murim";
import { loadSharedEvents } from "../content/shared";
import { REGION_PERK, TRIP_COST, startTrip, tripLocked, visited, warAction } from "../content/murim/life/journeys";
import { REGIONS, regionOf } from "../content/murim/life/region";
import { ROUTES } from "../content/murim/life/routes";
import { worldOfLife } from "../content/murim/life/world";
import { activeWar, warsOf } from "../content/murim/world/sectWar";
import { visibleChoices } from "./events";
import { ageUp, createLife, resolveChoice } from "./game";
import type { Life } from "./types";

loadMurimWorld();
loadSharedEvents();

const life = (seed: number, age = 25): Life => {
  const l = createLife({ seed, worldId: "murim", gender: "m" });
  worldOfLife(l);
  l.age = age; l.queue = []; l.money = 500_000; l.stats.health = 100;
  return l;
};
const away = (l: Life) => REGIONS.find((r) => r.id !== regionOf(l).id)!.id;
const fight = (l: Life) => { l.power = { rank: 3, hunterClass: "m_sword", level: 5, exp: 0, skills: [], gates: 0, bossKills: 0, awakenedAt: 15, items: [] }; };

describe("เดินทาง", () => {
  it("เดินทางแล้วเสียเงิน เวลา ได้นับเส้นทาง และไม่ได้ย้ายถิ่น", () => {
    const l = life(1);
    const home = regionOf(l).id, to = away(l), m = l.money;
    startTrip(l, to);
    expect(l.money).toBe(m - TRIP_COST * 1000);
    expect(regionOf(l).id).toBe(home);
    expect(l.queue[0].eventId).toBe(`rg.jr_${to}`);
    expect(visited(l).map((r) => r.id)).toContain(to);
    expect(ROUTES.find((r) => r.id === "road")!.tier(l)).toBeGreaterThanOrEqual(1);
    resolveChoice(l, visibleChoices(l, l.queue[0]).at(-1)!.index);
    expect(tripLocked(l, to)).toBeTruthy();
  });

  it("ปีละครั้ง และกลับไปที่เดิมต้องรอ 5 ปี", () => {
    const l = life(2);
    const to = away(l);
    startTrip(l, to); l.queue = [];
    const other = REGIONS.find((r) => r.id !== regionOf(l).id && r.id !== to)!.id;
    expect(tripLocked(l, other)).toContain("ปีนี้");
    l.doneThisYear = [];
    expect(tripLocked(l, to)).toContain("5");
    expect(tripLocked(l, other)).toBeUndefined();
    l.age += 5;
    expect(tripLocked(l, to)).toBeUndefined();
  });

  it("ไปบ้านตัวเองไม่ได้ ติดคุกหรืออยู่ในวังก็ไปไม่ได้", () => {
    const l = life(3);
    expect(tripLocked(l, regionOf(l).id)).toContain("อยู่ที่นี่");
    l.flags.jailUntil = l.age + 2;
    expect(tripLocked(l, away(l))).toContain("คุก");
    const q = life(4); q.flags.qnRank = 1;
    expect(tripLocked(q, away(q))).toBeTruthy();
  });

  it("ทุกภูมิภาคมีฉากเดินทางและผลรายปีที่เล่นได้", () => {
    for (const r of REGIONS) {
      const l = life(5);
      l.flags.region = REGIONS.find((x) => x.id !== r.id)!.id;
      startTrip(l, r.id);
      expect(visibleChoices(l, l.queue[0]).length).toBeGreaterThan(0);
      expect(REGION_PERK[r.id].text).toBeTruthy();
      l.queue = [];
      REGION_PERK[r.id].run(l);
    }
  });

  it("ไปครบทุกภูมิภาคได้รางวัลครั้งเดียว", () => {
    const l = life(6);
    let n = 0;
    for (const r of REGIONS) { if (r.id === regionOf(l).id) continue; l.doneThisYear = []; startTrip(l, r.id); l.queue = []; n++; }
    expect(n).toBe(REGIONS.length - 1);
    expect(l.flags.jrAll).toBe(true);
  });
});

describe("ลงมือในสงครามสำนัก", () => {
  const atWar = (l: Life) => { fight(l); warsOf(l).push({ id: "w1", a: [], b: [], since: 1100, front: 0, deaths: 0, cause: "ทดสอบ" } as never); };
  it("ไม่มีสงครามไม่มีปุ่ม · ยังไม่เลือกข้างได้ปุ่มเลือกข้าง · เลือกแล้วออกศึกได้ปีละครั้ง", () => {
    const l = life(7);
    fight(l);
    expect(warAction(l)).toBeUndefined();
    atWar(l);
    expect(activeWar(l)).toBeTruthy();
    expect(warAction(l)?.label).toBe("เลือกข้าง");
    l.flags.warSide = "a";
    const a = warAction(l)!;
    expect(a.label).toBe("ออกศึกปีนี้");
    a.run(l);
    expect(l.queue[0].eventId).toBe("sw.battle");
    expect(warAction(l)?.locked).toBeTruthy();
  });
  it("วางตัวเป็นกลางแล้วไม่มีปุ่ม", () => {
    const l = life(8);
    atWar(l);
    l.flags.warSide = "none";
    expect(warAction(l)).toBeUndefined();
  });
});

describe("ขึ้นปี", () => {
  it("ผลรายปีของถิ่นไม่ทำให้เกมพัง", () => {
    const l = life(9);
    for (let i = 0; i < 5; i++) { l.queue = []; ageUp(l); }
    expect(l.alive).toBe(true);
  });
});
