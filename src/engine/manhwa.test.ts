import { describe, expect, it } from "vitest";
import { loadCourtWorld } from "../content/court";
import { loadTowerWorld } from "../content/tower";
import { loadApocalypseWorld } from "../content/apocalypse";
import { loadOrdinaryWorld } from "../content/ordinary";
import { loadHunterWorld } from "../content/hunter";
import { canEnterGate, enterGate } from "../content/hunter/events/gates";
import { cliffhanger, seriesOf } from "../content/manhwa";
import { loadMurimWorld } from "../content/murim";
import { loadSharedEvents } from "../content/shared";
import { visibleChoices } from "./events";
import { ageUp, createLife, resolveChoice } from "./game";
import { nextFloat } from "./rng";
import type { Life, WorldId } from "./types";

loadHunterWorld();
loadMurimWorld();
loadCourtWorld();
loadTowerWorld();
loadApocalypseWorld();
loadOrdinaryWorld();
loadSharedEvents();

function play(seed: number, world: WorldId): Life {
  const life = createLife({ seed, worldId: world });
  const r = { rng: seed };
  while (life.alive && life.age < 120) {
    while (life.queue.length) {
      const o = visibleChoices(life, life.queue[0]);
      resolveChoice(life, o[Math.floor(nextFloat(r) * o.length)].index);
    }
    if (!life.alive) break;
    if (life.power && !canEnterGate(life, 0)) enterGate(life, 0);
    while (life.queue.length) {
      const o = visibleChoices(life, life.queue[0]);
      resolveChoice(life, o[Math.floor(nextFloat(r) * o.length)].index);
    }
    // ประโยคค้างคาต้องไม่แตะ RNG ของชีวิต
    const before = life.rng;
    cliffhanger(life);
    expect(life.rng).toBe(before);
    if (life.alive) ageUp(life);
  }
  return life;
}

describe("M7 อ่านเหมือนมังฮวา", () => {
  it("มีตอน ภาค คอมเมนต์ (ไม่ถี่เกิน) และชื่อเรื่องตอนจบ", () => {
    const worlds: WorldId[] = ["hunter", "murim", "court"];
    const titles = new Set<string>();
    let lives = 0;
    let chapters = 0;
    let commentBlocks = 0;
    let years = 0;
    for (let s = 1; s <= 150; s++) {
      const life = play(s * 7907, worlds[s % 3]);
      lives++;
      years += life.age;
      chapters += life.log.filter((e) => e.kind === "chapter").length;
      commentBlocks += life.log.filter((e) => e.kind === "comments").length;
      expect(life.log[0].kind).toBe("arc");
      const s1 = seriesOf(life);
      expect(s1.title.length).toBeGreaterThan(3);
      expect(s1.rating).toBeGreaterThanOrEqual(1);
      expect(s1.rating).toBeLessThanOrEqual(5);
      titles.add(s1.title);
    }
    console.log("SIM M7 ตอน/ชีวิต", (chapters / lives).toFixed(1), "| คอมเมนต์/ชีวิต", (commentBlocks / lives).toFixed(1), "| ปี/คอมเมนต์", (years / Math.max(1, commentBlocks)).toFixed(1), "| ชื่อเรื่องไม่ซ้ำ", titles.size);
    expect(chapters / lives).toBeGreaterThan(3);
    // คอมเมนต์เฉพาะฉากเด็ด ไม่ใช่ทุกปี
    expect(years / Math.max(1, commentBlocks)).toBeGreaterThan(4);
    expect(titles.size).toBeGreaterThan(8);
  }, 300_000);
});
