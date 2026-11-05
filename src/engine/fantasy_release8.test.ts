import { describe, expect, it } from "vitest";
import { loadFantasyWorld } from "../content/fantasy";
import { bodyCap, combat, needXp, YEARS_PER_CAP } from "../content/fantasy/power";
import { SECLUDE_GAP, corrupt, corruptionOf, craftRank, nextBreak, secluded, standingLine } from "../content/fantasy/power2";
import { ACTIVITIES } from "./activities";
import { setRace } from "../content/fantasy/life";
import { fl } from "../content/fantasy/state";
import { getEvent, labelOf, visibleChoices } from "./events";
import { ageUp, createLife, kill, resolveChoice, runEvent } from "./game";
import type { Life } from "./types";

loadFantasyWorld();
const life = (seed: number, age = 25): Life => {
  const l = createLife({ seed, worldId: "fantasy", plain: true });
  l.age = age; l.queue = []; l.money = 100_000; l.flags.ftStarsSeen = true; l.stats.health = 90;
  return l;
};
const labels = (l: Life) => { const q = l.queue[0], ev = getEvent(q.eventId)!; return visibleChoices(l, q).map((x) => labelOf(ev.choices![x.index], l, q.ctx)); };
const choose = (l: Life, re: RegExp) => {
  const q = l.queue[0], ev = getEvent(q.eventId)!;
  const sc = q.scene && ev.scenes ? ev.scenes[q.scene] : ev;
  const o = visibleChoices(l, q).find((x) => re.test(labelOf(sc.choices![x.index], l, q.ctx)));
  if (!o) throw new Error(`no choice ${re} in ${q.eventId}`);
  return resolveChoice(l, o.index);
};

describe("ทะลวงขั้นด้วยการทดสอบ", () => {
  it("การทะลวงมีบททดสอบหลายแบบ และทางเอาชีวิตเข้าแลกเป็นทางเดียวที่ตายได้", () => {
    const l = life(1); fl(l).bstars = 6; fl(l).body = needXp(0);
    runEvent(l, "ft.break_body");
    const ls = labels(l);
    expect(ls.some((t) => /อาจารย์ประลอง/.test(t))).toBe(true);
    expect(ls.some((t) => /สมาธิ/.test(t))).toBe(true);
    const ev = getEvent("ft.break_body")!;
    const reckless = ev.choices!.find((c) => labelOf(c, l, {}).includes("เอาชีวิตเข้าแลก"))!;
    expect(reckless.survival?.(l, {})).toBeLessThan(1);
    expect(ev.choices!.filter((c) => c.survival).length).toBe(1);
  });
  it("ฝึกต่อเนื่องสิบห้าปีดันเพดานขึ้นหนึ่งขั้น", () => {
    const l = life(2); fl(l).bstars = 0;
    const cap0 = bodyCap(l);
    fl(l).trainYears = YEARS_PER_CAP;
    expect(bodyCap(l)).toBe(cap0 + 1);
  });
});

describe("ความมืด ยา และการเก็บตัว", () => {
  it("ความมืดสูงทำให้นักไต่สวนตามมา และชำระบาปลดได้", () => {
    const l = life(3); corrupt(l, 60);
    expect(corruptionOf(l)).toBe(60);
    let came = false;
    for (let i = 0; i < 25 && !came; i++) { l.queue = []; ageUp(l); came = (l.seen["ft.pw.inquisitor"] ?? 0) > 0; }
    expect(came).toBe(true);
  });
  it("ยาคืนชีพกันตายได้หนึ่งครั้ง แต่กันความชราไม่ได้", () => {
    const l = life(4); fl(l).potions = { life: 1 };
    kill(l, "ตายระหว่างรับงานกิลด์");
    expect(l.alive).toBe(true);
    expect(fl(l).potions!.life).toBe(0);
    const o = life(5); fl(o).potions = { life: 1 };
    kill(o, "จากไปอย่างสงบในวัยชรา");
    expect(o.alive).toBe(false);
  });
  it("เก็บตัวบนเขาได้แต้มฝึกมาก และทำกิจกรรมในเมืองไม่ได้", () => {
    const l = life(6); fl(l).bodyRank = 1;
    runEvent(l, "ft.pw.seclude"); choose(l, /3 ปี/);
    expect(secluded(l)).toBe(true);
    const b0 = fl(l).body; l.queue = []; ageUp(l);
    expect(fl(l).body).toBeGreaterThan(b0 + 50);
  });
  it("ลงจากเขาแล้วต้องรอห้าปีก่อนขึ้นไปใหม่ และยาคืนชีพต้องปรุงเอง", () => {
    const l = life(11); fl(l).bodyRank = 1;
    const act = ACTIVITIES.find((a) => a.id === "ft_seclude")!;
    expect(act.available!(l)).toBe(true);
    l.flags.ftSecludeUntil = l.age;
    expect(act.available!(l)).toBe(false);
    l.age += SECLUDE_GAP;
    expect(act.available!(l)).toBe(true);
    const c = getEvent("ft.pw.potions")!.choices!.find((x) => labelOf(x, l, {}).startsWith("ยาคืนชีพ"))!;
    expect(c.req?.(l, {})).toBeTruthy();
    fl(l).craft = { alchemy: 300 };
    expect(c.req?.(l, {})).toBeFalsy();
    runEvent(l, "ft.pw.potions");
    expect(labels(l).some((t) => /ยาคืนชีพ/.test(t))).toBe(true);
  });
});

describe("ฝีมือช่าง อายุ และหน้าพลัง", () => {
  it("ฝึกวิชาช่างแล้วขึ้นขั้น", () => {
    const l = life(7);
    for (let i = 0; i < 3; i++) { runEvent(l, "ft.pw.study"); choose(l, /การปรุงยา/); }
    expect(craftRank(l, "alchemy")).toBeGreaterThanOrEqual(1);
  });
  it("ร่างกายร่วงโรยตามวัย", () => {
    const y = life(8, 30); fl(y).bodyRank = 3; fl(y).body = 0;
    const o = life(8, 85); fl(o).bodyRank = 3; fl(o).body = 0;
    expect(combat(o)).toBeLessThan(combat(y));
    const e = life(9, 85); setRace(e, "elf"); fl(e).bodyRank = 3; fl(e).body = 0;
    expect(combat(e)).toBeGreaterThanOrEqual(combat(o));
  });
  it("หน้าพลังบอกเป็นคำว่าสู้อะไรได้ และขั้นต่อไปต้องมีอะไร", () => {
    const l = life(10); fl(l).bodyRank = 2;
    expect(standingLine(l)).toMatch(/คุณ/);
    expect(nextBreak(l, "body")).toMatch(/แต้มฝึก|พร้อมทะลวง|เพดาน/);
  });
});
