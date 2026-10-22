import { describe, expect, it } from "vitest";
import { loadMurimWorld } from "../content/murim";
import { loadSharedEvents } from "../content/shared";
import { worldOfLife } from "../content/murim/life/world";
import { allEvents, eligibilityFilters, visibleChoices, type Choice } from "./events";
import { ageUp, createLife, resolveChoice } from "./game";
import { nextFloat } from "./rng";
import type { Life } from "./types";

loadMurimWorld();
loadSharedEvents();

const murimEvents = () => {
  const l = createLife({ seed: 5, worldId: "murim" });
  return allEvents().filter((e) => (!e.world || e.world === "murim") && !e.notIn?.includes("murim") && eligibilityFilters.every((f) => f(l, e)));
};

/** ฉากที่ตัวเลือกถูกกรองจากข้อมูลในฉากเอง และรับประกันว่ามีอย่างน้อยหนึ่งตัวเลือกเสมอ */
const ALWAYS_OFFERED = new Set(["mk.assessment/style"]);

describe("Murim Phase 8: เนื้อเรื่อง 600+ และ % ตามความสามารถ", () => {
  it("มีเรื่องในยุทธภพอย่างน้อย 600 เรื่อง", () => {
    expect(murimEvents().length).toBeGreaterThanOrEqual(600);
  });

  it("ทุกตัวเลือกที่มี % ขึ้นกับความสามารถของตัวละคร (เก่งกว่า = โอกาสสูงกว่าหรือเท่ากัน และไม่คงที่ทุกตัว)", () => {
    const weak = createLife({ seed: 11, worldId: "murim" });
    const strong = createLife({ seed: 11, worldId: "murim" });
    for (const k of ["health", "happiness", "smarts", "looks", "luck"] as const) { weak.stats[k] = 15; strong.stats[k] = 90; }
    strong.power = { rank: 4, hunterClass: "m_sword", level: 30, exp: 0, skills: [], gates: 0, bossKills: 0, awakenedAt: 15, items: [] };
    const fixed: string[] = [];
    for (const e of murimEvents()) {
      const scenes = [e.choices ?? [], ...Object.values(e.scenes ?? {}).map((s) => s.choices)];
      for (const list of scenes) for (const c of list as Choice[]) {
        if (!c.odds) continue;
        try {
          const a = c.odds(weak, {}), b = c.odds(strong, {});
          if (Math.abs(a - b) < 1e-9) fixed.push(`${e.id}: ${typeof c.label === "string" ? c.label : "?"}`);
        } catch { /* ตัวเลือกที่ต้องมีคนในฉาก */ }
      }
    }
    const story = fixed.filter((f) => /^(dl|sl|el|ch|rr|yt|ad|ms|rg|jb|ft|fm|cr|tv|mk|rk|sc|mw|jh|rm|iv)\./.test(f));
    expect(story, story.join("\n")).toEqual([]);
  });

  it("ทุกฉากของเรื่องใหม่มีอย่างน้อยหนึ่งตัวเลือกที่เลือกได้เสมอ (ไม่ติดเงิน/เงื่อนไข)", () => {
    const stuck: string[] = [];
    for (const e of murimEvents()) {
      if (!/^(dl|sl|el|ch|rr|yt|ad|ms|rg|gen|jb|ft|fm|cr|tv|mk|rk|sc|mw|jh|rm|iv)\./.test(e.id) || e.auto) continue;
      const scenes = { start: e.choices ?? [], ...Object.fromEntries(Object.entries(e.scenes ?? {}).map(([k, s]) => [k, s.choices])) };
      for (const [k, list] of Object.entries(scenes)) if (!ALWAYS_OFFERED.has(`${e.id}/${k}`) && !(list as Choice[]).some((c) => !c.show && !c.req)) stuck.push(`${e.id}/${k}`);
    }
    expect(stuck, stuck.join("\n")).toEqual([]);
  });

  it("ชีวิตสุ่ม 150 ชีวิต เจอเรื่องใหม่ได้ ไม่มีฉากตัน ข้อมูลไม่พัง", () => {
    const N = 150;
    const seenNew: Record<string, number> = {};
    let rolls = 0, effects = 0;
    for (let s = 1; s <= N; s++) {
      const l: Life = createLife({ seed: s * 4409, worldId: "murim" });
      worldOfLife(l);
      const r = { rng: s * 13 };
      let guard = 0;
      while (l.alive && guard++ < 120) {
        let g = 0;
        while (l.queue.length && g++ < 80) {
          const o = visibleChoices(l, l.queue[0]);
          expect(o.length, `ไม่มีตัวเลือกใน ${l.queue[0].eventId}/${l.queue[0].scene ?? "start"}`).toBeGreaterThan(0);
          const out = resolveChoice(l, o[Math.floor(nextFloat(r) * o.length)].index);
          if (out?.roll) rolls++;
          if (out?.effects && (out.effects.good.length || out.effects.bad.length)) effects++;
        }
        if (!l.alive) break;
        ageUp(l);
      }
      for (const [k, v] of Object.entries(l.seen)) { const p = k.split(".")[0]; if (/^(dl|sl|el|ch|rr|yt|ad|ms|rg)$/.test(p)) seenNew[p] = (seenNew[p] ?? 0) + v; }
      expect(JSON.parse(JSON.stringify(l))).toEqual(l);
    }
    console.log("SIM P8 เรื่องใหม่", JSON.stringify(seenNew), "| ลุ้น%", rolls, "| ผลได้/เสีย", effects);
    for (const p of ["dl", "sl", "el", "yt", "ad", "ms", "rg"]) expect(seenNew[p] ?? 0, p).toBeGreaterThan(5);
    expect(rolls).toBeGreaterThan(N);
  });
});
