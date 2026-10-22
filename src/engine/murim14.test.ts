import { describe, expect, it } from "vitest";
import { loadMurimWorld } from "../content/murim";
import { loadSharedEvents } from "../content/shared";
import { addHeat } from "../content/murim/life/law";
import { coverTracks, fameNewsOf, hearRumor, rumorsOf } from "../content/murim/life/rumors";
import { worldOfLife } from "../content/murim/life/world";
import { doActivity } from "./activities";
import { visibleChoices } from "./events";
import { ageUp, createLife, resolveChoice, runEvent } from "./game";
import { profileOf } from "./npc";
import { nextFloat } from "./rng";
import type { Life } from "./types";
import { createPerson } from "./util";

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
const adult = (seed: number) => {
  const l = createLife({ seed, worldId: "murim" });
  worldOfLife(l);
  l.age = 30; l.money = 2_000_000;
  l.power = { rank: 3, hunterClass: "m_sword", level: 30, exp: 0, skills: [], gates: 0, bossKills: 0, awakenedAt: 12, items: [] };
  for (let i = 0; i < 4; i++) createPerson(l, "friend", { age: 30, bond: 50 });
  return l;
};

describe("ข่าวลือ การสืบสวน และการปกปิด (กลุ่ม 3)", () => {
  it("ข่าวลือมีแหล่ง ความน่าเชื่อถือ และความจริงที่สัมพันธ์กับแหล่ง", () => {
    const bySrc: Record<string, { t: number; n: number }> = {};
    for (let s = 1; s <= 400; s++) {
      const l = adult(s);
      const r = hearRumor(l);
      expect(r.src.length).toBeGreaterThan(0);
      expect(r.rel).toBeGreaterThanOrEqual(1);
      expect(r.rel).toBeLessThanOrEqual(4);
      if (r.kind === "scandal") continue;
      const b = (bySrc[r.src] ??= { t: 0, n: 0 });
      b.n++;
      if (r.truth === "true" || r.truth === "partial") b.t++;
    }
    const rate = (k: string) => bySrc[k].t / bySrc[k].n;
    console.log("SIM rumor truth by source", JSON.stringify(Object.fromEntries(Object.entries(bySrc).map(([k, v]) => [k, (v.t / v.n).toFixed(2)]))));
    expect(rate("มือปราบที่เมาในโรงเตี๊ยม")).toBeGreaterThan(rate("คู่แข่งในตลาด"));
  });

  it("ตรวจสอบและลงมือตามข่าวได้ทุกประเภท ไม่ตัน", () => {
    const kinds = new Set<string>();
    for (let s = 1; s <= 120; s++) {
      const l = adult(1000 + s);
      const r = { rng: s };
      const rumor = hearRumor(l);
      kinds.add(rumor.kind);
      runEvent(l, "rm.verify", { rid: rumor.id }); drain(l, r);
      if (!l.alive) continue;
      runEvent(l, "rm.act", { rid: rumor.id }); drain(l, r);
      expect(JSON.parse(JSON.stringify(l))).toEqual(l);
    }
    expect(kinds.size).toBeGreaterThanOrEqual(4);
  });

  it("ข่าวเรื่องคุณแพร่ออกไปทีละภูมิภาค และคนรู้จักจำได้ตามค่านิยมของเขา", () => {
    const l = adult(7);
    const judge = createPerson(l, "friend", { age: 35, bond: 60 });
    judge.values = ["ความยุติธรรม", "ครอบครัว"]; judge.fear = "กลัวความจน"; judge.sideGoals = []; judge.limit = "";
    profileOf(judge);
    l.flags.lastCrime = "ปล้นคนเดินทาง";
    addHeat(l, 20);
    expect(fameNewsOf(l).length).toBe(1);
    const rr = { rng: 7 };
    for (let y = 0; y < 6 && l.alive; y++) { drain(l, rr); ageUp(l); }
    const f = fameNewsOf(l)[0];
    expect(f.reach).toBeGreaterThanOrEqual(3);
    expect(f.told.length).toBeGreaterThan(0);
    const told = l.people.filter((p) => p.mem?.some((m) => m.k === "heard_news"));
    expect(told.length).toBeGreaterThan(0);
    // ปกปิด: ข่าวถูกกลบ ความร้อนแรงลด
    const h = Number(l.flags.heat ?? 0);
    coverTracks(l, 20);
    expect(Number(l.flags.heat ?? 0)).toBeLessThan(h + 1);
    expect(fameNewsOf(l).every((x) => x.covered || x.good)).toBe(true);
  });

  it("สืบคดีจากเบาะแส: ชี้ถูกได้ ชี้ผิดก็มีผล และปิดคดีได้", () => {
    let right = 0, wrong = 0;
    for (let s = 1; s <= 80; s++) {
      const l = adult(2000 + s);
      l.stats.smarts = 80;
      const r = { rng: s };
      const align0 = Number(l.flags.m17Align ?? 0);
      runEvent(l, "iv.case"); drain(l, r);
      const a = Number(l.flags.m17Align ?? 0);
      if (a > align0) right++; else if (a < align0) wrong++;
    }
    console.log("SIM cases right", right, "wrong", wrong);
    expect(right).toBeGreaterThan(0);
    expect(wrong).toBeGreaterThan(0);
  });

  it("ปลอมตัว เอกสารปลอม และทำลายหลักฐาน ลดการถูกตามจับได้", () => {
    let lowered = 0;
    for (let s = 1; s <= 30; s++) {
      const l = adult(3000 + s);
      l.stats.smarts = 75;
      l.flags.lastCrime = "ขโมย"; addHeat(l, 60);
      const h0 = Number(l.flags.heat);
      for (const id of ["mw_disguise", "mw_forge", "mw_cover"]) { l.doneThisYear = []; doActivity(l, id); }
      if (Number(l.flags.heat) < h0) lowered++;
    }
    expect(lowered).toBeGreaterThan(15);
  });

  it("ชีวิตสุ่ม 100 ชีวิตกับระบบข่าวลือ ไม่มีฉากตันและข้อมูลไม่พัง", () => {
    let heard = 0;
    for (let s = 1; s <= 100; s++) {
      const l = createLife({ seed: s * 4219, worldId: "murim" });
      worldOfLife(l);
      const r = { rng: s };
      let g = 0;
      while (l.alive && g++ < 110) { drain(l, r); if (!l.alive) break; ageUp(l); }
      heard += rumorsOf(l).length;
      expect(JSON.parse(JSON.stringify(l))).toEqual(l);
    }
    expect(heard).toBeGreaterThan(100);
  });
});
