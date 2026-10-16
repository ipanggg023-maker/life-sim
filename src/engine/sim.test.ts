import { describe, expect, it } from "vitest";
import { worldMatches } from "../content/worlds";
import { loadHunterWorld } from "../content/hunter";
import { CAREERS } from "../content/hunter/careers";
import { canEnterGate, enterGate, train } from "../content/hunter/events/gates";
import { rankLabel, rankName } from "../content/hunter/power";
import { loadMurimWorld } from "../content/murim";
import { loadCourtWorld } from "../content/court";
import { loadTowerWorld } from "../content/tower";
import { loadApocalypseWorld } from "../content/apocalypse";
import { loadOrdinaryWorld } from "../content/ordinary";
import { loadSharedEvents } from "../content/shared";
import { ACTIVITIES, activityLocked, doActivity } from "./activities";
import { visibleChoices } from "./events";
import { ageUp, applyJob, createLife, resolveChoice } from "./game";
import { nextFloat } from "./rng";
import type { Life, WorldId } from "./types";

loadHunterWorld();
loadMurimWorld();
loadCourtWorld();
loadTowerWorld();
loadApocalypseWorld();
loadOrdinaryWorld();
loadSharedEvents();

function drain(life: Life, r: { rng: number }) {
  let guard = 0;
  while (life.queue.length && guard++ < 50) {
    const opts = visibleChoices(life, life.queue[0]);
    expect(opts.length, `ไม่มีตัวเลือกใน ${life.queue[0].eventId}/${life.queue[0].scene ?? "start"}`).toBeGreaterThan(0);
    resolveChoice(life, opts[Math.floor(nextFloat(r) * opts.length)].index);
  }
}

function playLife(seed: number, opts: { hunterBot?: boolean; world?: WorldId } = {}): Life {
  const life = createLife({ seed, worldId: opts.world });
  const r = { rng: seed ^ 0x5bd1e995 };
  let guard = 0;
  while (life.alive && guard++ < 200) {
    drain(life, r);
    if (!life.alive) break;
    for (const a of ACTIVITIES) if (!activityLocked(life, a) && nextFloat(r) < 0.3) doActivity(life, a.id);
    const questJob = { hunter: "hunter", murim: "wanderer", court: "adventurer", tower: "climber", apocalypse: "survivor", ordinary: "o_mma" }[life.worldId];
    if (life.power && opts.hunterBot && !["hunter", "disciple", "wanderer", "knight", "court_mage", "adventurer"].includes(life.job?.careerId ?? "")) applyJob(life, questJob);
    const careers = CAREERS.filter((c) => worldMatches(c.world, life.worldId));
    if (!life.job && life.age >= 16) applyJob(life, careers[Math.floor(nextFloat(r) * careers.length)].id);
    if (opts.hunterBot && life.power) train(life);
    if (opts.hunterBot) {
      for (let i = 0; i < 3 && life.alive; i++) {
        const gr = Math.max(0, (life.power?.rank ?? 0) - (nextFloat(r) < 0.7 ? 1 : 0));
        if (canEnterGate(life, gr)) break;
        enterGate(life, gr);
        drain(life, r);
      }
    }
    if (life.alive) ageUp(life);
  }
  return life;
}

