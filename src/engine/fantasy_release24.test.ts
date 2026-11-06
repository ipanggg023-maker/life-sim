import { describe, expect, it } from "vitest";
import { loadFantasyWorld } from "../content/fantasy";
import { chainOpen, CHAIN_GAP } from "../content/fantasy/chains";
import { SEEDS, seedsOf } from "../content/fantasy/conseq";
import { HL_R24 } from "../content/fantasy/hl_r24";
import { createPerson } from "./util";
import { SMALL_MOMENTS } from "../content/fantasy/smallmoments";
import { fl } from "../content/fantasy/state";
import { buildYear, momentDone, quietRoutine } from "../content/fantasy/year";
import { allEvents, getEvent, visibleChoices } from "./events";
import { ageUp, createLife, runEvent } from "./game";
import type { Life } from "./types";

loadFantasyWorld();
const life = (seed: number, age = 30): Life => {
  const l = createLife({ seed, worldId: "fantasy", plain: true });
  l.age = age; l.queue = []; l.money = 100_000; l.stats.health = 90; l.flags.ftStarsSeen = true;
  return l;
};
const year = (l: Life, ids: string[]) => { l.queue = []; for (const id of ids) runEvent(l, id); buildYear(l); };

describe("เรื่องประจำของระบบจบเงียบ", () => {
  it("ภาษีครั้งแรกเป็นป๊อปอัป ครั้งต่อไปเป็นบรรทัดในบันทึก", () => {
    const l = life(1);
    year(l, ["ft.m2.tax"]);
    expect(l.queue.some((q) => q.eventId === "ft.m2.tax")).toBe(true);
    l.age += 3; delete l.flags.ftTaxAt;
    const before = l.money, n = l.log.length;
    year(l, ["ft.m2.tax"]);
    expect(l.queue.some((q) => q.eventId === "ft.m2.tax")).toBe(false);
    expect(l.money).toBeLessThan(before);
    expect(l.log.slice(n).some((x) => x.text.startsWith("ภาษีประจำปี:"))).toBe(true);
    expect(l.chapter?.lines.some((x) => x.startsWith("ภาษีประจำปี:"))).toBe(true);
    // บรรทัดสั้นๆ ไม่พูดซ้ำว่า "คุณจ่ายครบ คุณจ่าย"
    expect(l.chapter?.lines.find((x) => x.startsWith("ภาษีประจำปี:"))).toMatch(/^ภาษีประจำปี: คุณจ่าย \d+ เหรียญทอง/);
  });
  it("เจ้าหนี้: จ่ายไหวก็จ่ายเงียบๆ จ่ายไม่ไหวต้องเลือกเอง", () => {
    const l = life(2);
    l.seen["ft.$.creditor"] = 3; l.debt = 50 * 100;
    const q = { eventId: "ft.$.creditor", ctx: {} };
    expect(quietRoutine(l, q)).toBe(true);
    l.money = 10 * 100;
    expect(quietRoutine(l, q)).toBe(false);
  });
  it("โรคระบาดหยุดถามเมื่อร่างกายไม่พร้อม", () => {
    const l = life(3); l.seen["ft.w.plague"] = 2;
    const q = { eventId: "ft.w.plague", ctx: {} };
    expect(quietRoutine(l, q)).toBe(true);
    l.stats.health = 30;
    expect(quietRoutine(l, q)).toBe(false);
  });
});

describe("ช่วงเล็กๆ ไม่ซ้ำในชีวิตเดียว", () => {
  it("เรื่องที่เคยเกิดแล้วไม่กลับมาเป็นช่วงเล็กๆ อีก", () => {
    const l = life(4);
    const id = "ft.sm.human_census";
    fl(l).race = "human";
    expect(momentDone(l, id)).toBe(false);
    // ปีก่อนเรื่องนี้เกิดไปแล้ว
    l.flags[`ftMo_${id}`] = l.age - 1;
    expect(momentDone(l, id)).toBe(true);
    year(l, [id]);
    expect(l.queue.some((q) => q.eventId === id)).toBe(false);
    expect((l.chapter?.lines ?? []).some((x) => x.includes("สมุดทะเบียนราษฎร"))).toBe(false);
  });
  it("เรื่องที่ต่อจากเมล็ดเก่าไม่นับว่าซ้ำ", () => {
    const l = life(5);
    l.flags["ftMo_ft.sg.cont"] = 20;
    expect(momentDone(l, "ft.sg.cont")).toBe(false);
  });
  it("คลังช่วงเล็กๆ ตามสถานการณ์: ทุกเรื่องมีสามทาง ขึ้นตามเผ่าของคุณ", () => {
    expect(SMALL_MOMENTS.length).toBeGreaterThanOrEqual(36);
    for (const e of SMALL_MOMENTS) expect(e.choices?.length, e.id).toBeGreaterThanOrEqual(3);
    const l = life(6); fl(l).race = "elf";
    expect(getEvent("ft.sm.elf_seedling")!.when!(l)).toBe(true);
    expect(getEvent("ft.sm.orc_tusk")!.when!(l)).toBe(false);
  });
});

