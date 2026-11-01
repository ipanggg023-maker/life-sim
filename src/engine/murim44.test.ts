import { describe, expect, it } from "vitest";
import { loadMurimWorld } from "../content/murim";
import { loadSharedEvents } from "../content/shared";
import { worldOfLife } from "../content/murim/life/world";
import { ROUTES, applyRouteGifts, recordRoutes, routeGains, routeHints } from "../content/murim/life/routes";
import { ARCS, activeArcs, arcLine, carryArc } from "../content/murim/life/sideStories";
import "../content/murim/life/sideStories2";
import { startWarEra } from "../content/murim/world/war";
import { activitiesFor, activityLocked, doActivity } from "./activities";
import { allEvents, getEvent, visibleChoices } from "./events";
import { ageUp, createLife, resolveChoice, runEvent } from "./game";
import { nextFloat } from "./rng";
import { newSoul } from "./soul";
import type { Life } from "./types";

loadMurimWorld();
loadSharedEvents();

const base = (seed: number, age = 30): Life => {
  const l = createLife({ seed, worldId: "murim" });
  worldOfLife(l);
  l.age = age; l.queue = []; l.money = 500_000;
  return l;
};
const finish = (l: Life, pick = 0) => { let g = 0; while (l.queue.length && g++ < 20) { const o = visibleChoices(l, l.queue[0]); resolveChoice(l, o[Math.min(pick, o.length - 1)].index); } };

describe("เรื่องต่อเนื่องข้างทาง", () => {
  it("ทุกเรื่องเดินครบสี่ตอนได้ และลงเอยเป็นตอนจบ", () => {
    expect(ARCS.length).toBe(12);
    for (const a of ARCS) {
      const l = base(ARCS.indexOf(a) + 1);
      l.stats.health = 90; l.stats.smarts = 90; l.stats.luck = 90;
      l.flags[`ssS_${a.id}`] = 1; l.flags[`ssA_${a.id}`] = l.age;
      for (let n = 1; n <= 4; n++) {
        expect(getEvent(`ss.${a.id}.${n}`)!.when!(l), `${a.id} ตอน ${n}`).toBe(true);
        runEvent(l, `ss.${a.id}.${n}`);
        finish(l);
        l.age += 5;
      }
      expect(l.flags[`ssE_${a.id}`], a.id).toBeTruthy();
      expect(activeArcs(l).length).toBe(0);
    }
  });

  it("เลือกทิ้งตั้งแต่ต้นก็จบเรื่องได้ · ทุกตอนมีทางเลือกที่กดได้แม้ไม่มีเงิน", () => {
    const l = base(10);
    l.flags.ssS_jade = 1; l.flags.ssA_jade = l.age;
    runEvent(l, "ss.jade.1");
    finish(l, 2);
    expect(l.flags.ssE_jade).toBe("river");
    for (const e of allEvents().filter((x) => x.id.startsWith("ss.") && x.id !== "ss.inherit")) {
      const p = base(11);
      p.money = 0;
      runEvent(p, e.id);
      expect(visibleChoices(p, p.queue[0]).length, e.id).toBeGreaterThan(0);
    }
  });

  it("ตายกลางเรื่อง ทายาทรับเรื่องต่อที่ตอนเดิม · ไม่รับก็จบ", () => {
    const d = base(12);
    d.flags.ssS_ferry = 3; d.flags.ssA_ferry = 99;
    const n = base(13, 20);
    n.flags.plName = "บรรพบุรุษ";
    carryArc(d, n);
    expect(getEvent("ss.inherit")!.when!(n)).toBe(true);
    runEvent(n, "ss.inherit");
    finish(n);
    expect(arcLine(n)).toContain("3/4");
    expect(n.flags.ssCarry).toBeUndefined();
  });

  it("เล่นจริงหลายชีวิต: เรื่องเปิดและจบเองได้ ไม่เกินจำนวนจำกัด และไม่ค้าง", () => {
    const r = { rng: 7 };
    let started = 0, ended = 0, most = 0;
    for (let s = 1; s <= 40; s++) {
      const l = createLife({ seed: s * 97, worldId: "murim" });
      worldOfLife(l);
      for (let y = 0; y < 80 && l.alive; y++) {
        l.stats.health = Math.max(l.stats.health, 60);
        ageUp(l);
        let g = 0;
        while (l.queue.length && g++ < 80) { const o = visibleChoices(l, l.queue[0]); expect(o.length, l.queue[0].eventId).toBeGreaterThan(0); resolveChoice(l, o[Math.floor(nextFloat(r) * o.length)].index); }
      }
      const e = Object.keys(l.flags).filter((k) => k.startsWith("ssE_")).length;
      const n = e + activeArcs(l).length;
      started += n; ended += e; most = Math.max(most, n);
    }
    expect(most).toBeLessThanOrEqual(4);
    expect(started).toBeGreaterThan(40);
    expect(ended).toBeGreaterThan(20);
  });
});

describe("เส้นทางชีวิต", () => {
  it("ทุกทางบอกวิธีไปถึง · เคยปฏิเสธทูตแล้วยังกลับไปรับใช้เจ้าแคว้นได้ · เสมียนอำเภอเป็นทางเข้าราชการ", () => {
    for (const r of ROUTES) expect(r.how?.length, r.id).toBeGreaterThan(5);
    const l = base(30);
    startWarEra(l);
    l.flags.refusedLords = true;
    expect(activitiesFor(l).find((a) => a.id === "mw_join_lord") && !activityLocked(l, activitiesFor(l).find((a) => a.id === "mw_join_lord")!)).toBe(true);
    doActivity(l, "mw_join_lord");
    expect(l.queue[0].eventId).toBe("mw.war.recruit");
    expect(l.flags.refusedLords).toBeUndefined();
    finish(l);
    expect(l.flags.lord).toBeTruthy();
    const c = base(31);
    c.stats.smarts = 95; c.stats.luck = 95; Reflect.deleteProperty(c, "job");
    for (let i = 0; i < 12 && !c.flags.rtClerk; i++) { c.queue = []; delete c.seen["rt.clerk"]; runEvent(c, "rt.clerk"); finish(c); }
    expect((c as Life).job?.careerId).toBe("official");
    expect(ROUTES.find((r) => r.id === "court")!.tier(c)).toBeGreaterThanOrEqual(1);
  });

  it("นับจากสิ่งที่ทำจริง เก็บข้ามชีวิต และแนะนำทางที่ยังไม่เคยเดิน", () => {
    const s = newSoul();
    const l = base(20);
    l.money = 0;
    expect(routeGains(s, l).length).toBe(0);
    l.money = 6000 * 1000;
    l.flags.m17Align = 65; l.fame = 60;
    const got = routeGains(s, l).map((g) => [g.r.id, g.tier]);
    expect(got).toContainEqual(["wealth", 2]);
    expect(got).toContainEqual(["good", 3]);
    recordRoutes(s, l);
    expect(s.routes!.good).toBe(3);
    expect(routeGains(s, l).length).toBe(0);
    const hints = routeHints(s, l);
    expect(hints.length).toBe(3);
    expect(hints.map((h) => h.name)).not.toContain("คนดีของแผ่นดิน");
  });

  it("พรของทางที่เดินครบมีเพดาน แม้ครบทุกทาง", () => {
    const s = newSoul();
    s.routes = Object.fromEntries(ROUTES.map((r) => [r.id, 3]));
    const l = base(21);
    const before = { ...l.stats };
    applyRouteGifts(l, s);
    for (const k of Object.keys(before) as (keyof typeof before)[]) expect(l.stats[k] - before[k]).toBeLessThanOrEqual(6);
  });
});
