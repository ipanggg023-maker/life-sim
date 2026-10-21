import { describe, expect, it } from "vitest";
import { loadMurimWorld } from "../content/murim";
import { loadSharedEvents } from "../content/shared";
import { spouses } from "../content/murim/life/household";
import { plansFor, setPlan } from "../content/murim/life/plan";
import { visibleChoices } from "./events";
import { ageUp, createLife, propose, resolveChoice, spendTime, tryForBaby } from "./game";
import { nextFloat } from "./rng";
import type { Life } from "./types";
import { createPerson, relationLabel } from "./util";

loadMurimWorld();
loadSharedEvents();

function drain(l: Life, r: { rng: number }) {
  let g = 0;
  while (l.queue.length && g++ < 80) {
    const o = visibleChoices(l, l.queue[0]);
    expect(o.length, `ไม่มีตัวเลือกใน ${l.queue[0].eventId}/${l.queue[0].scene ?? "start"}`).toBeGreaterThan(0);
    resolveChoice(l, o[Math.floor(nextFloat(r) * o.length)].index);
  }
}

describe("Murim Phase 5: ครัวเรือน ทายาท อาจารย์–ศิษย์ ความกตัญญู", () => {
  it("แต่งงานเพิ่มขณะมีคู่สมรส = ฮูหยินรอง และคนเดิมจำได้", () => {
    const l = createLife({ seed: 404, worldId: "murim", gender: "m" });
    l.age = 25;
    const wife = createPerson(l, "spouse", { gender: "f", age: 24, bond: 80 });
    const lover = createPerson(l, "partner", { gender: "f", age: 20, bond: 95 });
    let tries = 0;
    while (lover.relation !== "spouse" && tries++ < 30) { l.doneThisYear = []; propose(l, lover); }
    expect(lover.relation).toBe("spouse");
    expect(lover.tags).toContain("secondary");
    expect(relationLabel(lover, l)).toBe("ฮูหยินรอง");
    expect(relationLabel(wife, l)).toBe("ฮูหยิน");
    expect(wife.mem?.some((m) => m.k === "second_wife")).toBe(true);
    expect(wife.rel!.jealousy).toBeGreaterThan(0);
  });

  it("ชีวิตจำลอง: เรื่องในบ้านเกิดจริง ลูกได้เส้นทาง มีการเลือกทายาท ไม่มีฉากค้าง", () => {
    const N = 150;
    const seen = new Map<string, number>();
    let heirs = 0, paths = 0, multi = 0;
    for (let s = 1; s <= N; s++) {
      const l = createLife({ seed: s * 9001, worldId: "murim", gender: s % 3 === 0 ? "f" : "m" });
      const r = { rng: s * 13 };
      let guard = 0;
      while (l.alive && guard++ < 120) {
        drain(l, r);
        if (!l.alive) break;
        const opts = plansFor(l);
        if (opts.length && nextFloat(r) < 0.3) setPlan(l, opts[Math.floor(nextFloat(r) * opts.length)].id);
        if (l.age >= 20 && l.age <= 35 && !spouses(l).length && nextFloat(r) < 0.3) createPerson(l, "spouse", { gender: l.gender === "m" ? "f" : "m", age: l.age, bond: 70 });
        const sp = spouses(l)[Math.floor(nextFloat(r) * Math.max(1, spouses(l).length))];
        if (sp && l.age <= 45 && nextFloat(r) < 0.6) tryForBaby(l, sp);
        if (sp && nextFloat(r) < 0.5) spendTime(l, sp);
        if (l.age >= 18) l.money += 60_000;
        ageUp(l);
      }
      drain(l, r);
      for (const [k, v] of Object.entries(l.seen)) if (k.startsWith("hh.") || k.startsWith("md.")) seen.set(k, (seen.get(k) ?? 0) + v);
      if (l.flags.heirId) heirs++;
      paths += l.people.filter((p) => p.tags?.some((t) => t.startsWith("path:"))).length;
      if (l.people.some((p) => p.tags?.includes("secondary"))) multi++;
      expect(Number.isFinite(l.money)).toBe(true);
    }
    console.log("SIM P5 เรื่องในบ้าน", JSON.stringify(Object.fromEntries(seen)), "| มีทายาท", heirs, "| ลูกได้เส้นทาง", paths, "| ครัวเรือนหลายภรรยา", multi);
    expect(seen.get("hh.child_path") ?? 0).toBeGreaterThan(N * 0.3);
    expect(heirs).toBeGreaterThan(5);
    expect(multi).toBeGreaterThan(3);
  });
});
