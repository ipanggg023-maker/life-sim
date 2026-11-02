import { describe, expect, it } from "vitest";
import { loadMurimWorld } from "../content/murim";
import { loadSharedEvents } from "../content/shared";
import { worldOfLife } from "../content/murim/life/world";
import { courtOf } from "../content/murim/world/court";
import { kingdoms, startWarEra } from "../content/murim/world/war";
import { activitiesFor, activityLocked, doActivity } from "./activities";
import { getEvent, labelOf, visibleChoices } from "./events";
import { ageUp, choiceChance, createLife, resolveChoice, runEvent } from "./game";
import { nextFloat } from "./rng";
import type { Life } from "./types";
import { createPerson } from "./util";

loadMurimWorld();
loadSharedEvents();

const lady = (seed: number, age = 18): Life => {
  const l = createLife({ seed, worldId: "murim", gender: "f" });
  worldOfLife(l);
  l.age = age; l.queue = []; l.money = 500_000;
  l.stats.looks = 95; l.stats.smarts = 95; l.stats.health = 90; l.stats.luck = 90;
  return l;
};
function choose(l: Life, start: string) {
  const o = visibleChoices(l, l.queue[0]).find((x) => labelOf(x.c, l, l.queue[0].ctx).startsWith(start));
  expect(o, `ไม่มี "${start}" ใน ${l.queue[0]?.eventId}`).toBeTruthy();
  resolveChoice(l, o!.index);
}
const enter = (l: Life) => { for (let i = 0; i < 20 && l.flags.qnRank === undefined; i++) { l.queue = []; l.seen["qn.selection"] = 0; runEvent(l, "qn.selection"); choose(l, "เข้ารับการคัดเลือกด้วยรูปโฉม"); } };

