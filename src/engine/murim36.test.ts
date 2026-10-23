import { describe, expect, it } from "vitest";
import { loadMurimWorld } from "../content/murim";
import { loadSharedEvents } from "../content/shared";
import { ACHIEVEMENTS, catInWorld, newAchievements } from "../content/achievements";
import { DREAMS, GOALS, mainGoal, setGoal, tickGoals } from "../content/murim/life/goals";
import { worldOfLife } from "../content/murim/life/world";
import { courtOf } from "../content/murim/world/court";
import { syncThrone } from "../content/murim/world/emperor";
import { activitiesFor } from "./activities";
import { getEvent, visibleChoices } from "./events";
import { ageUp, createLife, resolveChoice, runEvent } from "./game";
import { nextFloat } from "./rng";
import { newSoul } from "./soul";
import type { Life } from "./types";
import { createPerson } from "./util";

loadMurimWorld();
loadSharedEvents();

const adult = (seed: number) => { const l = createLife({ seed, worldId: "murim" }); l.age = 30; worldOfLife(l); l.queue = []; return l; };
const tickN = (l: Life, n: number) => { for (let i = 0; i < n; i++) { l.age++; tickGoals(l); } };
const power = (rank: number) => ({ rank, hunterClass: "m_sword", level: 30, exp: 0, skills: [], gates: 0, bossKills: 0, awakenedAt: 12, items: [] });
const labelOf = (l: Life, i: number) => { const ch = visibleChoices(l, l.queue[0]).find((o) => o.index === i)?.c; const lb = ch?.label; return typeof lb === "function" ? lb(l, l.queue[0].ctx) : lb ?? ""; };

