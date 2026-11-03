import { describe, expect, it } from "vitest";
import { loadFantasyWorld } from "../content/fantasy";
import { personaOf } from "../content/fantasy/persona";
import { dataOf, fl, homeKingdom, kingdomsOf } from "../content/fantasy/state";
import { AFTERMATH, COURT_EVENTS, WAR_EVENTS, WORLD_ECHOES, mark, marksOf, regard, rulerView, temperOf } from "../content/fantasy/worldmark";
import { getEvent, visibleChoices } from "./events";
import { ageUp, createLife, resolveChoice, runEvent } from "./game";
import type { Life } from "./types";

loadFantasyWorld();
const life = (seed: number, age = 30): Life => {
  const l = createLife({ seed, worldId: "fantasy" });
  l.age = age; l.queue = []; l.money = 500_000; l.stats.health = 90; l.flags.ftStarsSeen = true;
  return l;
};
const drain = (l: Life) => { let g = 0; while (l.queue.length && l.alive && g++ < 30) resolveChoice(l, visibleChoices(l, l.queue[0])[0].index); };

describe("รอยเท้าบนแผ่นดิน", () => {
  it("สิ่งที่ทำเปลี่ยนแผ่นดินจริงและถูกจดไว้", () => {
    const l = life(3);
    const k = homeKingdom(l), s = k.stability;
    mark(l, "ทดสอบ", { s: 10 });
    expect(homeKingdom(l).stability).toBe(Math.min(95, s + 10));
    expect(marksOf(l).at(-1)!.text).toBe("ทดสอบ");
  });
  it("ทางเลือกในเรื่องเดิมก็เปลี่ยนแผ่นดินได้", () => {
    const l = life(4);
    homeKingdom(l).famine = 2;
    const s = homeKingdom(l).stability;
    runEvent(l, "ft.e.famine");
    resolveChoice(l, 0); drain(l);
    expect(homeKingdom(l).stability).toBeGreaterThan(s);
    expect(marksOf(l).some((m) => m.text.includes("แบ่งเสบียง"))).toBe(true);
  });
});

describe("ผู้ครองและฝ่ายอำนาจ", () => {
  it("ผู้ครองแต่ละคนมีนิสัยคงที่ และมองคุณตามนิสัยของคุณ", () => {
    const l = life(5);
    const k = kingdomsOf(l)[0];
    expect(temperOf(k)).toBe(temperOf(k));
    const base = rulerView(l, k);
    const p = personaOf(l);
    if (temperOf(k) === "just") { p.m = 80; p.h = 80; } else if (temperOf(k) === "cruel") { p.m = -80; p.c = 80; } else if (temperOf(k) === "greedy") p.h = -80; else { p.f = 80; p.m = 80; }
    expect(rulerView(l, k)).toBeGreaterThan(base);
  });
  it("ศาสนจักรนับถือคนศรัทธา ราชสำนักรัตติกาลชอบคนเจ้าเล่ห์", () => {
    const l = life(6);
    const dawn = dataOf(l).factions.find((x) => x.id === "dawn")!, night = dataOf(l).factions.find((x) => x.id === "night")!;
    personaOf(l).f = 80; personaOf(l).m = 60;
    expect(regard(l, dawn)).toBeGreaterThan(30);
    personaOf(l).h = -80;
    expect(regard(l, night)).toBeGreaterThan(regard(l, dawn) - 200);
    expect(regard(l, night)).toBeGreaterThan(20);
  });
  it("ทุกฉากของราชสำนัก สงคราม และเรื่องที่กลับมาเขียนข้อความได้", () => {
    const l = life(7);
    homeKingdom(l).war = kingdomsOf(l).find((k) => k.id !== fl(l).kingdom)!.id;
    for (const e of [...COURT_EVENTS, ...WAR_EVENTS, AFTERMATH, ...WORLD_ECHOES]) {
      expect(getEvent(e.id), e.id).toBeTruthy();
      const ok = !e.when || e.when(l);
      const ctx = ok && e.prepare ? e.prepare(l) : { k: kingdomsOf(l)[1].id, fac: "dawn" };
      expect(e.text(l, ctx), e.id).not.toMatch(/undefined|NaN/);
    }
  });
});

describe("สงคราม", () => {
  it("ยามสงครามมีเรื่องให้เลือก และเมื่อสงครามจบ คนที่ช่วยแผ่นดินได้เป็นวีรชน", () => {
    const l = life(8);
    const foe = kingdomsOf(l).find((k) => k.id !== fl(l).kingdom)!;
    homeKingdom(l).war = foe.id;
    ageUp(l); drain(l);
    expect(l.flags.ftWarWith).toBe(foe.id);
    l.flags.ftWarMerit = 8;
    homeKingdom(l).war = undefined;
    l.queue = [];
    ageUp(l);
    expect(l.queue.some((q) => q.eventId === "ft.wr.after")).toBe(true);
    while (l.queue.length) { const q = l.queue[0]; resolveChoice(l, visibleChoices(l, q)[0].index); }
    expect(fl(l).deeds.some((d) => d.includes("วีรชนแห่งสงคราม"))).toBe(true);
    expect(l.flags.ftWarWith).toBeUndefined();
  });
  it("สามสิบปีมีเรื่องราชสำนักและสงครามพอดี ไม่ท่วมทุกปี", () => {
    let n = 0;
    for (let s = 0; s < 8; s++) {
      const l = life(300 + s, 18);
      for (let y = 0; y < 30 && l.alive; y++) { ageUp(l); let g = 0; while (l.queue.length && l.alive && g++ < 30) { if (/^ft\.w[dr]\./.test(l.queue[0].eventId)) n++; resolveChoice(l, visibleChoices(l, l.queue[0])[0].index); } }
    }
    expect(n / 8).toBeGreaterThan(1);
    expect(n / 8).toBeLessThan(15);
  }, 60000);
});
