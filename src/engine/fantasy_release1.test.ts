import { describe, expect, it } from "vitest";
import { REPEAT_GAP, loadFantasyWorld } from "../content/fantasy";
import { HEADLINES, pickHeadline } from "../content/fantasy/hkit";
import { closeLife, memorable } from "../content/fantasy/life";
import { BODY_RANKS, GUILD_RANKS, MAGIC_RANKS } from "../content/fantasy/power";
import { dataOf, fl } from "../content/fantasy/state";
import { buildReport, snapshot } from "./report";
import { eligibilityFilters, getEvent } from "./events";
import { createLife, runEvent, whyFailed } from "./game";
import { newSoul, rememberSeen } from "./soul";
import type { Life } from "./types";
import { createPerson, fitGender } from "./util";

loadFantasyWorld();
const life = (seed = 3, age = 30): Life => {
  const l = createLife({ seed, worldId: "fantasy" });
  l.age = age; l.queue = []; l.flags.ftStarsSeen = true;
  return l;
};

describe("คำบอกเพศ", () => {
  it("ผู้หญิงได้คำของผู้หญิง และคำว่าหนุ่มสาวคงไว้", () => {
    expect(fitGender("พ่อค้าแผงลอย", "f")).toBe("แม่ค้าแผงลอย");
    expect(fitGender("นักผจญภัยหนุ่ม", "f")).toBe("นักผจญภัยสาว");
    expect(fitGender("ราชาโจร", "f")).toBe("ราชินีโจร");
    expect(fitGender("เรื่องสมัยหนุ่มสาว", "f")).toBe("เรื่องสมัยหนุ่มสาว");
    expect(fitGender("นักผจญภัยหนุ่ม", "m")).toBe("นักผจญภัยหนุ่ม");
  });
  it("คนที่สร้างพร้อมอาชีพได้คำตามเพศของเขา", () => {
    const l = life(4);
    const p = createPerson(l, "friend", { gender: "f", age: 20, job: "อัจฉริยะหนุ่ม" });
    expect(p.job).toBe("อัจฉริยะสาว");
  });
  it("คนใหม่ในเรื่องหลักที่ข้อความเรียกว่าหนุ่ม เป็นผู้ชายเสมอ", () => {
    for (let s = 0; s < 12; s++) {
      const l = life(40 + s, 60);
      fl(l).bodyRank = 3;
      runEvent(l, "ft.hl.elder_young_rival");
      const p = l.people.find((x) => x.id === l.queue[0].ctx.pid)!;
      expect(p.gender).toBe("m");
    }
  });
});

describe("ไม่ซ้ำ", () => {
  it("เรื่องหลักที่ชาติก่อนเจอแล้วไม่กลับมาถ้ายังมีเรื่องใหม่", () => {
    const l = life(5, 30);
    const first = pickHeadline(l)!;
    l.pastSeen = [first.id];
    for (let i = 0; i < 30; i++) expect(pickHeadline(l)?.id).not.toBe(first.id);
  });
  it("วิญญาณจำเรื่องหลักของปีที่ผ่านมา", () => {
    const l = life(6, 30), soul = newSoul();
    l.seen["ft.hl." + HEADLINES[0].id] = 1;
    rememberSeen(soul, l);
    expect(soul.seenEver).toContain("ft.hl." + HEADLINES[0].id);
  });
  it("เรื่องเล็กที่เกิดซ้ำได้ต้องห่างกัน 15 ปี", () => {
    const l = life(7, 40);
    const e = getEvent("ft.np.sick") ?? getEvent("ft.fd.rebel")!;
    const ok = () => eligibilityFilters.every((f) => f(l, { ...e, maxTimes: 0 }));
    l.seenAt = { [e.id]: 35 };
    expect(ok()).toBe(false);
    l.age = 35 + REPEAT_GAP;
    expect(ok()).toBe(true);
  });
});

describe("ชีวิตที่น่าจดจำเท่านั้นที่ทิ้งร่องรอยในโลก", () => {
  it("ชีวิตธรรมดาไม่อยู่ในพงศาวดาร ชีวิตที่มีวีรกรรมอยู่", () => {
    const plain = life(8, 70); plain.fame = 5; fl(plain).deeds = [];
    expect(memorable(plain)).toBe(false);
    const s1 = newSoul(); const before = (plain.fw?.chronicle ?? []).length;
    closeLife(s1, plain);
    expect((s1.fantasyWorld!.chronicle ?? []).length).toBe(before);
    const hero = life(9, 70); hero.fame = 60; fl(hero).deeds = ["สังหารราชาก็อบลิน", "ช่วยเมืองจากไฟ"];
    const s2 = newSoul(); closeLife(s2, hero);
    expect(s2.fantasyWorld!.legends.some((g) => g.lifeId === hero.id)).toBe(true);
    expect((s2.fantasyWorld!.chronicle ?? []).some((c) => c.text.includes(hero.firstName))).toBe(true);
  });
});

describe("ป๊อปอัปและสรุปปี", () => {
  it("ทางเลือกที่พลาดมีเหตุผลหนึ่งบรรทัด", () => {
    const l = life(10, 25); l.stats.health = 20;
    runEvent(l, "ft.ar.bout");
    const q = l.queue[0];
    const i = getEvent(q.eventId)!.choices!.findIndex((c) => !!c.odds);
    expect(whyFailed(l, q, i)).toMatch(/\S/);
  });
  it("สรุปปีเรียงเรื่องใหญ่ก่อน", () => {
    const l = life(11, 40);
    const p = createPerson(l, "friend", { age: 40, bond: 50 });
    const before = snapshot(l);
    l.stats.smarts += 5; p.alive = false; l.money += 5000;
    const r = buildReport(l, before);
    expect(r.lines[0].text).toMatch(/^จากไป/);
    expect(r.lines[1].text).toMatch(/^เงิน/);
  });
});

describe("ชื่อใหม่", () => {
  it("ขั้นกายไม่ใช้คำว่าดาบ ขั้นกิลด์ไล่จากทองแดงขึ้นไป และอาวุธตำนานใช้ชื่อใหม่", () => {
    expect(BODY_RANKS.join()).not.toMatch(/ดาบ/);
    expect(MAGIC_RANKS[6]).toBe("ผู้ครองดารา");
    expect(GUILD_RANKS.slice(1, 3)).toEqual(["ทองแดง", "เหล็ก"]);
    const l = life(12);
    expect(dataOf(l).relics.find((r) => r.id === "dawnchoice")?.name).toBe("ดาบสุริยัน");
  });
});
