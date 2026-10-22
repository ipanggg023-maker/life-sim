import { describe, expect, it } from "vitest";
import { loadMurimWorld } from "../content/murim";
import { loadSharedEvents } from "../content/shared";
import { GOALS, addSideGoal, mainGoal, setGoal, sideGoals, tickGoals } from "../content/murim/life/goals";
import { foundSect, saveSect, mySect } from "../content/murim/m17core";
import { worldOfLife } from "../content/murim/life/world";
import { getEvent, visibleChoices } from "./events";
import { ageUp, createLife, resolveChoice, runEvent } from "./game";
import { profileOf, wouldBetray } from "./npc";
import { nextFloat } from "./rng";
import type { Life } from "./types";
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
const adult = (seed: number) => { const l = createLife({ seed, worldId: "murim" }); l.age = 30; worldOfLife(l); return l; };
/** เดินเป้าหมายจนจบ (ปีละขั้น) */
const tickN = (l: Life, n: number) => { for (let i = 0; i < n; i++) { l.age++; tickGoals(l); } };

describe("Murim: เป้าหมายชีวิตครบตามแผน + NPC มีตัวตนเชิงลึก", () => {
  it("มีเป้าหมายครบ 15 แบบตามแผน และทุกแบบทำสำเร็จได้จริง", () => {
    for (const id of ["peak", "wealth", "family", "healer", "official", "wander", "quiet", "revenge", "sect", "birth", "oath", "atone", "teach", "leader", "ascend"]) expect(GOALS.some((g) => g.id === id), id).toBe(true);
    // สำนัก
    const a = adult(1); a.money = 5_000_000; a.power = { rank: 5, hunterClass: "m_sword", level: 30, exp: 0, skills: [], gates: 0, bossKills: 0, awakenedAt: 12, items: [] };
    setGoal(a, "sect"); foundSect(a, "สำนักทดสอบ"); const s = mySect(a)!; s.d = 40; saveSect(a, s); tickN(a, 4);
    expect(a.flags.goalWon_sect).toBe(true);
    // ชาติกำเนิด
    const b = adult(2); setGoal(b, "birth"); b.flags.birthClue1 = true; b.flags.birthClue2 = true; b.flags.birthTruth = true; tickN(b, 4);
    expect(b.flags.goalWon_birth).toBe(true);
    // คำสัตย์
    const c = adult(3); setGoal(c, "oath"); c.flags.oathKept = 2; tickN(c, 9);
    expect(c.flags.goalWon_oath).toBe(true);
    // ชดใช้บาป
    const d = adult(4); d.flags.m17Align = 40; setGoal(d, "atone"); tickN(d, 4);
    expect(d.flags.goalWon_atone).toBe(true);
    // ถ่ายทอดวิชา
    const e = adult(5); setGoal(e, "teach"); for (let i = 0; i < 3; i++) { const p = createPerson(e, "ally", { age: 16, bond: 60 }); p.tags = ["disciple", "art:a_long_fist"]; } tickN(e, 4);
    expect(e.flags.goalWon_teach).toBe(true);
    // ผู้นำ (สำนัก)
    const f = adult(6); f.fame = 60; f.money = 5_000_000; f.power = { rank: 5, hunterClass: "m_sword", level: 30, exp: 0, skills: [], gates: 0, bossKills: 0, awakenedAt: 12, items: [] }; f.flags.leaderPath = "sect"; setGoal(f, "leader"); foundSect(f, "สำนักผู้นำ"); tickN(f, 4);
    expect(f.flags.goalWon_leader).toBe(true);
    // เซียน
    const g = adult(7); g.power = { rank: 8, hunterClass: "m_sword", level: 60, exp: 0, skills: [], gates: 0, bossKills: 0, awakenedAt: 12, items: [] }; g.flags.ascended = true; setGoal(g, "ascend"); tickN(g, 4);
    expect(g.flags.goalWon_ascend).toBe(true);
  });

  it("เป้าหมายรองไม่เกิน 2 และเดินไปพร้อมเป้าหมายหลัก", () => {
    const l = adult(9);
    setGoal(l, "quiet");
    expect(addSideGoal(l, "wealth")).toBe(true);
    expect(addSideGoal(l, "family")).toBe(true);
    expect(addSideGoal(l, "wander")).toBe(false);
    expect(sideGoals(l).length).toBe(2);
    expect(mainGoal(l)?.id).toBe("quiet");
    l.money = 30_000_000;
    tickN(l, 4);
    expect(l.flags.goalWon_wealth).toBe(true);
    // ยกเป้าหมายรองขึ้นเป็นหลัก ไม่นับซ้ำ
    setGoal(l, "family");
    expect(mainGoal(l)?.id).toBe("family");
    expect((l.goals ?? []).filter((g) => g.id === "family").length).toBe(1);
  });

  it("สายค้นหาชาติกำเนิดเล่นจนจบได้", () => {
    for (let s = 1; s <= 20; s++) {
      const l = adult(100 + s);
      const r = { rng: s };
      setGoal(l, "birth");
      for (const id of ["goal.birth_clue1", "goal.birth_clue2", "goal.birth_truth"]) {
        for (let k = 0; k < 12 && getEvent(id)!.when!(l); k++) { runEvent(l, id, getEvent(id)!.prepare?.(l) ?? {}); drain(l, r); }
      }
      expect(l.flags.birthTruth, `seed ${s}`).toBe(true);
      expect(JSON.parse(JSON.stringify(l))).toEqual(l);
    }
  });

  it("NPC มีเป้าหมายรอง ความกลัว ค่านิยม เส้นที่ไม่ข้าม คงที่ และคนภักดีไม่ทรยศ", () => {
    const l = adult(11);
    let loyalBetray = 0, withSecret = 0;
    for (let i = 0; i < 60; i++) {
      const p = createPerson(l, "friend", { age: 30, bond: 50 });
      const a = JSON.stringify(profileOf(p));
      expect(JSON.stringify(profileOf(p))).toBe(a);
      const pr = profileOf(p);
      expect(pr.fear.length).toBeGreaterThan(0);
      expect(pr.values.length).toBe(2);
      if (pr.secret) withSecret++;
      if ((pr.values.includes("ความภักดี") || pr.limit === "ไม่ทรยศคนที่ไว้ใจตน") && wouldBetray(p)) loyalBetray++;
    }
    expect(loyalBetray).toBe(0);
    expect(withSecret).toBeGreaterThan(10);
  });

  it("ชีวิตสุ่ม 120 ชีวิตกับระบบใหม่ ไม่มีฉากตันและข้อมูลไม่พัง", () => {
    const seen: Record<string, number> = {};
    for (let s = 1; s <= 120; s++) {
      const l = createLife({ seed: s * 6211, worldId: "murim" });
      worldOfLife(l);
      const r = { rng: s * 5 };
      let g = 0;
      while (l.alive && g++ < 110) { drain(l, r); if (!l.alive) break; ageUp(l); }
      drain(l, r);
      for (const [k, v] of Object.entries(l.seen)) if (/^(goal\.|npc\.(confide|fear|side_goal|limit))/.test(k)) seen[k] = (seen[k] ?? 0) + v;
      expect(JSON.parse(JSON.stringify(l))).toEqual(l);
    }
    console.log("SIM goals/NPC", JSON.stringify(seen));
    expect(Object.keys(seen).length).toBeGreaterThan(6);
  });
});