describe("เส้นเรื่องหลวมและแตกทาง", () => {
  it("ตอนต่อไปในกลุ่มเดียวกันเว้นช่วงอย่างน้อยหนึ่งปี", () => {
    const l = life(7);
    const e = getEvent("ft.so.plot")!;
    l.flags.ftChain_court = l.age;
    expect(chainOpen(l, e)).toBe(false);
    l.age += CHAIN_GAP[1];
    // ถ้าชีวิตนี้ตอนนี้ไม่ถูกข้าม ก็กลับมาได้หลังช่วงเว้น
    l.seen["ft.so.plot"] = 1;
    expect(chainOpen(l, e)).toBe(true);
  });
  it("บางชีวิตไม่เจอตอนต่อบางตอนเลย", () => {
    const e = getEvent("ft.s.rival_return")!;
    let skipped = 0;
    for (let s = 1; s <= 60; s++) if (!chainOpen(life(s), e)) skipped++;
    expect(skipped).toBeGreaterThan(3);
    expect(skipped).toBeLessThan(30);
  });
  it("คู่ปรับที่ดีกันแล้วกลับมาเป็นเพื่อน ไม่ใช่มาท้าสู้", () => {
    const l = life(8, 30);
    const r = createPerson(l, "friend", { age: 30, bond: 80 });
    fl(l).rivalId = r.id; fl(l).graduated = true; fl(l).bodyRank = 2;
    expect(getEvent("ft.s.rival_return")!.when!(l)).toBe(false);
    expect(getEvent("ft.s.rival_friend")!.when!(l)).toBe(true);
    r.relation = "rival"; r.bond = 20; l.job = { careerId: "ft_chef", level: 1, performance: 50, years: 2 }; fl(l).bodyRank = 0; fl(l).magicRank = 0;
    expect(getEvent("ft.s.rival_letter")!.when!(l)).toBe(true);
    expect(getEvent("ft.s.rival_return")!.when!(l)).toBe(false);
  });
  it("คนที่เคยแค้นแต่ดีกันแล้ว กลับมาเพื่อคืนดี", () => {
    const l = life(9);
    const p = createPerson(l, "friend", { age: 30, bond: 70 });
    runEvent(l, "ft.sg.cont", { pid: p.id, kind: "peace", title: "ไฟไหม้กลางดึก" });
    const q = l.queue.at(-1)!;
    const vis = visibleChoices(l, q);
    expect(vis.length).toBe(3);
  });
  it("บางเมล็ดเงียบหายไปโดยไม่กลับมา", () => {
    let faded = 0;
    const id = Object.keys(SEEDS)[0];
    for (let s = 1; s <= 40; s++) {
      const l = life(s, 60);
      seedsOf(l).push({ id, age: 1, note: "ทดสอบ" });
      l.queue = []; ageUp(l);
      if (seedsOf(l).find((x) => x.id === id)?.faded) faded++;
    }
    expect(faded).toBeGreaterThan(2);
    expect(faded).toBeLessThan(25);
  });
});

describe("เรื่องหลักชุดใหม่", () => {
  it("ลงทะเบียนครบ ทุกฉากมีอย่างน้อยสามทาง", () => {
    expect(HL_R24.length).toBeGreaterThanOrEqual(12);
    for (const e of HL_R24) {
      expect(allEvents().some((x) => x.id === e.id)).toBe(true);
      expect(e.choices!.length, e.id).toBeGreaterThanOrEqual(3);
      for (const [k, s] of Object.entries(e.scenes ?? {})) expect(s.choices.length, `${e.id}/${k}`).toBeGreaterThanOrEqual(3);
    }
  });
});
