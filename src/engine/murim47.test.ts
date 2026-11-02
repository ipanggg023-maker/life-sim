import { describe, expect, it } from "vitest";
import { loadMurimWorld } from "../content/murim";
import { loadSharedEvents } from "../content/shared";
import { disciplesOf } from "../content/murim/life/generations";
import { isSovereign, personActions } from "../content/murim/life/kinship";
import { ROUTES } from "../content/murim/life/routes";
import { worldOfLife } from "../content/murim/life/world";
import { courtOf } from "../content/murim/world/court";
import { activitiesFor, activityLocked } from "./activities";
import { getEvent, labelOf, visibleChoices } from "./events";
import { ageUp, createLife, propose, resolveChoice, runEvent } from "./game";
import type { Life, Person } from "./types";
import { createPerson, people } from "./util";

loadMurimWorld();
loadSharedEvents();

const life = (seed: number, age: number, gender: "m" | "f"): Life => {
  const l = createLife({ seed, worldId: "murim", gender });
  worldOfLife(l);
  l.age = age; l.queue = []; l.money = 500_000;
  l.stats.health = 100; l.stats.smarts = 90; l.stats.looks = 90;
  return l;
};
const force = (l: Life, start: string, ok = true) => {
  const q = l.queue[0];
  const o = visibleChoices(l, q).find((x) => labelOf(x.c, l, q.ctx).startsWith(start));
  expect(o, `ไม่มี "${start}" ใน ${q.eventId}`).toBeTruthy();
  const out = o!.c.run(l, q.ctx, ok);
  l.queue = [];
  return out;
};
const lady = (seed: number) => { const l = life(seed, 20, "f"); runEvent(l, "qn.selection"); force(l, "เข้ารับการคัดเลือกด้วยรูปโฉม"); return l; };
const sov = (l: Life) => l.people.find((p) => p.alive && isSovereign(p));
const can = (l: Life, id: string) => { const a = activitiesFor(l).find((x) => x.id === id); return !!a && !activityLocked(l, a); };

describe("ฮ่องเต้เป็นคู่ชีวิตจริง", () => {
  it("เข้าวังแล้วมีฮ่องเต้ในรายชื่อ ชื่อตรงกับราชสำนัก และแตะเหตุการณ์ชีวิตธรรมดาไม่ได้", () => {
    const l = lady(1);
    expect(sov(l)?.name).toBe(courtOf(l).emperor.name);
    expect(sov(l)?.relation).toBe("spouse");
    expect(personActions(l, sov(l)!).map((a) => a.id)).toEqual(["audience"]);
    expect(getEvent("lv.spouse_cheats") && getEvent("hh.quarrel")).toBeTruthy();
  });

  it("เข้าเฝ้าเพิ่มความโปรดปราน และความผูกพันตามความโปรดปราน", () => {
    const l = lady(2);
    const before = Number(l.flags.qnFavor);
    runEvent(l, "qn.audience");
    force(l, "ถวายคำปรึกษา");
    expect(Number(l.flags.qnFavor)).toBe(before + 10);
    ageUp(l); l.queue = [];
    expect(sov(l)!.bond).toBe(Number(l.flags.qnFavor));
  });

  it("ฮ่องเต้สวรรคตแล้วคนในรายชื่อเสียชีวิตตาม และมีเรื่องผลัดแผ่นดิน", () => {
    const l = lady(3);
    const p = sov(l)!;
    courtOf(l).emperor.name = "ฮ่องเต้องค์ใหม่";
    ageUp(l); l.queue = [];
    expect(p.alive).toBe(false);
    expect(getEvent("qn.widow")!.when!(l)).toBe(true);
  });

  it("ดันลูกชายขึ้นครองราชย์ได้ เป็นไทเฮา และมีผู้สำเร็จราชการถ้าลูกยังเล็ก", () => {
    const l = lady(4);
    const k = createPerson(l, "child", { age: 7, gender: "m", bond: 80 });
    k.tags = ["royal"];
    courtOf(l).emperor.name = "ฮ่องเต้องค์ใหม่";
    runEvent(l, "qn.widow");
    force(l, "ผลักดันองค์ชาย");
    expect(courtOf(l).emperor.name).toContain(k.name);
    expect(courtOf(l).regent).toContain("ไทเฮา");
    expect(l.flags.qnRank).toBe(5);
    expect(getEvent("qn.widow")!.when!(l)).toBe(false);
  });

  it("ออกจากวังแล้วฮ่องเต้หายจากรายชื่อ", async () => {
    const { leavePalace } = await import("../content/murim/world/consortLife");
    const l = lady(5);
    leavePalace(l);
    expect(sov(l)).toBeUndefined();
  });
});

