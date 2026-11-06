import { describe, expect, it } from "vitest";
import { loadFantasyWorld } from "../content/fantasy";
import { GOALS, MAX_GOALS, alertsOf, goalDone, goalsOf, setGoal, storyText, suggestionsOf } from "../content/fantasy/ease";
import { fl } from "../content/fantasy/state";
import { ACTIVITIES, activityLocked } from "./activities";
import { ageUp, createLife } from "./game";
import type { Life } from "./types";

loadFantasyWorld();
const life = (seed: number, age = 30): Life => {
  const l = createLife({ seed, worldId: "fantasy", plain: true });
  l.age = age; l.queue = []; l.money = 100_000; l.flags.ftStarsSeen = true; l.stats.health = 90;
  return l;
};

describe("สัญญาณเตือนและสิ่งที่น่าทำ", () => {
  it("แผลที่ยังไม่หายขึ้นเป็นสัญญาณเตือน และแนะนำให้หาหมอ", () => {
    const l = life(1);
    expect(alertsOf(l).some((a) => /แผล/.test(a.text))).toBe(false);
    fl(l).wound = l.age;
    expect(alertsOf(l).some((a) => a.kind === "danger" && /แผล/.test(a.text))).toBe(true);
    expect(suggestionsOf(l)[0]?.id).toBe("ft_healer");
  });
  it("สิ่งที่น่าทำมีไม่เกินสามอย่าง และไม่ซ้ำ", () => {
    const l = life(2); fl(l).wound = l.age; fl(l).ailment = { kind: "poison", stage: 1 };
    const s = suggestionsOf(l);
    expect(s.length).toBeLessThanOrEqual(3);
    expect(new Set(s.map((x) => x.id)).size).toBe(s.length);
  });
  it("พร้อมเลื่อนขั้นขึ้นเป็นสัญญาณว่าพร้อมแล้ว", () => {
    const l = life(3); l.job = { careerId: "ft_smith", level: 2, performance: 85, years: 3 };
    expect(alertsOf(l).some((a) => a.kind === "ready")).toBe(true);
  });
});

describe("เป้าหมายชีวิต", () => {
  it("เลือกได้ไม่เกินสามอย่าง และสำเร็จแล้วเป็นวีรกรรม", () => {
    const l = life(4);
    for (const g of GOALS.slice(0, 5)) setGoal(l, g.id, true);
    expect(goalsOf(l)).toHaveLength(MAX_GOALS);
    setGoal(l, "rich", true);
    l.money = 2000 * 100;
    if (!goalsOf(l).some((g) => g.id === "rich")) { setGoal(l, goalsOf(l)[0].id, false); setGoal(l, "rich", true); }
    l.queue = []; ageUp(l);
    expect(goalDone(l, "rich")).toBe(true);
    expect(fl(l).deeds.some((d) => d.includes("สะสมทอง"))).toBe(true);
  });
});

describe("ปุ่มที่ยังทำไม่ได้บอกเหตุผล และเรื่องเล่าส่งออกได้", () => {
  it("งานกิลด์บอกว่าต้องสมัครกิลด์ก่อน", () => {
    const l = life(5);
    const a = ACTIVITIES.find((x) => x.id === "ft_contract")!;
    expect(activityLocked(l, a)).toMatch(/สมัครกิลด์/);
  });
  it("เรื่องเล่าเป็นข้อความเรียงตามอายุ", () => {
    const l = life(6); l.queue = []; ageUp(l);
    const t = storyText(l);
    expect(t).toContain(l.firstName);
    expect(t).toMatch(/── อายุ \d+ ──/);
  });
});
