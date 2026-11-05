import { describe, expect, it } from "vitest";
import { loadFantasyWorld } from "../content/fantasy";
import { knows } from "../content/fantasy/bestiary";
import { DANGER_EVENTS, FEAR_PENALTY, INJURIES, addInjury, afflict, wound } from "../content/fantasy/danger";
import { combat } from "../content/fantasy/power";
import { fl, homeKingdom } from "../content/fantasy/state";
import { ACTIVITIES, doActivity } from "./activities";
import { currentScene, getEvent, labelOf } from "./events";
import { ageUp, createLife, oddsOf, resolveChoice, runEvent } from "./game";
import type { Life } from "./types";

loadFantasyWorld();
const life = (seed: number, age = 25): Life => {
  const l = createLife({ seed, worldId: "fantasy", plain: true });
  l.age = age; l.queue = []; l.money = 100_000; l.flags.ftStarsSeen = true; l.stats.health = 90;
  return l;
};
const labels = (l: Life) => { const q = l.queue[0]; const s = currentScene(q, l)!; return s.choices.filter((c) => !c.show || c.show(l, q.ctx)).map((c) => labelOf(c, l, q.ctx)); };
/** เลือกทางตามชื่อ และกำหนดผลเอง (สำเร็จ/พลาด) · ไปฉากต่อถ้ามี */
const pickRun = (l: Life, re: RegExp, ok = true) => {
  const q = l.queue[0], s = currentScene(q, l)!;
  const c = s.choices.find((x) => (!x.show || x.show(l, q.ctx)) && re.test(labelOf(x, l, q.ctx)));
  if (!c) throw new Error(`no choice ${re} in ${q.eventId}/${q.scene ?? "start"}: ${labels(l).join(" | ")}`);
  const out = c.run(l, q.ctx, ok);
  if (out.next) q.scene = out.next; else l.queue.shift();
  return out;
};
const year = (l: Life, acts = "") => { l.queue = []; l.doneThisYear = acts ? acts.split("|") : []; ageUp(l); };

describe("ศึกใหญ่หลายจังหวะ และสัตว์คู่อาฆาต", () => {
  it("ศึกกับคู่อาฆาตมีสามจังหวะ ใช้ท่าหรือยาในจังหวะกลาง แล้วตัดสินตอนจบ", () => {
    const l = life(1); fl(l).nemesis = { name: "หมาป่าเขาเดียวตาข้างเดียว", power: 30, met: 1, last: 10 };
    fl(l).potions = { strength: 1, life: 1 };
    runEvent(l, "ft.dg.nemesis");
    pickRun(l, /บุกเข้าใส่/);
    expect(l.queue[0].scene).toBe("turn");
    pickRun(l, /ยาเพิ่มพลัง/);
    expect(fl(l).potions!.strength).toBe(0);
    expect(l.queue[0].scene).toBe("end");
    expect(Number(l.queue[0].ctx.edge)).toBeGreaterThan(0.1);
    pickRun(l, /ปิดฉาก/, false);
    expect(fl(l).nemesis!.power).toBeGreaterThan(30);
    expect(fl(l).fear).toBe(true);
  });
  it("คู่อาฆาตกลับมาเมื่อครบกำหนด และชนะแล้วจบเรื่อง", () => {
    const l = life(2, 30); fl(l).nemesis = { name: "หมีถ้ำหลังเงิน", power: 20, met: 2, last: 24 };
    expect(getEvent("ft.dg.nemesis")!.when!(l)).toBe(true);
    runEvent(l, "ft.dg.nemesis"); pickRun(l, /ตั้งรับ/); pickRun(l, /สู้ต่อ/); pickRun(l, /ปิดฉาก/, true);
    expect(fl(l).nemesis!.dead).toBe(true);
    expect(fl(l).deeds.some((d) => d.includes("หมีถ้ำหลังเงิน"))).toBe(true);
    expect(getEvent("ft.dg.nemesis")!.when!(l)).toBe(false);
  });
  it("ความกลัวลดโอกาสชนะ จนกว่าจะชนะได้อีกครั้ง", () => {
    const l = life(3); fl(l).nemesis = { name: "x", power: 30, met: 1, last: 0 };
    runEvent(l, "ft.dg.nemesis"); pickRun(l, /บุกเข้าใส่/); pickRun(l, /สู้ต่อ/);
    const fin = currentScene(l.queue[0], l)!.choices[0];
    const p0 = oddsOf(l, fin, l.queue[0].ctx)!;
    fl(l).fear = true;
    expect(oddsOf(l, fin, l.queue[0].ctx)!).toBeCloseTo(p0 - FEAR_PENALTY, 5);
  });
});

