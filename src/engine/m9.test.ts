import { describe, expect, it } from "vitest";
import { loadCourtWorld } from "../content/court";
import { loadTowerWorld } from "../content/tower";
import { loadApocalypseWorld } from "../content/apocalypse";
import { loadOrdinaryWorld } from "../content/ordinary";
import { loadHunterWorld } from "../content/hunter";
import { loadMurimWorld } from "../content/murim";
import { loadSharedEvents } from "../content/shared";
import { titlesOf } from "../content/titles";
import { ACTIVITIES, activityLocked, doActivity } from "./activities";
import { visibleChoices } from "./events";
import { ageUp, applyJob, createLife, pastSelfOf, resolveChoice } from "./game";
import { nextFloat } from "./rng";
import type { Life, WorldId } from "./types";

loadHunterWorld();
loadMurimWorld();
loadCourtWorld();
loadTowerWorld();
loadApocalypseWorld();
loadOrdinaryWorld();
loadSharedEvents();

const QUEST_JOB: Record<WorldId, string> = { hunter: "hunter", murim: "wanderer", court: "adventurer", tower: "climber", apocalypse: "survivor", ordinary: "o_mma" };
const WORLDS: WorldId[] = ["hunter", "murim", "court", "tower"];

/** บอทเลือกสุ่ม แต่ชอบตัวเลือก "ใช้สกิล" ถ้ามี */
function play(life: Life, r: { rng: number }, onYear?: (l: Life) => void) {
  while (life.alive && life.age < 120) {
    while (life.queue.length) {
      const o = visibleChoices(life, life.queue[0]);
      expect(o.length, `ไม่มีตัวเลือกใน ${life.queue[0].eventId}`).toBeGreaterThan(0);
      const skill = o.filter(({ c }) => typeof c.label === "string" && c.label.includes("ใช้「"));
      const pool = skill.length && nextFloat(r) < 0.5 ? skill : o;
      resolveChoice(life, pool[Math.floor(nextFloat(r) * pool.length)].index);
    }
    if (!life.alive) break;
    if (life.power && life.job?.careerId !== QUEST_JOB[life.worldId]) applyJob(life, QUEST_JOB[life.worldId]);
    for (const a of ACTIVITIES) if (!activityLocked(life, a) && nextFloat(r) < 0.3) doActivity(life, a.id);
    onYear?.(life);
    ageUp(life);
  }
}

describe("M9 ปรับระบบ", () => {
  it("คู่ปรับ ภารกิจลับ สกิลใช้งาน ปาร์ตี้ และฉายา ทำงานโดยไม่พัง", () => {
    let nemesis = 0, clashes = 0, nemesisEnd = { friend: 0, enemy: 0, beaten: 0 };
    let questsDone = 0, questsTaken = 0, skillUsers = 0, allies = 0, titled = 0;
    const N = 180;
    for (let s = 1; s <= N; s++) {
      const life = createLife({ seed: s * 7919, worldId: WORLDS[s % 4] });
      const r = { rng: s };
      let hadAlly = false;
      play(life, r, (l) => {
        if (l.flags.sqId) questsTaken += l.flags.sqTaken === l.flags.sqDeadline ? 0 : 1;
        if (l.flags.sqId) l.flags.sqTaken = l.flags.sqDeadline;
        if (l.people.some((p) => p.relation === "ally" && p.alive)) hadAlly = true;
      });
      expect(life.alive).toBe(false);
      if (life.flags.nemesisId) nemesis++;
      clashes += life.seen["nemesis.clash"] ?? 0;
      if (life.flags.nemesisStage === "friend") nemesisEnd.friend++;
      if (life.flags.nemesisStage === "enemy") nemesisEnd.enemy++;
      if (life.flags.nemesisBeaten) nemesisEnd.beaten++;
      questsDone += Number(life.flags.sqDone ?? 0);
      if (Object.keys(life.power?.mastery ?? {}).length) skillUsers++;
      if (hadAlly) allies++;
      if (titlesOf(life).length) titled++;
    }
    console.log("SIM M9 มีคู่ปรับ", nemesis, "/", N, "| ปะทะรวม", clashes, "| ตอนจบคู่ปรับ", JSON.stringify(nemesisEnd));
    console.log("SIM M9 ภารกิจลับ รับ", questsTaken, "สำเร็จ", questsDone, "| ใช้สกิลในฉาก", skillUsers, "| มีเพื่อนร่วมทีม", allies, "| ได้ฉายา", titled);
    expect(nemesis).toBeGreaterThan(N * 0.6);
    expect(clashes).toBeGreaterThan(N);
    expect(questsDone).toBeGreaterThan(10);
    expect(skillUsers).toBeGreaterThan(N * 0.3);
  });

  it("วิญญาณข้ามโลก: ความทรงจำชาติก่อนกลับมาและได้วิชาจากต่างโลก", () => {
    let dreams = 0, crossSkill = 0, knowledge = 0;
    const N = 120;
    for (let s = 1; s <= N; s++) {
      const prev = createLife({ seed: s * 31337, worldId: WORLDS[s % 4] });
      play(prev, { rng: s });
      const world = WORLDS[(s + 1) % 4];
      const life = createLife({ seed: s * 7331, worldId: world, pastLife: pastSelfOf(prev) });
      expect(life.flags.pastWorld).toBe(prev.worldId);
      play(life, { rng: s + 99 });
      if (life.seen["past.dream"]) dreams++;
      if (life.seen["past.skill"]) crossSkill++;
      if (life.seen["past.knowledge"]) knowledge++;
    }
    console.log("SIM M9 ข้ามโลก ฝันถึงชาติก่อน", dreams, "/", N, "| วิชาต่างโลก", crossSkill, "| ใช้ความรู้ชาติก่อน", knowledge);
    expect(dreams).toBeGreaterThan(N * 0.7);
    expect(crossSkill).toBeGreaterThan(5);
  });

  it("เกิดในโลกเดิมไม่ติดความทรงจำข้ามโลก", () => {
    const prev = createLife({ seed: 42, worldId: "murim" });
    const life = createLife({ seed: 43, worldId: "murim", pastLife: pastSelfOf(prev) });
    expect(life.flags.pastWorld).toBeUndefined();
  });
});
