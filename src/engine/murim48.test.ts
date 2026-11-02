import { describe, expect, it } from "vitest";
import { loadMurimWorld } from "../content/murim";
import { loadSharedEvents } from "../content/shared";
import { placeHidden, placeOf } from "../content/murim/life/place";
import { worldOfLife } from "../content/murim/life/world";
import { activitiesFor, activityLocked, doActivity } from "./activities";
import { createLife } from "./game";
import type { Life } from "./types";

loadMurimWorld();
loadSharedEvents();

const life = (seed: number, gender: "m" | "f" = "f"): Life => {
  const l = createLife({ seed, worldId: "murim", gender });
  worldOfLife(l);
  l.age = 25; l.queue = []; l.money = 500_000;
  return l;
};
const ids = (l: Life) => activitiesFor(l).map((a) => a.id);

describe("ทำอะไรได้ตามที่อยู่", () => {
  it("คนทั่วไปอยู่ข้างนอก เห็นกิจกรรมปกติ ไม่เห็นหมวดของสถานที่", () => {
    const l = life(1);
    expect(placeOf(l)).toBeUndefined();
    expect(ids(l)).toContain("mw_tavern");
    for (const id of ["mw_j_bribe", "mw_q_study", "mw_c_garden"]) expect(ids(l)).not.toContain(id);
  });

  it("ในวังหลังออกไปโรงเตี๊ยมหรือรับงานยุทธภพไม่ได้ แต่เล่นเกมในวังได้", () => {
    const l = life(2);
    l.flags.qnRank = 1; l.flags.qnFavor = 60;
    expect(placeOf(l)?.id).toBe("harem");
    expect(ids(l)).not.toContain("mw_tavern");
    expect(ids(l)).not.toContain("mw_investigate");
    expect(ids(l)).not.toContain("mw_rob");
    for (const id of ["mw_consort", "mw_rest", "mw_doctor", "mw_q_study", "mw_q_dowager"]) expect(ids(l), id).toContain(id);
    expect(placeHidden(l)).toBeGreaterThan(0);
    expect(doActivity(l, "mw_tavern")).toBeUndefined();
  });

  it("กลับเยี่ยมบ้านได้ทุก 5 ปี", () => {
    const l = life(3);
    l.flags.qnRank = 1; l.flags.qnFavor = 60;
    const a = activitiesFor(l).find((x) => x.id === "mw_q_home")!;
    expect(activityLocked(l, a)).toBeUndefined();
    doActivity(l, a.id);
    l.doneThisYear = [];
    expect(activityLocked(l, a)).toBeTruthy();
    l.age += 5;
    expect(activityLocked(l, a)).toBeUndefined();
  });

  it("ตำหนักเย็นเหลือแค่พัก ฝึก และปลูกผัก", () => {
    const l = life(4);
    l.flags.qnRank = 1; l.flags.qnCold = true;
    expect(placeOf(l)?.id).toBe("cold");
    expect(ids(l)).toContain("mw_c_garden");
    expect(ids(l)).toContain("mw_rest");
    expect(ids(l)).not.toContain("mw_consort");
  });

  it("ในคุกมีทางของคนในคุก ติดสินบนแล้วโทษลดจริง ไม่ทำโทษติดลบจนค้าง", () => {
    let cut = 0;
    for (let s = 10; s < 40; s++) {
      const l = life(s, "m");
      l.flags.jailUntil = l.age + 4;
      expect(placeOf(l)?.id).toBe("jail");
      expect(ids(l)).toContain("mw_j_bribe");
      expect(ids(l)).not.toContain("mw_tavern");
      const before = l.money;
      doActivity(l, "mw_j_bribe");
      expect(l.money).toBe(before - 25_000);
      if (Number(l.flags.jailUntil) < l.age + 4) cut++;
      expect(Number(l.flags.jailUntil)).toBeGreaterThanOrEqual(l.age + 2);
    }
    expect(cut).toBeGreaterThan(0);
  });

  it("ปิดด่านทำได้แค่ฝึกกับพัก", () => {
    const l = life(50, "m");
    l.flags.secludeUntil = l.age + 2;
    expect(placeOf(l)?.id).toBe("seclusion");
    expect(ids(l)).not.toContain("mw_tavern");
    expect(ids(l)).toContain("mw_meditate");
  });

  it("ราชบุตรเขยยังไปไหนมาไหนได้", () => {
    const l = life(51, "m");
    l.flags.pcRank = 0;
    expect(placeOf(l)).toBeUndefined();
    expect(ids(l)).toContain("mw_tavern");
  });
});
