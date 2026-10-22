import { describe, expect, it } from "vitest";
import { loadMurimWorld } from "../content/murim";
import { loadSharedEvents } from "../content/shared";
import { CAREERS } from "../content/hunter/careers";
import { worldOfLife } from "../content/murim/life/world";
import { DAILY3_EVENTS } from "../content/murim/story/daily3";
import { JOB2A_EVENTS } from "../content/murim/story/jobs2a";
import { JOB2B_EVENTS } from "../content/murim/story/jobs2b";
import { JOB2C_EVENTS } from "../content/murim/story/jobs2c";
import type { GameEvent } from "./events";
import { allEvents, labelOf, visibleChoices } from "./events";
import { isRetiredInMurim } from "../content/murim/story";
import { createLife, resolveChoice, runEvent } from "./game";
import { nextFloat } from "./rng";
import type { Life } from "./types";
import { createPerson } from "./util";
import { validateLife } from "./validate";

loadMurimWorld();
loadSharedEvents();

const MURIM_JOBS = CAREERS.filter((c) => c.world === "murim").map((c) => c.id);

/** หาชีวิตที่ event นี้เกิดได้ (ลองทุกอาชีพ ทุกช่วงอายุ) */
function lifeFor(e: GameEvent, seed: number): Life | undefined {
  for (const age of [e.minAge ?? 10, Math.round(((e.minAge ?? 10) + Math.min(e.maxAge ?? 80, 80)) / 2)]) {
    for (const j of [undefined, ...MURIM_JOBS]) {
      const l = createLife({ seed, worldId: "murim" });
      worldOfLife(l);
      l.age = age; l.money = 500_000; l.stats.health = 85;
      l.power = { rank: 2, hunterClass: "m_sword", level: 20, exp: 0, skills: [], gates: 0, bossKills: 0, awakenedAt: 12, items: [] };
      if (j) l.job = { careerId: j, level: 2, performance: 60, years: 3 };
      if (age >= 25) { createPerson(l, "child", { age: 8, bond: 70 }); createPerson(l, "child", { age: 30, bond: 70 }); }
      if (!e.when || e.when(l)) return l;
    }
  }
  return undefined;
}

describe("แพ็กเหตุการณ์ละเอียด: อาชีพทุกสายและชีวิตประจำวัน", () => {
  const all = [...JOB2A_EVENTS, ...JOB2B_EVENTS, ...JOB2C_EVENTS, ...DAILY3_EVENTS];

  it("ทุกอาชีพยุทธภพมีเรื่องของตัวเองอย่างน้อยสามเรื่อง", () => {
    const evs = allEvents().filter((e) => !isRetiredInMurim(e.id) && !e.manual && e.when);
    const thin: string[] = [];
    for (const j of MURIM_JOBS) {
      const ids = new Set<string>();
      for (const age of [20, 35, 50]) {
        const l = createLife({ seed: 7, worldId: "murim" });
        worldOfLife(l);
        l.age = age; l.money = 500_000;
        const base = new Set(evs.filter((e) => { try { return e.when!(l); } catch { return false; } }).map((e) => e.id));
        l.job = { careerId: j, level: 3, performance: 60, years: 5 };
        for (const e of evs) { let w = false; try { w = e.when!(l); } catch { /* ไม่เกี่ยว */ } if (w && !base.has(e.id)) ids.add(e.id); }
      }
      if (ids.size < 3) thin.push(`${j}:${ids.size}`);
    }
    expect(thin).toEqual([]);
    expect(all.length).toBeGreaterThanOrEqual(70);
  });

  it("ทุกตัวเลือกของทุกเหตุการณ์เล่นได้ ไม่ตัน และสถานะไม่เสีย", () => {
    let played = 0;
    for (const e of all) {
      const probe = lifeFor(e, 11);
      expect(probe, `หาชีวิตที่ ${e.id} เกิดได้ไม่เจอ`).toBeTruthy();
      if (e.auto) { runEvent(probe!, e.id); expect(validateLife(probe!)).toEqual([]); played++; continue; }
      runEvent(probe!, e.id);
      const n = visibleChoices(probe!, probe!.queue[0]).length;
      expect(n, `${e.id} ไม่มีตัวเลือก`).toBeGreaterThan(0);
      for (let i = 0; i < n; i++) {
        for (const s of [1, 2]) {
          const l = lifeFor(e, 100 + s * 7 + i)!;
          runEvent(l, e.id);
          const o = visibleChoices(l, l.queue[0]);
          if (!o[i]) continue;
          expect(labelOf(o[i].c, l, l.queue[0].ctx).length).toBeGreaterThan(0);
          resolveChoice(l, o[i].index);
          const r = { rng: s + i };
          let g = 0;
          while (l.queue.length && g++ < 60) { const x = visibleChoices(l, l.queue[0]); expect(x.length, `ตันใน ${l.queue[0].eventId}`).toBeGreaterThan(0); resolveChoice(l, x[Math.floor(nextFloat(r) * x.length)].index); }
          expect(validateLife(l)).toEqual([]);
          played++;
        }
      }
    }
    console.log("SIM new events", all.length, "choices played", played);
    expect(played).toBeGreaterThan(300);
  });
});
