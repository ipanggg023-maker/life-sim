import { describe, expect, it } from "vitest";
import { loadMurimWorld } from "../content/murim";
import { loadSharedEvents } from "../content/shared";
import { DYN_REWARD, carryDyn, dynProgress, dynReached, dynTally, nextTries, recordDynasty } from "../content/murim/life/dynasty";
import { startTrip } from "../content/murim/life/journeys";
import { REGIONS, regionOf } from "../content/murim/life/region";
import { worldOfLife } from "../content/murim/life/world";
import { getEvent, visibleChoices } from "./events";
import { createLife } from "./game";
import { newSoul } from "./soul";
import type { Life } from "./types";

loadMurimWorld();
loadSharedEvents();

const life = (seed: number): Life => {
  const l = createLife({ seed, worldId: "murim" });
  worldOfLife(l);
  l.age = 40; l.queue = []; l.money = 500_000;
  return l;
};

describe("เป้าหมายตระกูล", () => {
  it("นับต่อเมื่อสืบรุ่น และคนละสายเริ่มนับใหม่", () => {
    const a = life(1), b = life(2), c = life(3);
    a.power = { rank: 5, hunterClass: "m_sword", level: 5, exp: 0, skills: [], gates: 0, bossKills: 0, awakenedAt: 15, items: [] };
    carryDyn(a, b);
    expect(dynTally(b).gens).toBe(2);
    expect(dynTally(b).fighters).toBe(1);
    expect(dynTally(c).gens).toBe(1);
  });

  it("ครบแล้วให้แต้มครั้งเดียว", () => {
    const s = newSoul(), l = life(4);
    l.flags.dynGens = 2;
    const before = s.points;
    expect(recordDynasty(s, l).map((g) => g.id)).toContain("gens3");
    expect(s.points).toBe(before + DYN_REWARD);
    expect(recordDynasty(s, l)).toEqual([]);
    expect(s.points).toBe(before + DYN_REWARD);
    expect(dynProgress(s, l).some((g) => g.id === "gens3")).toBe(false);
  });

  it("ชีวิตที่ทำครบแล้วไม่ถูกแนะนำซ้ำ แต่ขึ้นเป็นความสำเร็จ แม้ยังไม่บันทึกแต้ม", () => {
    const s = newSoul(), l = life(8);
    l.flags.dynGens = 2;
    expect(dynProgress(s, l).some((g) => g.id === "gens3")).toBe(false);
    expect(dynReached(l).map((g) => g.id)).toEqual(["gens3"]);
    l.flags.dynGens = 3;
    expect(dynReached(l)).toEqual([]);
  });

  it("หน้าชีวิตหน้ามีทั้งเส้นทาง เรื่องเล่า และตระกูล", () => {
    const kinds = nextTries(newSoul(), life(5)).map((x) => x.kind);
    expect(kinds).toContain("เส้นทาง");
    expect(kinds).toContain("เรื่องเล่า");
    expect(kinds).toContain("ตระกูล");
  });
});

describe("เรื่องระหว่างทาง", () => {
  it("กลับไปรอบสองเจอฉากใหม่ของภูมิภาคนั้น", () => {
    for (const r of REGIONS) {
      const l = life(6);
      l.flags.region = REGIONS.find((x) => x.id !== r.id)!.id;
      startTrip(l, r.id);
      expect(l.queue[0].eventId).toBe(`rg.jr_${r.id}`);
      l.queue = []; l.doneThisYear = []; l.age += 5;
      startTrip(l, r.id);
      expect(l.queue[0].eventId).toBe(`rg.jr2_${r.id}`);
      expect(visibleChoices(l, l.queue[0]).length).toBeGreaterThan(0);
    }
  });

  it("ทุกเหตุการณ์ใหม่มีอยู่จริง", () => {
    for (const id of ["rg.jr_road_inn", "rg.jr_road_bandit", "rg.jr_road_elder", "qn.pc_grandson", "qn.pc_prince", "qn.pc_old_friend", "jb.w_bribe", "jb.w_junior", "jb.w_drink"]) expect(getEvent(id), id).toBeTruthy();
    expect(regionOf(life(7))).toBeTruthy();
  });
});
