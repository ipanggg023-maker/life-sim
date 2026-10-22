import { describe, expect, it } from "vitest";
import { loadMurimWorld } from "../content/murim";
import { loadSharedEvents } from "../content/shared";
import { buildDisciple, inheritMurim, lifeSummary, recordChronicle } from "../content/murim/life/generations";
import { learn } from "../content/murim/martial/arts";
import { worldOfLife } from "../content/murim/life/world";
import { visibleChoices } from "./events";
import { ageUp, createLife, resolveChoice } from "./game";
import { nextFloat } from "./rng";
import { buildHeir, heirsOf, nextEraOptions } from "./soul";
import type { Life, Soul } from "./types";
import { createPerson } from "./util";

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

function live(l: Life, r: { rng: number }, years = 120) {
  let guard = 0;
  while (l.alive && guard++ < years) {
    drain(l, r);
    if (!l.alive) break;
    ageUp(l);
  }
  drain(l, r);
}

const soul = (): Soul => ({ version: 1, points: 0, totalPoints: 0, lives: 0, achievements: [], awarded: [], perks: { blessing: 0, reroll: 0, clarity: false } });

describe("Murim Phase 7: ข้ามรุ่น", () => {
  it("ลูก ศิษย์ และคนยุคหลัง รับโลกและมรดกต่อได้ เล่นต่อได้ไม่พัง", () => {
    const s = soul();
    let heirs = 0, pupils = 0, eras = 0, gen = 0;
    for (let i = 1; i <= 30; i++) {
      const r = { rng: i * 11 };
      const dead = createLife({ seed: i * 9341, worldId: "murim" });
      worldOfLife(dead);
      live(dead, r);
      // บังคับให้มีศิษย์ที่ได้รับวิชา
      learn(dead, "a_long_fist", "ทดสอบ", true);
      const d = createPerson(dead, "ally", { age: 20, bond: 70 });
      d.tags = ["disciple", "art:a_long_fist"];
      d.alive = true;
      const kid = createPerson(dead, "child", { age: 16, bond: 60 });
      kid.tags = ["art:a_long_fist"];
      dead.alive = false;
      recordChronicle(s, dead);
      const sum = lifeSummary(dead);
      expect(sum.family).toBeTruthy();

      const p = buildDisciple(dead, d.id);
      expect(p.mw?.era).toBe(dead.mw?.era);
      expect(p.mwArts?.some((a) => a.id === "a_long_fist")).toBe(true);
      expect(p.flags.plName).toBeTruthy();
      live(p, r, 30);
      expect(JSON.parse(JSON.stringify(p))).toEqual(p);
      pupils++;

      const kids = heirsOf(dead);
      if (kids.length) {
        const h = buildHeir(dead, kid.id);
        inheritMurim(dead, h, "heir", kid.id);
        expect(h.mw).toBeTruthy();
        expect(h.mwArts?.some((a) => a.id === "a_long_fist")).toBe(true);
        live(h, r, 30);
        expect(JSON.parse(JSON.stringify(h))).toEqual(h);
        heirs++;
      }

      const e = createLife({ ...nextEraOptions(dead), seed: i * 77 });
      inheritMurim(dead, e, "era");
      expect(e.mw?.eraSince).toBe(e.birthYear);
      live(e, r, 60);
      for (const [k, v] of Object.entries(e.seen)) if (k.startsWith("gen.")) gen += v;
      eras++;
    }
    console.log("SIM P7 ศิษย์", pupils, "| ลูก", heirs, "| ยุคหลัง", eras, "| ฉากข้ามรุ่น", gen, "| บันทึก", s.chronicle?.length);
    expect(s.chronicle!.length).toBeGreaterThanOrEqual(30);
    expect(gen).toBeGreaterThan(5);
  });
});
