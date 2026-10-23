import { describe, expect, it } from "vitest";
import { loadMurimWorld } from "../content/murim";
import { loadSharedEvents } from "../content/shared";
import { VOWS, takeVow, vowOf } from "../content/murim/life/faith";
import { doJobAction, jobActionsFor } from "../content/murim/life/jobActions";
import { lastYearActs, repeatLastYear } from "../content/murim/life/plan";
import { courtesyOf } from "../content/murim/life/rites";
import { worldOfLife } from "../content/murim/life/world";
import { doActivity } from "./activities";
import { getEvent, visibleChoices } from "./events";
import { ageUp, createLife, lifespanHooks, resolveChoice, runEvent } from "./game";
import { nextFloat } from "./rng";
import type { Life } from "./types";
import { createPerson } from "./util";
import { validateLife } from "./validate";

loadMurimWorld();
loadSharedEvents();

type R = { rng: number };
const visited = new Set<string>();
function drain(l: Life, r: R, pickFirst?: (labels: string[]) => number) {
  let g = 0;
  while (l.queue.length && g++ < 80) {
    visited.add(l.queue[0].eventId);
    const o = visibleChoices(l, l.queue[0]);
    expect(o.length, `ไม่มีตัวเลือกใน ${l.queue[0].eventId}/${l.queue[0].scene ?? "start"}`).toBeGreaterThan(0);
    const labels = o.map((x) => (typeof x.c.label === "string" ? x.c.label : x.c.label(l, l.queue[0].ctx)));
    const i = pickFirst ? pickFirst(labels) : -1;
    resolveChoice(l, o[i >= 0 ? i : Math.floor(nextFloat(r) * o.length)].index);
  }
}
const murim = (seed: number) => {
  const l = createLife({ seed, worldId: "murim" });
  worldOfLife(l);
  return l;
};
const year = (l: Life, r: R) => { drain(l, r); if (l.alive) ageUp(l); drain(l, r); };