describe("เป้าหมายชีวิตชุดใหม่ · ตั้งเป้าใหม่ได้หลังสำเร็จ · ความสำเร็จของยุทธภพ", () => {
  it("เป้าหมายใหม่ทุกข้อทำสำเร็จได้จริง", () => {
    const won = (id: string, setup: (l: Life) => void, years = 5) => { const l = adult(id.length * 7); setup(l); setGoal(l, id); tickN(l, years); setup(l); tickN(l, years); expect(l.flags[`goalWon_${id}`], id).toBe(true); };
    won("ranked", (l) => { l.flags.youngListed = true; l.flags.bestPlace = 8; });
    won("throne", (l) => { l.flags.palaceAccess = true; l.fame = 40; l.flags.emperorSelf = true; });
    won("arts", (l) => { l.mwArts = Array.from({ length: 10 }, (_, i) => ({ id: `x${i}`, m: 1 }) as never); });
    won("love", (l) => { const s = l.people.find((p) => p.relation === "spouse") ?? createPerson(l, "spouse", { age: 30, bond: 90 }); s.bond = 90; }, 12);
    won("fame", (l) => { l.fame = 75; });
    won("long", (l) => { l.age = Math.max(l.age, 91); l.stats.health = 60; });
    won("clan", (l) => { while (l.people.filter((p) => p.relation === "child").length < 3) createPerson(l, "child", { age: 20 }); l.money = 3_000_000; l.fame = 25; });
    won("hero", (l) => { l.flags.m17Align = 80; l.fame = 50; });
    won("demon", (l) => { l.flags.m17Align = -80; l.flags.mwKills = 6; l.power = power(6) as never; });
    won("trade", (l) => { l.job = { careerId: "smith", level: 4, performance: 50, years: 5 }; });
    won("gift", (l) => { l.power = power(2) as never; l.flags.taEvolved = 2; });
    won("champion", (l) => { l.flags.duelWins = 4; l.flags.tourneyChampion = true; });
    won("brothers", (l) => { for (let i = 0; i < 3; i++) createPerson(l, "friend", { age: 30, bond: 85 }); });
    // ทุกเป้าหมายมีปุ่มให้เลือกในฉากความฝัน
    for (const g of GOALS) if (g.id !== "revenge" && g.id !== "birth" && g.id !== "oath" && g.id !== "atone") expect(DREAMS.some((d) => d[0] === g.id), g.id).toBe(true);
  });

  it("ทำเป้าหมายสำเร็จแล้ว ปีถัดไปได้ตั้งเป้าใหม่ (ไม่ใช่ข้อเดิม) · ทบทวนแล้วเปลี่ยนเป้าได้", () => {
    const l = adult(3);
    l.fame = 80;
    setGoal(l, "fame");
    tickN(l, 4);
    expect(l.flags.goalWon_fame).toBe(true);
    expect(mainGoal(l)).toBeUndefined();
    const ev = getEvent("goal.choose")!;
    l.age++;
    expect(ev.when!(l)).toBe(true);
    runEvent(l, "goal.choose");
    const labels = visibleChoices(l, l.queue[0]).map((o) => labelOf(l, o.index));
    expect(labels.some((s) => s.includes("ชื่อของข้าขจร"))).toBe(false);
    expect(labels.length).toBeGreaterThan(6);
    resolveChoice(l, visibleChoices(l, l.queue[0]).find((o) => labelOf(l, o.index).includes("ร่ำรวย"))!.index);
    expect(mainGoal(l)?.id).toBe("wealth");
    // ทบทวนเป้าหมายจากกิจกรรม แล้วเปลี่ยนเป็นข้ออื่น
    expect(activitiesFor(l).some((a) => a.id === "mw_goal")).toBe(true);
    runEvent(l, "goal.review");
    expect(String(getEvent("goal.review")!.text instanceof Function ? (getEvent("goal.review")!.text as (l: Life) => string)(l) : "")).toContain("ร่ำรวย");
    resolveChoice(l, visibleChoices(l, l.queue[0]).find((o) => labelOf(l, o.index).includes("มีพี่น้องร่วมสาบาน"))!.index);
    expect(mainGoal(l)?.id).toBe("brothers");
    expect(l.goals!.find((g) => g.id === "wealth")!.end).toBe("changed");
  });

  it("ความสำเร็จของยุทธภพหลายหมวด · แจ้งระหว่างชีวิต · สิ่งที่เคยทำได้ยังนับตอนจบ", () => {
    const mu = ACHIEVEMENTS.filter((a) => catInWorld(a.cat, "murim"));
    expect(mu.length).toBeGreaterThanOrEqual(80);
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(ACHIEVEMENTS.length);
    const l = adult(9);
    courtOf(l);
    l.flags.emperorSelf = true;
    syncThrone(l);
    l.queue = [];
    // ฮ่องเต้ยังทบทวนเป้าหมายชีวิตได้
    expect(activitiesFor(l).some((a) => a.id === "mw_goal")).toBe(true);
    ageUp(l);
    expect(String(l.flags.achShown)).toContain("mu_emperor");
    expect(l.log.some((e) => e.text.includes("โอรสสวรรค์"))).toBe(true);
    // สละราชย์แล้ว ความสำเร็จยังนับ
    l.flags.emperorSelf = false;
    expect(newAchievements(l, newSoul()).some((a) => a.id === "mu_emperor")).toBe(true);
  });

  it("ผู้เล่นที่ตั้งใจ 40 ชีวิต (รับโอกาสของเป้าหมาย อยู่ถึงวัยชรา): ราวครึ่งหนึ่งทำเป้าหมายสำเร็จ และได้ตั้งเป้าใหม่ · ไม่ตัน", () => {
    const r = { rng: 77 };
    let multi = 0, won = 0;
    for (let s = 1; s <= 40; s++) {
      const l = createLife({ seed: 500 + s, worldId: "murim" });
      for (let y = 0; y < 70 && l.alive; y++) {
        l.stats.health = Math.max(l.stats.health, 60);
        ageUp(l);
        let g = 0;
        while (l.queue.length && g++ < 80) {
          const o = visibleChoices(l, l.queue[0]);
          expect(o.length, l.queue[0].eventId).toBeGreaterThan(0);
          const pickIdx = l.queue[0].eventId.startsWith("goal.c_") ? 0 : Math.floor(nextFloat(r) * o.length);
          resolveChoice(l, o[pickIdx].index);
        }
      }
      if ((l.goals ?? []).filter((g) => !g.side).length >= 2) multi++;
      if ((l.goals ?? []).some((g) => g.end === "won")) won++;
    }
    console.log("เป้าหมาย: ตั้งหลายครั้ง", multi, "/ 40 · สำเร็จอย่างน้อยหนึ่ง", won, "/ 40");
    expect(won).toBeGreaterThanOrEqual(15);
    expect(multi).toBeGreaterThan(15);
  });
});
