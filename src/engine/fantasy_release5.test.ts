import { describe, expect, it } from "vitest";
import { loadFantasyWorld } from "../content/fantasy";
import { EXPEL_AT, mentorOf, offerLevel, pathOf } from "../content/fantasy/childhood";
import { seedsOf } from "../content/fantasy/conseq";
import { timelineOf } from "../content/fantasy/lifestory";
import { SCHOOLS } from "../content/fantasy/places";
import { fl } from "../content/fantasy/state";
import { getEvent, labelOf, visibleChoices } from "./events";
import { ageUp, createLife, resolveChoice, runEvent } from "./game";
import type { Life } from "./types";

loadFantasyWorld();
const life = (seed: number, age: number): Life => {
  const l = createLife({ seed, worldId: "fantasy", plain: true });
  l.age = age; l.queue = []; l.money = 50_000; l.flags.ftStarsSeen = true; l.stats.health = 90;
  return l;
};
const choose = (l: Life, re: RegExp) => {
  const q = l.queue[0], ev = getEvent(q.eventId)!;
  const o = visibleChoices(l, q).find((x) => re.test(labelOf(ev.choices![x.index], l, q.ctx)));
  if (!o) throw new Error(`no choice ${re} in ${q.eventId}: ${visibleChoices(l, q).map((x) => labelOf(ev.choices![x.index], l, q.ctx)).join(" | ")}`);
  return resolveChoice(l, o.index);
};

describe("วัยเด็ก", () => {
  it("ช่วงเล็กๆ ตอนเด็กฝังเมล็ดที่ซ่อนอยู่ จนกว่ามันจะกลับมา", () => {
    const l = life(1, 3);
    runEvent(l, "ft.ch.share"); choose(l, /แบ่งให้/);
    expect(seedsOf(l).some((s) => s.id === "kid_shared")).toBe(true);
    expect(timelineOf(l).some((b) => b.text.includes("แบ่งขนม"))).toBe(false);
    l.age = 30;
    runEvent(l, "ft.ec.kid_shared");
    expect(seedsOf(l).find((s) => s.id === "kid_shared")!.done).toBe(30);
    expect(l.log.some((e) => e.text.includes("ตอนอายุ 3"))).toBe(true);
  });
  it("เด็กที่ไม่ได้เข้าโรงเรียนได้เลือกทางของตัวเอง และลูกมือช่างได้เริ่มงานช่างที่ขั้นสอง", () => {
    const l = life(2, 12);
    runEvent(l, "ft.ch.path"); choose(l, /ลูกมือช่างตีเหล็ก/);
    expect(pathOf(l)).toBe("apprentice");
    expect(Number(l.flags.ftBest_ft_smith)).toBe(3);
  });
  it("คนที่เห็นแววกลายเป็นอาจารย์ติดตัว", () => {
    const l = life(3, 12);
    runEvent(l, "ft.ch.mentor"); choose(l, /ขอเป็นศิษย์/);
    expect(mentorOf(l)).toBeTruthy();
  });
});

describe("โรงเรียน", () => {
  it("มีโรงเรียนใหม่ห้าแห่ง ทุกแห่งเปิดประตูสู่อาชีพ", () => {
    for (const id of ["scholars", "merchants", "bards", "thieves", "temple"]) expect(SCHOOLS.find((s) => s.id === id)?.career, id).toBeTruthy();
    const l = life(4, 12);
    runEvent(l, "ft.school_apply");
    const labels = visibleChoices(l, l.queue[0]).map((x) => labelOf(getEvent("ft.school_apply")!.choices![x.index], l, {}));
    expect(labels.some((t) => t.includes("วิหารนวกะ"))).toBe(true);
  });
  it("วิหารนวกะให้เลือกเทพ และเทพประทานพร", () => {
    const l = life(5, 12);
    const f = fl(l); f.school = "temple"; f.schoolSince = 12; f.classScore = 50;
    runEvent(l, "ft.ch.god"); choose(l, /ซอเลีย/);
    expect(l.flags.ftGod).toBe("solia");
    let blessed = false;
    for (let i = 0; i < 25 && !blessed; i++) { l.queue = []; ageUp(l); blessed = l.log.some((e) => e.text.startsWith("พรจากซอเลีย")); }
    expect(blessed).toBe(true);
  });
  it("คะแนนต่ำที่สุดของรุ่นถูกเรียกพบ และถ้าถูกไล่ออกก็มีรอยติดตัว", () => {
    const l = life(6, 15);
    const f = fl(l); f.school = "merchants"; f.schoolSince = 12; f.classScore = EXPEL_AT;
    runEvent(l, "ft.ch.expel"); choose(l, /ยอมรับ/);
    expect(fl(l).school).toBeUndefined();
    expect(l.flags.ftExpelled).toBe("merchants");
  });
  it("หัวกะทิของรุ่นได้ข้อเสนอเริ่มงานขั้นสอง ที่หนึ่งของรุ่นเริ่มขั้นสาม", () => {
    const l = life(7, 17);
    const f = fl(l); f.school = "scholars"; f.graduated = true; f.classScore = 90;
    expect(offerLevel(l)).toBe(3);
    runEvent(l, "ft.ch.offer"); choose(l, /รับข้อเสนอ/);
    expect(l.job?.careerId).toBe("ft_scholar");
    expect(l.job?.level).toBe(3);
  });
});

describe("วัยรุ่น", () => {
  it("อายุสิบเจ็ดได้ถามตัวเองว่าอยากเป็นคนแบบไหน", () => {
    const l = life(8, 16);
    let asked = false;
    for (let i = 0; i < 3 && !asked; i++) { l.queue = []; ageUp(l); asked = l.queue.some((q) => q.eventId === "ft.tn.path"); }
    expect(asked).toBe(true);
  });
});
