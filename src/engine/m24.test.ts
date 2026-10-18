import { describe, expect, it } from "vitest";
import { loadApocalypseWorld } from "../content/apocalypse";
import { loadCourtWorld } from "../content/court";
import { loadHunterWorld } from "../content/hunter";
import { loadMurimWorld } from "../content/murim";
import { loadOrdinaryWorld } from "../content/ordinary";
import { PASSIVES, passivesOf } from "../content/passives";
import { loadSharedEvents } from "../content/shared";
import { TALENTS, talentById } from "../content/talents";
import { loadTowerWorld } from "../content/tower";
import { ACTIVITIES, activityLocked, doActivity } from "./activities";
import { visibleChoices } from "./events";
import { ageUp, applyJob, createLife, resolveChoice } from "./game";
import { nextFloat } from "./rng";
import type { Rarity, WorldId } from "./types";

loadHunterWorld();
loadMurimWorld();
loadCourtWorld();
loadTowerWorld();
loadApocalypseWorld();
loadOrdinaryWorld();
loadSharedEvents();

const WORLDS: WorldId[] = ["hunter", "murim", "court", "tower", "apocalypse", "ordinary"];
const QJ: Record<WorldId, string> = { hunter: "hunter", murim: "wanderer", court: "adventurer", tower: "climber", apocalypse: "survivor", ordinary: "store" };

describe("M24 พรสวรรค์และสกิลติดตัว", () => {
  it("มีพรสวรรค์และสกิลติดตัวอย่างละ 100+ ไม่ซ้ำ และคำอธิบายครบ", () => {
    expect(TALENTS.length).toBeGreaterThanOrEqual(110);
    expect(PASSIVES.length).toBeGreaterThanOrEqual(116);
    expect(new Set(TALENTS.map((t) => t.id)).size).toBe(TALENTS.length);
    expect(new Set(PASSIVES.map((p) => p.id)).size).toBe(PASSIVES.length);
    for (const t of TALENTS) expect(t.desc.length, t.id).toBeGreaterThan(5);
    for (const p of PASSIVES) expect(p.desc.length, p.id).toBeGreaterThan(3);
  });

  it("สุ่มเกิด: ทุกพรสวรรค์มีโอกาสได้ และ 'หนึ่งเดียวในโลก' ยากที่สุดแต่ไม่ใช่ศูนย์", () => {
    const N = 30_000;
    const got: Record<string, number> = {};
    const byRarity: Record<Rarity, number> = { common: 0, rare: 0, legendary: 0, divine: 0, mythic: 0 };
    let mythicLives = 0;
    for (let s = 1; s <= N; s++) {
      const l = createLife({ seed: s * 2246822519, worldId: WORLDS[s % 6] });
      let m = false;
      for (const t of l.talents) {
        got[t.id] = (got[t.id] ?? 0) + 1;
        const r = talentById(t.id)!.rarity;
        byRarity[r]++;
        if (r === "mythic") m = true;
      }
      if (m) mythicLives++;
    }
    const missing = TALENTS.filter((t) => t.rarity !== "mythic" && !got[t.id]).map((t) => t.id);
    console.log("SIM M24 สุ่มเกิด", N, "ครั้ง | ตามระดับ", JSON.stringify(byRarity), "| ชีวิตที่ได้หนึ่งเดียวในโลก", mythicLives, `(1 ใน ${Math.round(N / Math.max(1, mythicLives))})`, "| ไม่เคยออก", missing.join(","));
    expect(missing).toEqual([]);
    expect(mythicLives).toBeGreaterThan(5);
    expect(mythicLives).toBeLessThan(N / 300);
    expect(byRarity.mythic).toBeLessThan(byRarity.divine);
  });

  it("สกิลติดตัวได้มาจากการเล่นจริงหลากหลาย", () => {
    const earned: Record<string, number> = {};
    let total = 0;
    const N = 180;
    for (let s = 1; s <= N; s++) {
      const life = createLife({ seed: s * 40503, worldId: WORLDS[s % 6] });
      const r = { rng: s * 17 };
      let guard = 0;
      while (life.alive && guard++ < 600) {
        while (life.queue.length) {
          const o = visibleChoices(life, life.queue[0]);
          resolveChoice(life, o[Math.floor(nextFloat(r) * o.length)].index);
        }
        if (!life.alive) break;
        for (const a of ACTIVITIES) if (!activityLocked(life, a) && nextFloat(r) < 0.35) doActivity(life, a.id);
        if (life.power && life.job?.careerId !== QJ[life.worldId]) applyJob(life, QJ[life.worldId]);
        ageUp(life);
      }
      for (const p of passivesOf(life)) earned[p.id] = (earned[p.id] ?? 0) + 1;
      total += passivesOf(life).length;
    }
    console.log("SIM M24 ได้บ่อย", JSON.stringify(Object.entries(earned).sort((a, b) => b[1] - a[1]).map(([k, v]) => k + ":" + v)));
    const kinds = Object.keys(earned).length;
    const never = PASSIVES.filter((p) => !earned[p.id]).map((p) => p.id);
    console.log("SIM M24 สกิลติดตัวต่อชีวิตเฉลี่ย", (total / N).toFixed(1), "| ได้ต่างกัน", kinds, "/", PASSIVES.length, "| ไม่มีใครได้", never.join(","));
    expect(kinds).toBeGreaterThan(PASSIVES.length * 0.7);
  });
});
