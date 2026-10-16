import { describe, expect, it } from "vitest";
import { loadApocalypseWorld } from "../content/apocalypse";
import { loadOrdinaryWorld } from "../content/ordinary";
import { LAST_SCENARIO, scenarioNo } from "../content/apocalypse/scenario";
import { loadCourtWorld } from "../content/court";
import { loadHunterWorld } from "../content/hunter";
import { canEnterGate, enterGate } from "../content/hunter/events/gates";
import { loadMurimWorld } from "../content/murim";
import { loadSharedEvents } from "../content/shared";
import { loadTowerWorld } from "../content/tower";
import { getEvent, visibleChoices } from "./events";
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

describe("M11 วันสิ้นโลก", () => {
  it("โลกพังตามอายุที่กำหนด ทุกคนได้ระบบ ฉากหลักเดินจนจบได้ และชีวิตหลังโลกฟื้น", () => {
    let doomed = 0, diedAtDoom = 0, heroes = 0, rebuilt = 0, modernInRuins = 0, maxMain = 0;
    const mains: number[] = [];
    const causes: Record<string, number> = {};
    const N = 250;
    for (let s = 1; s <= N; s++) {
      const life: Life = createLife({ seed: s * 40503, worldId: "apocalypse" });
      const r = { rng: s };
      let doomDeath = false;
      while (life.alive && life.age < 120) {
        while (life.queue.length) {
          const id = life.queue[0].eventId;
          if (life.flags.doomed && !life.flags.rebuilt && getEvent(id)?.world === "modern") modernInRuins++;
          const o = visibleChoices(life, life.queue[0]);
          expect(o.length, `ไม่มีตัวเลือกใน ${id}`).toBeGreaterThan(0);
          resolveChoice(life, o[Math.floor(nextFloat(r) * o.length)].index);
          if (id === "apoc.doom" && !life.alive) { diedAtDoom++; doomDeath = true; }
        }
        if (!life.alive) break;
        if (life.power && life.job?.careerId !== "survivor") applyJob(life, "survivor");
        if (life.power && !life.flags.rebuilt) {
          for (let k = 0; k < 2 && life.alive; k++) {
            if (canEnterGate(life, life.power.rank)) break;
            enterGate(life, life.power.rank);
            while (life.queue.length) {
              const o = visibleChoices(life, life.queue[0]);
              resolveChoice(life, o[Math.floor(nextFloat(r) * o.length)].index);
            }
          }
        }
        if (!life.alive) break;
        ageUp(life);
      }
      expect(life.alive).toBe(false);
      if (life.flags.doomed) {
        doomed++;
        if (!doomDeath) expect(life.power, "หลังวันสิ้นโลกทุกคนต้องมีระบบ").toBeDefined();
        mains.push(scenarioNo(life));
      }
      maxMain = Math.max(maxMain, scenarioNo(life));
      if (life.flags.doomed) causes[(life.causeOfDeath ?? "").replace(/d+/g, "N").slice(0, 40)] = (causes[(life.causeOfDeath ?? "").replace(/d+/g, "N").slice(0, 40)] ?? 0) + 1;
      if (life.flags.apocHero) heroes++;
      if (life.flags.rebuilt) rebuilt++;
    }
    mains.sort((a, b) => a - b);
    console.log("SIM M11 สาเหตุ", JSON.stringify(Object.entries(causes).sort((a, b) => b[1] - a[1]).slice(0, 10)));
    console.log("SIM M11 ถึงวันสิ้นโลก", doomed, "/", N, "| ตายคืนแรก", diedAtDoom, "| ฉากหลัก p50", mains[mains.length >> 1], "| โลกฟื้น", rebuilt, "| ฮีโร่ฉากสุดท้าย", heroes);
    expect(doomed).toBeGreaterThan(N * 0.7);
    expect(maxMain).toBe(LAST_SCENARIO);
    expect(rebuilt).toBeGreaterThan(5);
    expect(modernInRuins).toBe(0);
  });
});
