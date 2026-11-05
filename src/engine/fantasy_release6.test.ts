import { describe, expect, it } from "vitest";
import { loadFantasyWorld } from "../content/fantasy";
import { fantasyPersonActions } from "../content/fantasy/bonds";
import { upkeepOf } from "../content/fantasy/economy";
import { STAFF, marriageBlock, staffOf, stageOf, sworn } from "../content/fantasy/people3";
import { fl } from "../content/fantasy/state";
import { personActions } from "../content/murim/life/kinship";
import { timeUsed } from "./activities";
import { getEvent, labelOf, visibleChoices } from "./events";
import { ageUp, createLife, propose, resolveChoice, runEvent } from "./game";
import { relOf, remember } from "./npc";
import type { Life } from "./types";
import { createPerson } from "./util";

loadFantasyWorld();
const life = (seed: number, age = 25): Life => {
  const l = createLife({ seed, worldId: "fantasy", plain: true });
  l.age = age; l.queue = []; l.money = 100_000; l.flags.ftStarsSeen = true; l.stats.health = 90;
  return l;
};
const choose = (l: Life, re: RegExp) => {
  const q = l.queue[0], ev = getEvent(q.eventId)!;
  const sc = q.scene && ev.scenes ? ev.scenes[q.scene] : ev;
  const o = visibleChoices(l, q).find((x) => re.test(labelOf(sc.choices![x.index], l, q.ctx)));
  if (!o) throw new Error(`no choice ${re} in ${q.eventId}`);
  return resolveChoice(l, o.index);
};

describe("ความรักเป็นขั้น", () => {
  it("คนที่เพิ่งจีบกันยังขอแต่งงานไม่ได้ ต้องคบกันจริงจังก่อน", () => {
    const l = life(1);
    const p = createPerson(l, "partner", { gender: l.gender === "m" ? "f" : "m", age: 25, bond: 90 });
    expect(stageOf(p)).toBe("courting");
    expect(marriageBlock(l)).toBeTruthy();
    expect(propose(l, p).text).toMatch(/คบกันจริงจัง/);
    runEvent(l, "ft.lv.together", { pid: p.id }); choose(l, /คบกันจริงจัง/);
    expect(stageOf(p)).toBe("together");
    expect(marriageBlock(l)).toBeUndefined();
  });
  it("ไปเที่ยวด้วยกันนับเป็นเดต และไม่ได้ไปไหนด้วยกันนานเกินไป ความรักเย็นลง", () => {
    const l = life(2);
    const p = createPerson(l, "spouse", { gender: l.gender === "m" ? "f" : "m", age: 25, bond: 70 });
    const date = fantasyPersonActions(l, p).find((a) => a.id === "date")!;
    date.run(l);
    expect(p.tags).toContain(`dated:${l.age}`);
    l.queue = []; l.age += 4;
    let cold = false;
    for (let i = 0; i < 20 && !cold; i++) { l.queue = []; ageUp(l); cold = l.seen["ft.lv.cold"] > 0; }
    expect(cold).toBe(true);
  });
});

describe("เวลาและผู้คน", () => {
  it("การใช้เวลากับคนกินเวลาของปีเดียวกับกิจกรรม", () => {
    const l = life(3);
    const f = createPerson(l, "friend", { age: 25, bond: 60 });
    const before = timeUsed(l);
    personActions(l, f).find((a) => !a.locked && a.id !== "letter")!.run(l);
    expect(timeUsed(l)).toBe(before + 1);
  });
  it("แนะนำเพื่อนสองคนที่มีเรื่องกับคุณ ความแค้นเบาลง", () => {
    const l = life(4);
    const a = createPerson(l, "friend", { age: 25, bond: 60 }), b = createPerson(l, "friend", { age: 26, bond: 55 });
    remember(l, a, "x", "เรื่องเก่า", 2, { grudge: 40 });
    const g0 = relOf(a).grudge;
    runEvent(l, "ft.pp.intro", { pid: a.id });
    choose(l, new RegExp(`พา${b.name.split(" ")[0]}`));
    expect(relOf(a).grudge).toBeLessThan(g0);
  });
});

describe("มิตรภาพ การหักหลัง และความโศก", () => {
  it("เพื่อนที่ผูกพันมากขอสาบานเป็นพี่น้อง", () => {
    const l = life(5);
    const f = createPerson(l, "friend", { age: 25, bond: 90 });
    runEvent(l, "ft.pp.sworn", { pid: f.id }); choose(l, /กรีดมือ/);
    expect(sworn(f)).toBe(true);
  });
  it("เพื่อนที่อิจฉามากมีสัญญาณก่อนหักหลัง และถ้าเฝ้าดูไว้จะจับได้", () => {
    const l = life(6);
    const f = createPerson(l, "friend", { age: 25, bond: 50 });
    remember(l, f, "x", "อิจฉา", 3, { jealousy: 70 });
    f.tags = [...(f.tags ?? []), "turning", "watched"];
    const money = l.money;
    runEvent(l, "ft.pp.betray");
    expect(l.queue[0].ctx.caught).toBe(1);
    resolveChoice(l, 0);
    expect(l.money).toBe(money);
  });
  it("คนใกล้ตัวจากไป ความโศกอยู่หลายปีและถามว่าคุณจะรับมืออย่างไร", () => {
    const l = life(7, 40);
    const f = createPerson(l, "friend", { age: 40, bond: 80 });
    f.alive = false;
    l.queue = []; ageUp(l);
    expect(l.flags.ftGrief).toBe(f.id);
    expect(l.queue.some((q) => q.eventId === "ft.pp.grief")).toBe(true);
  });
});

describe("คนในบ้าน", () => {
  it("พ่อบ้านลดค่าดูแลของใหญ่ และรับค่าจ้างทุกปี", () => {
    const l = life(8, 40);
    l.flags.ftHome = 4; fl(l).estates = { tower: 0 };
    const u0 = upkeepOf(l);
    runEvent(l, "ft.pp.hire"); choose(l, /พ่อบ้าน/);
    expect(staffOf(l, "steward")).toBeTruthy();
    expect(upkeepOf(l)).toBeLessThan(u0);
    const m = l.money; l.queue = []; ageUp(l);
    expect(l.money).toBeLessThanOrEqual(m - STAFF.steward.wage * 100 + 1_000_000);
  });
});