describe("เส้นทางฮองเฮา", () => {
  it("เฉพาะหญิงโสดเข้าคัดเลือกได้ เข้าวังแล้วหางานนอกไม่ได้", () => {
    const m = createLife({ seed: 1, worldId: "murim", gender: "m" });
    worldOfLife(m); m.age = 18; m.queue = [];
    const can = (l: Life) => { const a = activitiesFor(l).find((x) => x.id === "mw_consort_enter"); return !!a && !activityLocked(l, a); };
    expect(can(m)).toBe(false);
    const l = lady(2);
    expect(can(l)).toBe(true);
    createPerson(l, "spouse", { age: 20, gender: "m", bond: 60 });
    expect(can(l)).toBe(false);
    const f = lady(3);
    enter(f);
    expect(f.flags.qnRank).toBe(0);
    expect(f.flags.palaceAccess).toBe(true);
  });

  it("ขึ้นตำแหน่งด้วยความโปรดปราน โค่นฮองเฮาได้ แล้วเป็นไทเฮาตอนผลัดแผ่นดิน และขึ้นเป็นจักรพรรดินีได้", () => {
    const l = lady(4);
    enter(l);
    l.flags.qnFavor = 90;
    for (let i = 0; i < 3; i++) { expect(getEvent("qn.promote")!.when!(l)).toBe(true); runEvent(l, "qn.promote"); choose(l, "รับด้วยความถ่อมตน"); }
    expect(l.flags.qnRank).toBe(3);
    l.flags.qnSons = 3; l.flags.schemeHeat = 0; l.stats.smarts = 100; l.flags.qnFavor = 100;
    for (let i = 0; i < 30 && Number(l.flags.qnRank) < 4; i++) { l.queue = []; l.flags.qnAccused = false; delete l.flags.qnAccused; runEvent(l, "qn.menu"); choose(l, "โค่นฮองเฮา"); l.queue = []; }
    expect(l.flags.qnRank).toBe(4);
    expect(courtOf(l).empress.name).toContain(l.firstName);
    courtOf(l).emperor.name = "ฮ่องเต้องค์ใหม่";
    expect(getEvent("qn.widow")!.when!(l)).toBe(true);
    runEvent(l, "qn.widow"); choose(l, "รับฐานันดรไทเฮา");
    expect(l.flags.qnRank).toBe(5);
    l.fame = 100; l.flags.schemeHeat = 0;
    for (let i = 0; i < 40 && l.alive && !l.flags.emperorSelf; i++) { l.queue = []; l.seen["qn.regnant"] = 0; const o = visibleChoices({ ...l } as Life, { eventId: "qn.regnant", ctx: {} } as never); void o; runEvent(l, "qn.regnant"); const c = visibleChoices(l, l.queue[0])[0]; c.c.run(l, l.queue[0].ctx, true); l.queue = []; }
    expect(l.flags.emperorSelf).toBe(true);
  });

  it("ถูกกล่าวหา: โอกาสรอดขึ้นกับความสามารถ · ดิ้นไม่หลุดครั้งแรกตำหนักเย็น ครั้งสองแพรขาว", () => {
    const smart = lady(5); enter(smart); smart.flags.qnAccused = true;
    const dull = lady(6); enter(dull); dull.stats.smarts = 10; dull.flags.qnAccused = true;
    runEvent(smart, "qn.accused"); runEvent(dull, "qn.accused");
    const first = (l: Life) => choiceChance(l, l.queue[0], visibleChoices(l, l.queue[0])[0].index)!;
    expect(first(smart)).toBeGreaterThan(first(dull) + 0.2);
    const q = dull.queue[0];
    expect(visibleChoices(dull, q).length).toBeGreaterThanOrEqual(5);
    const c = visibleChoices(dull, q)[0].c;
    c.run(dull, q.ctx, false);
    expect(dull.flags.qnCold).toBe(true);
    delete dull.flags.qnCold; dull.queue = []; dull.flags.qnAccused = true;
    runEvent(dull, "qn.accused");
    visibleChoices(dull, dull.queue[0])[0].c.run(dull, dull.queue[0].ctx, false);
    expect(getEvent("qn.silk")!.when!(dull)).toBe(true);
  });

  it("เล่นสุ่มในวังหลังไม่ค้าง ทุกฉากมีทางเลือก", () => {
    const r = { rng: 3 };
    const seen = new Set<string>();
    for (let s = 1; s <= 40; s++) {
      const l = lady(100 + s, 18);
      enter(l);
      for (let y = 0; y < 50 && l.alive; y++) {
        l.stats.health = Math.max(l.stats.health, 60);
        const a = activitiesFor(l).find((x) => x.id === "mw_consort");
        if (a && !activityLocked(l, a)) doActivity(l, a.id);
        let g = 0;
        const drain = () => { while (l.queue.length && g++ < 80) { const q = l.queue[0]; seen.add(q.eventId); const o = visibleChoices(l, q); expect(o.length, q.eventId).toBeGreaterThan(0); resolveChoice(l, o[Math.floor(nextFloat(r) * o.length)].index); } };
        drain();
        if (!l.alive) break;
        ageUp(l); g = 0;
        drain();
      }
    }
    expect([...seen].filter((x) => x.startsWith("qn.")).length).toBeGreaterThanOrEqual(6);
  });

  it("แปรพักตร์สำเร็จแล้วไปอยู่กับแคว้นศัตรูจริง", () => {
    const l = lady(51, 30);
    startWarEra(l);
    l.flags.lord = kingdoms(l)[0].id;
    const old = l.flags.lord;
    runEvent(l, "bt.lord");
    const c = visibleChoices(l, l.queue[0]).find((x) => labelOf(x.c, l, l.queue[0].ctx).startsWith("แปรพักตร์"))!.c;
    c.run(l, l.queue[0].ctx, true);
    expect(l.flags.lord).toBeTruthy();
    expect(l.flags.lord).not.toBe(old);
  });
});

describe("การหักหลังนอกวัง", () => {
  it("ขายพี่น้องร่วมสาบานได้ ผลร้ายตามจริง · แปรพักตร์แล้วนายเก่าหลุดจริง", () => {
    const l = lady(50, 30);
    const p = createPerson(l, "friend", { age: 30, gender: "m", bond: 90 });
    p.tags = ["sworn"];
    runEvent(l, "bt.sworn", { pid: p.id });
    const c = visibleChoices(l, l.queue[0]).find((x) => labelOf(x.c, l, l.queue[0].ctx).startsWith("ขายที่อยู่"))!.c;
    c.run(l, l.queue[0].ctx, true);
    expect(p.alive).toBe(false);
  });
});
