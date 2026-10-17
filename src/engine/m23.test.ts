import { describe, expect, it } from "vitest";
import { loadApocalypseWorld } from "../content/apocalypse";
import { loadCourtWorld } from "../content/court";
import { loadHunterWorld } from "../content/hunter";
import { loadMurimWorld } from "../content/murim";
import { loadOrdinaryWorld } from "../content/ordinary";
import { loadSharedEvents } from "../content/shared";
import { loadTowerWorld } from "../content/tower";
import { ACTIVITIES, activityLocked, doActivity } from "./activities";
import { getEvent, isStoryEvent, visibleChoices } from "./events";
import { ageUp, applyJob, createLife, resolveChoice } from "./game";
import { nextFloat } from "./rng";
import { applySoul, claimAward, newSoul } from "./soul";
import { foundThisLife } from "../content/shared/collection";
import type { Life, WorldId } from "./types";

loadHunterWorld();
loadMurimWorld();
loadCourtWorld();
loadTowerWorld();
loadApocalypseWorld();
loadOrdinaryWorld();
loadSharedEvents();

const QJ: Record<WorldId, string> = { hunter: "hunter", murim: "wanderer", court: "adventurer", tower: "climber", apocalypse: "survivor", ordinary: "store" };

function play(life: Life, seed: number) {
  const r = { rng: seed };
  while (life.alive && life.age < 110) {
    while (life.queue.length) {
      const o = visibleChoices(life, life.queue[0]);
      resolveChoice(life, o[Math.floor(nextFloat(r) * o.length)].index);
    }
    if (!life.alive) break;
    for (const a of ACTIVITIES) if (!activityLocked(life, a) && nextFloat(r) < 0.3) doActivity(life, a.id);
    if (life.power && life.job?.careerId !== QJ[life.worldId]) applyJob(life, QJ[life.worldId]);
    ageUp(life);
  }
}

const story = (l: Life) => Object.keys(l.seen).filter((id) => { const e = getEvent(id); return e && isStoryEvent(e); });

describe("M23 เรื่องไม่ซ้ำข้ามชาติ", () => {
  it("ชาติหลังๆ เจอเรื่องใหม่ แต่กลไกหลัก (ตื่นพลัง) ยังเกิดตามปกติ", () => {
    const worlds: WorldId[] = ["hunter", "murim", "court", "tower", "apocalypse", "ordinary"];
    const LIVES = 6, SOULS = 6;
    const repeat: number[] = Array(LIVES).fill(0), stories: number[] = Array(LIVES).fill(0), power: number[] = Array(LIVES).fill(0), age: number[] = Array(LIVES).fill(0);
    let n = 0, jail = 0, found = 0, enc = 0;
    for (const w of worlds) {
      for (let s = 1; s <= SOULS; s++) {
        const soul = newSoul();
        for (let k = 0; k < LIVES; k++) {
          const life = createLife({ seed: (s * 7919 + k * 104729) >>> 0, worldId: w });
          applySoul(life, soul, true);
          const past = new Set(soul.seenEver ?? []);
          play(life, s * 31 + k);
          const st = story(life);
          stories[k] += st.length;
          repeat[k] += st.filter((id) => past.has(id)).length;
          if (life.power || life.sys) power[k]++;
          age[k] += life.age;
          jail += Number(life.flags.jailCount ?? 0);
          found += foundThisLife(life).length;
          enc += Object.keys(life.seen).filter((id) => id.startsWith("free.x.")).length;
          claimAward(soul, life, false);
        }
        n++;
      }
    }
    const pct = (a: number, b: number) => `${Math.round((a / Math.max(1, b)) * 100)}%`;
    for (let k = 0; k < LIVES; k++) console.log(`SIM M23 ชาติที่ ${k + 1}: เรื่อง ${(stories[k] / n).toFixed(0)} · ซ้ำ ${pct(repeat[k], stories[k])} · มีพลัง ${pct(power[k], n)} · อายุเฉลี่ย ${(age[k] / n).toFixed(0)}`);
    console.log("SIM M23 ติดคุก", jail, "| ของสะสมที่เจอ", found, "| เรื่องระหว่างทาง", enc);
    expect(jail).toBeGreaterThan(0);
    expect(found).toBeGreaterThan(n);
    expect(enc).toBeGreaterThan(n);
    // ชาติที่ 2 ซ้ำกับชาติแรกน้อยมาก
    expect(repeat[1] / stories[1]).toBeLessThan(0.15);
    // ชาติหลังๆ ยังตื่นพลังได้ใกล้เคียงชาติแรก
    expect(power[LIVES - 1]).toBeGreaterThan(power[0] * 0.75);
  });
});
