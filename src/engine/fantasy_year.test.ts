import { describe, expect, it } from "vitest";
import { loadFantasyWorld } from "../content/fantasy";
import { HEADLINES, hookScore, pickHeadline } from "../content/fantasy/hkit";
import { personaPick } from "../content/fantasy/year";
import { getEvent, visibleChoices } from "./events";
import { ageUp, createLife, resolveChoice, runEvent } from "./game";
import { nextFloat } from "./rng";
import type { Life } from "./types";
import { createPerson } from "./util";

loadFantasyWorld();
const life = (seed: number, age = 24): Life => {
  const l = createLife({ seed, worldId: "fantasy" });
  l.age = age; l.queue = []; l.money = 500_000; l.stats.health = 90; l.flags.ftStarsSeen = true;
  return l;
};

describe("ปีหนึ่งคือหนึ่งบท", () => {
  it("แต่ละปีมีเรื่องหลักเป็นป๊อปอัปไม่เกินหนึ่งเรื่อง ที่เหลือเป็นช่วงเล็กๆ และมีชื่อบท", () => {
    for (let s = 1; s <= 25; s++) {
      const l = life(s * 7);
      ageUp(l);
      const loose = l.queue.filter((q) => { const e = getEvent(q.eventId)!; return !e.forced && !/^ft\.(st\.awaken|st\.bloom|break_|wr\.after|pe\.)/.test(q.eventId); });
      expect(loose.length, `seed ${s}`).toBeLessThanOrEqual(1);
      expect(l.chapter?.age).toBe(l.age);
      expect(l.chapter!.title).toContain(`อายุ ${l.age}`);
      expect(l.flags[`ch_${l.age}`]).toBe(l.chapter!.title);
    }
  });
  it("ปีถัดไปเก็บบทที่แล้วไว้อ่านซ้ำได้", () => {
    const l = life(5);
    ageUp(l); while (l.queue.length) resolveChoice(l, visibleChoices(l, l.queue[0])[0].index);
    const first = l.chapter!.title;
    ageUp(l);
    expect(l.lastChapter?.title).toBe(first);
  });
  it("ให้นิสัยตัดสินแทน: ไม่มีเรื่องหลักเป็นป๊อปอัปเลย", () => {
    for (let s = 1; s <= 10; s++) {
      const l = life(s * 11);
      l.flags.ftAutoDecide = true;
      ageUp(l);
      expect(l.queue.filter((q) => q.eventId.startsWith("ft.hl.")).length).toBe(0);
    }
  });
  it("นิสัยไม่เลือกทางเสี่ยงตายแทนผู้เล่น", () => {
    const l = life(9);
    for (const e of [getEvent("ft.dragon_meet"), getEvent("ft.k.battle")].filter(Boolean)) {
      runEvent(l, e!.id);
      const q = l.queue.at(-1)!;
      const idx = personaPick(l, q);
      if (idx !== undefined) { const c = e!.choices![idx]; expect(c.tone).not.toBe("danger"); expect(c.survival).toBeUndefined(); }
      l.queue = [];
    }
  });
});

describe("เรื่องหลัก", () => {
  it("มีราว 80 เรื่อง ทุกทางมีราคาและหล่อหลอมนิสัย ทุกตอนจบมีคนจำ และข่าวลือหรือเมล็ด", () => {
    expect(HEADLINES.length).toBeGreaterThanOrEqual(75);
    for (const h of HEADLINES) for (const [k, b] of Object.entries(h.beats)) for (const c of b.choices) {
      expect(c.cost, `${h.id}.${k}`).toBeTruthy();
      expect(Object.keys(c.lean).length, `${h.id}.${k} lean`).toBeGreaterThan(0);
      for (const e of [c.end, c.fail].filter(Boolean)) {
        expect(e!.mem[0] || e!.mem.length, `${h.id}.${k} mem`).toBeTruthy();
        expect(!!e!.rumor || !!e!.seed, `${h.id}.${k} rumor/seed`).toBe(true);
      }
      if (c.go) expect(h.beats[c.go], `${h.id} → ${c.go}`).toBeTruthy();
      if (!c.go && !c.failGo) expect(c.end, `${h.id}.${k} end`).toBeTruthy();
    }
  });
  it("ทุกเรื่องหลักเล่นได้จนจบโดยไม่มีข้อความเพี้ยน", () => {
    const r = { rng: 3 };
    for (const h of HEADLINES) {
      const l = life(100 + HEADLINES.indexOf(h), Math.max(h.ages[0], Math.min(h.ages[1], 40)));
      createPerson(l, "spouse", { age: l.age }); createPerson(l, "child", { age: 8 }); createPerson(l, "child", { age: 15 }); createPerson(l, "child", { age: 24 });
      createPerson(l, "friend", { age: l.age }); createPerson(l, "sibling", { age: l.age });
      runEvent(l, `ft.hl.${h.id}`);
      let g = 0;
      while (l.queue.length && l.alive && g++ < 10) {
        const q = l.queue[0];
        const o = visibleChoices(l, q);
        if (!o.length) break;
        const before = l.log.length;
        resolveChoice(l, o[Math.floor(nextFloat(r) * o.length)].index);
        for (const e of l.log.slice(before)) expect(e.text, h.id).not.toMatch(/undefined|NaN|\{n\}|\[object/);
      }
    }
  });
  it("เรื่องที่ผูกกับชีวิตได้คะแนนสูงกว่า", () => {
    const a = life(21, 30), b = life(22, 30);
    createPerson(a, "spouse", { age: 30 });
    const h = HEADLINES.find((x) => x.id === "spouse_secret_debt")!;
    expect(hookScore(a, h)).toBeGreaterThan(hookScore(b, h));
    expect(pickHeadline(a)).toBeTruthy();
  });
});
