import { describe, expect, it } from "vitest";
import { loadFantasyWorld } from "../content/fantasy";
import { CALLINGS } from "../content/fantasy/family";
import { familyOf, grandkids, recordFamily } from "../content/fantasy/family2";
import { closeLife, inheritLife, setRace } from "../content/fantasy/life";
import { fl } from "../content/fantasy/state";
import { getEvent, labelOf, visibleChoices } from "./events";
import { ageUp, breakUp, createLife, resolveChoice, runEvent, tryForBaby } from "./game";
import { buildHeir, heirsOf, newSoul } from "./soul";
import type { Life } from "./types";
import { createPerson, relationLabel } from "./util";

loadFantasyWorld();
const life = (seed: number, age = 30): Life => {
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

describe("หลานและการมีลูก", () => {
  it("ลูกที่โตแล้วมีหลานให้ และหลานรับช่วงต่อได้เมื่อพ่อแม่ของเขาไม่อยู่แล้ว", () => {
    const l = life(1, 60);
    const k = createPerson(l, "child", { age: 30, bond: 70, lastName: l.lastName });
    for (let i = 0; i < 40 && !grandkids(l).length; i++) { l.queue = []; ageUp(l); }
    const g = grandkids(l)[0];
    expect(g).toBeTruthy();
    expect(relationLabel(g, l)).toMatch(/หลาน/);
    g.age = 20; k.alive = false;
    expect(heirsOf(l).some((p) => p.id === g.id)).toBe(true);
  });
  it("เอลฟ์ยังมีลูกได้ตอนอายุร้อยปี", () => {
    const l = life(2, 100); setRace(l, "elf"); l.gender = "f";
    const sp = createPerson(l, "spouse", { gender: "m", age: 100, bond: 90 });
    let born = false;
    for (let i = 0; i < 30 && !born; i++) { l.doneThisYear = []; tryForBaby(l, sp); born = l.people.some((p) => p.relation === "child"); }
    expect(born).toBe(true);
  });
  it("รับเลี้ยงเด็กจากวิหารได้", () => {
    const l = life(3);
    runEvent(l, "ft.f2.adopt"); choose(l, /เด็กกำพร้า/);
    expect(l.people.some((p) => p.relation === "child" && p.tags?.includes("adopted"))).toBe(true);
  });
});

describe("หย่าและครอบครัว", () => {
  it("หย่าแล้วลูกผูกพันน้อยลง", () => {
    const l = life(4, 40);
    const sp = createPerson(l, "spouse", { age: 40, bond: 80 });
    const k = createPerson(l, "child", { age: 10, bond: 80, lastName: l.lastName });
    breakUp(l, sp);
    expect(k.bond).toBeLessThan(80);
  });
});

describe("ตระกูลข้ามชีวิต", () => {
  it("ชีวิตที่น่าจดจำเพิ่มชื่อเสียงให้ตระกูล และทายาทได้รับเกียรตินั้น", () => {
    const a = life(5, 70); a.fame = 80; fl(a).deeds = ["ก", "ข", "ค"];
    const k = createPerson(a, "child", { age: 30, bond: 70, lastName: a.lastName });
    const s = newSoul(); closeLife(s, a);
    const rec = familyOf(a.fw!, a.lastName);
    expect(rec.fame).toBeGreaterThan(10);
    const n = buildHeir(a, k.id); inheritLife(a, n, k.id);
    expect(n.log.some((e) => e.text.includes(`ตระกูล${a.lastName}`))).toBe(true);
  });
  it("ความลับของตระกูลถูกเก็บไว้ให้รุ่นหลังเจอ", () => {
    const a = life(6, 70);
    let found = false;
    for (let i = 0; i < 40 && !found; i++) { recordFamily(a.fw!, a, true); found = !!familyOf(a.fw!, a.lastName).secret; }
    expect(found).toBe(true);
  });
});

describe("บั้นปลาย", () => {
  it("มีงานของบั้นปลายเพิ่มสี่แบบ", () => {
    for (const id of ["elder", "work", "atone", "adventure"]) expect(CALLINGS[id as keyof typeof CALLINGS]).toBeTruthy();
  });
  it("ใกล้จากไปได้ฉากสุดท้าย ให้อภัยศัตรูแล้วความแค้นเบาลง", () => {
    const l = life(7, 80); l.stats.health = 15;
    const foe = createPerson(l, "rival", { age: 80, bond: 10 });
    foe.rel = { love: 0, trust: 10, respect: 0, fear: 0, debt: 0, grudge: 60, jealousy: 0, loyalty: 0 };
    l.flags.ftLastDue = true; runEvent(l, "ft.f2.last"); choose(l, /ให้อภัย/);
    expect(l.flags.ftLastWish).toBe("forgive");
    expect(foe.rel!.grudge).toBeLessThan(60);
  });
});