describe("ราชบุตรเขย", () => {
  const fuma = (seed: number) => { const l = life(seed, 22, "m"); runEvent(l, "qn.pc_select"); force(l, "ตอบปัญหา"); return l; };

  it("เฉพาะชายโสดถวายตัวได้ ได้ภรรยาเป็นองค์หญิงและเข้าวังได้", () => {
    const f = life(10, 22, "f");
    expect(can(f, "mw_pc_enter")).toBe(false);
    const m = life(11, 22, "m");
    expect(can(m, "mw_pc_enter")).toBe(true);
    const l = fuma(12);
    expect(l.flags.palaceAccess).toBe(true);
    expect(people(l, "spouse")[0].name).toContain("องค์หญิง");
    expect(can(l, "mw_pc")).toBe(true);
  });

  it("แต่งซ้อนไม่ได้และหย่าไม่ได้ผ่านการขอแต่งงาน", () => {
    const l = fuma(13);
    const p = createPerson(l, "partner", { age: 25, gender: "f", bond: 100 });
    propose(l, p);
    expect(p.relation).toBe("partner");
  });

  it("เลื่อนขั้นด้วยความไว้วางใจ แล้วยึดบัลลังก์ได้", () => {
    const l = fuma(14);
    l.flags.pcTrust = 80;
    for (const n of [1, 2]) { runEvent(l, "qn.pc_promote"); force(l, "รับด้วยความถ่อมตน"); expect(l.flags.pcRank).toBe(n); }
    expect(ROUTES.find((r) => r.id === "fuma")!.tier(l)).toBe(3);
    runEvent(l, "qn.pc_menu");
    force(l, "ยึดอำนาจ");
    expect(l.flags.emperorSelf).toBe(true);
    expect(l.flags.pcRank).toBeUndefined();
  });

  it("ถูกจับได้ครั้งแรกเสียตำแหน่ง องค์หญิงจากไป", () => {
    const l = fuma(15);
    l.flags.pcAccused = true;
    runEvent(l, "qn.pc_accused");
    visibleChoices(l, l.queue[0])[0].c.run(l, l.queue[0].ctx, false);
    expect(l.flags.pcRank).toBeUndefined();
    expect(people(l, "spouse").some((p) => p.alive)).toBe(false);
    expect(l.flags.palaceAccess).toBeUndefined();
  });
});

describe("การกระทำรายคน", () => {
  const act = (l: Life, p: Person, id: string) => { const a = personActions(l, p).find((x) => x.id === id); expect(a, id).toBeTruthy(); a!.run(l); };

  it("ปุ่มขึ้นตามความสัมพันธ์ และทำได้ปีละครั้ง", () => {
    const l = life(20, 40, "m");
    const kid = createPerson(l, "child", { age: 10, bond: 70 });
    act(l, kid, "raise");
    expect(personActions(l, kid)[0].locked).toBeTruthy();
    expect(personActions(l, createPerson(l, "child", { age: 3, bond: 70 }))).toEqual([]);
    expect(personActions(l, createPerson(l, "child", { age: 20, bond: 70 }))[0].id).toBe("match");
  });

  it("ลูกที่อบรมมาดีได้งานตอนอายุ 18", () => {
    const l = life(21, 40, "m");
    const k = createPerson(l, "child", { age: 17, bond: 70 });
    k.tags = ["edu:3"];
    ageUp(l);
    expect(k.job).toBe("ขุนนางท้องถิ่น");
  });

  it("หาคู่ให้ลูกแล้วปุ่มหายไป", () => {
    const l = life(22, 45, "f");
    const k = createPerson(l, "child", { age: 20, bond: 70 });
    act(l, k, "match");
    resolveChoice(l, visibleChoices(l, l.queue[0]).find((x) => labelOf(x.c, l, l.queue[0].ctx).startsWith("ให้ลูกเลือกเอง"))!.index);
    expect(personActions(l, k)).toEqual([]);
  });

  it("คารวะอาจารย์ได้ทุก 3 ปี", () => {
    const l = life(23, 30, "m");
    const m = createPerson(l, "ally", { age: 60, bond: 70 });
    m.tags = ["master"];
    act(l, m, "master");
    resolveChoice(l, visibleChoices(l, l.queue[0]).at(-1)!.index);
    l.doneThisYear = [];
    expect(personActions(l, m)[0].locked).toBe("อีก 3 ปี");
  });

  it("ศิษย์เอกมีได้คนเดียว และขึ้นก่อนในการสืบต่อ", () => {
    const l = life(24, 50, "m");
    const a = createPerson(l, "ally", { age: 25, bond: 70 }), b = createPerson(l, "ally", { age: 26, bond: 70 });
    a.tags = ["disciple"]; b.tags = ["disciple"];
    for (const p of [a, b]) {
      act(l, p, "disciple");
      resolveChoice(l, visibleChoices(l, l.queue[0]).find((x) => labelOf(x.c, l, l.queue[0].ctx).startsWith("แต่งตั้ง"))!.index);
    }
    expect(a.tags).not.toContain("chosen");
    expect(disciplesOf(l)[0].id).toBe(b.id);
  });
});