describe("จำลองชีวิต", () => {
  it("เล่นจนจบได้ 300 ชีวิตโดยไม่พัง และอายุเฉลี่ยสมเหตุสมผล", () => {
    const ages: number[] = [];
    const worth: number[] = [];
    let degrees = 0;
    let awakened = 0;
    for (let s = 1; s <= 300; s++) {
      const life = playLife(s * 7919);
      worth.push(life.money - life.debt);
      if (life.education.degree) degrees++;
      if (life.power) awakened++;
      expect(life.alive).toBe(false);
      for (const v of Object.values(life.stats)) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(100);
      }
      expect(JSON.parse(JSON.stringify(life))).toEqual(life);
      ages.push(life.age);
    }
    const avg = ages.reduce((a, b) => a + b, 0) / ages.length;
    worth.sort((a, b) => a - b);
    console.log(
      "SIM อายุเฉลี่ย", avg.toFixed(1), "| ทรัพย์สินมัธยฐาน", worth[150], "| จบปริญญา", degrees, "/300", "| ตื่นพลัง", awakened, "/300",
    );
    expect(avg).toBeGreaterThan(55);
    expect(avg).toBeLessThan(95);
  });

  it("บอท Hunter บุก Gate ทุกปีได้โดยไม่พัง", () => {
    const ranks: Record<string, number> = {};
    const hunterAges: number[] = [];
    const levels: number[] = [];
    let gateDeaths = 0;
    let hunters = 0;
    for (let s = 1; s <= 300; s++) {
      const life = playLife(s * 104729, { hunterBot: true });
      if (!life.power) continue;
      hunters++;
      const k = rankName(life.power.rank);
      ranks[k] = (ranks[k] ?? 0) + 1;
      hunterAges.push(life.age);
      levels.push(life.power.level);
      if (/Gate|ดันเจี้ยน|Red Gate/.test(life.causeOfDeath ?? "")) gateDeaths++;
    }
    const avg = hunterAges.reduce((a, b) => a + b, 0) / Math.max(1, hunterAges.length);
    console.log("SIM Hunter", hunters, "คน | อายุเฉลี่ย", avg.toFixed(1), "| ตายใน Gate", gateDeaths, "| แรงก์ตอนจบ", JSON.stringify(ranks), "| เลเวลมัธยฐาน", levels.sort((a, b) => a - b)[levels.length >> 1]);
    expect(hunters).toBeGreaterThan(100);
  });

  it("ยุทธภพ: บอทจอมยุทธ์เล่นจนจบได้ 300 ชีวิต", () => {
    const ranks: Record<string, number> = {};
    const ages: number[] = [];
    let cultivators = 0;
    let sect = 0;
    const causes: Record<string, number> = {};
    for (let s = 1; s <= 300; s++) {
      const life = playLife(s * 15485863, { hunterBot: true, world: "murim" });
      expect(life.alive).toBe(false);
      expect(life.worldId).toBe("murim");
      ages.push(life.age);
      const cause = (life.causeOfDeath ?? "").replace(/ระดับ.*$/, "");
      causes[cause] = (causes[cause] ?? 0) + 1;
      if (!life.power) continue;
      cultivators++;
      if (life.power.guild) sect++;
      const k = rankLabel(life, life.power.rank);
      ranks[k] = (ranks[k] ?? 0) + 1;
    }
    const avg = ages.reduce((a, b) => a + b, 0) / ages.length;
    console.log("SIM ยุทธภพ อายุเฉลี่ย", avg.toFixed(1), "| ผู้ฝึกยุทธ์", cultivators, "| มีสำนัก", sect, "| ขั้นตอนจบ", JSON.stringify(ranks));
    console.log("SIM ยุทธภพ สาเหตุการตาย", JSON.stringify(Object.entries(causes).sort((a, b) => b[1] - a[1]).slice(0, 8)));
    expect(cultivators).toBeGreaterThan(100);
  });

  it("ราชสำนัก: เล่นจนจบได้ 300 ชีวิต และ Death Flag ทำงาน", () => {
    const roles: Record<string, number> = {};
    const ages: number[] = [];
    let executed = 0;
    let defied = 0;
    let mages = 0;
    for (let s = 1; s <= 300; s++) {
      const life = playLife(s * 32452843, { hunterBot: true, world: "court" });
      expect(life.alive).toBe(false);
      expect(life.worldId).toBe("court");
      ages.push(life.age);
      const role = String(life.flags.role ?? "ตายก่อนรู้บท");
      roles[role] = (roles[role] ?? 0) + 1;
      if (/กิโยติน|ลานประหาร/.test(life.causeOfDeath ?? "")) executed++;
      if (life.flags.fateDefied) defied++;
      if (life.power) mages++;
    }
    const avg = ages.reduce((a, b) => a + b, 0) / ages.length;
    console.log("SIM ราชสำนัก อายุเฉลี่ย", avg.toFixed(1), "| บทบาท", JSON.stringify(roles), "| ถูกประหาร", executed, "| หักชะตา", defied, "| มีพลังเวท", mages);
    expect(executed + defied).toBeGreaterThan(0);
  });

  it("M6: อายุตื่นพลังกระจายหลายช่วง และชีวิตที่ยาวพอมีจุดพลิก", () => {
    const awakenAges: number[] = [];
    let sssAtAwaken = 0;
    let turned = 0;
    let reachedTp = 0;
    const tracks: Record<string, number> = {};
    const worlds: WorldId[] = ["hunter", "murim", "court"];
    for (let s = 1; s <= 600; s++) {
      const world = worlds[s % 3];
      const life = playLife(s * 49979687, { hunterBot: true, world });
      expect(life.alive).toBe(false);
      const t = String(life.flags.awakenTrack ?? "?");
      tracks[t] = (tracks[t] ?? 0) + 1;
      if (life.power) awakenAges.push(life.power.awakenedAt);
      if (life.flags.sssAwakened) sssAtAwaken++;
      if (life.age > Number(life.flags.tpAge ?? 99)) {
        reachedTp++;
        if (life.flags.turnDone) turned++;
      }
    }
    awakenAges.sort((a, b) => a - b);
    const pct = (p: number) => awakenAges[Math.floor(awakenAges.length * p)];
    console.log(
      "SIM M6 เส้นทาง", JSON.stringify(tracks), "| อายุตื่น p5/p50/p95", pct(0.05), pct(0.5), pct(0.95),
      "| SSS", sssAtAwaken, "| ถึงอายุจุดพลิก", reachedTp, "มีจุดพลิก", turned,
    );
    expect(turned).toBe(reachedTp);
    expect(pct(0.05)).toBeLessThan(12);
    expect(pct(0.95)).toBeGreaterThan(20);
  }, 120_000);

  it("seed เดียวกันได้ชีวิตเหมือนกัน (จำเป็นสำหรับการย้อนเวลา)", () => {
    const a = playLife(42, { hunterBot: true });
    const b = playLife(42, { hunterBot: true });
    expect(a.log).toEqual(b.log);
  });
});