describe("แผล พิษ และการรักษา", () => {
  it("แผลสดหายเมื่อหาหมอ แต่ปล่อยไว้อาจเป็นแผลถาวรที่ลดพลังต่อสู้", () => {
    const a = life(4); wound(a); year(a); year(a, "act:ft_healer");
    expect(fl(a).wound).toBeUndefined();
    expect(fl(a).injuries ?? []).toHaveLength(0);
    const b = life(5); const c0 = combat(b);
    let got = false;
    for (let i = 0; i < 30 && !got; i++) { if (fl(b).wound === undefined) wound(b); year(b); got = (fl(b).injuries ?? []).length > 0; }
    expect(got).toBe(true);
    expect(combat(b)).toBeLessThan(c0 + 1);
  });
  it("แผลถาวรรักษาได้ด้วยเวทเยียวยาชั้นสูง", () => {
    const l = life(6); addInjury(l, "leg");
    expect(fl(l).injuries).toEqual(["leg"]);
    doActivity(l, "ft_cure"); l.queue = l.queue.filter((q) => q.eventId === "ft.dg.cure"); pickRun(l, /เวทเยียวยา/);
    expect(fl(l).injuries).toEqual([]);
    expect(Object.keys(INJURIES)).toHaveLength(4);
  });
  it("พิษทรุดลงทุกปีจนกว่าจะรักษา", () => {
    const l = life(7); afflict(l, "curse");
    year(l); const s = fl(l).ailment?.stage ?? 0;
    if (fl(l).ailment) expect(s).toBeGreaterThanOrEqual(2);
    afflict(l, "curse"); year(l, "act:ft_h_temple"); year(l, "act:ft_h_temple");
    expect(fl(l).ailment).toBeUndefined();
  });
});

describe("งานที่ลงลึกต่อเนื่อง", () => {
  it("ดันเจี้ยนผ่านชั้นแล้วลงชั้นต่อไปได้ทันทีในรอบเดียว", () => {
    const l = life(8); fl(l).bodyRank = 2;
    runEvent(l, "ft.h.floor", { dg: "crypt" }); pickRun(l, /บุกตรง/, true);
    expect(l.queue[0]?.eventId).toBe("ft.h.floor");
    expect(Number(l.queue[0].ctx.run)).toBe(1);
    expect(labels(l).some((t) => /พัก/.test(t))).toBe(true);
    pickRun(l, /ถอยกลับ/);
    expect(l.queue.length).toBe(0);
  });
  it("กระดานงานมีสามงานจากลูกค้าที่มีชื่อ ลูกค้าจำคุณได้และให้งานใหญ่ขึ้น", () => {
    const l = life(9); fl(l).guild = 2;
    doActivity(l, "ft_guildboard"); l.queue = l.queue.filter((q) => q.eventId === "ft.dg.board");
    const jobs = labels(l).filter((t) => /เหรียญทอง/.test(t));
    expect(jobs).toHaveLength(3);
    const cl = Number(l.queue[0].ctx.c0);
    l.queue[0].ctx.x0 = 0;
    const r = pickRun(l, /^[^ป]/, true); void r;
    expect(Object.values(fl(l).clients ?? {})).toContain(1);
    fl(l).clients = { ...fl(l).clients }; for (const k of Object.keys(fl(l).clients!)) fl(l).clients![k] = 3;
    runEvent(l, "ft.dg.bigjob", { cl, step: 1 }); l.queue = l.queue.slice(-1);
    pickRun(l, /รับงาน/, true);
    expect(l.queue.at(-1)?.eventId === "ft.dg.bigjob" || l.queue[0]?.eventId === "ft.dg.bigjob").toBe(true);
  });
  it("งานตามหาคนบางงานมีความจริงที่ลูกค้าไม่ได้บอก", () => {
    const l = life(16); fl(l).guild = 2;
    runEvent(l, "ft.dg.board", { c0: 0, t0: 0, x0: 2, c1: 1, t1: 1, x1: 0, c2: 2, t2: 2, x2: 0 });
    pickRun(l, /ตามหาเด็ก/, true);
    expect(l.queue[0].eventId).toBe("ft.dg.twist");
    expect(currentScene(l.queue[0], l)!.text(l, l.queue[0].ctx)).toMatch(/หนีออกจากบ้าน/);
    const g0 = l.money; pickRun(l, /คืนค่าจ้าง/);
    expect(g0 - l.money).toBe(Number(19) * 100);
  });
  it("ค่าหัวบางใบเป็นคนบริสุทธิ์ ให้เลือกว่าจะทำอย่างไร", () => {
    const l = life(10); fl(l).guild = 3;
    runEvent(l, "ft.dg.bounty", { n: 0, cr: 0, inn: true }); pickRun(l, /ตามล่า/, true);
    expect(l.queue[0].eventId).toBe("ft.dg.innocent");
    pickRun(l, /ส่งตัวอยู่ดี/);
    expect(fl(l).persona!.m).toBeLessThan(0);
  });
  it("สู้กับสัตว์อสูรครั้งแรกแล้วจำจุดอ่อนได้ในสมุดสัตว์อสูร", () => {
    const l = life(11); l.stats.smarts = 20; fl(l).guild = 1;
    runEvent(l, "ft.contract", { mon: 1 });
    expect(currentScene(l.queue[0], l)!.text(l, l.queue[0].ctx)).toMatch(/ไม่รู้จุดอ่อน/);
    pickRun(l, /กำจัดสัตว์อสูร/, true);
    expect(knows(l, "โกเลมศิลา")).toBe(true);
    runEvent(l, "ft.contract", { mon: 1 });
    expect(currentScene(l.queue.at(-1)!, l)!.text(l, l.queue.at(-1)!.ctx)).toMatch(/จุดอ่อนธาตุ/);
  });
});

