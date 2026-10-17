import { describe, expect, it } from "vitest";
import { ACHIEVEMENTS } from "../content/achievements";
import { loadApocalypseWorld } from "../content/apocalypse";
import { loadCourtWorld } from "../content/court";
import { loadHunterWorld } from "../content/hunter";
import { CLASSES } from "../content/hunter/power";
import { loadMurimWorld } from "../content/murim";
import { loadOrdinaryWorld } from "../content/ordinary";
import { loadSharedEvents } from "../content/shared";
import { STORYLINES } from "../content/shared/chains";
import { loadTowerWorld } from "../content/tower";
import { ACTIVITIES, activityLocked, doActivity } from "./activities";
import { visibleChoices } from "./events";
import { ageUp, applyJob, createLife, resolveChoice } from "./game";
import { nextFloat } from "./rng";
import type { WorldId } from "./types";

loadHunterWorld();
loadMurimWorld();
loadCourtWorld();
loadTowerWorld();
loadApocalypseWorld();
loadOrdinaryWorld();
loadSharedEvents();

const QJ: Record<WorldId, string> = { hunter: "hunter", murim: "wanderer", court: "adventurer", tower: "climber", apocalypse: "survivor", ordinary: "store" };

describe("M22 คลาส ความสำเร็จ เควสต่อเนื่อง", () => {
  it("เส้นเรื่องเดินต่อหลายตอน คลาสใหม่ถูกเลือก และได้สายรอง", () => {
    const worlds: WorldId[] = ["hunter", "murim", "court", "tower", "apocalypse", "ordinary"];
    const started: Record<string, number> = {}, finished: Record<string, number> = {};
    const classes: Record<string, number> = {};
    let dual = 0, achLogged = 0;
    const N = 300;
    for (let s = 1; s <= N; s++) {
      const life = createLife({ seed: s * 92821, worldId: worlds[s % 6] });
      const r = { rng: s };
      while (life.alive && life.age < 120) {
        while (life.queue.length) {
          const o = visibleChoices(life, life.queue[0]);
          expect(o.length, `ไม่มีตัวเลือกใน ${life.queue[0].eventId}`).toBeGreaterThan(0);
          resolveChoice(life, o[Math.floor(nextFloat(r) * o.length)].index);
        }
        if (!life.alive) break;
        for (const a of ACTIVITIES) if (!a.id.startsWith("free_") && !activityLocked(life, a) && nextFloat(r) < 0.3) doActivity(life, a.id);
        if (life.power && life.job?.careerId !== QJ[life.worldId]) applyJob(life, QJ[life.worldId]);
        ageUp(life);
      }
      for (const st of STORYLINES) {
        if (st.started(life)) started[st.id] = (started[st.id] ?? 0) + 1;
        const step = Number(life.flags[`q_${st.id}`] ?? 0);
        if (step === 99 || step >= st.parts) finished[st.id] = (finished[st.id] ?? 0) + 1;
      }
      if (life.power) classes[life.power.hunterClass] = (classes[life.power.hunterClass] ?? 0) + 1;
      if (life.flags.subClass) dual++;
      achLogged += String(life.flags.achShown ?? "").split(",").filter(Boolean).length;
    }
    const newIds = ["archer", "crafter", "psychic", "berserker", "m_qin", "m_light", "m_staff", "m_poison", "c_alchemist", "c_shadow", "c_paladin", "c_wind", "t_shield", "t_puppet", "t_bard", "a_engineer", "a_hunter", "a_psyker"];
    const newPicked = newIds.filter((id) => classes[id]).length;
    const totalStarted = Object.values(started).reduce((a, b) => a + b, 0);
    const totalDone = Object.values(finished).reduce((a, b) => a + b, 0);
    console.log("SIM M22 ไม่ถูกเลือก", newIds.filter((id) => !classes[id]).join(","), "| ทั้งหมด", JSON.stringify(classes));
    console.log("SIM M22 คลาสทั้งหมด", CLASSES.length, "| คลาสใหม่ที่ถูกเลือก", newPicked, "/", newIds.length, "| สายรอง", dual, "| ความสำเร็จ", ACHIEVEMENTS.length, "แจ้งเฉลี่ย", (achLogged / N).toFixed(1));
    console.log("SIM M22 เส้นเรื่อง เริ่ม", totalStarted, "จบ", totalDone, "| ", JSON.stringify(finished));
    expect(newPicked).toBeGreaterThanOrEqual(12);
    expect(dual).toBeGreaterThan(5);
    expect(totalDone).toBeGreaterThan(totalStarted * 0.4);
    expect(ACHIEVEMENTS.length).toBeGreaterThanOrEqual(70);
  });
});
