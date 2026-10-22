import { describe, expect, it } from "vitest";
import { loadMurimWorld } from "../content/murim";
import { loadSharedEvents } from "../content/shared";
import { CAREERS } from "../content/hunter/careers";
import { foundSect, mySect, saveSect } from "../content/murim/m17core";
import { inheritMurim } from "../content/murim/life/generations";
import { worldOfLife } from "../content/murim/life/world";
import { factions } from "../content/murim/world/factions";
import { buildSect, hasBuilding, legendsOf, myYoungPlace, openSectBusiness, sectDefense, youngList } from "../content/murim/world/jianghu";
import { activitiesFor, doActivity } from "./activities";
import { getEvent, visibleChoices } from "./events";
import { ageUp, createLife, resolveChoice, runEvent } from "./game";
import { nextFloat } from "./rng";
import { nextEraOptions } from "./soul";
import type { Life } from "./types";

loadMurimWorld();
loadSharedEvents();

function drain(l: Life, r: { rng: number }) {
  let g = 0;
  while (l.queue.length && g++ < 80) {
    const o = visibleChoices(l, l.queue[0]);
    expect(o.length, `ไม่มีตัวเลือกใน ${l.queue[0].eventId}/${l.queue[0].scene ?? "start"}`).toBeGreaterThan(0);
    resolveChoice(l, o[Math.floor(nextFloat(r) * o.length)].index);
  }
}
const fighter = (seed: number, rank = 4): Life => {
  const l = createLife({ seed, worldId: "murim" });
  worldOfLife(l);
  l.age = 25; l.money = 5_000_000; l.fame = 50;
  l.power = { rank, hunterClass: "m_sword", level: 30, exp: 0, skills: [], gates: 0, bossKills: 0, awakenedAt: 12, items: [] };
  return l;
};

describe("ยุทธภพเต็มรูปแบบ (กลุ่ม 2)", () => {
  it("มีห้าตระกูลใหญ่และพันธมิตรมรรคาดำ — เซฟเก่าก็ได้ด้วย", () => {
    const l = fighter(1);
    expect(factions(l).some((f) => f.id === "families")).toBe(true);
    expect(factions(l).some((f) => f.id === "blackway")).toBe(true);
    l.mw!.fx = l.mw!.fx!.filter((f) => f.id !== "families" && f.id !== "blackway");
    expect(factions(l).filter((f) => f.id === "families" || f.id === "blackway").length).toBe(2);
  });

  it("ทำเนียบมังกรหนุ่มเปลี่ยนทุกปี และคนเก่งอายุน้อยติดได้", () => {
    const l = fighter(2, 6);
    l.age = 20;
    const before = JSON.stringify(youngList(l));
    ageUp(l);
    expect(JSON.stringify(youngList(l))).not.toBe(before);
    expect(youngList(l).every((y) => y.a <= 30)).toBe(true);
    expect(myYoungPlace(l)).toBeGreaterThan(0);
    l.age = 31;
    expect(myYoungPlace(l)).toBe(0);
  });

  it("ชุมนุมผู้กล้า กิจกรรมยุทธภพใหม่ และการขโมยคัมภีร์ เล่นได้ไม่ตัน", () => {
    let champions = 0, hunted = 0;
    for (let s = 1; s <= 40; s++) {
      const l = fighter(10 + s, 3 + (s % 3));
      const r = { rng: s };
      l.flags.gatheringYear = l.birthYear + l.age;
      runEvent(l, "jh.gathering", getEvent("jh.gathering")!.prepare?.(l) ?? {});
      drain(l, r);
      if (l.flags.gatheringChampion) champions++;
      if (!l.alive) continue;
      for (const id of ["mw_visit", "mw_alliance", "mw_cult_hunt", "mw_beauty", "mw_steal_manual"]) { l.doneThisYear = []; doActivity(l, id); drain(l, r); if (!l.alive) break; }
      if (l.flags.manualHunted) hunted++;
      expect(JSON.parse(JSON.stringify(l))).toEqual(l);
    }
    console.log("SIM group2: แชมป์ชุมนุม", champions, "/ 40 | ถูกตามล่าคัมภีร์", hunted);
    expect(champions).toBeGreaterThan(0);
    expect(champions).toBeLessThan(30);
    const l = fighter(99);
    const acts = activitiesFor(l).map((a) => a.id);
    for (const id of ["mw_visit", "mw_alliance", "mw_cult_hunt", "mw_beauty", "mw_steal_manual"]) expect(acts).toContain(id);
  });

  it("สำนักของตัวเอง: อาคารและกิจการมีผลจริง และกลายเป็นฝ่ายในโลกยุคหลัง", () => {
    const l = fighter(5, 5);
    l.age = 40;
    foundSect(l, "สำนักทดสอบอาคาร");
    const d0 = sectDefense(l);
    buildSect(l, "armory");
    buildSect(l, "hall");
    openSectBusiness(l, "inn");
    expect(hasBuilding(mySect(l), "armory")).toBe(true);
    expect(sectDefense(l)).toBeGreaterThan(d0);
    const s = mySect(l)!; s.d = 20; saveSect(l, s);
    const money0 = l.money;
    ageUp(l);
    expect(mySect(l)!.d).toBeGreaterThanOrEqual(20);
    expect(Number.isFinite(l.money)).toBe(true);
    expect(l.money).not.toBe(money0);
    // ยุคหลัง: สำนักเป็นฝ่ายหนึ่งในโลก และชื่อคุณอยู่ในทำเนียบตำนาน
    l.alive = false;
    const e = createLife({ ...nextEraOptions(l), seed: 777 });
    inheritMurim(l, e, "era");
    expect(factions(e).some((f) => f.name === "สำนักทดสอบอาคาร")).toBe(true);
    expect(legendsOf(e).length).toBeGreaterThan(0);
  });

  it("สอบขุนนางครบสามระดับ และอาชีพราชสำนักมีครบ", () => {
    for (const id of ["woodcutter", "waiter", "imperial_guard", "jinyiwei", "palace_physician"]) expect(CAREERS.some((c) => c.id === id && c.world === "murim"), id).toBe(true);
    let jinshi = 0;
    for (let s = 1; s <= 30; s++) {
      const l = createLife({ seed: 300 + s, worldId: "murim" });
      l.age = 25; l.stats.smarts = 95; l.money = 100_000; l.flags.xiucai = true;
      const r = { rng: s };
      for (let k = 0; k < 6 && !l.flags.juren; k++) { runEvent(l, "jh.exam_province"); drain(l, r); }
      for (let k = 0; k < 6 && l.flags.juren && !l.flags.jinshi; k++) { l.money = 100_000; runEvent(l, "jh.exam_palace"); drain(l, r); }
      if (l.flags.jinshi) jinshi++;
    }
    expect(jinshi).toBeGreaterThan(5);
  });

  it("ชีวิตสุ่ม 100 ชีวิตกับยุทธภพใหม่ ไม่มีฉากตัน", () => {
    let gather = 0;
    for (let s = 1; s <= 100; s++) {
      const l = createLife({ seed: s * 5101, worldId: "murim" });
      worldOfLife(l);
      const r = { rng: s * 3 };
      let g = 0;
      while (l.alive && g++ < 110) { drain(l, r); if (!l.alive) break; ageUp(l); }
      drain(l, r);
      gather += l.seen["jh.gathering"] ?? 0;
      expect(JSON.parse(JSON.stringify(l))).toEqual(l);
    }
    console.log("SIM group2 life: ชุมนุมผู้กล้าที่เจอ", gather);
    expect(gather).toBeGreaterThan(20);
  });
});
