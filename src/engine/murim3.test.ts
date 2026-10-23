import { describe, expect, it } from "vitest";
import { loadMurimWorld } from "../content/murim";
import { loadSharedEvents } from "../content/shared";
import { startDuel } from "../content/murim/life/duel";
import { plansFor, setPlan } from "../content/murim/life/plan";
import { combatPower, awaken } from "../content/hunter/power";
import { bodyOf, combatFactor, disabilities, injure, permanentInjuries, tickBody, woundFrom } from "./body";
import { visibleChoices } from "./events";
import { ageUp, choiceChance, createLife, resolveChoice } from "./game";
import { nextFloat } from "./rng";
import type { Life } from "./types";

loadMurimWorld();
loadSharedEvents();

function drain(l: Life, r: { rng: number }) {
  let g = 0;
  while (l.queue.length && g++ < 80) {
    const q = l.queue[0];
    const o = visibleChoices(l, q).filter(({ c }) => !c.req?.(l, q.ctx));
    expect(o.length, `ไม่มีตัวเลือกที่กดได้ใน ${q.eventId}/${q.scene ?? "start"}`).toBeGreaterThan(0);
    resolveChoice(l, o[Math.floor(nextFloat(r) * o.length)].index);
  }
}

describe("Murim Phase 3: ร่างกาย บาดแผลถาวร การต่อสู้ โอกาสตรงไปตรงมา", () => {
  it("โอกาสที่แสดงตรงกับผลจริง (บุกเต็มกำลังยกแรก)", () => {
    let wins = 0, shown = 0;
    const N = 3000;
    for (let s = 1; s <= N; s++) {
      const l = createLife({ seed: 900 + s, worldId: "murim" });
      l.age = 25;
      l.stats.health = 90;
      awaken(l, 3, "m_sword");
      startDuel(l, { foe: "คู่ซ้อม", rank: 3 });
      const q = l.queue[0];
      const idx = visibleChoices(l, q).find(({ c }) => String(c.label) === "บุกเต็มกำลัง")!.index;
      shown += choiceChance(l, q, idx)!;
      const before = Number(q.ctx.fhp);
      resolveChoice(l, idx);
      if (Number(l.queue[0]?.ctx.fhp ?? 0) < before) wins++;
    }
    const expected = shown / N, actual = wins / N;
    console.log("SIM P3 โอกาสที่แสดง", expected.toFixed(3), "| ผลจริง", actual.toFixed(3));
    expect(Math.abs(expected - actual)).toBeLessThan(0.03);
  });

  it("บาดแผลถาวรลดพลังจริง · แผลเบาหายตามเวลา · ฝึกมืออีกข้างครบสามปีได้ผล", () => {
    const l = createLife({ seed: 31, worldId: "murim" });
    l.age = 25;
    awaken(l, 4, "m_sword");
    const full = combatPower(l);
    injure(l, "armR", "severed", 3, "ทดสอบ");
    expect(combatFactor(l)).toBeLessThan(0.6);
    expect(combatPower(l)).toBeLessThan(full * 0.6);
    expect(disabilities(l).some((d) => d.includes("แขนขวาขาด"))).toBe(true);
    bodyOf(l).offHandFrom = l.age;
    injure(l, "legL", "cut", 1);
    for (let i = 0; i < 3; i++) { l.age++; tickBody(l); }
    expect(l.body!.offHand).toBe(true);
    expect(l.body!.injuries.some((i) => i.kind === "cut")).toBe(false);
    expect(combatFactor(l)).toBeGreaterThan(0.8);
    // แผลหนักๆ จากการปะทะ บางครั้งกลายเป็นความพิการถาวร
    let perm = 0;
    for (let s = 0; s < 400; s++) { const x = createLife({ seed: 5000 + s, worldId: "murim" }); woundFrom(x, 30, "ทดสอบ"); perm += permanentInjuries(x).length; }
    expect(perm).toBeGreaterThan(5);
    expect(perm).toBeLessThan(120);
  });

  it("ชีวิตจำลอง: ต่อสู้เกิดจริง บาดเจ็บถาวรไม่มากเกินไป ไม่มีฉากค้าง", () => {
    const N = 150;
    let duels = 0, permLives = 0, dead = 0, ages = 0;
    for (let s = 1; s <= N; s++) {
      const l = createLife({ seed: s * 7919, worldId: "murim" });
      const r = { rng: s * 11 };
      let guard = 0;
      while (l.alive && guard++ < 130) {
        drain(l, r);
        if (!l.alive) break;
        const opts = plansFor(l);
        if (opts.length && nextFloat(r) < 0.3) setPlan(l, opts[Math.floor(nextFloat(r) * opts.length)].id);
        ageUp(l);
      }
      drain(l, r);
      duels += l.seen.duel ?? 0;
      if (permanentInjuries(l).length) permLives++;
      if (!l.alive) { dead++; ages += l.age; }
      expect(Number.isFinite(l.money)).toBe(true);
    }
    console.log("SIM P3 ต่อสู้", duels, "| ชีวิตที่มีบาดแผลถาวร", permLives, "/", N, "| อายุขัยเฉลี่ย", (ages / Math.max(1, dead)).toFixed(1));
    expect(duels).toBeGreaterThan(N * 0.5);
    expect(permLives).toBeGreaterThan(N * 0.05);
    expect(permLives).toBeLessThan(N * 0.6);
    expect(ages / Math.max(1, dead)).toBeGreaterThan(42);
  });
});
