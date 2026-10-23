import { describe, expect, it } from "vitest";
import { loadMurimWorld } from "../content/murim";
import { loadSharedEvents } from "../content/shared";
import { inheritMurim } from "../content/murim/life/generations";
import { linksOf } from "../content/murim/life/npcLife";
import { plantSeed, seedsOf } from "../content/murim/life/seedStore";
import { ripeSeed, SEED_EVENTS } from "../content/murim/life/seeds";
import { worldOfLife } from "../content/murim/life/world";
import { getEvent, visibleChoices } from "./events";
import { ageUp, createLife, resolveChoice, runEvent } from "./game";
import { nextFloat } from "./rng";
import { buildHeir } from "./soul";
import type { Life } from "./types";
import { createPerson } from "./util";
import { validateLife } from "./validate";

loadMurimWorld();
loadSharedEvents();

type R = { rng: number };
const seen = new Map<string, number>();
function drain(l: Life, r: R) {
  let g = 0;
  while (l.queue.length && g++ < 80) {
    const id = l.queue[0].eventId;
    seen.set(id, (seen.get(id) ?? 0) + 1);
    const o = visibleChoices(l, l.queue[0]);
    expect(o.length, `ไม่มีตัวเลือกใน ${id}/${l.queue[0].scene ?? "start"}`).toBeGreaterThan(0);
    resolveChoice(l, o[Math.floor(nextFloat(r) * o.length)].index);
  }
}
const murim = (seed: number) => {
  const l = createLife({ seed, worldId: "murim" });
  worldOfLife(l);
  return l;
};
const year = (l: Life, r: R) => { drain(l, r); if (l.alive) ageUp(l); drain(l, r); };