describe("สงคราม เมือง และทางของคนไม่จับอาวุธ", () => {
  it("หมายเกณฑ์ให้เลือกบทบาท และผลเปลี่ยนกำลังของแผ่นดิน", () => {
    const l = life(12); fl(l).bodyRank = 3;
    const k = homeKingdom(l); k.war = k.id === "x" ? "y" : "other"; const p0 = k.power;
    runEvent(l, "ft.w.draft");
    const ls = labels(l);
    for (const re of [/นายกอง/, /หมอสนาม/, /สายลับ/, /เสบียง/, /หนีทัพ/]) expect(ls.some((t) => re.test(t))).toBe(true);
    pickRun(l, /นายกอง/, true);
    expect(k.power).toBeGreaterThan(p0);
  });
  it("หนีจากเมืองที่ถูกล้อมทำให้บ้านเสียหาย", () => {
    const l = life(13); l.flags.ftHome = 2;
    runEvent(l, "ft.dg.siege"); pickRun(l, /หนีเอาตัวรอด/);
    expect(Number(l.flags.ftHome)).toBe(1);
  });
  it("ปฏิญาณไม่จับอาวุธ ภัยมาหาน้อยลง และแตกเมื่อเลือกสู้", () => {
    const l = life(14);
    const w0 = (getEvent("ft.dg.road")!.weight as (l: Life) => number)(l);
    doActivity(l, "ft_peacevow");
    expect(fl(l).peaceVow).toBe(true);
    expect((getEvent("ft.dg.road")!.weight as (l: Life) => number)(l)).toBeLessThan(w0);
    l.queue = []; runEvent(l, "ft.dg.road");
    resolveChoice(l, 0);
    expect(fl(l).peaceVow).toBe(false);
  });
  it("กิจกรรมทุกอย่างมีรหัสไม่ซ้ำกัน", () => {
    const ids = ACTIVITIES.map((a) => a.id);
    expect(ids.filter((x, i) => ids.indexOf(x) !== i)).toEqual([]);
  });
  it("ภัยทุกเรื่องที่มาหาเองมีทางผ่านโดยไม่ต้องสู้", () => {
    for (const e of DANGER_EVENTS.filter((x) => !x.manual)) {
      const peace = (e.choices ?? []).filter((c) => !c.odds);
      expect(peace.length, e.id).toBeGreaterThan(0);
    }
  });
  it("อาวุธที่หักตีใหม่ได้แข็งกว่าเดิม", () => {
    const l = life(15); fl(l).weapon = { name: "ดาบของปู่", quality: 2 };
    runEvent(l, "ft.dg.broken", { w: "ดาบของปู่" }); pickRun(l, /ตีใหม่/);
    expect(fl(l).weapon!.quality).toBe(3);
    expect(fl(l).weapon!.name).toMatch(/ดาบของปู่/);
  });
});
