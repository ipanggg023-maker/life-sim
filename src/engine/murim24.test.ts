import { describe, expect, it } from "vitest";
import { loadMurimWorld } from "../content/murim";
import { loadSharedEvents } from "../content/shared";
import { ROMANCE_EVENTS } from "../content/murim/life/romance";
import { worldOfLife } from "../content/murim/life/world";
import { feel } from "./npc";
import { getEvent, labelOf, visibleChoices } from "./events";
import { ageUp, createLife, resolveChoice, runEvent, tryForBaby } from "./game";
import { nextFloat } from "./rng";
import type { Life } from "./types";
import { createPerson, relationLabel } from "./util";
import { validateLife } from "./validate";

loadMurimWorld();
loadSharedEvents();

const base = (seed: number) => {
  const l = createLife({ seed, worldId: "murim" });
  worldOfLife(l);
  l.age = 28; l.money = 1_000_000; l.fame = 50; l.wealth = "rich"; l.stats.looks = 70;
  l.power = { rank: 2, hunterClass: "m_sword", level: 20, exp: 0, skills: [], gates: 0, bossKills: 0, awakenedAt: 12, items: [] };
  return l;
};
const other = (l: Life) => (l.gender === "m" ? "f" : "m");
/** ตั้งสถานการณ์ให้แต่ละเรื่องเกิดได้ */
const SETUP: Record<string, (l: Life) => void> = {
  "lv.enemy_meet": () => {},
  "lv.forbidden_found": (l) => { const p = createPerson(l, "partner", { gender: other(l), age: l.age, bond: 70 }); p.tags = ["forbidden"]; },
  "lv.foe_child": (l) => { const f = createPerson(l, "rival", { age: 50, bond: 10 }); feel(f, { grudge: 80 }); },
  "lv.temptation": (l) => { createPerson(l, "spouse", { gender: other(l), age: l.age, bond: 60 }); l.flags.temptedAge = l.age; },
  "lv.affair_found": (l) => { createPerson(l, "spouse", { gender: other(l), age: l.age, bond: 60 }); const lv = createPerson(l, "friend", { age: l.age, bond: 60 }); lv.tags = ["secret_lover"]; l.flags.affairFound = lv.id; },
  "lv.spouse_cheats": (l) => { const s = createPerson(l, "spouse", { gender: other(l), age: l.age, bond: 40 }); l.flags.spouseAffair = s.id; },
  "lv.love_rival": (l) => { createPerson(l, "partner", { gender: other(l), age: l.age, bond: 60 }); },
  "lv.jealous": (l) => { createPerson(l, "partner", { gender: other(l), age: l.age, bond: 60 }); },
  "lv.arranged": (l) => { l.age = 20; createPerson(l, "partner", { gender: other(l), age: 20, bond: 60 }); },
  "lv.arranged_heart": (l) => { const s = createPerson(l, "spouse", { gender: other(l), age: l.age, bond: 30 }); s.tags = ["arranged"]; },
  "lv.political": () => {},
  "lv.ss_confide": (l) => { createPerson(l, "friend", { gender: l.gender, age: l.age, bond: 70 }); },
  "lv.ss_union": (l) => { createPerson(l, "partner", { gender: l.gender, age: l.age, bond: 70 }); },
  "lv.ss_pressure": (l) => { const s = createPerson(l, "spouse", { gender: l.gender, age: l.age, bond: 70 }); s.tags = ["secret_union"]; },
};
function drain(l: Life, r: { rng: number }) {
  let g = 0;
  while (l.queue.length && g++ < 60) { const o = visibleChoices(l, l.queue[0]); expect(o.length, `ตันใน ${l.queue[0].eventId}`).toBeGreaterThan(0); resolveChoice(l, o[Math.floor(nextFloat(r) * o.length)].index); }
}