describe("ศีล เส้นทางนักพรต การทรมาน พิธีบรรลุนิติภาวะ และซ้ำปีก่อน", () => {
  it("บวชแล้วได้รับศีล · ผิดศีลจากสิ่งที่ทำจริง → ต้องเลือกปลงอาบัติ/ปิดบัง/สึก · ออกจากวัดแล้วศีลสิ้นสุด", () => {
    const l = murim(1);
    l.age = 25; l.stats.health = 90;
    l.job = { careerId: "monk", level: 2, performance: 60, years: 1 };
    expect(getEvent("vw.ordain_monk")!.when!(l)).toBe(true);
    runEvent(l, "vw.ordain_monk");
    drain(l, { rng: 1 }, (ls) => ls.findIndex((x) => x.startsWith("รับศีล")));
    expect(vowOf(l)).toBe("buddhist");
    l.flags.mwKills = Number(l.flags.mwKills ?? 0) + 1;
    ageUp(l);
    expect(String(l.flags.vowBreak)).toContain("kill");
    expect(l.queue.some((q) => q.eventId === "vw.broken") || getEvent("vw.broken")!.when!(l)).toBe(true);
    if (!l.queue.some((q) => q.eventId === "vw.broken")) runEvent(l, "vw.broken");
    drain(l, { rng: 2 }, (ls) => ls.findIndex((x) => x.startsWith("สารภาพ")));
    expect(l.flags.vowBreak).toBeUndefined();
    expect(vowOf(l)).toBe("buddhist");
    // ปีที่ไม่ผิดศีล = นับปีที่รักษาได้ · รักษาครบสิบปี = อายุขัยเพิ่ม
    const kept0 = Number(l.flags.vowKept ?? 0);
    ageUp(l);
    expect(Number(l.flags.vowKept ?? 0) > kept0 || !!l.flags.vowBreak).toBe(true);
    drain(l, { rng: 3 }, (ls) => ls.findIndex((x) => /เผาจดหมาย|ปัดดาบ|นั่งต่อ|สารภาพ/.test(x)));
    const base = lifespanHooks.reduce((s, h) => s + h(l), 0);
    l.flags.vowKept = 20;
    expect(lifespanHooks.reduce((s, h) => s + h(l), 0)).toBeGreaterThan(base);
    l.job = undefined;
    ageUp(l);
    expect(vowOf(l)).toBeUndefined();
  });

  it("นักพรตสองสาย: เจิ้งอีมีครอบครัวได้ ฉวนเจินมีคู่ครองแล้วผิดศีล · งานของนักพรตใช้ได้", () => {
    const z = murim(2); z.age = 30;
    z.job = { careerId: "taoist", level: 3, performance: 60, years: 3 };
    takeVow(z, "zhengyi");
    createPerson(z, "spouse", { age: 30, bond: 70 });
    ageUp(z);
    expect(z.flags.vowBreak).toBeUndefined();
    const q = murim(3); q.age = 30;
    q.job = { careerId: "taoist", level: 3, performance: 60, years: 3 };
    takeVow(q, "quanzhen");
    createPerson(q, "partner", { age: 30, bond: 70 });
    ageUp(q);
    expect(String(q.flags.vowBreak)).toContain("celibacy");
    expect(VOWS.zhengyi.keeps).not.toContain("celibacy");
    drain(q, { rng: 4 });
    const t = murim(4); t.age = 35; t.money = 1_000_000;
    t.job = { careerId: "taoist", level: 3, performance: 60, years: 3 };
    const ids = jobActionsFor(t).map((a) => a.id);
    expect(ids).toEqual(expect.arrayContaining(["tao_elixir", "tao_talisman", "tao_divine", "tao_retreat"]));
    doJobAction(t, "tao_retreat");
    expect(Number(t.flags.taoLongevity)).toBe(1);
  });

  it("ถูกจับคดีหนัก → ถูกสอบสวนก่อนศาล · ทุกทางเลือกไปถึงศาลได้ · ซัดทอดคนอื่นแล้วเขาแค้น", () => {
    let interrogated = 0, betrayed = 0, wounded = 0;
    for (let s = 1; s <= 60; s++) {
      const l = murim(100 + s);
      l.age = 25; l.money = 200_000;
      for (let i = 0; i < 3; i++) createPerson(l, "friend", { age: 25, bond: 50 });
      l.flags.lastCrime = "ปล้นคนเดินทาง";
      l.flags.heat = 60;
      visited.clear();
      runEvent(l, "cr.hunters");
      drain(l, { rng: s }, (ls) => ls.findIndex((x) => x.includes("มอบตัว")));
      if (visited.has("tt.interrogate")) interrogated++;
      if (l.people.some((p) => p.tags?.includes("betrayed_in_jail"))) betrayed++;
      if (l.body?.injuries.some((i) => i.part === "handR")) wounded++;
      expect(visited.has("cr.trial") || !l.alive, "ต้องขึ้นศาลหลังสอบสวน").toBe(true);
      expect(validateLife(l)).toEqual([]);
    }
    expect(interrogated).toBe(60);
    expect(visited.size).toBeGreaterThan(0);
    expect(betrayed).toBeGreaterThan(0);
    expect(wounded).toBeGreaterThan(0);
  });

  it("มือปราบที่ทรมานผู้ต้องหาได้คำสารภาพเร็วแต่บางครั้งจับผิดคน แล้วความจริงกลับมาหา · ไต่สวนอย่างอดทนไม่จับผิดคน", () => {
    let wrong = 0, cameBack = 0;
    for (let s = 1; s <= 60; s++) {
      const l = murim(300 + s);
      l.age = 30; l.money = 300_000;
      l.job = { careerId: "constable", level: 2, performance: 60, years: 2 };
      runEvent(l, "tt.question");
      drain(l, { rng: s }, (ls) => ls.findIndex((x) => x.includes("เครื่องทรมาน")));
      if (l.flags.wrongConfession) {
        wrong++;
        for (let y = 0; y < 4 && l.alive; y++) { l.stats.health = 90; ageUp(l); if (l.queue.some((q) => q.eventId === "tt.wrong_man")) cameBack++; drain(l, { rng: s + y }); }
        if (l.seen["tt.wrong_man"]) cameBack++;
      }
    }
    expect(wrong).toBeGreaterThan(5);
    expect(cameBack).toBeGreaterThan(0);
    for (let s = 1; s <= 40; s++) {
      const l = murim(500 + s);
      l.age = 30; l.stats.smarts = 90;
      l.job = { careerId: "constable", level: 2, performance: 60, years: 2 };
      runEvent(l, "tt.question");
      drain(l, { rng: s }, (ls) => ls.findIndex((x) => x.startsWith("ไต่สวน")));
      expect(l.flags.wrongConfession).toBeUndefined();
    }
  });

  it("พิธีบรรลุนิติภาวะ: ชายสวมกวานตอน 20 หญิงปักปิ่นตอน 15 พร้อมชื่อรอง แม้ไม่มีพ่อแม่", () => {
    let m = 0, mNamed = 0, f = 0, fNamed = 0;
    for (let s = 1; s <= 80; s++) {
      const l = murim(700 + s * 13);
      const r = { rng: s };
      if (s % 3 === 0) for (const p of l.people) if (p.relation === "father" || p.relation === "mother") p.alive = false;
      let g = 0;
      while (l.alive && l.age < 22 && g++ < 30) year(l, r);
      if (!l.alive) continue;
      // ผู้ชายเลือก "ไม่จัดพิธี" ได้ — นับว่าได้รับพิธี (ถูกเสนอ) ถ้าเลือกไม่จัดเอง
      if (l.gender === "m") { m++; if (courtesyOf(l) || l.seen["ca.capping"]) mNamed++; } else { f++; if (courtesyOf(l)) fNamed++; }
    }
    console.log("SIM courtesy names", { m, mNamed, f, fNamed });
    expect(mNamed / Math.max(1, m)).toBeGreaterThan(0.6);
    expect(fNamed / Math.max(1, f)).toBeGreaterThan(0.6);
  });

  it("ซ้ำปีก่อน: ทำกิจกรรมและงานชุดเดิม (ข้ามอาชญากรรมและสิ่งที่ทำไม่ได้แล้ว)", () => {
    const l = murim(9);
    l.age = 30; l.money = 1_000_000; l.stats.health = 80;
    l.job = { careerId: "farmer", level: 2, performance: 60, years: 2 };
    doActivity(l, "mw_meditate");
    doActivity(l, "mw_body");
    doActivity(l, "mw_steal");
    drain(l, { rng: 1 });
    const ja = jobActionsFor(l).find((a) => !a.cost)!;
    doJobAction(l, ja.id);
    drain(l, { rng: 2 });
    ageUp(l);
    drain(l, { rng: 3 });
    expect(lastYearActs(l)).toEqual(expect.arrayContaining(["act:mw_meditate", "act:mw_body", `job:${ja.id}`]));
    const out = repeatLastYear(l);
    drain(l, { rng: 4 });
    expect(out.done.length).toBeGreaterThanOrEqual(2);
    expect(out.skipped.some((x) => x.includes("ขโมย") || x.length > 0) || !lastYearActs(l).includes("act:mw_steal")).toBe(true);
    expect(l.doneThisYear).not.toContain("act:mw_steal");
    expect(l.doneThisYear).toEqual(expect.arrayContaining(["act:mw_meditate", "act:mw_body"]));
  });

  it("80 ชีวิตสุ่มในวัด อาราม และกองมือปราบ ไม่มีฉากตันและสถานะไม่เสีย", () => {
    const jobs = ["monk", "taoist", "constable", "jinyiwei"];
    for (let s = 1; s <= 80; s++) {
      const l = murim(1200 + s * 7);
      l.age = 16; l.money = 100_000;
      l.job = { careerId: jobs[s % 4], level: 1, performance: 60, years: 0 };
      const r = { rng: s };
      let g = 0;
      while (l.alive && g++ < 80) {
        if (s % 2 && lastYearActs(l).length) { repeatLastYear(l); drain(l, r); }
        else if (l.job) { const a = jobActionsFor(l)[Math.floor(nextFloat(r) * Math.max(1, jobActionsFor(l).length))]; if (a) { doJobAction(l, a.id); drain(l, r); } }
        year(l, r);
        expect(validateLife(l)).toEqual([]);
      }
      expect(JSON.parse(JSON.stringify(l))).toEqual(l);
    }
  });
});
