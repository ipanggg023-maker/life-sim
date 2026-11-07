import { describe, expect, it } from "vitest";
import { loadFantasyWorld } from "../content/fantasy";
import { careerPicks, effectsOf, peopleToCare, powerSteps, topPicks, yearLine } from "../content/fantasy/glance";
import { fl } from "../content/fantasy/state";
import { ACTIVITIES } from "./activities";
import { createLife } from "./game";
import type { Life } from "./types";

loadFantasyWorld();
const life = (seed: number, age = 25): Life => {
  const l = createLife({ seed, worldId: "fantasy", plain: true });
  l.age = age; l.queue = []; l.money = 5_000; l.stats.health = 80; l.flags.ftStarsSeen = true;
  return l;
};

describe("สรุปและสิ่งที่ควรทำ (ใช้การ์ดเดิม)", () => {
  it("แถบทำมีสามอย่างที่ควรทำ แต่ละอย่างบอกเหตุผล", () => {
    const l = life(1);
    const p = topPicks(l);
    expect(p.length).toBe(3);
    for (const x of p) expect(x.why.length).toBeGreaterThan(0);
  });
  it("สุขภาพต่ำ: หาหมอหรือพักขึ้นก่อน และบอกว่าได้สุขภาพ", () => {
    const l = life(2); l.stats.health = 25;
    const p = topPicks(l);
    expect(["ft_healer", "ft_rest"]).toContain(p[0].id);
    expect(p[0].gets).toContain("+สุขภาพ");
    expect(yearLine(l)).toMatch(/สุขภาพ 25 \(ต่ำ\)/);
  });
  it("ป้ายผลของกิจกรรม", () => {
    const l = life(3);
    expect(effectsOf(l, ACTIVITIES.find((a) => a.id === "ft_healer")!)).toContain("+สุขภาพ");
    expect(effectsOf(l, ACTIVITIES.find((a) => a.id === "ft_train")!)).toContain("+พลังกาย");
  });
  it("คนที่ควรใส่ใจ: พ่อแม่ที่ห่างเหิน และศัตรูที่ยังแค้น", () => {
    const l = life(4);
    const mom = l.people.find((p) => p.relation === "mother")!;
    mom.alive = true; mom.bond = 10;
    const list = peopleToCare(l);
    expect(list.some((c) => c.p.id === mom.id)).toBe(true);
    expect(list.length).toBeLessThanOrEqual(3);
  });
  it("ก้าวต่อไปของพลังบอกแต้มที่ขาด", () => {
    const l = life(5); fl(l).body = 5;
    expect(powerSteps(l)[0].why).toMatch(/^อีก \d+ แต้ม/);
  });
  it("แถบอาชีพ: มีหนี้แนะนำหาเงิน", () => {
    const l = life(6); l.debt = 30 * 100;
    const p = careerPicks(l);
    expect(p.length).toBeGreaterThan(0);
    expect(p.some((x) => /หนี้/.test(x.why)), JSON.stringify(p)).toBe(true);
  });
});
