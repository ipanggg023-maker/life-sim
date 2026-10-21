import { describe, expect, it } from "vitest";
import { loadMurimWorld } from "../content/murim";
import { loadSharedEvents } from "../content/shared";
import { YEAR_PLANS, applyPlan, plansFor, setPlan } from "../content/murim/life/plan";
import { priceIndex, worldOfLife } from "../content/murim/life/world";
import { visibleChoices } from "./events";
import { ageUp, createLife, resolveChoice } from "./game";
import { buildReport, snapshot } from "./report";
import { nextFloat } from "./rng";
import type { Life } from "./types";

loadMurimWorld();
loadSharedEvents();

function drain(l: Life, r: { rng: number }) {
  let g = 0;
  while (l.queue.length && g++ < 60) {
    const o = visibleChoices(l, l.queue[0]);
    expect(o.length, `ไม่มีตัวเลือกใน ${l.queue[0].eventId}/${l.queue[0].scene ?? "start"}`).toBeGreaterThan(0);
    resolveChoice(l, o[Math.floor(nextFloat(r) * o.length)].index);
  }
}

describe("Murim Phase 1: ชีวิตรายปี สภาพโลก วิกฤต", () => {
  it("โลกเปลี่ยนยุคจากแรงกดดัน วิกฤตเดินครบ 5 ระยะ แผนของปีมีผล และไม่มีค่าพัง", () => {
    const N = 160;
    let eraChanges = 0, crisesDone = 0, crisisChoices = 0, planLogs = 0, reports = 0;
    const kinds = new Set<string>();
    for (let s = 1; s <= N; s++) {
      const l = createLife({ seed: s * 4099, worldId: "murim" });
      const r = { rng: s * 7 };
      worldOfLife(l);
      let guard = 0;
      while (l.alive && guard++ < 130) {
        drain(l, r);
        if (!l.alive) break;
        // บอทเปลี่ยนแผนบ้างเป็นครั้งคราว
        const opts = plansFor(l);
        if (opts.length && nextFloat(r) < 0.3) setPlan(l, opts[Math.floor(nextFloat(r) * opts.length)].id);
        const logBefore = l.log.length;
        const before = snapshot(l);
        ageUp(l);
        const rep = buildReport(l, before);
        if (rep.lines.length) reports++;
        planLogs += l.log.slice(logBefore).filter((e) => YEAR_PLANS.some((p) => e.text.startsWith(p.emoji))).length;
        eraChanges += l.log.slice(logBefore).filter((e) => e.text.startsWith("🏮 แผ่นดินเข้าสู่")).length;
        expect(Number.isFinite(l.money), `เงินพังที่อายุ ${l.age}`).toBe(true);
        for (const v of Object.values(l.stats)) expect(v >= 0 && v <= 100).toBe(true);
        expect(priceIndex(l)).toBeGreaterThan(0);
      }
      const w = l.mw!;
      crisesDone += w.past?.length ?? 0;
      for (const p of w.past ?? []) kinds.add(p.id);
      crisisChoices += Object.keys(l.seen).filter((k) => k.startsWith("mw.")).reduce((a, k) => a + l.seen[k], 0);
    }
    console.log("SIM Murim P1 เปลี่ยนยุค", eraChanges, "| วิกฤตจบครบ", crisesDone, "| ชนิด", [...kinds].join(","), "| ฉากตัดสินใจวิกฤต", crisisChoices, "| ผลแผน", planLogs, "| ปีที่มีสรุป", reports);
    expect(eraChanges).toBeGreaterThan(N * 0.5);
    expect(crisesDone).toBeGreaterThan(N * 0.3);
    expect(kinds.size).toBeGreaterThanOrEqual(3);
    expect(crisisChoices).toBeGreaterThan(N * 0.2);
    expect(planLogs).toBeGreaterThan(N * 5);
  });

  it("แผนที่หมดช่วงวัยถูกล้าง และแผนของเด็กใช้ไม่ได้ตอนโต", () => {
    const l = createLife({ seed: 77, worldId: "murim" });
    l.age = 11;
    setPlan(l, "play");
    l.age = 12;
    applyPlan(l);
    expect(l.flags.plan).toBeUndefined();
    expect(plansFor(l).some((p) => p.id === "play")).toBe(false);
    expect(plansFor(l).some((p) => p.id === "train")).toBe(true);
  });

  it("ข้ามหลายปีหยุดเมื่อมีเรื่องให้ตัดสินใจ", () => {
    let stopped = 0;
    for (let s = 1; s <= 30; s++) {
      const l = createLife({ seed: s * 31, worldId: "murim" });
      const r = { rng: s };
      while (l.alive && l.age < 40) {
        drain(l, r);
        for (let i = 0; i < 3; i++) {
          ageUp(l);
          if (!l.alive || l.queue.length) break;
        }
        if (l.queue.length) stopped++;
      }
    }
    expect(stopped).toBeGreaterThan(30);
  });
});