describe("เฟส B: ดราม่าความรัก", () => {
  it("ทุกเรื่องความรักเกิดได้ และทุกตัวเลือกเล่นได้ไม่ตัน สถานะไม่เสีย", () => {
    for (const e of ROMANCE_EVENTS) {
      const setup = SETUP[e.id];
      expect(setup, `ไม่มีการตั้งสถานการณ์ของ ${e.id}`).toBeTruthy();
      const probe = base(1);
      setup(probe);
      expect(!e.when || e.when(probe), `${e.id} ไม่เกิดในสถานการณ์ที่ตั้ง`).toBe(true);
      runEvent(probe, e.id);
      const n = visibleChoices(probe, probe.queue[0]).length;
      expect(n, `${e.id} ไม่มีตัวเลือก`).toBeGreaterThan(0);
      for (let i = 0; i < n; i++) {
        for (const s of [3, 4]) {
          const l = base(s * 10 + i);
          setup(l);
          runEvent(l, e.id);
          const o = visibleChoices(l, l.queue[0]);
          if (!o[i]) continue;
          resolveChoice(l, o[i].index);
          drain(l, { rng: s + i });
          expect(validateLife(l)).toEqual([]);
          expect(l.flags.affairFound ?? false).toBeFalsy();
          expect(l.flags.spouseAffair ?? false).toBeFalsy();
        }
      }
    }
  });

  it("ถูกจับได้ว่านอกใจแล้วเลือกคนรักลับ = หย่าจริง แต่งกับคนรักจริง", () => {
    const l = base(7);
    SETUP["lv.affair_found"](l);
    const old = l.people.find((p) => p.relation === "spouse")!;
    const lover = l.people.find((p) => p.tags?.includes("secret_lover"))!;
    runEvent(l, "lv.affair_found");
    const pickLover = visibleChoices(l, l.queue[0]).find((o) => labelOf(o.c, l, l.queue[0].ctx).startsWith("เลือกคนรักลับ"))!;
    resolveChoice(l, pickLover.index);
    expect(old.relation).not.toBe("spouse");
    expect(lover.relation).toBe("spouse");
    expect(lover.tags).not.toContain("secret_lover");
  });

  it("ความรักเพศเดียวกัน: พิธีลับ ป้ายชื่อคู่ชีวิต และมีลูกเองไม่ได้ (รับเลี้ยงแทน)", () => {
    const l = base(9);
    SETUP["lv.ss_union"](l);
    const p = l.people.find((x) => x.relation === "partner")!;
    runEvent(l, "lv.ss_union");
    const vow = visibleChoices(l, l.queue[0]).find((o) => labelOf(o.c, l, l.queue[0].ctx).startsWith("สาบานต่อฟ้าดิน"))!;
    resolveChoice(l, vow.index);
    expect(p.relation).toBe("spouse");
    expect(p.tags).toContain("secret_union");
    expect(relationLabel(p, l)).toContain("คู่ชีวิต");
    const kids = l.people.filter((x) => x.relation === "child").length;
    const out = tryForBaby(l, p);
    expect(out.text).toContain("รับเลี้ยง");
    expect(l.people.filter((x) => x.relation === "child").length).toBe(kids);
    expect(getEvent("lv.ss_pressure")!.when!(l)).toBe(true);
  });

  it("ชีวิตสุ่ม 100 ชีวิต: เรื่องความรักเกิดขึ้นเองตามสถานการณ์ ไม่มีฉากตัน และธงไม่ค้าง", () => {
    const seen = new Map<string, number>();
    for (let s = 1; s <= 100; s++) {
      const l = createLife({ seed: s * 8191, worldId: "murim" });
      worldOfLife(l);
      const r = { rng: s };
      let g = 0;
      while (l.alive && g++ < 90) {
        drain(l, r);
        if (!l.alive) break;
        ageUp(l);
        for (const q of l.queue) if (q.eventId.startsWith("lv.")) seen.set(q.eventId, (seen.get(q.eventId) ?? 0) + 1);
        drain(l, r);
        expect(validateLife(l)).toEqual([]);
      }
      expect(JSON.parse(JSON.stringify(l))).toEqual(l);
    }
    console.log("SIM romance events", JSON.stringify([...seen].sort((a, b) => b[1] - a[1])));
    expect(seen.size).toBeGreaterThanOrEqual(6);
  });
});
