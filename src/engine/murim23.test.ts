import { describe, expect, it } from "vitest";
import { loadMurimWorld } from "../content/murim";
import { loadSharedEvents } from "../content/shared";
import { darkTargets, hireOdds, poisonOdds } from "../content/murim/life/darkDeeds";
import { inheritMurim } from "../content/murim/life/generations";
import { worldOfLife } from "../content/murim/life/world";
import { courtOf } from "../content/murim/world/court";
import { palaceOf } from "../content/murim/world/palace";
import { getEvent, labelOf, visibleChoices } from "./events";
import { createLife, resolveChoice, runEvent } from "./game";
import { nextFloat } from "./rng";
import { buildHeir } from "./soul";
import type { Life } from "./types";
import { createPerson } from "./util";
import { validateLife } from "./validate";

loadMurimWorld();
loadSharedEvents();

const adult = (seed: number) => {
  const l = createLife({ seed, worldId: "murim" });
  worldOfLife(l);
  l.age = 35; l.money = 2_000_000; l.stats.smarts = 75;
  l.power = { rank: 3, hunterClass: "m_sword", level: 30, exp: 0, skills: [], gates: 0, bossKills: 0, awakenedAt: 12, items: [] };
  createPerson(l, "spouse", { age: 33, bond: 60 });
  createPerson(l, "child", { age: 10, bond: 70 });
  createPerson(l, "child", { age: 8, bond: 70 });
  createPerson(l, "friend", { age: 35, bond: 50 });
  palaceOf(l);
  return l;
};
/** เปิดเมนู เลือกเป้าหมายตาม id แล้วเลือกวิธีที่ขึ้นต้นด้วยข้อความนี้ */
function deed(l: Life, tid: string, method: string) {
  runEvent(l, "dk.menu");
  const t = darkTargets(l).findIndex((x) => x.id === tid);
  const o = visibleChoices(l, l.queue[0]);
  resolveChoice(l, o[t].index);
  const m = visibleChoices(l, l.queue[0]).find((x) => labelOf(x.c, l, l.queue[0].ctx).startsWith(method))!;
  return resolveChoice(l, m.index);
}
function drain(l: Life, r: { rng: number }) {
  let g = 0;
  while (l.queue.length && g++ < 60) { const o = visibleChoices(l, l.queue[0]); expect(o.length, l.queue[0].eventId).toBeGreaterThan(0); resolveChoice(l, o[Math.floor(nextFloat(r) * o.length)].index); }
}

