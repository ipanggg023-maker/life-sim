import { describe, expect, it } from "vitest";
import { loadMurimWorld } from "../content/murim";
import { loadSharedEvents } from "../content/shared";
import { mainGoal } from "../content/murim/life/goals";
import { plansFor, setPlan } from "../content/murim/life/plan";
import { visibleChoices } from "./events";
import { ageUp, createLife, resolveChoice, spendTime, tryForBaby } from "./game";
import { feel, relOf, remember, reveal, traitsOf } from "./npc";
import { nextFloat } from "./rng";
import type { Life } from "./types";
import { createPerson } from "./util";

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

describe("Murim Phase 2: เป้าหมายชีวิต · NPC มีความรู้สึกและความทรงจำ", () => {
  it("ความแค้นของคนเจ้าคิดเจ้าแค้นหนักกว่า · ทำลับหลังยังไม่แค้นจนกว่าจะรู้ · ความสนิทขยับตามความรู้สึก", () => {
    const l = createLife({ seed: 5, worldId: "murim" });
    const p = createPerson(l, "friend", { age: 20, bond: 50 });
    p.traits = ["vengeful", "envious"];
    const q = createPerson(l, "friend", { age: 20, bond: 50 });
    q.traits = ["generous", "gentle"];
    remember(l, p, "insult", "ดูถูก", 2, { grudge: 20 });
    remember(l, q, "insult", "ดูถูก", 2, { grudge: 20 });
    expect(relOf(p).grudge).toBeGreaterThan(relOf(q).grudge);
    expect(p.bond).toBeLessThan(50);
    const s = createPerson(l, "friend", { age: 20, bond: 50 });
    remember(l, s, "stole", "ขโมยของ", 3, { grudge: 40 }, false);
    expect(relOf(s).grudge).toBe(0);
    expect(reveal(s, "stole", 30)).toBe(true);
    expect(relOf(s).grudge).toBeGreaterThan(20);
    const b = s.bond;
    feel(s, { love: 20 });
    expect(s.bond).toBeGreaterThan(b);
    expect(traitsOf(s).length).toBeGreaterThanOrEqual(2);
    expect(traitsOf(s)).toEqual(traitsOf(s)); // คงที่
  });

  it("ชีวิตจำลอง: ทุกคนได้ตั้งเป้าหมาย บางคนสำเร็จ NPC ลงมือเอง ความรู้สึกอยู่ในช่วง", () => {
    const N = 150;
    let chose = 0, won = 0, revenge = 0, npcActs = 0, memories = 0, changed = 0;
    const wonKinds = new Set<string>();
    for (let s = 1; s <= N; s++) {
      const l = createLife({ seed: s * 6007, worldId: "murim" });
      const r = { rng: s * 3 };
      let guard = 0;
      while (l.alive && guard++ < 120) {
        drain(l, r);
        if (!l.alive) break;
        const opts = plansFor(l);
        if (opts.length && nextFloat(r) < 0.3) setPlan(l, opts[Math.floor(nextFloat(r) * opts.length)].id);
        for (const p of l.people.filter((x) => x.alive).slice(0, 3)) if (nextFloat(r) < 0.3) spendTime(l, p);
        if (l.age >= 22 && l.age <= 40 && !l.people.some((p) => p.relation === "spouse" && p.alive) && nextFloat(r) < 0.2) createPerson(l, "spouse", { age: l.age, bond: 70 });
        const sp = l.people.find((p) => p.relation === "spouse" && p.alive);
        if (sp && l.age <= 40 && nextFloat(r) < 0.5) tryForBaby(l, sp);
        if (l.age >= 18) l.money += 40_000;
        const before = l.log.length;
        ageUp(l);
        npcActs += l.log.slice(before).filter((e) => /^(🐍|🔥|🎐|💔 .*เก็บข้าวของ|ข่าวจากคนรู้จัก)/.test(e.text) || e.text.includes("แอบใส่เงิน")).length;
        for (const p of l.people) {
          if (!p.rel) continue;
          for (const v of Object.values(p.rel)) expect(v >= 0 && v <= 100).toBe(true);
          expect(p.bond >= 0 && p.bond <= 100).toBe(true);
        }
      }
      if (l.goals?.length) chose++;
      for (const g of l.goals ?? []) {
        if (g.end === "won") { won++; wonKinds.add(g.id); }
        if (g.end === "changed") changed++;
        if (g.id === "revenge") revenge++;
      }
      memories += l.people.reduce((a, p) => a + (p.mem?.length ?? 0), 0);
      expect(Number.isFinite(l.money)).toBe(true);
      if (l.alive) expect(mainGoal(l) === undefined || typeof mainGoal(l)!.id === "string").toBe(true);
    }
    console.log("SIM Murim P2 ตั้งเป้า", chose, "/", N, "| สำเร็จ", won, [...wonKinds].join(","), "| เปลี่ยนใจ", changed, "| ล้างแค้น", revenge, "| NPC ลงมือเอง", npcActs, "| ความทรงจำ", memories);
    expect(chose).toBeGreaterThan(N * 0.85);
    expect(won).toBeGreaterThan(N * 0.12);
    expect(wonKinds.size).toBeGreaterThanOrEqual(4);
    expect(npcActs).toBeGreaterThan(N);
    expect(memories).toBeGreaterThan(N * 0.2);
  });
});
