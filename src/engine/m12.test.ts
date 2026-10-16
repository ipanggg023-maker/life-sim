import { describe, expect, it } from "vitest";
import { loadApocalypseWorld } from "../content/apocalypse";
import { loadCourtWorld } from "../content/court";
import { loadHunterWorld } from "../content/hunter";
import { canEnterGate, dailyQuest, enterGate } from "../content/hunter/events/gates";
import { loadMurimWorld } from "../content/murim";
import { loadOrdinaryWorld } from "../content/ordinary";
import { loadSharedEvents } from "../content/shared";
import { loadTowerWorld } from "../content/tower";
import { visibleChoices } from "./events";
import { ageUp, applyJob, createLife, resolveChoice } from "./game";
import { nextFloat } from "./rng";
import type { Life } from "./types";

loadHunterWorld();
loadMurimWorld();
loadCourtWorld();
loadTowerWorld();
loadApocalypseWorld();
loadOrdinaryWorld();
loadSharedEvents();

const JOB: Record<string, string> = { o_fighter: "o_mma", o_idol: "o_trainee", o_doctor: "o_mma", o_gamer: "o_progamer", o_chef: "o_chef_job", o_chaebol: "o_heir" };

function drain(life: Life, r: { rng: number }) {
  while (life.queue.length) {
    const o = visibleChoices(life, life.queue[0]);
    expect(o.length, `ไม่มีตัวเลือกใน ${life.queue[0].eventId}`).toBeGreaterThan(0);
    resolveChoice(life, o[Math.floor(nextFloat(r) * o.length)].index);
  }
}

describe("M12 โลกธรรมดา + ระบบชีวิต", () => {
  it("มีแค่บางคนที่ได้ระบบ เส้นทางกระจาย และแชโบลเปิดเฉพาะผู้ย้อนเวลา", () => {
    const paths: Record<string, number> = {};
    let withSystem = 0, famous = 0;
    const N = 250;
    for (let s = 1; s <= N; s++) {
      const life = createLife({ seed: s * 69069, worldId: "ordinary" });
      const r = { rng: s };
      while (life.alive && life.age < 120) {
        drain(life, r);
        if (!life.alive) break;
        const p = life.power;
        if (p && life.job?.careerId !== JOB[p.hunterClass]) applyJob(life, JOB[p.hunterClass]);
        if (p) {
          dailyQuest(life);
          for (let k = 0; k < 2 && life.alive; k++) {
            if (canEnterGate(life, p.rank)) break;
            enterGate(life, p.rank);
            drain(life, r);
          }
        }
        if (!life.alive) break;
        ageUp(life);
      }
      expect(life.alive).toBe(false);
      if (life.power) {
        withSystem++;
        paths[life.power.hunterClass] = (paths[life.power.hunterClass] ?? 0) + 1;
      }
      if (life.fame >= 50) famous++;
    }
    console.log("SIM M12 มีระบบ", withSystem, "/", N, "| เส้นทาง", JSON.stringify(paths), "| ดังมาก", famous);
    expect(withSystem).toBeGreaterThan(N * 0.7);
    expect(withSystem).toBeLessThan(N);
    expect(paths.o_chaebol ?? 0).toBe(0); // ไม่มีใครย้อนเวลาในการจำลองนี้
    expect(Object.keys(paths).length).toBeGreaterThanOrEqual(4);
  });
});