describe("ด้านมืด: เลือกเป้าหมายใครก็ได้ · โอกาสตามการคุ้มกัน · ถูกจับ = ประหารและกวาดล้างตระกูล", () => {
  it("เป้าหมายมีทั้งครอบครัว คนรู้จัก และราชสำนัก · ยิ่งสูงยิ่งยาก (ฮ่องเต้แทบเป็นไปไม่ได้)", () => {
    const l = adult(1);
    const ts = darkTargets(l);
    const spouse = ts.find((t) => t.id === l.people.find((p) => p.relation === "spouse")!.id)!;
    const emperor = ts.find((t) => t.id === "court:emperor")!;
    expect(spouse).toBeTruthy();
    expect(emperor).toBeTruthy();
    expect(ts.every((t) => /♂|♀|\(/.test(t.label))).toBe(true);
    expect(poisonOdds(l, spouse)).toBeGreaterThan(0.6);
    expect(poisonOdds(l, emperor)).toBeLessThan(0.08);
    expect(hireOdds(l, emperor)).toBeLessThan(0.05);
  });

  it("ฆ่าคนในครอบครัวได้จริง — ตายจริง ทิ้งร่องรอยในใจคนที่เหลือ", () => {
    let killed = 0;
    for (let s = 1; s <= 30; s++) {
      const l = adult(100 + s);
      const spouse = l.people.find((p) => p.relation === "spouse")!;
      deed(l, spouse.id, "วางยา");
      if (!spouse.alive) { killed++; expect(Number(l.flags.kinslayer)).toBe(1); }
      expect(validateLife(l)).toEqual([]);
    }
    expect(killed).toBeGreaterThan(15);
  });

  it("ลอบสังหารฮ่องเต้แล้วถูกจับ = ประหาร ทั้งตระกูลถูกกวาดล้าง ลูกบางคนหนีรอดไปเป็นเรื่องของรุ่นถัดไป", () => {
    let purged = 0, escapedHeir: Life | undefined;
    for (let s = 1; s <= 60 && !escapedHeir; s++) {
      const l = adult(200 + s);
      deed(l, "court:emperor", "วางยา");
      if (l.alive) continue;
      purged++;
      expect(l.causeOfDeath).toContain("ประหาร");
      expect(l.people.filter((p) => p.relation === "spouse").every((p) => !p.alive)).toBe(true);
      const kid = l.people.find((p) => p.relation === "child" && p.alive);
      if (!kid) continue;
      expect(kid.tags).toContain("escaped_purge");
      const heir = buildHeir(l, kid.id);
      inheritMurim(l, heir, "heir", kid.id);
      heir.age = 15;
      expect(getEvent("dk.purge_heir")!.when!(heir)).toBe(true);
      escapedHeir = heir;
    }
    expect(purged).toBeGreaterThan(0);
    expect(escapedHeir).toBeTruthy();
  });

  it("ลอบสังหารคนธรรมดาแล้วถูกจับ = ขึ้นศาล ไม่ถึงกับกวาดล้างตระกูล · สำเร็จกับราชสำนัก = ฮ่องเต้สวรรคตจริง", () => {
    let trial = 0;
    for (let s = 1; s <= 40; s++) {
      const l = adult(300 + s);
      const f = l.people.find((p) => p.relation === "friend")!;
      deed(l, f.id, "ลงมือด้วยมือตัวเอง");
      if (l.queue.some((q) => q.eventId === "cr.trial")) { trial++; expect(l.alive).toBe(true); }
    }
    expect(trial).toBeGreaterThan(3);
    // บังคับให้สำเร็จ: ราชสำนักต้องผลัดแผ่นดินจริง
    const l = adult(9);
    l.stats.smarts = 100; l.job = { careerId: "poisoner", level: 5, performance: 80, years: 10 };
    let dead = false;
    for (let s = 0; s < 200 && !dead; s++) { const x = adult(5000 + s); x.stats.smarts = 100; x.job = l.job; deed(x, "court:emperor", "วางยา"); if (courtOf(x).emperor.health === 0) dead = true; }
    expect(dead).toBe(true);
  });

  it("ข่าวป่วยหนักของคนในครอบครัวตายจริงได้ (ไม่ใช่แค่ข้อความ)", () => {
    let spouseDied = 0, kidDied = 0;
    for (let s = 1; s <= 80; s++) {
      const l = adult(600 + s);
      l.age = 60;
      const sp = l.people.find((p) => p.relation === "spouse")!;
      sp.age = 60;
      runEvent(l, "el.e.spouse_ill", { pid: sp.id });
      const work = visibleChoices(l, l.queue[0]).find((o) => labelOf(o.c, l, l.queue[0].ctx).startsWith("ทำงานต่อ"))!;
      resolveChoice(l, work.index);
      if (!sp.alive) spouseDied++;
      const k = adult(700 + s);
      const kid = k.people.find((p) => p.relation === "child")!;
      runEvent(k, "d.h.child_sick", { pid: kid.id });
      const herbs = visibleChoices(k, k.queue[0]).find((o) => labelOf(o.c, k, k.queue[0].ctx).startsWith("ต้มยา"))!;
      resolveChoice(k, herbs.index);
      if (!kid.alive) kidDied++;
    }
    expect(spouseDied).toBeGreaterThan(15);
    expect(kidDied).toBeGreaterThan(10);
  });

  it("ใช้เมนูด้านมืดแบบสุ่มกับทุกเป้าหมาย ไม่มีฉากตันและสถานะไม่เสีย", () => {
    for (let s = 1; s <= 60; s++) {
      const l = adult(800 + s);
      const r = { rng: s };
      runEvent(l, "dk.menu");
      drain(l, r);
      expect(validateLife(l)).toEqual([]);
      expect(JSON.parse(JSON.stringify(l))).toEqual(l);
    }
  });
});
