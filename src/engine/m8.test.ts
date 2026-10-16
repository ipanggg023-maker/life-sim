import { describe, expect, it } from "vitest";
import { loadCourtWorld } from "../content/court";
import { loadHunterWorld } from "../content/hunter";
import { loadMurimWorld } from "../content/murim";
import { loadSharedEvents } from "../content/shared";
import { FOCUSES } from "../content/shared/focus";
import { titlesOf } from "../content/titles";
import { visibleChoices } from "./events";
import { ageUp, applyJob, createLife, resolveChoice } from "./game";
import { nextFloat } from "./rng";
import type { WorldId } from "./types";

loadHunterWorld();
loadMurimWorld();
loadCourtWorld();
loadSharedEvents();

const QUEST_JOB: Record<WorldId, string> = { hunter: "hunter", murim: "wanderer", court: "adventurer" };

describe("M8 เล่นเพลิน", () => {
  it("Focus ทำงานทุกปี, มีเพื่อนร่วมทีม และได้ฉายา โดยไม่พัง", () => {
    const worlds: WorldId[] = ["hunter", "murim", "court"];
    let withAllies = 0;
    let withTitles = 0;
    let powered = 0;
    for (let s = 1; s <= 150; s++) {
      const life = createLife({ seed: s * 104723, worldId: worlds[s % 3] });
      const r = { rng: s };
      let maxAllies = 0;
      while (life.alive && life.age < 120) {
        while (life.queue.length) {
          const o = visibleChoices(life, life.queue[0]);
          expect(o.length, `ไม่มีตัวเลือกใน ${life.queue[0].eventId}`).toBeGreaterThan(0);
          resolveChoice(life, o[Math.floor(nextFloat(r) * o.length)].index);
        }
        if (!life.alive) break;
        // เปลี่ยน Focus ทุก 5 ปี
        if (life.age % 5 === 0) life.flags.focus = FOCUSES[Math.floor(nextFloat(r) * FOCUSES.length)].id;
        if (life.power && life.job?.careerId !== QUEST_JOB[life.worldId]) applyJob(life, QUEST_JOB[life.worldId]);
        maxAllies = Math.max(maxAllies, life.people.filter((p) => p.relation === "ally" && p.alive).length);
        ageUp(life);
      }
      if (life.power) powered++;
      if (maxAllies > 0) withAllies++;
      if (titlesOf(life).length) withTitles++;
      expect(life.alive).toBe(false);
    }
    console.log("SIM M8 มีพลัง", powered, "| เคยมีเพื่อนร่วมทีม", withAllies, "| ได้ฉายา", withTitles);
    expect(withAllies).toBeGreaterThan(20);
    expect(withTitles).toBeGreaterThan(20);
  }, 120_000);
});