describe("NPC มีชีวิตของตัวเอง · ผลที่ตามมาหลายสิบปี · ปีสงบหลังอายุ 40", () => {
  it("เมล็ดของผลที่ตามมาสุกตามเวลา ทุกเรื่องเล่นได้ไม่ตัน และปิดเรื่อง/เลื่อนออกไปจริง", () => {
    let fired = 0;
    for (let s = 1; s <= 60; s++) {
      for (const e of SEED_EVENTS) {
        const k = e.id.slice(3) as Parameters<typeof plantSeed>[1];
        const l = murim(200 + s);
        l.age = 40; l.money = 500_000; l.stats.health = 90;
        l.power = { rank: 3, hunterClass: "m_sword", level: 30, exp: 0, skills: [], gates: 0, bossKills: 0, awakenedAt: 12, items: [] };
        plantSeed(l, k, "ทดสอบ");
        expect(ripeSeed(l, k)).toBeUndefined();
        l.age += 30;
        expect(ripeSeed(l, k)).toBeTruthy();
        expect(e.when!(l)).toBe(true);
        runEvent(l, e.id);
        drain(l, { rng: s * 7 + fired });
        fired++;
        const left = seedsOf(l).filter((x) => x.k === k);
        // ปิดเรื่องแล้ว หรือเลื่อนไปปีหน้าขึ้นไป (หนี/ขอขมาไม่สำเร็จ)
        for (const x of left) expect(x.ripe).toBeGreaterThan(l.birthYear + l.age);
        expect(validateLife(l)).toEqual([]);
      }
    }
    expect(fired).toBe(60 * SEED_EVENTS.length);
  });

  it("ไว้ชีวิต/ฆ่าในการดวลปลูกเมล็ดจริง และความแค้นที่ยังไม่สุกตกถึงลูก", () => {
    const l = murim(5);
    l.age = 30;
    l.queue = [{ eventId: "duel", ctx: { foe: "จอมโจรทดสอบ", rank: 1 }, scene: "victory" }];
    const kill = visibleChoices(l, l.queue[0]).find((o) => (typeof o.c.label === "string" ? o.c.label : "") === "ปลิดชีพ")!;
    resolveChoice(l, kill.index);
    drain(l, { rng: 1 });
    expect(seedsOf(l).some((x) => x.k === "killed" && x.who === "จอมโจรทดสอบ")).toBe(true);
    const kid = createPerson(l, "child", { age: 5, bond: 70 });
    l.alive = false;
    const heir = buildHeir(l, kid.id);
    inheritMurim(l, heir, "heir", kid.id);
    const s = seedsOf(heir).find((x) => x.k === "killed")!;
    expect(s.by).toBeTruthy();
    expect(s.ripe).toBeGreaterThanOrEqual(heir.birthYear + 16);
    heir.age = s.ripe - heir.birthYear;
    expect(getEvent("dc.killed")!.when!(heir)).toBe(true);
    runEvent(heir, "dc.killed");
    expect(getEvent("dc.killed")!.text(heir, heir.queue[0].ctx)).toContain("บรรพบุรุษ");
  });

  it("ชีวิตสุ่ม: NPC แต่งงานกันเอง ทะเลาะกันเอง ย้ายไปแล้วกลับมา ได้งาน · ผลที่ตามมาเกิดหลังหลายปี · ปีสงบหลัง 40", () => {
    seen.clear();
    let wed = 0, feud = 0, away = 0, jobs = 0, ripeGap = 0, ripeN = 0, calm40 = 0, lives40 = 0;
    for (let s = 1; s <= 120; s++) {
      const l = murim(s * 6007);
      for (let i = 0; i < 6; i++) createPerson(l, "friend", { age: 5 + i, bond: 60 });
      // ครึ่งหนึ่งเล่นแบบตั้งใจ: ไว้ชีวิตศัตรูหนึ่งคนตอนอายุ 20 (บอทสุ่มแทบไม่เคยดวลจนชนะ)
      const sparedAt = s % 2 ? 20 : -1;
      const r = { rng: s };
      let g = 0;
      while (l.alive && g++ < 100) {
        if (l.age === sparedAt) plantSeed(l, "spared", "ศัตรูที่ไว้ชีวิต");
        const before = seedsOf(l).map((x) => ({ id: x.id, y: x.y }));
        year(l, r);
        for (const b of before) if (!seedsOf(l).some((x) => x.id === b.id) && l.alive) { ripeGap += l.birthYear + l.age - b.y; ripeN++; }
        expect(validateLife(l)).toEqual([]);
      }
      const ls = linksOf(l);
      wed += ls.filter((x) => x.k === "wed").length;
      feud += ls.filter((x) => x.k === "feud").length;
      away += l.people.filter((p) => p.tags?.some((t) => t.startsWith("away:"))).length;
      jobs += l.people.filter((p) => p.job).length;
      if (l.age >= 50) { lives40++; calm40 += Object.keys(l.seen).filter((id) => id.startsWith("cm.")).length; }
      expect(JSON.parse(JSON.stringify(l))).toEqual(l);
    }
    const npcEv = [...seen].filter(([id]) => id.startsWith("npc.l_")).reduce((a, [, n]) => a + n, 0);
    const dcEv = [...seen].filter(([id]) => id.startsWith("dc.")).reduce((a, [, n]) => a + n, 0);
    console.log("SIM npc lives", { wed, feud, away, jobs, npcEv }, "| consequences", dcEv, "avg years after", ripeN ? (ripeGap / ripeN).toFixed(1) : "-", "| calm per 50+ life", lives40 ? (calm40 / lives40).toFixed(1) : "-");
    expect(wed).toBeGreaterThan(10);
    expect(feud).toBeGreaterThan(5);
    expect(npcEv).toBeGreaterThan(10);
    expect(jobs).toBeGreaterThan(100);
    expect(dcEv).toBeGreaterThan(15);
    expect(ripeGap / Math.max(1, ripeN)).toBeGreaterThanOrEqual(8);
    expect(calm40 / Math.max(1, lives40)).toBeGreaterThanOrEqual(1.5);
  });
});
