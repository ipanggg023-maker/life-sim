import { describe, expect, it } from "vitest";
import { loadMurimWorld } from "../content/murim";
import { loadSharedEvents } from "../content/shared";
import { CAREERS, careerById } from "../content/hunter/careers";
import { combatPower } from "../content/hunter/power";
import { JOB_ACTIONS, doJobAction, jobActionLocked, jobActionsFor } from "../content/murim/life/jobActions";
import { visibleChoices } from "./events";
import { createLife, resolveChoice, salaryOf } from "./game";
import { nextFloat } from "./rng";
import type { Life } from "./types";

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

const adult = (seed: number, job: string): Life => {
  const l = createLife({ seed, worldId: "murim" });
  l.age = 30;
  l.money = 500_000;
  l.power = { rank: 2, hunterClass: "m_sword", level: 20, exp: 0, skills: [], gates: 0, bossKills: 0, awakenedAt: 12, items: [] };
  l.job = { careerId: job, level: 3, performance: 50, years: 5 };
  return l;
};

describe("งานเฉพาะอาชีพ (ยุทธภพ)", () => {
  it("ทุกอาชีพในยุทธภพมีงานของตัวเองอย่างน้อย 2 อย่าง และ id ไม่ซ้ำ", () => {
    const ids = JOB_ACTIONS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const c of CAREERS.filter((x) => x.world === "murim")) {
      const l = adult(1, c.id);
      expect(jobActionsFor(l).length, c.id).toBeGreaterThanOrEqual(2);
    }
  });

  it("ทุกงานทำได้จริงโดยไม่พัง (ปีละครั้ง)", () => {
    let runs = 0;
    for (const a of JOB_ACTIONS) for (const job of a.jobs) {
      for (let s = 1; s <= 6; s++) {
        const l = adult(s * 97 + job.length, job);
        const r = { rng: s };
        expect(jobActionLocked(l, a), `${a.id} (${job})`).toBeUndefined();
        doJobAction(l, a.id);
        drain(l, r);
        runs++;
        expect(Number.isFinite(l.money)).toBe(true);
        if (l.alive) expect(jobActionLocked(l, a)).toBe("ปีนี้ทำแล้ว");
        expect(JSON.parse(JSON.stringify(l))).toEqual(l);
      }
    }
    expect(runs).toBeGreaterThan(200);
  });

  it("อาวุธที่ตีเองเพิ่มพลังต่อสู้ และการขยายกิจการเพิ่มรายได้", () => {
    const l = adult(5, "smith");
    const before = combatPower(l);
    for (let y = 0; y < 8; y++) { l.doneThisYear = []; doJobAction(l, "smith_self"); }
    expect(Number(l.flags.mwWeaponTier ?? 0)).toBeGreaterThan(0);
    expect(combatPower(l)).toBeGreaterThan(before);
    const f = adult(6, "farmer");
    const pay0 = salaryOf(f, careerById("farmer")!, 3);
    doJobAction(f, "farm_land");
    expect(salaryOf(f, careerById("farmer")!, 3)).toBeGreaterThan(pay0);
  });
});
