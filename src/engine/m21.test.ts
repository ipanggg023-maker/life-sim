import { describe, expect, it } from "vitest";
import { loadApocalypseWorld } from "../content/apocalypse";
import { loadCourtWorld } from "../content/court";
import { loadHunterWorld } from "../content/hunter";
import { CAREERS } from "../content/hunter/careers";
import { loadMurimWorld } from "../content/murim";
import { loadOrdinaryWorld } from "../content/ordinary";
import { canChallenge, startChallenge } from "../content/ordinary/system";
import { allocate, sysDaily, trainSys } from "../content/ordinary/sys";
import { evoOf, openShop, startAppraise, sysDaily2 } from "../content/ordinary/m21sys";
import { SYS_STATS } from "../content/gameStats";
import { loadSharedEvents } from "../content/shared";
import { loadTowerWorld } from "../content/tower";
import { allEvents, visibleChoices } from "./events";
import { ageUp, applyJob, createLife, jobRequirementMissing, resolveChoice } from "./game";
import { nextFloat } from "./rng";
import type { Country, Life, WorldId } from "./types";

loadHunterWorld();
loadMurimWorld();
loadCourtWorld();
loadTowerWorld();
loadApocalypseWorld();
loadOrdinaryWorld();
loadSharedEvents();

function drain(life: Life, r: { rng: number }) {
  while (life.queue.length) {
    const o = visibleChoices(life, life.queue[0]);
    expect(o.length, `ไม่มีตัวเลือกใน ${life.queue[0].eventId}`).toBeGreaterThan(0);
    resolveChoice(life, o[Math.floor(nextFloat(r) * o.length)].index);
  }
}

describe("M21 โลกธรรมดา + เหตุการณ์ประเทศ", () => {
  it("มีเนื้อหาครบตามเป้า", () => {
    const ids = allEvents().map((e) => e.id);
    expect(ids.filter((id) => id.startsWith("o21.")).length).toBeGreaterThanOrEqual(150);
    for (const c of ["th", "kr", "jp"]) expect(ids.filter((id) => id.startsWith(`cty.${c}.`)).length).toBeGreaterThanOrEqual(30);
  });

  it("บอทใช้ระบบเต็มที่ 160 ชีวิต: ทุกฉากมีตัวเลือก ชีวิตจบ ระบบวิวัฒนาการได้", () => {
    const special = CAREERS.filter((c) => c.sys);
    const seen = new Set<string>();
    const jobs: Record<string, number> = {};
    let evo1 = 0, evo3 = 0, withSys = 0;
    const N = 160;
    for (let s = 1; s <= N; s++) {
      const life = createLife({ seed: s * 92821, worldId: "ordinary" });
      const r = { rng: s * 7 };
      const focus = SYS_STATS[s % 6];
      while (life.alive && life.age < 120) {
        drain(life, r);
        if (!life.alive) break;
        if (life.sys) {
          sysDaily(life);
          sysDaily2(life);
          trainSys(life, focus);
          trainSys(life, SYS_STATS[(s + life.age) % 6]);
          for (const k of [focus, ...SYS_STATS]) while (life.sys.points > 0 && life.sys[k] < 100) allocate(life, k);
          if (!life.job || life.job.careerId === "store") {
            const ok = special.filter((c) => !jobRequirementMissing(life, c));
            if (ok.length) applyJob(life, ok[Math.floor(nextFloat(r) * ok.length)].id);
            else if (life.age >= 18 && !life.job) applyJob(life, "store");
          }
          if (!canChallenge(life)) { startChallenge(life); drain(life, r); }
          if (!life.alive) break;
          openShop(life); drain(life, r);
          startAppraise(life); drain(life, r);
          if (!life.alive) break;
        }
        ageUp(life);
      }
      expect(life.alive).toBe(false);
      for (const id of Object.keys(life.seen)) seen.add(id);
      if (life.sys) withSys++;
      if (evoOf(life) >= 1) evo1++;
      if (evoOf(life) >= 3) evo3++;
      if (life.job) jobs[life.job.careerId] = (jobs[life.job.careerId] ?? 0) + 1;
    }
    const o21 = [...seen].filter((id) => id.startsWith("o21."));
    console.log("SIM M21 มีระบบ", withSys, "/", N, "| วิวัฒนาการ ≥1:", evo1, "| ครบ 3:", evo3, "| เห็น o21 ต่างกัน", o21.length, "| งาน", JSON.stringify(jobs));
    expect(evo1).toBeGreaterThan(withSys * 0.4);
    expect(o21.length).toBeGreaterThan(90);
    expect(seen.has("o21.shop")).toBe(true);
    expect(seen.has("o21.appraise")).toBe(true);
  });

  it("แต่ละประเทศเห็นเหตุการณ์ของตัวเองเท่านั้น", () => {
    const countries: Country[] = ["th", "kr", "jp"];
    const worlds: WorldId[] = ["hunter", "tower", "ordinary", "apocalypse"];
    for (const c of countries) {
      const own = new Set<string>();
      for (let s = 1; s <= 24; s++) {
        const life = createLife({ seed: s * 4099 + c.charCodeAt(0), worldId: worlds[s % 4], country: c, gender: s % 2 ? "m" : "f" });
        expect(life.country).toBe(c);
        const r = { rng: s };
        while (life.alive && life.age < 120) {
          drain(life, r);
          if (!life.alive) break;
          if (life.age >= 18 && !life.job) applyJob(life, "store");
          ageUp(life);
        }
        for (const id of Object.keys(life.seen)) {
          if (!id.startsWith("cty.")) continue;
          expect(id.startsWith(`cty.${c}.`), `${c} เห็น ${id}`).toBe(true);
          own.add(id);
        }
      }
      console.log(`SIM M21 ประเทศ ${c}: เห็นเหตุการณ์ประเทศ ${own.size} แบบ`);
      expect(own.size).toBeGreaterThan(15);
    }
    // ชีวิตเก่าที่ไม่มี country = ไทย
    const old = createLife({ seed: 1, worldId: "hunter" });
    delete old.country;
    const th = allEvents().filter((e) => e.id.startsWith("cty.th.") && e.when?.({ ...old, age: 30 }));
    expect(th.length).toBeGreaterThan(0);
  });
});
